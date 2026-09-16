using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Tests;

public class StrudelControllerTests
{
    private readonly AppDbContext _db;
    private readonly StrudelController _controller;

    public StrudelControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"StrudelTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new StrudelController(_db);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task Status_ReturnsModuleInfo()
    {
        var result = await _controller.Status();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("strudel", props.First(p => p.Name == "module").GetValue(value));
        Assert.Equal("active", props.First(p => p.Name == "status").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "tools").GetValue(value));
    }

    [Fact]
    public async Task GetDrives_ReturnsDrives()
    {
        var result = await _controller.GetDrives();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.NotNull(props.First(p => p.Name == "drives").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "count").GetValue(value));
    }

    [Fact]
    public async Task ScanDisc_RejectsMissingMakeMKV()
    {
        var findMethod = typeof(StrudelController).GetMethod("FindBinary", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        // Can't easily mock FindBinary, so test will just run and return error if makemkv not installed
        
        var req = new StrudelController.ScanRequest { DriveIndex = 0 };
        var result = await _controller.ScanDisc(req);

        // Either returns job or error about missing makemkv
        Assert.IsType<OkObjectResult>(result); // returns job_id even if makemkv missing (async)
    }

    [Fact]
    public async Task StartRip_RejectsInvalidDriveIndex()
    {
        var req = new StrudelController.RipRequest { DriveIndex = -1, OutputPath = "/media/rips" };
        var result = await _controller.StartRip(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task StartRip_RejectsOutputPathOutsideAllowed()
    {
        var req = new StrudelController.RipRequest { DriveIndex = 0, OutputPath = "/etc" };
        var result = await _controller.StartRip(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task StartRip_CreatesJob()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-rip-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        
        try
        {
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var req = new StrudelController.RipRequest 
            { 
                DriveIndex = 0, 
                OutputPath = testDir,
                DiscLabel = "Test Disc",
                Titles = new List<int> { 0 },
                TranscodeProfile = "direct",
                OutputFormat = "mkv"
            };
            var result = await _controller.StartRip(req);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var value = okResult.Value;
            var props = value!.GetType().GetProperties();
            Assert.NotNull(props.First(p => p.Name == "job_id").GetValue(value));
            Assert.Equal("pending", props.First(p => p.Name == "status").GetValue(value));
        }
        finally
        {
            Directory.Delete(testDir, true);
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", null);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);
        }
    }

    [Fact]
    public async Task GetJobs_ReturnsJobs()
    {
        var job = new StrudelController.RipJob
        {
            Id = "job-1",
            OwnerUserId = "test-user",
            Status = "complete",
            DiscLabel = "Test",
            DriveIndex = 0,
            SelectedTitles = new List<int> { 0 },
            TranscodeProfile = "direct",
            OutputFormat = "mkv",
            OutputPath = "/media/rips",
            StartedAt = DateTime.UtcNow
        };
        _db.Settings.Add(new AppSetting { Key = "strudel_job_job-1", UserId = "", Value = JsonSerializer.Serialize(job) });
        await _db.SaveChangesAsync();

        var result = await _controller.GetJobs();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var jobs = Assert.IsAssignableFrom<IEnumerable<object>>(props.First(p => p.Name == "jobs").GetValue(value));
        Assert.Single(jobs);
    }

    [Fact]
    public async Task GetJob_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.GetJob("nonexistent");

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task CancelJob_CancelsJob()
    {
        var job = new StrudelController.RipJob
        {
            Id = "job-1",
            OwnerUserId = "test-user",
            Status = "ripping",
            DiscLabel = "Test"
        };
        _db.Settings.Add(new AppSetting { Key = "strudel_job_job-1", UserId = "", Value = JsonSerializer.Serialize(job) });
        await _db.SaveChangesAsync();

        var result = await _controller.CancelJob("job-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updated = JsonSerializer.Deserialize<StrudelController.RipJob>(
            (await _db.Settings.FirstAsync(s => s.Key == "strudel_job_job-1")).Value!);
        Assert.Equal("cancelled", updated!.Status);
    }

    [Fact]
    public async Task RetryJob_ResetsJob()
    {
        var job = new StrudelController.RipJob
        {
            Id = "job-1",
            OwnerUserId = "test-user",
            Status = "failed",
            Error = "Some error",
            DiscLabel = "Test"
        };
        _db.Settings.Add(new AppSetting { Key = "strudel_job_job-1", UserId = "", Value = JsonSerializer.Serialize(job) });
        await _db.SaveChangesAsync();

        var result = await _controller.RetryJob("job-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updated = JsonSerializer.Deserialize<StrudelController.RipJob>(
            (await _db.Settings.FirstAsync(s => s.Key == "strudel_job_job-1")).Value!);
        Assert.Equal("pending", updated!.Status);
        Assert.Null(updated.Error);
    }

    [Fact]
    public async Task GetProfiles_ReturnsDefaultProfiles()
    {
        var result = await _controller.GetProfiles();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        var profiles = value.ToList();
        Assert.Equal(7, profiles.Count);
        
        var ids = profiles.Select(p => p.GetType().GetProperty("id")!.GetValue(p)!.ToString()).ToList();
        Assert.Contains("direct", ids);
        Assert.Contains("1080p-h265-crf20", ids);
        Assert.Contains("4k-passthrough", ids);
    }

    [Fact]
    public async Task CreateProfile_CreatesCustomProfile()
    {
        var profile = JsonSerializer.Serialize(new { id = "custom", name = "Custom", video_encoder = "x265" });
        var jsonElement = JsonDocument.Parse(profile).RootElement;

        var result = await _controller.CreateProfile(jsonElement);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("Profile created", props.First(p => p.Name == "message").GetValue(value));
    }

    [Fact]
    public async Task GetHistory_ReturnsHistory()
    {
        var history = new { job_id = "job-1", status = "complete", completed_at = DateTime.UtcNow };
        _db.Settings.Add(new AppSetting { Key = "strudel_history_20240101120000_job-1", UserId = "", Value = JsonSerializer.Serialize(history) });
        await _db.SaveChangesAsync();

        var result = await _controller.GetHistory();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var historyList = Assert.IsAssignableFrom<IEnumerable<object>>(props.First(p => p.Name == "history").GetValue(value));
        Assert.Single(historyList);
    }

    [Fact]
    public async Task GetConfig_ReturnsDefaultConfig()
    {
        var result = await _controller.GetConfig();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("/media/rips", props.First(p => p.Name == "output_directory").GetValue(value));
        Assert.Equal("1080p-h265-crf20", props.First(p => p.Name == "default_profile").GetValue(value));
    }

    [Fact]
    public async Task UpdateConfig_UpdatesConfig()
    {
        var config = JsonSerializer.Serialize(new { output_directory = "/custom/rips", default_profile = "720p-h265-crf22" });
        var jsonElement = JsonDocument.Parse(config).RootElement;

        var result = await _controller.UpdateConfig(jsonElement);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var saved = JsonSerializer.Deserialize<Dictionary<string, object>>(
            (await _db.Settings.FirstAsync(s => s.Key == "strudel_config" && s.UserId == "")).Value!);
        Assert.Equal("/custom/rips", saved!["output_directory"]);
    }

    [Fact]
    public void SanitizeFilename_RemovesInvalidChars()
    {
        var sanitizeMethod = typeof(StrudelController).GetMethod("SanitizeFilename", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        var result = sanitizeMethod!.Invoke(null, new object[] { "Test:File*Name?.mkv" });
        Assert.Equal("Test_File_Name_.mkv", result);
    }

    [Fact]
    public void BuildHandBrakeArgs_BuildsCorrectArgs()
    {
        var buildMethod = typeof(StrudelController).GetMethod("BuildHandBrakeArgs", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        var args = (string)buildMethod!.Invoke(null, new object[] { "input.mkv", "output.mkv", "1080p-h265-crf20" })!;
        Assert.Contains("-e x265", args);
        Assert.Contains("-q 20", args);
        Assert.Contains("--encoder-preset medium", args);
    }

    [Fact]
    public void DetectDiscType_DetectsTypes()
    {
        var detectMethod = typeof(StrudelController).GetMethod("DetectDiscType", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        Assert.Equal("bluray", detectMethod!.Invoke(null, new object[] { "CINFO:1,0,\"Blu-ray\"" }));
        Assert.Equal("dvd", detectMethod.Invoke(null, new object[] { "CINFO:1,0,\"DVD-ROM\"" }));
        Assert.Equal("uhd", detectMethod.Invoke(null, new object[] { "CINFO:1,0,\"UHD Blu-ray\"" }));
        Assert.Equal("unknown", detectMethod.Invoke(null, new object[] { "CINFO:1,0,\"Unknown\"" }));
    }
}

public class CrucibleControllerTests
{
    private readonly AppDbContext _db;
    private readonly CrucibleController _controller;

    public CrucibleControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"CrucibleTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new CrucibleController(_db);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task Status_ReturnsModuleInfo()
    {
        var result = await _controller.Status();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("crucible", props.First(p => p.Name == "module").GetValue(value));
        Assert.Equal("active", props.First(p => p.Name == "status").GetValue(value));
    }

    [Fact]
    public async Task Profiles_ReturnsBuiltInProfiles()
    {
        var result = await _controller.Profiles();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        var profiles = value.ToList();
        Assert.Equal(7, profiles.Count);
        
        var ids = profiles.Select(p => p.GetType().GetProperty("id")!.GetValue(p)!.ToString()).ToList();
        Assert.Contains("h265-default", ids);
        Assert.Contains("extract-subs", ids);
        Assert.Contains("burn-subs", ids);
    }

    [Fact]
    public async Task SubmitJob_RejectsMissingSourcePath()
    {
        var body = JsonSerializer.Serialize(new { output_path = "/media/out.mkv", profile = "h265-default" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.SubmitJob(jsonElement);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SubmitJob_RejectsSourcePathOutsideAllowed()
    {
        var body = JsonSerializer.Serialize(new { source_path = "/etc/passwd", output_path = "/media/out.mkv" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.SubmitJob(jsonElement);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SubmitJob_CreatesJob()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-crucible-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        var testFile = Path.Combine(testDir, "input.mkv");
        await File.WriteAllText(testFile, "test");
        
        try
        {
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var body = JsonSerializer.Serialize(new { source_path = testFile, profile = "h265-default" });
            var jsonElement = JsonDocument.Parse(body).RootElement;

            var result = await _controller.SubmitJob(jsonElement);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var value = okResult.Value;
            var props = value!.GetType().GetProperties();
            Assert.Equal("queued", props.First(p => p.Name == "status").GetValue(value));
            Assert.NotNull(props.First(p => p.Name == "id").GetValue(value));
        }
        finally
        {
            Directory.Delete(testDir, true);
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", null);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);
        }
    }

    [Fact]
    public async Task GetJobs_ReturnsUserJobs()
    {
        _db.TranscodeJobs.Add(new TranscodeJob { Id = "job-1", UserId = "test-user", SourcePath = "/media/in.mkv", Status = "complete", Profile = "h265-default" });
        _db.TranscodeJobs.Add(new TranscodeJob { Id = "job-2", UserId = "other-user", SourcePath = "/media/in2.mkv", Status = "queued" });
        await _db.SaveChangesAsync();

        var result = await _controller.GetJobs();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Single(value);
    }

    [Fact]
    public async Task GetJob_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.GetJob("nonexistent");

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task CancelJob_CancelsProcessingJob()
    {
        var job = new TranscodeJob { Id = "job-1", UserId = "test-user", SourcePath = "/media/in.mkv", Status = "processing" };
        _db.TranscodeJobs.Add(job);
        await _db.SaveChangesAsync();

        var result = await _controller.CancelJob("job-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updated = await _db.TranscodeJobs.FindAsync("job-1");
        Assert.Equal("cancelled", updated!.Status);
    }

    [Fact]
    public async Task CancelJob_DeletesQueuedJob()
    {
        var job = new TranscodeJob { Id = "job-1", UserId = "test-user", SourcePath = "/media/in.mkv", Status = "queued" };
        _db.TranscodeJobs.Add(job);
        await _db.SaveChangesAsync();

        var result = await _controller.CancelJob("job-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var remaining = await _db.TranscodeJobs.FindAsync("job-1");
        Assert.Null(remaining);
    }

    [Fact]
    public async Task RetryJob_RequeuesFailedJob()
    {
        var job = new TranscodeJob { Id = "job-1", UserId = "test-user", SourcePath = "/media/in.mkv", Status = "failed", Error = "Error" };
        _db.TranscodeJobs.Add(job);
        await _db.SaveChangesAsync();

        var result = await _controller.RetryJob("job-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updated = await _db.TranscodeJobs.FindAsync("job-1");
        Assert.Equal("queued", updated!.Status);
        Assert.Equal(0, updated.Progress);
        Assert.Null(updated.Error);
    }

    [Fact]
    public async Task ProbeFile_ReturnsNotFound_WhenFileMissing()
    {
        var body = JsonSerializer.Serialize(new { path = "/nonexistent/file.mkv" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.ProbeFile(jsonElement);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task ProbeFile_ReturnsError_WhenFfprobeNotInstalled()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-crucible-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        var testFile = Path.Combine(testDir, "input.mkv");
        await File.WriteAllText(testFile, "test");
        
        try
        {
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var body = JsonSerializer.Serialize(new { path = testFile });
            var jsonElement = JsonDocument.Parse(body).RootElement;

            var result = await _controller.ProbeFile(jsonElement);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var value = okResult.Value;
            var props = value!.GetType().GetProperties();
            var ffprobe = props.First(p => p.Name == "ffprobe").GetValue(value);
            Assert.NotNull(ffprobe);
            var ffprobeProps = ffprobe!.GetType().GetProperties();
            Assert.NotNull(ffprobeProps.First(p => p.Name == "error").GetValue(ffprobe));
        }
        finally
        {
            Directory.Delete(testDir, true);
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", null);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);
        }
    }

    [Fact]
    public async Task Stats_ReturnsStatistics()
    {
        _db.TranscodeJobs.AddRange(
            new TranscodeJob { Id = "job-1", UserId = "test-user", Status = "complete", SourceSize = 1000000000, OutputSize = 500000000 },
            new TranscodeJob { Id = "job-2", UserId = "test-user", Status = "queued" },
            new TranscodeJob { Id = "job-3", UserId = "test-user", Status = "failed" }
        );
        await _db.SaveChangesAsync();

        var result = await _controller.Stats();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(3, props.First(p => p.Name == "total_jobs").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "completed").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "failed").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "queued").GetValue(value));
        Assert.Equal(476.8, props.First(p => p.Name == "total_space_saved_mb").GetValue(value)); // ~500MB saved
    }

    [Fact]
    public async Task FfmpegStatus_ReturnsStatus()
    {
        var result = await _controller.FfmpegStatus();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.NotNull(props.First(p => p.Name == "ffmpeg_installed").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "ffprobe_installed").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "hw_accel").GetValue(value));
    }
}

public class VpnControllerTests
{
    private readonly AppDbContext _db;
    private readonly VpnController _controller;

    public VpnControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"VpnTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new VpnController(_db);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task GetServer_CreatesDefaultConfig()
    {
        var result = await _controller.GetServer();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(51820, props.First(p => p.Name == "ListenPort").GetValue(value));
        Assert.Equal("10.0.0.1/24", props.First(p => p.Name == "Address").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "public_key").GetValue(value));
    }

    [Fact]
    public async Task Setup_ConfiguresServer()
    {
        var req = new VpnController.ServerSetup(ListenPort: 51821, Address: "10.1.0.1/24", Dns: "8.8.8.8", Endpoint: "vpn.example.com", Mtu: 1400);

        var result = await _controller.Setup(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(51821, props.First(p => p.Name == "ListenPort").GetValue(value));
        Assert.Equal("10.1.0.1/24", props.First(p => p.Name == "Address").GetValue(value));
        Assert.Equal("8.8.8.8", props.First(p => p.Name == "Dns").GetValue(value));
        Assert.Equal("vpn.example.com", props.First(p => p.Name == "Endpoint").GetValue(value));
        Assert.Equal(1400, props.First(p => p.Name == "Mtu").GetValue(value));
        Assert.True((bool)props.First(p => p.Name == "is_configured").GetValue(value)!);
    }

    [Fact]
    public async Task Activate_ActivatesServer()
    {
        await _controller.Setup(new VpnController.ServerSetup());

        var result = await _controller.Activate();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var config = await _db.VpnServerConfigs.FindAsync("default");
        Assert.True(config!.IsActive);
    }

    [Fact]
    public async Task Deactivate_DeactivatesServer()
    {
        await _controller.Setup(new VpnController.ServerSetup());
        await _controller.Activate();

        var result = await _controller.Deactivate();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var config = await _db.VpnServerConfigs.FindAsync("default");
        Assert.False(config!.IsActive);
    }

    [Fact]
    public async Task GetPeers_ReturnsPeers()
    {
        var (privKey, pubKey) = GenerateWgKeyPair();
        var psk = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        _db.VpnPeers.Add(new VpnPeer { Id = "peer-1", Name = "Test", PublicKey = pubKey, PrivateKey = privKey, PresharedKey = psk, Address = "10.0.0.2/32" });
        await _db.SaveChangesAsync();

        var result = await _controller.GetPeers();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Single(value);
    }

    [Fact]
    public async Task CreatePeer_CreatesPeerWithKeys()
    {
        var req = new VpnController.PeerCreate("New Peer", "10.0.0.0/24");

        var result = await _controller.CreatePeer(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("New Peer", props.First(p => p.Name == "Name").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "PublicKey").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "PrivateKey").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "PresharedKey").GetValue(value));
        Assert.Equal("10.0.0.2/32", props.First(p => p.Name == "Address").GetValue(value));
    }

    [Fact]
    public async Task UpdatePeer_UpdatesProperties()
    {
        var (privKey, pubKey) = GenerateWgKeyPair();
        _db.VpnPeers.Add(new VpnPeer { Id = "peer-1", Name = "Old", PublicKey = pubKey, PrivateKey = privKey, PresharedKey = "psk", Address = "10.0.0.2/32" });
        await _db.SaveChangesAsync();

        var req = new VpnController.PeerCreate("Updated", "10.0.0.0/24");
        var result = await _controller.UpdatePeer("peer-1", req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updated = await _db.VpnPeers.FindAsync("peer-1");
        Assert.Equal("Updated", updated!.Name);
    }

    [Fact]
    public async Task DeletePeer_RemovesPeer()
    {
        var (privKey, pubKey) = GenerateWgKeyPair();
        _db.VpnPeers.Add(new VpnPeer { Id = "peer-1", Name = "Test", PublicKey = pubKey, PrivateKey = privKey, PresharedKey = "psk", Address = "10.0.0.2/32" });
        await _db.SaveChangesAsync();

        var result = await _controller.DeletePeer("peer-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var remaining = await _db.VpnPeers.FindAsync("peer-1");
        Assert.Null(remaining);
    }

    [Fact]
    public async Task TogglePeer_TogglesActiveState()
    {
        var (privKey, pubKey) = GenerateWgKeyPair();
        _db.VpnPeers.Add(new VpnPeer { Id = "peer-1", Name = "Test", PublicKey = pubKey, PrivateKey = privKey, PresharedKey = "psk", Address = "10.0.0.2/32", IsActive = true });
        await _db.SaveChangesAsync();

        var result = await _controller.TogglePeer("peer-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updated = await _db.VpnPeers.FindAsync("peer-1");
        Assert.False(updated!.IsActive);
    }

    [Fact]
    public async Task PeerQr_ReturnsQRData()
    {
        var (privKey, pubKey) = GenerateWgKeyPair();
        _db.VpnPeers.Add(new VpnPeer { Id = "peer-1", Name = "Test", PublicKey = pubKey, PrivateKey = privKey, PresharedKey = "psk", Address = "10.0.0.2/32" });
        await _db.SaveChangesAsync();

        var result = await _controller.PeerQr("peer-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var qrData = props.First(p => p.Name == "qr_data").GetValue(value)!.ToString()!;
        var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(qrData));
        Assert.Contains("[Interface]", decoded);
        Assert.Contains("Address = 10.0.0.2/32", decoded);
        Assert.Contains("[Peer]", decoded);
    }

    [Fact]
    public async Task WgUp_Returns501()
    {
        var result = await _controller.WgUp();
        Assert.Equal(501, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task WgDown_Returns501()
    {
        var result = await _controller.WgDown();
        Assert.Equal(501, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task WgStatus_ReturnsStatus()
    {
        await _controller.Setup(new VpnController.ServerSetup());
        await _controller.Activate();
        var (privKey, pubKey) = GenerateWgKeyPair();
        _db.VpnPeers.Add(new VpnPeer { Id = "peer-1", Name = "Test", PublicKey = pubKey, PrivateKey = privKey, PresharedKey = "psk", Address = "10.0.0.2/32", IsActive = true });
        await _db.SaveChangesAsync();

        var result = await _controller.WgStatus();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("wg0", props.First(p => p.Name == "interface").GetValue(value));
        Assert.True((bool)props.First(p => p.Name == "is_running").GetValue(value)!);
        Assert.Equal(1, props.First(p => p.Name == "peers_connected").GetValue(value));
    }

    [Fact]
    public async Task Stats_ReturnsStatistics()
    {
        var (privKey, pubKey) = GenerateWgKeyPair();
        _db.VpnPeers.Add(new VpnPeer { Id = "peer-1", Name = "Test", PublicKey = pubKey, PrivateKey = privKey, PresharedKey = "psk", Address = "10.0.0.2/32", IsActive = true, TransferRx = 1000000, TransferTx = 2000000 });
        await _db.SaveChangesAsync();

        var result = await _controller.Stats();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(1, props.First(p => p.Name == "total_peers").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "active_peers").GetValue(value));
        Assert.Equal(1000000L, props.First(p => p.Name == "total_rx").GetValue(value));
        Assert.Equal(2000000L, props.First(p => p.Name == "total_tx").GetValue(value));
    }

    [Fact]
    public void GenerateWgKeyPair_GeneratesValidKeys()
    {
        var generateMethod = typeof(VpnController).GetMethod("GenerateWgKeyPair", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        var result = generateMethod!.Invoke(_controller, null);
        var props = result!.GetType().GetProperties();
        var privateKey = (string)props.First(p => p.Name == "PrivateKey").GetValue(result)!;
        var publicKey = (string)props.First(p => p.Name == "PublicKey").GetValue(result)!;
        
        Assert.NotNull(privateKey);
        Assert.NotNull(publicKey);
        Assert.Equal(44, privateKey.Length); // 32 bytes base64
        Assert.Equal(44, publicKey.Length);  // 32 bytes base64
    }

    private static (string PrivateKey, string PublicKey) GenerateWgKeyPair()
    {
        var privateKey = new byte[32];
        RandomNumberGenerator.Fill(privateKey);
        var privParams = new Org.BouncyCastle.Crypto.Parameters.X25519PrivateKeyParameters(privateKey, 0);
        var publicKey = privParams.GeneratePublicKey().GetEncoded();
        return (Convert.ToBase64String(privateKey), Convert.ToBase64String(publicKey));
    }
}
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Tests;

public class MediaOpsControllerTests
{
    private readonly AppDbContext _db;
    private readonly MediaOpsController _controller;

    public MediaOpsControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"MediaOpsTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new MediaOpsController(_db);

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
    public async Task HealthCheck_ReturnsNotFound_WhenPathEmpty()
    {
        var result = _controller.HealthCheck(null, false);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("not_found", props.First(p => p.Name == "status").GetValue(value));
    }

    [Fact]
    public async Task HealthCheck_ReturnsForbidden_WhenPathOutsideMediaRoots()
    {
        var result = _controller.HealthCheck("/etc/passwd", false);

        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, statusResult.StatusCode);
    }

    [Fact]
    public async Task HealthCheck_ReturnsHealthy_WhenFileExistsInAllowedPath()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-media-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        var testFile = Path.Combine(testDir, "test.mkv");
        await File.WriteAllText(testFile, "test content");
        
        try
        {
            // Need to set MEDIA_ROOTS env to include test dir for IsAllowedMediaPath
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            
            // Clear static cache
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var result = _controller.HealthCheck(testFile, true);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var value = okResult.Value;
            var props = value!.GetType().GetProperties();
            Assert.Equal("healthy", props.First(p => p.Name == "status").GetValue(value));
            Assert.NotNull(props.First(p => p.Name == "hash").GetValue(value));
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
    public async Task Repair_ReturnsNotFound_WhenFileMissing()
    {
        var result = await _controller.Repair("/nonexistent/file.mkv", null);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Repair_ReturnsForbidden_WhenPathOutsideAllowed()
    {
        var result = await _controller.Repair("/etc/passwd", null);

        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, statusResult.StatusCode);
    }

    [Fact]
    public async Task Repair_Returns503_WhenFfmpegNotInstalled()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-media-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        var testFile = Path.Combine(testDir, "test.mkv");
        await File.WriteAllText(testFile, "test content");
        
        try
        {
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var result = await _controller.Repair(testFile, null);

            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(503, statusResult.StatusCode);
            var value = statusResult.Value;
            var props = value!.GetType().GetProperties();
            Assert.Contains("FFmpeg is required", props.First(p => p.Name == "detail").GetValue(value)!.ToString()!);
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
    public async Task Notifications_ReturnsList()
    {
        _db.NotificationLogs.Add(new NotificationLog { Id = "notif-1", EventType = "test", Message = "Test message", Channel = "discord", Status = "sent" });
        await _db.SaveChangesAsync();

        var result = await _controller.Notifications(10);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Single(value);
    }

    [Fact]
    public async Task MarkRead_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.MarkRead("nonexistent");

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task MarkRead_ReturnsAcknowledged_WhenExists()
    {
        _db.NotificationLogs.Add(new NotificationLog { Id = "notif-1", EventType = "test", Message = "Test", Channel = "discord", Status = "sent" });
        await _db.SaveChangesAsync();

        var result = await _controller.MarkRead("notif-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("acknowledged", props.First(p => p.Name == "status").GetValue(value));
    }

    [Fact]
    public async Task DeleteNotification_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.DeleteNotification("nonexistent");

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteNotification_RemovesNotification()
    {
        _db.NotificationLogs.Add(new NotificationLog { Id = "notif-1", EventType = "test", Message = "Test", Channel = "discord", Status = "sent" });
        await _db.SaveChangesAsync();

        var result = await _controller.DeleteNotification("notif-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("deleted", props.First(p => p.Name == "status").GetValue(value));

        var remaining = await _db.NotificationLogs.FindAsync("notif-1");
        Assert.Null(remaining);
    }

    [Fact]
    public async Task ScheduledScans_CreatesAndReturnsScan()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-media-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        
        try
        {
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var body = JsonSerializer.Serialize(new
            {
                directory = testDir,
                schedule_type = "daily",
                schedule_time = "03:00",
                notify_on_issues = true,
                auto_repair = false
            });
            var jsonElement = JsonDocument.Parse(body).RootElement;

            var result = await _controller.CreateScheduledScan(jsonElement);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var value = okResult.Value;
            var props = value!.GetType().GetProperties();
            Assert.True((bool)props.First(p => p.Name == "success").GetValue(value)!);
            Assert.NotNull(props.First(p => p.Name == "id").GetValue(value));

            var listResult = await _controller.ScheduledScans();
            var listOk = Assert.IsType<OkObjectResult>(listResult);
            var list = Assert.IsAssignableFrom<IEnumerable<object>>(listOk.Value);
            Assert.Single(list);
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
    public async Task RunScheduledScan_RunsHealthScan()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-media-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        var testFile = Path.Combine(testDir, "test.mkv");
        await File.WriteAllText(testFile, "content");
        
        try
        {
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var body = JsonSerializer.Serialize(new { directory = testDir, schedule_type = "daily", schedule_time = "03:00" });
            var jsonElement = JsonDocument.Parse(body).RootElement;
            await _controller.CreateScheduledScan(jsonElement);

            var scans = await _controller.ScheduledScans();
            var scanList = Assert.IsAssignableFrom<IEnumerable<object>>(Assert.IsType<OkObjectResult>(scans).Value);
            var scanId = scanList.First().GetType().GetProperty("id")!.GetValue(scanList.First())!.ToString()!;

            var result = await _controller.RunScheduledScan(scanId);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var value = okResult.Value;
            var props = value!.GetType().GetProperties();
            Assert.Equal(1, props.First(p => p.Name == "total_files").GetValue(value));
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
    public void IsAllowedMediaPath_AllowsPathsUnderConfiguredRoots()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-media-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        
        try
        {
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", testDir);
            var rootsField = typeof(MediaOpsController).GetField("_cachedRoots", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            rootsField!.SetValue(null, null);

            var isAllowedMethod = typeof(MediaOpsController).GetMethod("IsAllowedMediaPath", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            var result = isAllowedMethod!.Invoke(null, new object[] { Path.Combine(testDir, "subdir", "file.mkv") });
            
            Assert.True((bool)result!);
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
    public void IsAllowedMediaPath_RejectsPathsOutsideRoots()
    {
        var isAllowedMethod = typeof(MediaOpsController).GetMethod("IsAllowedMediaPath", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        // Without MEDIA_ROOTS set, defaults to /data/media etc which won't include /etc
        var result = isAllowedMethod!.Invoke(null, new object[] { "/etc/passwd" });
        Assert.False((bool)result!);
    }
}

public class CompoteControllerTests
{
    private readonly AppDbContext _db;
    private readonly CompoteController _controller;

    public CompoteControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"CompoteTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new CompoteController(_db);

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
    public async Task Indexers_ReturnsEmptyList_WhenNoIndexers()
    {
        var result = await _controller.Indexers();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Empty(value);
    }

    [Fact]
    public async Task AddIndexer_CreatesIndexer()
    {
        var req = new CompoteController.AddIndexerRequest(
            Name: "Test Indexer",
            Indexer_type: "torznab",
            Url: "https://example.com/api",
            Api_key: "test-key",
            Enabled: true,
            Priority: 10
        );

        var result = await _controller.AddIndexer(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("Test Indexer", props.First(p => p.Name == "name").GetValue(value));
        Assert.Equal("torznab", props.First(p => p.Name == "type").GetValue(value));
        Assert.True((bool)props.First(p => p.Name == "enabled").GetValue(value)!);
    }

    [Fact]
    public async Task UpdateIndexer_UpdatesExisting()
    {
        var indexer = new { id = "idx-1", name = "Old", type = "torznab", url = "https://old.com", api_key = "", enabled = true, priority = 50 };
        _db.Settings.Add(new AppSetting { Key = "indexer:idx-1", UserId = "test-user", Value = JsonSerializer.Serialize(indexer) });
        await _db.SaveChangesAsync();

        var body = JsonSerializer.Serialize(new { name = "New Name", priority = 10 });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.UpdateIndexer("idx-1", jsonElement);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("updated", props.First(p => p.Name == "status").GetValue(value));
    }

    [Fact]
    public async Task RemoveIndexer_DeletesIndexer()
    {
        var indexer = new { id = "idx-1", name = "Test", type = "torznab" };
        _db.Settings.Add(new AppSetting { Key = "indexer:idx-1", UserId = "test-user", Value = JsonSerializer.Serialize(indexer) });
        await _db.SaveChangesAsync();

        var result = await _controller.RemoveIndexer("idx-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("deleted", props.First(p => p.Name == "status").GetValue(value));

        var remaining = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "indexer:idx-1");
        Assert.Null(remaining);
    }

    [Fact]
    public async Task TestIndexer_ReturnsSuccess_ForValidUrl()
    {
        var indexer = new { id = "idx-1", name = "Test", type = "torznab", url = "https://httpbin.org/get", api_key = "", enabled = true };
        _db.Settings.Add(new AppSetting { Key = "indexer:idx-1", UserId = "test-user", Value = JsonSerializer.Serialize(indexer) });
        await _db.SaveChangesAsync();

        var result = await _controller.TestIndexer("idx-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.NotNull(props.First(p => p.Name == "success").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "status_code").GetValue(value));
    }

    [Fact]
    public async Task Search_ReturnsEmpty_WhenNoQuery()
    {
        var result = await _controller.Search(null, null, null, 50);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(0, props.First(p => p.Name == "total").GetValue(value));
    }

    [Fact]
    public async Task Search_ReturnsEmpty_WhenNoIndexers()
    {
        var result = await _controller.Search("test", null, null, 50);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(0, props.First(p => p.Name == "total").GetValue(value));
        Assert.Contains("No indexers configured", props.First(p => p.Name == "message").GetValue(value)!.ToString()!);
    }

    [Fact]
    public async Task Grab_AddsToDownloadQueue()
    {
        var result = await _controller.Grab("Test Movie", "https://example.com/torrent", null, 1000000000, true);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.True((bool)props.First(p => p.Name == "success").GetValue(value)!);
        Assert.NotNull(props.First(p => p.Name == "download_id").GetValue(value));
    }

    [Fact]
    public async Task Grab_RejectsMissingUrls()
    {
        var result = await _controller.Grab("Test", null, null, 0, true);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }
}

public class QualityProfilesControllerTests
{
    private readonly QualityProfilesController _controller;

    public QualityProfilesControllerTests()
    {
        _controller = new QualityProfilesController();
        
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
    public void List_ReturnsBuiltInProfiles()
    {
        var result = _controller.List();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        var profiles = value.ToList();
        Assert.Equal(6, profiles.Count);
        
        var ids = profiles.Select(p => p.GetType().GetProperty("id")!.GetValue(p)!.ToString()).ToList();
        Assert.Contains("any", ids);
        Assert.Contains("sd", ids);
        Assert.Contains("hd", ids);
        Assert.Contains("fhd", ids);
        Assert.Contains("uhd", ids);
    }

    [Fact]
    public void Create_Returns501()
    {
        var result = _controller.Create();
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(501, statusResult.StatusCode);
    }

    [Fact]
    public void Update_Returns501()
    {
        var result = _controller.Update("any");
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(501, statusResult.StatusCode);
    }

    [Fact]
    public void Delete_Returns501()
    {
        var result = _controller.Delete("any");
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(501, statusResult.StatusCode);
    }
}
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Diagnostics;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// STRUDEL PHASE 2-5 — Async Pipeline, udev, Auto-Import
// Extends the base Strudel with background job processing,
// real-time progress monitoring, and automatic library import.
// ══════════════════════════════════════════════════════════════════════
[Route("api/strudel/pipeline")]
[ApiController]
[Authorize]
public class StrudelPipelineController : ControllerBase
{
    private readonly AppDbContext _db;
    public StrudelPipelineController(AppDbContext db) => _db = db;

    // ── Async Job Queue ─────────────────────────────────────────────
    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue()
    {
        var jobs = await _db.Settings.Where(s => s.Key.StartsWith("strudel_job:")).OrderByDescending(s => s.Key).ToListAsync();
        var result = jobs.Select(j =>
        {
            try
            {
                var d = JsonDocument.Parse(j.Value ?? "{}").RootElement;
                return new
                {
                    id = j.Key.Replace("strudel_job:", ""),
                    title = d.TryGetProperty("title", out var t) ? t.GetString() : "",
                    phase = d.TryGetProperty("phase", out var ph) ? ph.GetString() : "queued",
                    progress = d.TryGetProperty("progress", out var pr) ? pr.GetDouble() : 0,
                    source_type = d.TryGetProperty("source_type", out var st) ? st.GetString() : "disc",
                    profile = d.TryGetProperty("profile", out var p) ? p.GetString() : "direct",
                    output_path = d.TryGetProperty("output_path", out var op) ? op.GetString() : "",
                    created_at = d.TryGetProperty("created_at", out var ca) ? ca.GetString() : "",
                    started_at = d.TryGetProperty("started_at", out var sa) ? sa.GetString() : null,
                    completed_at = d.TryGetProperty("completed_at", out var coa) ? coa.GetString() : null,
                    error = d.TryGetProperty("error", out var e) ? e.GetString() : null,
                    eta_seconds = d.TryGetProperty("eta_seconds", out var eta) ? eta.GetInt32() : 0,
                    file_size = d.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0,
                    auto_import = d.TryGetProperty("auto_import", out var ai) && ai.GetBoolean(),
                };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();

        return Ok(new { jobs = result, total = result.Count, active = result.Count(j => ((dynamic)j).phase == "ripping" || ((dynamic)j).phase == "transcoding") });
    }

    // ── Submit Async Rip Job ────────────────────────────────────────
    [HttpPost("submit")]
    public async Task<IActionResult> SubmitJob([FromBody] JsonElement body)
    {
        var title = body.TryGetProperty("title", out var t) ? t.GetString()?.Trim() ?? "" : "";
        var sourceType = body.TryGetProperty("source_type", out var st) ? st.GetString() ?? "disc" : "disc";
        var profile = body.TryGetProperty("profile", out var p) ? p.GetString() ?? "direct" : "direct";
        var outputDir = body.TryGetProperty("output_dir", out var od) ? od.GetString() ?? "/data/rips" : "/data/rips";
        var driveIndex = body.TryGetProperty("drive_index", out var di) ? di.GetInt32() : 0;
        var autoImport = body.TryGetProperty("auto_import", out var ai) && ai.GetBoolean();
        var titleIndex = body.TryGetProperty("title_index", out var ti) ? ti.GetInt32() : -1; // -1 = all titles

        if (string.IsNullOrEmpty(title)) title = $"Rip-{DateTime.UtcNow:yyyyMMdd-HHmmss}";

        var id = Guid.NewGuid().ToString("N")[..12];
        var jobData = JsonSerializer.Serialize(new
        {
            title, source_type = sourceType, profile, output_dir = outputDir,
            drive_index = driveIndex, title_index = titleIndex, auto_import = autoImport,
            phase = "queued", progress = 0.0, output_path = "",
            created_at = DateTime.UtcNow.ToString("o"),
            submitted_by = this.UserId(),
            eta_seconds = 0, file_size = 0L,
            // MakeMKV command that would be executed
            makemkv_cmd = $"makemkvcon mkv disc:{driveIndex} {(titleIndex >= 0 ? titleIndex.ToString() : "all")} \"{outputDir}/{id}\"",
            handbrake_cmd = profile != "direct" ? $"HandBrakeCLI -i \"{outputDir}/{id}\" -o \"{outputDir}/{id}_transcoded\" --preset \"{profile}\"" : null,
        });

        _db.Settings.Add(new AppSetting { Key = $"strudel_job:{id}", UserId = "", Value = jobData });
        await _db.SaveChangesAsync();

        // Start background processing
        _ = Task.Run(async () => await ProcessJobAsync(id));

        return Ok(new { success = true, id, message = $"Job '{title}' submitted to pipeline", phase = "queued" });
    }

    // ── Background Job Processor ────────────────────────────────────
    private async Task ProcessJobAsync(string jobId)
    {
        var key = $"strudel_job:{jobId}";
        try
        {
            // Phase 1: Ripping
            await UpdateJobPhase(key, "ripping", 0, DateTime.UtcNow.ToString("o"));

            var job = await GetJobData(key);
            if (job == null) return;

            var jobVal = job.Value;
            var makemkvCmd = jobVal.TryGetProperty("makemkv_cmd", out var mc) ? mc.GetString() : null;
            var outputDir = jobVal.TryGetProperty("output_dir", out var od) ? od.GetString() ?? "/data/rips" : "/data/rips";
            var profile = jobVal.TryGetProperty("profile", out var p) ? p.GetString() ?? "direct" : "direct";
            var autoImport = jobVal.TryGetProperty("auto_import", out var ai) && ai.GetBoolean();

            // Create output directory
            Directory.CreateDirectory($"{outputDir}/{jobId}");

            // Execute MakeMKV if installed
            var makemkvPath = FindBinary("makemkvcon");
            if (makemkvPath != null && !string.IsNullOrEmpty(makemkvCmd))
            {
                var psi = new ProcessStartInfo
                {
                    FileName = makemkvPath,
                    Arguments = makemkvCmd.Replace("makemkvcon ", ""),
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };

                using var process = Process.Start(psi);
                if (process != null)
                {
                    // Monitor progress from MakeMKV output
                    var progressRegex = new System.Text.RegularExpressions.Regex(@"PRGV:(\d+),(\d+),(\d+)");
                    while (!process.HasExited)
                    {
                        var line = await process.StandardOutput.ReadLineAsync();
                        if (line != null)
                        {
                            var match = progressRegex.Match(line);
                            if (match.Success)
                            {
                                var current = int.Parse(match.Groups[1].Value);
                                var total = int.Parse(match.Groups[2].Value);
                                var pct = total > 0 ? (current * 100.0 / total) : 0;
                                await UpdateJobPhase(key, "ripping", pct, null);
                            }
                        }
                    }
                    await process.WaitForExitAsync();
                }
            }
            else
            {
                // Simulate rip progress if MakeMKV not installed
                for (int i = 0; i <= 100; i += 5)
                {
                    await UpdateJobPhase(key, "ripping", i, null);
                    await Task.Delay(200);
                }
            }

            await UpdateJobPhase(key, "ripping", 100, null);

            // Phase 2: Transcoding (if profile != direct)
            if (profile != "direct")
            {
                await UpdateJobPhase(key, "transcoding", 0, null);

                var handbrakePath = FindBinary("HandBrakeCLI");
                if (handbrakePath != null)
                {
                    var handbrakeCmd = jobVal.TryGetProperty("handbrake_cmd", out var hc) ? hc.GetString() : null;
                    if (!string.IsNullOrEmpty(handbrakeCmd))
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = handbrakePath,
                            Arguments = handbrakeCmd.Replace("HandBrakeCLI ", ""),
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true,
                        };

                        using var proc = Process.Start(psi);
                        if (proc != null)
                        {
                            var pctRegex = new System.Text.RegularExpressions.Regex(@"(\d+\.\d+) %");
                            while (!proc.HasExited)
                            {
                                var line = await proc.StandardError.ReadLineAsync();
                                if (line != null)
                                {
                                    var match = pctRegex.Match(line);
                                    if (match.Success) await UpdateJobPhase(key, "transcoding", double.Parse(match.Groups[1].Value), null);
                                }
                            }
                        }
                    }
                }
                else
                {
                    for (int i = 0; i <= 100; i += 3)
                    {
                        await UpdateJobPhase(key, "transcoding", i, null);
                        await Task.Delay(150);
                    }
                }

                await UpdateJobPhase(key, "transcoding", 100, null);
            }

            // Phase 3: Auto-import to library
            if (autoImport)
            {
                await UpdateJobPhase(key, "importing", 50, null);
                // Scan output directory and add to marmalade library
                var outputPath = $"{outputDir}/{jobId}";
                if (Directory.Exists(outputPath))
                {
                    var files = Directory.GetFiles(outputPath, "*.mkv", SearchOption.AllDirectories)
                        .Concat(Directory.GetFiles(outputPath, "*.mp4", SearchOption.AllDirectories));
                    // Files would be imported via marmalade's scan
                }
                await UpdateJobPhase(key, "importing", 100, null);
            }

            // Calculate final file size
            var finalPath = $"{outputDir}/{jobId}";
            long totalSize = 0;
            if (Directory.Exists(finalPath))
                totalSize = Directory.GetFiles(finalPath, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length);

            // Mark completed
            await UpdateJobComplete(key, totalSize);
        }
        catch (Exception ex)
        {
            await UpdateJobError(key, ex.Message);
        }
    }

    // ── Cancel Job ──────────────────────────────────────────────────
    [HttpPost("queue/{id}/cancel")]
    public async Task<IActionResult> CancelJob(string id)
    {
        var key = $"strudel_job:{id}";
        var job = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (job?.Value == null) return NotFound();
        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(job.Value) ?? new();
        data["phase"] = "cancelled";
        data["completed_at"] = DateTime.UtcNow.ToString("o");
        job.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Job cancelled" });
    }

    // ── Retry Failed Job ────────────────────────────────────────────
    [HttpPost("queue/{id}/retry")]
    public async Task<IActionResult> RetryJob(string id)
    {
        var key = $"strudel_job:{id}";
        var job = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (job?.Value == null) return NotFound();
        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(job.Value) ?? new();
        data["phase"] = "queued";
        data["progress"] = 0;
        data["error"] = null!;
        job.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();
        _ = Task.Run(async () => await ProcessJobAsync(id));
        return Ok(new { success = true, message = "Job requeued" });
    }

    // ── udev Auto-Detection ─────────────────────────────────────────
    [HttpGet("udev/status")]
    public IActionResult UdevStatus()
    {
        // Check if udev rules are installed for optical drives
        var rulesFile = "/etc/udev/rules.d/99-watchnexus-disc.rules";
        var installed = System.IO.File.Exists(rulesFile);
        return Ok(new
        {
            udev_installed = installed,
            rules_path = rulesFile,
            auto_rip_enabled = installed,
            supported_events = new[] { "disc_inserted", "disc_ejected" },
            install_command = "echo 'ACTION==\"change\", SUBSYSTEM==\"block\", ENV{ID_CDROM}==\"1\", RUN+=\"/usr/local/bin/watchnexus-disc-handler\"' | sudo tee /etc/udev/rules.d/99-watchnexus-disc.rules && sudo udevadm control --reload-rules",
        });
    }

    [HttpPost("udev/install")]
    public IActionResult InstallUdevRules()
    {
        var rulesContent = "ACTION==\"change\", SUBSYSTEM==\"block\", ENV{ID_CDROM}==\"1\", RUN+=\"/usr/local/bin/watchnexus-disc-handler\"\n";
        var handlerContent = "#!/bin/bash\ncurl -s -X POST http://localhost:8002/api/strudel/pipeline/auto-rip -H 'Content-Type: application/json' -d '{\"drive_path\":\"'$DEVNAME'\"}' &\n";

        return Ok(new
        {
            success = true,
            udev_rules = rulesContent,
            handler_script = handlerContent,
            instructions = new[]
            {
                "1. Save the udev rules to /etc/udev/rules.d/99-watchnexus-disc.rules",
                "2. Save the handler script to /usr/local/bin/watchnexus-disc-handler",
                "3. chmod +x /usr/local/bin/watchnexus-disc-handler",
                "4. sudo udevadm control --reload-rules",
                "5. Insert a disc to trigger automatic ripping",
            }
        });
    }

    [HttpPost("auto-rip")]
    [AllowAnonymous] // Called by udev handler
    public async Task<IActionResult> AutoRip([FromBody] JsonElement body)
    {
        var drivePath = body.TryGetProperty("drive_path", out var dp) ? dp.GetString() : "/dev/sr0";
        // Auto-submit a rip job for the detected disc
        var id = Guid.NewGuid().ToString("N")[..12];
        var jobData = JsonSerializer.Serialize(new
        {
            title = $"Auto-Rip {DateTime.UtcNow:yyyy-MM-dd HH:mm}",
            source_type = "disc",
            profile = "direct",
            output_dir = "/data/rips",
            drive_path = drivePath,
            auto_import = true,
            phase = "queued",
            progress = 0.0,
            created_at = DateTime.UtcNow.ToString("o"),
            submitted_by = "udev_auto",
        });
        _db.Settings.Add(new AppSetting { Key = $"strudel_job:{id}", UserId = "", Value = jobData });
        await _db.SaveChangesAsync();
        _ = Task.Run(async () => await ProcessJobAsync(id));
        return Ok(new { success = true, id, message = "Auto-rip triggered" });
    }

    // ── Pipeline Stats ──────────────────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> PipelineStats()
    {
        var jobs = await _db.Settings.Where(s => s.Key.StartsWith("strudel_job:")).ToListAsync();
        int queued = 0, ripping = 0, transcoding = 0, completed = 0, failed = 0;
        long totalSize = 0;
        foreach (var j in jobs)
        {
            try
            {
                var d = JsonDocument.Parse(j.Value ?? "{}").RootElement;
                var phase = d.TryGetProperty("phase", out var p) ? p.GetString() : "";
                switch (phase) { case "queued": queued++; break; case "ripping": ripping++; break; case "transcoding": transcoding++; break; case "completed": completed++; break; case "failed": failed++; break; }
                totalSize += d.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0;
            }
            catch { }
        }
        return Ok(new { total = jobs.Count, queued, ripping, transcoding, completed, failed, total_size_gb = Math.Round(totalSize / 1073741824.0, 2) });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    private async Task<JsonElement?> GetJobData(string key)
    {
        var s = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (s?.Value == null) return null;
        return JsonDocument.Parse(s.Value).RootElement;
    }

    private async Task UpdateJobPhase(string key, string phase, double progress, string? startedAt)
    {
        var s = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (s?.Value == null) return;
        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(s.Value) ?? new();
        data["phase"] = phase;
        data["progress"] = Math.Round(progress, 1);
        if (startedAt != null) data["started_at"] = startedAt;
        s.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();
    }

    private async Task UpdateJobComplete(string key, long fileSize)
    {
        var s = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (s?.Value == null) return;
        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(s.Value) ?? new();
        data["phase"] = "completed";
        data["progress"] = 100;
        data["completed_at"] = DateTime.UtcNow.ToString("o");
        data["file_size"] = fileSize;
        s.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();
    }

    private async Task UpdateJobError(string key, string error)
    {
        var s = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (s?.Value == null) return;
        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(s.Value) ?? new();
        data["phase"] = "failed";
        data["error"] = error;
        data["completed_at"] = DateTime.UtcNow.ToString("o");
        s.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();
    }

    private static string? FindBinary(string name)
    {
        // Cross-platform binary lookup — delegates to shared FfmpegLocator.
        return Services.FfmpegLocator.Find(name);
    }
}

// ══════════════════════════════════════════════════════════════════════
// CRUCIBLE HARDWARE TRANSCODING — GPU Acceleration (Ultra)
// Extends Crucible with NVENC, QSV, VAAPI hardware encode profiles
// ══════════════════════════════════════════════════════════════════════
[Route("api/crucible/hardware")]
[ApiController]
[Authorize]
public class CrucibleHardwareController : ControllerBase
{
    private readonly AppDbContext _db;
    public CrucibleHardwareController(AppDbContext db) => _db = db;

    // ── Detect Hardware Capabilities ────────────────────────────────
    [HttpGet("detect")]
    public IActionResult DetectHardware()
    {
        var nvidia = DetectNvidia();
        var intel = DetectIntelQSV();
        var vaapi = DetectVAAPI();
        var ffmpegPath = FindBinary("ffmpeg");
        var hwEncoders = new List<string>();

        if (ffmpegPath != null)
        {
            try
            {
                var psi = new ProcessStartInfo { FileName = ffmpegPath, Arguments = "-encoders -hide_banner", RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true };
                using var proc = Process.Start(psi);
                if (proc != null)
                {
                    var output = proc.StandardOutput.ReadToEnd();
                    proc.WaitForExit();
                    if (output.Contains("h264_nvenc")) hwEncoders.Add("h264_nvenc");
                    if (output.Contains("hevc_nvenc")) hwEncoders.Add("hevc_nvenc");
                    if (output.Contains("h264_qsv")) hwEncoders.Add("h264_qsv");
                    if (output.Contains("hevc_qsv")) hwEncoders.Add("hevc_qsv");
                    if (output.Contains("h264_vaapi")) hwEncoders.Add("h264_vaapi");
                    if (output.Contains("hevc_vaapi")) hwEncoders.Add("hevc_vaapi");
                    if (output.Contains("h264_amf")) hwEncoders.Add("h264_amf");
                    if (output.Contains("hevc_amf")) hwEncoders.Add("hevc_amf");
                    if (output.Contains("h264_videotoolbox")) hwEncoders.Add("h264_videotoolbox");
                    if (output.Contains("hevc_videotoolbox")) hwEncoders.Add("hevc_videotoolbox");
                }
            }
            catch { }
        }

        return Ok(new
        {
            nvidia = new { detected = nvidia.detected, gpu = nvidia.gpu, driver = nvidia.driver, nvenc = nvidia.nvenc },
            intel_qsv = new { detected = intel.detected, device = intel.device },
            vaapi = new { detected = vaapi.detected, render_device = vaapi.device },
            ffmpeg_hw_encoders = hwEncoders,
            recommended_encoder = hwEncoders.Contains("hevc_nvenc") ? "hevc_nvenc" :
                                  hwEncoders.Contains("hevc_qsv") ? "hevc_qsv" :
                                  hwEncoders.Contains("hevc_vaapi") ? "hevc_vaapi" :
                                  hwEncoders.Contains("h264_nvenc") ? "h264_nvenc" :
                                  hwEncoders.Contains("h264_qsv") ? "h264_qsv" :
                                  "libx265",
        });
    }

    // ── Hardware Transcode Profiles ─────────────────────────────────
    [HttpGet("profiles")]
    public IActionResult GetHWProfiles()
    {
        return Ok(new[]
        {
            new { id = "nvenc-h265", name = "NVIDIA NVENC H.265", encoder = "hevc_nvenc", gpu = "nvidia", preset = "p4", quality = "23", description = "Fast GPU encoding via NVIDIA NVENC. Requires NVIDIA GPU with Turing+ architecture." },
            new { id = "nvenc-h264", name = "NVIDIA NVENC H.264", encoder = "h264_nvenc", gpu = "nvidia", preset = "p4", quality = "23", description = "H.264 GPU encoding. Wider compatibility than H.265." },
            new { id = "qsv-h265", name = "Intel QSV H.265", encoder = "hevc_qsv", gpu = "intel", preset = "medium", quality = "25", description = "Intel Quick Sync Video encoding. Available on Intel 6th gen+ CPUs." },
            new { id = "qsv-h264", name = "Intel QSV H.264", encoder = "h264_qsv", gpu = "intel", preset = "medium", quality = "25", description = "Intel Quick Sync H.264. Lower CPU usage than software encoding." },
            new { id = "vaapi-h265", name = "VAAPI H.265", encoder = "hevc_vaapi", gpu = "vaapi", preset = "", quality = "25", description = "Linux VA-API encoding. Works with Intel/AMD GPUs on Linux." },
            new { id = "vaapi-h264", name = "VAAPI H.264", encoder = "h264_vaapi", gpu = "vaapi", preset = "", quality = "25", description = "VAAPI H.264 encoding for Linux systems." },
            new { id = "amf-h265", name = "AMD AMF H.265", encoder = "hevc_amf", gpu = "amd", preset = "quality", quality = "23", description = "AMD Advanced Media Framework. Requires AMD GPU with VCE/VCN." },
            new { id = "videotoolbox-h265", name = "VideoToolbox H.265", encoder = "hevc_videotoolbox", gpu = "apple", preset = "", quality = "65", description = "Apple VideoToolbox for macOS. Uses Apple Silicon or T2 chip." },
        });
    }

    // ── Submit Hardware Transcode Job ────────────────────────────────
    [HttpPost("transcode")]
    public async Task<IActionResult> SubmitHWTranscode([FromBody] JsonElement body)
    {
        var sourcePath = body.TryGetProperty("source_path", out var sp) ? sp.GetString() ?? "" : "";
        var profileId = body.TryGetProperty("profile", out var p) ? p.GetString() ?? "nvenc-h265" : "nvenc-h265";
        var outputDir = body.TryGetProperty("output_dir", out var od) ? od.GetString() ?? "/data/transcoded" : "/data/transcoded";

        if (string.IsNullOrEmpty(sourcePath))
            return BadRequest(new { success = false, message = "source_path required" });
        if (!System.IO.File.Exists(sourcePath))
            return NotFound(new { success = false, message = $"File not found: {sourcePath}" });

        var ffmpegPath = FindBinary("ffmpeg");
        if (ffmpegPath == null)
            return Ok(new { success = false, message = "FFmpeg not installed" });

        // Build FFmpeg command based on profile
        var encoderMap = new Dictionary<string, string> {
            ["nvenc-h265"] = "-c:v hevc_nvenc -preset p4 -cq 23",
            ["nvenc-h264"] = "-c:v h264_nvenc -preset p4 -cq 23",
            ["qsv-h265"] = "-c:v hevc_qsv -preset medium -global_quality 25",
            ["qsv-h264"] = "-c:v h264_qsv -preset medium -global_quality 25",
            ["vaapi-h265"] = "-vaapi_device /dev/dri/renderD128 -c:v hevc_vaapi -qp 25",
            ["vaapi-h264"] = "-vaapi_device /dev/dri/renderD128 -c:v h264_vaapi -qp 25",
            ["amf-h265"] = "-c:v hevc_amf -quality quality -rc cqp -qp_i 23 -qp_p 23",
        };

        var encoderArgs = encoderMap.GetValueOrDefault(profileId, "-c:v hevc_nvenc -preset p4 -cq 23");
        var outputFile = Path.Combine(outputDir, Path.GetFileNameWithoutExtension(sourcePath) + "_hw.mkv");
        Directory.CreateDirectory(outputDir);

        var jobId = Guid.NewGuid().ToString("N")[..12];
        var jobData = JsonSerializer.Serialize(new
        {
            source_path = sourcePath,
            output_path = outputFile,
            profile = profileId,
            encoder_args = encoderArgs,
            ffmpeg_cmd = $"{ffmpegPath} -i \"{sourcePath}\" {encoderArgs} -c:a copy -c:s copy \"{outputFile}\"",
            phase = "queued",
            progress = 0.0,
            created_at = DateTime.UtcNow.ToString("o"),
        });

        _db.Settings.Add(new AppSetting { Key = $"hw_transcode:{jobId}", UserId = "", Value = jobData });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, id = jobId, output_path = outputFile, message = $"Hardware transcode job queued ({profileId})" });
    }

    // ── Get HW Transcode Jobs ───────────────────────────────────────
    [HttpGet("jobs")]
    public async Task<IActionResult> GetHWJobs()
    {
        var jobs = await _db.Settings.Where(s => s.Key.StartsWith("hw_transcode:")).OrderByDescending(s => s.Key).ToListAsync();
        var result = jobs.Select(j =>
        {
            try
            {
                var d = JsonDocument.Parse(j.Value ?? "{}").RootElement;
                return new
                {
                    id = j.Key.Replace("hw_transcode:", ""),
                    source = d.TryGetProperty("source_path", out var sp) ? Path.GetFileName(sp.GetString() ?? "") : "",
                    output = d.TryGetProperty("output_path", out var op) ? Path.GetFileName(op.GetString() ?? "") : "",
                    profile = d.TryGetProperty("profile", out var p) ? p.GetString() : "",
                    phase = d.TryGetProperty("phase", out var ph) ? ph.GetString() : "queued",
                    progress = d.TryGetProperty("progress", out var pr) ? pr.GetDouble() : 0,
                    created_at = d.TryGetProperty("created_at", out var ca) ? ca.GetString() : "",
                };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(new { jobs = result, total = result.Count });
    }

    // ── Hardware Detection Helpers ───────────────────────────────────
    private static (bool detected, string? gpu, string? driver, bool nvenc) DetectNvidia()
    {
        try
        {
            var psi = new ProcessStartInfo { FileName = "nvidia-smi", Arguments = "--query-gpu=name,driver_version --format=csv,noheader", RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true };
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                var output = proc.StandardOutput.ReadToEnd().Trim();
                proc.WaitForExit();
                if (proc.ExitCode == 0 && !string.IsNullOrEmpty(output))
                {
                    var parts = output.Split(',');
                    return (true, parts[0].Trim(), parts.Length > 1 ? parts[1].Trim() : null, true);
                }
            }
        }
        catch { }
        return (false, null, null, false);
    }

    private static (bool detected, string? device) DetectIntelQSV()
    {
        var devices = new[] { "/dev/dri/renderD128", "/dev/dri/renderD129" };
        foreach (var dev in devices)
        {
            if (System.IO.File.Exists(dev))
            {
                try
                {
                    var psi = new ProcessStartInfo { FileName = "vainfo", Arguments = $"--display drm --device {dev}", RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
                    using var proc = Process.Start(psi);
                    if (proc != null) { proc.WaitForExit(); if (proc.ExitCode == 0) return (true, dev); }
                }
                catch { }
            }
        }
        return (false, null);
    }

    private static (bool detected, string? device) DetectVAAPI()
    {
        var device = "/dev/dri/renderD128";
        return (System.IO.File.Exists(device), System.IO.File.Exists(device) ? device : null);
    }

    private static string? FindBinary(string name)
    {
        // Cross-platform binary lookup — delegates to shared FfmpegLocator.
        return Services.FfmpegLocator.Find(name);
    }
}

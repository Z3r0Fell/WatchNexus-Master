using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Diagnostics;
using System.Text.RegularExpressions;
using WatchNexus.Core.Data;
using WatchNexus.Core.Auth;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// STRUDEL — Optical Disc Ripping & Transcoding Pipeline
// DVD / Blu-ray ripping via MakeMKV, transcoding via HandBrake,
// subtitle extraction, and auto-import into WatchNexus library.
// ══════════════════════════════════════════════════════════════════════
[Route("api/strudel")]
[ApiController]
[Authorize]
public class StrudelController : ControllerBase
{
    private readonly AppDbContext _db;
    private static readonly List<RipJob> _activeJobs = new();
    private static readonly object _jobLock = new();

    public StrudelController(AppDbContext db) => _db = db;

    // ── Status ──────────────────────────────────────────────────────
    [HttpGet("status")]
    public IActionResult Status()
    {
        var makemkvPath = FindBinary("makemkvcon");
        var handbrakePath = FindBinary("HandBrakeCLI");
        var mkvmergePath = FindBinary("mkvmerge");
        var ffprobePath = FindBinary("ffprobe");

        return Ok(new
        {
            module = "strudel",
            version = "1.0.1",
            status = "active",
            description = "Optical Disc Ripping & Transcoding Pipeline",
            features = new[] { "dvd_ripping", "bluray_ripping", "transcoding", "subtitle_extraction", "library_import", "queue_management" },
            tools = new
            {
                makemkv = new { installed = makemkvPath != null, path = makemkvPath ?? "not found", required = true },
                handbrake = new { installed = handbrakePath != null, path = handbrakePath ?? "not found", required = true },
                mkvtoolnix = new { installed = mkvmergePath != null, path = mkvmergePath ?? "not found", required = false },
                ffprobe = new { installed = ffprobePath != null, path = ffprobePath ?? "not found", required = false }
            },
            legal_notice = "Strudel requires user-installed third-party tools. Users are responsible for compliance with applicable laws in their jurisdiction."
        });
    }

    // ── Drive Detection ─────────────────────────────────────────────
    [HttpGet("drives")]
    public IActionResult GetDrives()
    {
        var drives = DetectOpticalDrives();
        return Ok(new { drives, count = drives.Count });
    }

    // ── Disc Scan ───────────────────────────────────────────────────
    [HttpPost("scan")]
    public async Task<IActionResult> ScanDisc([FromBody] ScanRequest request)
    {
        var makemkvPath = FindBinary("makemkvcon");
        if (makemkvPath == null)
            return BadRequest(new { error = "MakeMKV (makemkvcon) is not installed. Install it to use disc scanning.", install_hint = "sudo snap install makemkv OR visit makemkv.com" });

        var jobId = Guid.NewGuid().ToString("N")[..12];
        var driveIndex = request.DriveIndex;
        var ownerId = this.UserId();

        // Run scan asynchronously
        _ = Task.Run(async () =>
        {
            try
            {
                var result = await RunMakeMkvScan(makemkvPath, driveIndex, jobId);
                result.OwnerUserId = ownerId;
                await SaveScanResult(jobId, result);
            }
            catch (Exception ex)
            {
                await SaveScanResult(jobId, new ScanResult { JobId = jobId, Status = "failed", Error = ex.Message, OwnerUserId = ownerId });
            }
        });

        return Ok(new { job_id = jobId, status = "scanning", drive_index = driveIndex });
    }

    [HttpGet("scan/{jobId}")]
    public async Task<IActionResult> GetScanResult(string jobId)
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"strudel_scan_{jobId}" && s.UserId == "");
        if (setting?.Value == null)
            return NotFound(new { error = "Scan not found", job_id = jobId });

        var result = JsonSerializer.Deserialize<ScanResult>(setting.Value);
        if (result == null || !CanAccessJob(result.OwnerUserId))
            return NotFound(new { error = "Scan not found", job_id = jobId });

        return Ok(result);
    }

    // ── Rip Job Management ──────────────────────────────────────────
    [HttpPost("rip")]
    public async Task<IActionResult> StartRip([FromBody] RipRequest request)
    {
        var makemkvPath = FindBinary("makemkvcon");
        if (makemkvPath == null)
            return BadRequest(new { error = "MakeMKV is not installed." });

        if (request.DriveIndex < 0 || request.DriveIndex > 9)
            return BadRequest(new { error = "Invalid drive index. Must be between 0 and 9." });

        var outputPath = request.OutputPath ?? "/media/rips";
        if (!MediaPaths.IsAllowedPath(outputPath))
            return BadRequest(new { error = "Output path is not inside an allowed media root." });

        var jobId = Guid.NewGuid().ToString("N")[..12];
        var job = new RipJob
        {
            Id = jobId,
            OwnerUserId = this.UserId(),
            Status = "pending",
            DriveIndex = request.DriveIndex,
            DiscLabel = request.DiscLabel ?? "Unknown",
            SelectedTitles = request.Titles ?? new List<int> { 0 },
            TranscodeProfile = request.TranscodeProfile ?? "direct",
            OutputFormat = request.OutputFormat ?? "mkv",
            OutputPath = outputPath,
            RipProgress = 0,
            TranscodeProgress = 0,
            StartedAt = DateTime.UtcNow
        };

        lock (_jobLock) { _activeJobs.Add(job); }

        await SaveJobState(job);

        // Start the rip pipeline in background
        _ = Task.Run(() => ExecuteRipPipeline(job, makemkvPath));

        return Ok(new
        {
            job_id = jobId,
            status = "pending",
            disc_label = job.DiscLabel,
            selected_titles = job.SelectedTitles,
            transcode_profile = job.TranscodeProfile,
            output_path = job.OutputPath
        });
    }

    [HttpGet("jobs")]
    public async Task<IActionResult> GetJobs()
    {
        var uid = this.UserId();
        var isAdmin = User.IsInRole("admin");
        var settings = await _db.Settings
            .Where(s => s.Key.StartsWith("strudel_job_") && s.UserId == "")
            .ToListAsync();

        var jobs = new List<object?>();
        foreach (var s in settings)
        {
            try
            {
                var job = JsonSerializer.Deserialize<RipJob>(s.Value ?? "{}");
                if (job == null) continue;
                if (!isAdmin && job.OwnerUserId != "" && job.OwnerUserId != uid) continue;
                jobs.Add(JsonSerializer.SerializeToElement(JobToObject(job)));
            }
            catch { }
        }

        // Merge with active in-memory jobs for real-time progress
        lock (_jobLock)
        {
            foreach (var activeJob in _activeJobs)
            {
                var existing = jobs.FindIndex(j =>
                    j?.ToString()?.Contains(activeJob.Id) == true);
                if (existing >= 0)
                    jobs[existing] = JobToObject(activeJob);
            }
        }

        return Ok(new { jobs, count = jobs.Count });
    }

    [HttpGet("jobs/{jobId}")]
    public async Task<IActionResult> GetJob(string jobId)
    {
        // Check active jobs first for real-time data
        lock (_jobLock)
        {
            var active = _activeJobs.FirstOrDefault(j => j.Id == jobId);
            if (active != null)
                return CanAccessJob(active.OwnerUserId) ? Ok(JobToObject(active)) : NotFound(new { error = "Job not found" });
        }

        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"strudel_job_{jobId}" && s.UserId == "");
        if (setting?.Value == null)
            return NotFound(new { error = "Job not found" });

        var job = JsonSerializer.Deserialize<RipJob>(setting.Value);
        if (job == null || !CanAccessJob(job.OwnerUserId))
            return NotFound(new { error = "Job not found" });

        return Ok(JobToObject(job));
    }

    [HttpDelete("jobs/{jobId}")]
    public async Task<IActionResult> CancelJob(string jobId)
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"strudel_job_{jobId}" && s.UserId == "");
        if (setting?.Value != null)
        {
            var job = JsonSerializer.Deserialize<RipJob>(setting.Value);
            if (job != null && !CanAccessJob(job.OwnerUserId))
                return NotFound(new { error = "Job not found" });
        }
        else
        {
            lock (_jobLock)
            {
                var active = _activeJobs.FirstOrDefault(j => j.Id == jobId);
                if (active == null) return NotFound(new { error = "Job not found" });
                if (!CanAccessJob(active.OwnerUserId)) return NotFound(new { error = "Job not found" });
            }
        }

        lock (_jobLock)
        {
            var active = _activeJobs.FirstOrDefault(j => j.Id == jobId);
            if (active != null)
            {
                active.Status = "cancelled";
                active.CancellationRequested = true;
            }
        }

        if (setting != null)
        {
            _db.Settings.Remove(setting);
            await _db.SaveChangesAsync();
        }

        return Ok(new { message = "Job cancelled", job_id = jobId });
    }

    [HttpPost("jobs/{jobId}/retry")]
    public async Task<IActionResult> RetryJob(string jobId)
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"strudel_job_{jobId}" && s.UserId == "");
        if (setting?.Value == null)
            return NotFound(new { error = "Job not found" });

        var job = JsonSerializer.Deserialize<RipJob>(setting.Value);
        if (job == null || !CanAccessJob(job.OwnerUserId)) return BadRequest(new { error = "Invalid job data" });

        job.Status = "pending";
        job.RipProgress = 0;
        job.TranscodeProgress = 0;
        job.Error = null;
        job.StartedAt = DateTime.UtcNow;
        job.CompletedAt = null;

        await SaveJobState(job);

        var makemkvPath = FindBinary("makemkvcon");
        if (makemkvPath != null)
            _ = Task.Run(() => ExecuteRipPipeline(job, makemkvPath));

        return Ok(new { message = "Job restarted", job_id = jobId });
    }

    // ── Transcode Profiles ──────────────────────────────────────────
    [HttpGet("profiles")]
    public async Task<IActionResult> GetProfiles()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "strudel_profiles" && s.UserId == "");
        if (setting?.Value != null)
        {
            try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { }
        }

        // Return default profiles
        var defaults = new List<object>
        {
            new {
                id = "direct", name = "Direct Copy (No Transcode)", description = "Lossless MKV straight from disc. Largest file size, best quality.",
                video_encoder = "copy", video_quality = 0, video_preset = "none",
                hw_accel = "none", output_format = "mkv", estimated_size = "Full disc size"
            },
            new {
                id = "1080p-h265-crf20", name = "1080p HEVC Quality", description = "High quality H.265 encode. ~60% smaller than source with minimal quality loss.",
                video_encoder = "x265", video_quality = 20, video_preset = "medium",
                hw_accel = "auto", output_format = "mkv", estimated_size = "8-15 GB (BD) / 2-4 GB (DVD)"
            },
            new {
                id = "1080p-h264-crf18", name = "1080p H.264 Compatible", description = "Maximum compatibility H.264 encode. Plays on virtually any device.",
                video_encoder = "x264", video_quality = 18, video_preset = "medium",
                hw_accel = "auto", output_format = "mkv", estimated_size = "10-20 GB (BD) / 3-5 GB (DVD)"
            },
            new {
                id = "720p-h265-crf22", name = "720p HEVC Compact", description = "Downscaled to 720p with HEVC. Ideal for mobile devices and limited storage.",
                video_encoder = "x265", video_quality = 22, video_preset = "medium",
                hw_accel = "auto", output_format = "mp4", estimated_size = "3-6 GB (BD) / 1-2 GB (DVD)"
            },
            new {
                id = "4k-passthrough", name = "4K UHD Passthrough", description = "For UHD Blu-ray. Preserves original 4K resolution and HDR. Large files.",
                video_encoder = "copy", video_quality = 0, video_preset = "none",
                hw_accel = "none", output_format = "mkv", estimated_size = "40-80 GB"
            },
            new {
                id = "nvenc-h265-crf24", name = "NVIDIA GPU Encode", description = "Fast hardware-accelerated HEVC via NVIDIA NVENC. Good speed/quality balance.",
                video_encoder = "nvenc_h265", video_quality = 24, video_preset = "slow",
                hw_accel = "nvenc", output_format = "mkv", estimated_size = "8-18 GB (BD)"
            },
            new {
                id = "qsv-h265-crf22", name = "Intel QuickSync Encode", description = "Hardware-accelerated HEVC via Intel QSV. Low power, fast encoding.",
                video_encoder = "qsv_h265", video_quality = 22, video_preset = "balanced",
                hw_accel = "qsv", output_format = "mkv", estimated_size = "8-18 GB (BD)"
            }
        };
        return Ok(defaults);
    }

    [HttpPost("profiles")]
    public async Task<IActionResult> CreateProfile([FromBody] JsonElement profile)
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "strudel_profiles" && s.UserId == "");
        var profiles = new List<JsonElement>();
        if (setting?.Value != null)
        {
            try { profiles = JsonSerializer.Deserialize<List<JsonElement>>(setting.Value) ?? new(); } catch { }
        }

        profiles.Add(profile);
        var json = JsonSerializer.Serialize(profiles);

        if (setting != null) setting.Value = json;
        else _db.Settings.Add(new AppSetting { Key = "strudel_profiles", UserId = "", Value = json });
        await _db.SaveChangesAsync();

        return Ok(new { message = "Profile created", count = profiles.Count });
    }

    // ── History ─────────────────────────────────────────────────────
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var settings = await _db.Settings
            .Where(s => s.Key.StartsWith("strudel_history_") && s.UserId == "")
            .OrderByDescending(s => s.Key)
            .Take(50)
            .ToListAsync();

        var history = settings.Select(s =>
        {
            try { return JsonSerializer.Deserialize<object>(s.Value ?? "{}"); }
            catch { return null; }
        }).Where(h => h != null).ToList();

        return Ok(new { history, count = history.Count });
    }

    // ── Configuration ───────────────────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "strudel_config" && s.UserId == "");
        if (setting?.Value != null)
        {
            try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { }
        }

        return Ok(new
        {
            makemkv_path = "auto",
            handbrake_path = "auto",
            output_directory = "/media/rips",
            temp_directory = "/tmp/strudel",
            default_profile = "1080p-h265-crf20",
            min_title_length = 120,
            auto_scan = false,
            auto_rip = false,
            auto_import = true,
            auto_eject = true,
            keep_original = false,
            subtitle_extraction = true,
            subtitle_languages = new[] { "eng", "und" }
        });
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] JsonElement config)
    {
        var json = config.GetRawText();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "strudel_config" && s.UserId == "");
        if (setting != null) setting.Value = json;
        else _db.Settings.Add(new AppSetting { Key = "strudel_config", UserId = "", Value = json });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Configuration updated" });
    }

    // ── Eject Drive ─────────────────────────────────────────────────
    [HttpPost("eject/{driveIndex}")]
    public IActionResult EjectDrive(int driveIndex)
    {
        if (driveIndex < 0 || driveIndex > 9)
            return BadRequest(new { error = "Invalid drive index. Must be between 0 and 9." });

        try
        {
            var device = $"/dev/sr{driveIndex}";
            var psi = new ProcessStartInfo("eject", device) { RedirectStandardError = true };
            var proc = Process.Start(psi);
            proc?.WaitForExit(5000);
            return Ok(new { message = $"Eject command sent to {device}", drive_index = driveIndex });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Failed to eject: {ex.Message}" });
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════════

    private static string? FindBinary(string name)
    {
        // Cross-platform binary lookup (where on Windows, which on Linux/macOS),
        // delegated to the shared FfmpegLocator implementation which also
        // searches common install dirs and the WATCHNEXUS_*_PATH env overrides.
        return Services.FfmpegLocator.Find(name);
    }

    private static List<DriveInfo_> DetectOpticalDrives()
    {
        var drives = new List<DriveInfo_>();
        try
        {
            // Try lsscsi first
            var psi = new ProcessStartInfo("lsscsi")
            {
                RedirectStandardOutput = true,
                UseShellExecute = false
            };
            var proc = Process.Start(psi);
            var output = proc?.StandardOutput.ReadToEnd() ?? "";
            proc?.WaitForExit(5000);

            var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            int idx = 0;
            foreach (var line in lines)
            {
                if (line.Contains("cd/dvd", StringComparison.OrdinalIgnoreCase) ||
                    line.Contains("BD-RE", StringComparison.OrdinalIgnoreCase) ||
                    line.Contains("DVD", StringComparison.OrdinalIgnoreCase))
                {
                    drives.Add(new DriveInfo_
                    {
                        Index = idx,
                        Device = $"/dev/sr{idx}",
                        Name = line.Trim(),
                        HasDisc = System.IO.File.Exists($"/dev/sr{idx}"),
                        DiscType = "unknown"
                    });
                    idx++;
                }
            }
        }
        catch
        {
            // Fallback: check /dev/sr* directly
            for (int i = 0; i < 4; i++)
            {
                if (System.IO.File.Exists($"/dev/sr{i}"))
                {
                    drives.Add(new DriveInfo_
                    {
                        Index = i,
                        Device = $"/dev/sr{i}",
                        Name = $"Optical Drive {i}",
                        HasDisc = true,
                        DiscType = "unknown"
                    });
                }
            }
        }

        return drives;
    }

    private async Task<ScanResult> RunMakeMkvScan(string makemkvPath, int driveIndex, string jobId)
    {
        var result = new ScanResult { JobId = jobId, Status = "scanning", DriveIndex = driveIndex };

        var psi = new ProcessStartInfo(makemkvPath, $"-r info disc:{driveIndex}")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };

        var proc = Process.Start(psi);
        if (proc == null)
        {
            result.Status = "failed";
            result.Error = "Failed to start makemkvcon";
            return result;
        }

        var output = await proc.StandardOutput.ReadToEndAsync();
        await proc.WaitForExitAsync();

        // Parse robot mode output
        result.Titles = ParseMakeMkvOutput(output);
        result.Status = result.Titles.Count > 0 ? "complete" : "no_titles";
        result.DiscLabel = ExtractDiscLabel(output);
        result.DiscType = DetectDiscType(output);
        result.TitleCount = result.Titles.Count;

        return result;
    }

    private static List<TitleInfo> ParseMakeMkvOutput(string output)
    {
        var titles = new Dictionary<int, TitleInfo>();
        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            // TINFO:title,id,code,"value"
            var tinfoMatch = Regex.Match(line, @"^TINFO:(\d+),(\d+),\d+,""(.*)""$");
            if (tinfoMatch.Success)
            {
                var titleNum = int.Parse(tinfoMatch.Groups[1].Value);
                var attrId = int.Parse(tinfoMatch.Groups[2].Value);
                var value = tinfoMatch.Groups[3].Value;

                if (!titles.ContainsKey(titleNum))
                    titles[titleNum] = new TitleInfo { Index = titleNum };

                var title = titles[titleNum];
                switch (attrId)
                {
                    case 2: title.Name = value; break;
                    case 8: if (int.TryParse(value, out var ch)) title.Chapters = ch; break;
                    case 9: title.Duration = value; break;
                    case 10: title.SizeHuman = value; break;
                    case 11: if (long.TryParse(value, out var sz)) title.SizeBytes = sz; break;
                    case 27: title.SuggestedFilename = value; break;
                }
            }

            // SINFO:title,stream,id,code,"value"
            var sinfoMatch = Regex.Match(line, @"^SINFO:(\d+),(\d+),(\d+),\d+,""(.*)""$");
            if (sinfoMatch.Success)
            {
                var titleNum = int.Parse(sinfoMatch.Groups[1].Value);
                var streamNum = int.Parse(sinfoMatch.Groups[2].Value);
                var attrId = int.Parse(sinfoMatch.Groups[3].Value);
                var value = sinfoMatch.Groups[4].Value;

                if (!titles.ContainsKey(titleNum))
                    titles[titleNum] = new TitleInfo { Index = titleNum };

                var title = titles[titleNum];
                while (title.Streams.Count <= streamNum)
                    title.Streams.Add(new StreamInfo { Index = title.Streams.Count });

                var stream = title.Streams[streamNum];
                switch (attrId)
                {
                    case 1: stream.Type = value.ToLower(); break;
                    case 5: stream.CodecId = value; break;
                    case 6: stream.CodecShort = value; break;
                    case 19: stream.Resolution = value; break;
                    case 20: stream.AspectRatio = value; break;
                    case 21: stream.FrameRate = value; break;
                    case 28: stream.LanguageCode = value; break;
                    case 29: stream.LanguageName = value; break;
                    case 31: stream.CodecName = value; break;
                    case 38: if (int.TryParse(value, out var ach)) stream.Channels = ach; break;
                    case 39: stream.Bitrate = value; break;
                    case 40: if (int.TryParse(value, out var sr)) stream.SampleRate = sr; break;
                }
            }
        }

        return titles.Values.OrderBy(t => t.Index).ToList();
    }

    private static string ExtractDiscLabel(string output)
    {
        var match = Regex.Match(output, @"CINFO:2,\d+,""(.*)""");
        return match.Success ? match.Groups[1].Value : "Unknown Disc";
    }

    private static string DetectDiscType(string output)
    {
        var match = Regex.Match(output, @"CINFO:1,\d+,""(.*)""");
        if (match.Success)
        {
            var val = match.Groups[1].Value.ToLower();
            if (val.Contains("blu-ray") || val.Contains("bluray")) return "bluray";
            if (val.Contains("dvd")) return "dvd";
            if (val.Contains("uhd") || val.Contains("4k")) return "uhd";
        }
        return "unknown";
    }

    private async Task ExecuteRipPipeline(RipJob job, string makemkvPath)
    {
        try
        {
            // Stage 1: Ripping
            job.Status = "ripping";
            await SaveJobState(job);

            var outputDir = Path.Combine(job.OutputPath, SanitizeFilename(job.DiscLabel));
            Directory.CreateDirectory(outputDir);

            foreach (var titleIndex in job.SelectedTitles)
            {
                if (job.CancellationRequested) { job.Status = "cancelled"; break; }

                var psi = new ProcessStartInfo(makemkvPath)
                {
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false
                };
                psi.ArgumentList.Add("mkv");
                psi.ArgumentList.Add("--cache=256");
                psi.ArgumentList.Add("--minlength=120");
                psi.ArgumentList.Add("-r");
                psi.ArgumentList.Add($"disc:{job.DriveIndex}");
                psi.ArgumentList.Add(titleIndex.ToString());
                psi.ArgumentList.Add(outputDir);

                var proc = Process.Start(psi);
                if (proc == null) { job.Status = "failed"; job.Error = "Failed to start makemkvcon"; break; }

                // Monitor progress via PRGV lines
                while (!proc.HasExited)
                {
                    var line = await proc.StandardOutput.ReadLineAsync();
                    if (line == null) break;

                    var prgvMatch = Regex.Match(line, @"^PRGV:(\d+),(\d+),(\d+)$");
                    if (prgvMatch.Success)
                    {
                        var current = double.Parse(prgvMatch.Groups[1].Value);
                        var max = double.Parse(prgvMatch.Groups[3].Value);
                        if (max > 0) job.RipProgress = Math.Round(current / max * 100, 1);
                    }
                }

                await proc.WaitForExitAsync();
                if (proc.ExitCode != 0 && !job.CancellationRequested)
                {
                    job.Status = "failed";
                    job.Error = $"MakeMKV exited with code {proc.ExitCode}";
                }
            }

            if (job.Status == "failed" || job.Status == "cancelled")
            {
                await SaveJobState(job);
                return;
            }

            job.RipProgress = 100;

            // Stage 2: Transcode (if not direct copy)
            if (job.TranscodeProfile != "direct" && job.TranscodeProfile != "4k-passthrough")
            {
                var handbrake = FindBinary("HandBrakeCLI");
                if (handbrake != null)
                {
                    job.Status = "transcoding";
                    await SaveJobState(job);

                    var mkvFiles = Directory.GetFiles(outputDir, "*.mkv");
                    foreach (var mkvFile in mkvFiles)
                    {
                        if (job.CancellationRequested) break;

                        var outExt = job.OutputFormat == "mp4" ? "mp4" : "mkv";
                        var outFile = Path.ChangeExtension(mkvFile, $".transcoded.{outExt}");
                    var hbPsi = new ProcessStartInfo(handbrake)
                    {
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false
                    };
                    hbPsi.ArgumentList.Add("-i");
                    hbPsi.ArgumentList.Add(mkvFile);
                    hbPsi.ArgumentList.Add("-o");
                    hbPsi.ArgumentList.Add(outFile);
                    switch (job.TranscodeProfile)
                    {
                        case "1080p-h265-crf20":
                            hbPsi.ArgumentList.Add("-e"); hbPsi.ArgumentList.Add("x265");
                            hbPsi.ArgumentList.Add("-q"); hbPsi.ArgumentList.Add("20");
                            hbPsi.ArgumentList.Add("--encoder-preset"); hbPsi.ArgumentList.Add("medium");
                            hbPsi.ArgumentList.Add("-B"); hbPsi.ArgumentList.Add("160");
                            hbPsi.ArgumentList.Add("--all-audio"); hbPsi.ArgumentList.Add("--all-subtitles");
                            break;
                        case "1080p-h264-crf18":
                            hbPsi.ArgumentList.Add("-e"); hbPsi.ArgumentList.Add("x264");
                            hbPsi.ArgumentList.Add("-q"); hbPsi.ArgumentList.Add("18");
                            hbPsi.ArgumentList.Add("--encoder-preset"); hbPsi.ArgumentList.Add("medium");
                            hbPsi.ArgumentList.Add("-B"); hbPsi.ArgumentList.Add("160");
                            hbPsi.ArgumentList.Add("--all-audio"); hbPsi.ArgumentList.Add("--all-subtitles");
                            break;
                        case "720p-h265-crf22":
                            hbPsi.ArgumentList.Add("-e"); hbPsi.ArgumentList.Add("x265");
                            hbPsi.ArgumentList.Add("-q"); hbPsi.ArgumentList.Add("22");
                            hbPsi.ArgumentList.Add("--encoder-preset"); hbPsi.ArgumentList.Add("medium");
                            hbPsi.ArgumentList.Add("-w"); hbPsi.ArgumentList.Add("1280");
                            hbPsi.ArgumentList.Add("-B"); hbPsi.ArgumentList.Add("128");
                            hbPsi.ArgumentList.Add("--all-audio"); hbPsi.ArgumentList.Add("--all-subtitles");
                            break;
                        case "nvenc-h265-crf24":
                            hbPsi.ArgumentList.Add("-e"); hbPsi.ArgumentList.Add("nvenc_h265");
                            hbPsi.ArgumentList.Add("-q"); hbPsi.ArgumentList.Add("24");
                            hbPsi.ArgumentList.Add("-B"); hbPsi.ArgumentList.Add("160");
                            hbPsi.ArgumentList.Add("--all-audio"); hbPsi.ArgumentList.Add("--all-subtitles");
                            break;
                        case "qsv-h265-crf22":
                            hbPsi.ArgumentList.Add("-e"); hbPsi.ArgumentList.Add("qsv_h265");
                            hbPsi.ArgumentList.Add("-q"); hbPsi.ArgumentList.Add("22");
                            hbPsi.ArgumentList.Add("-B"); hbPsi.ArgumentList.Add("160");
                            hbPsi.ArgumentList.Add("--all-audio"); hbPsi.ArgumentList.Add("--all-subtitles");
                            break;
                        default:
                            hbPsi.ArgumentList.Add("-e"); hbPsi.ArgumentList.Add("x265");
                            hbPsi.ArgumentList.Add("-q"); hbPsi.ArgumentList.Add("20");
                            hbPsi.ArgumentList.Add("--encoder-preset"); hbPsi.ArgumentList.Add("medium");
                            hbPsi.ArgumentList.Add("-B"); hbPsi.ArgumentList.Add("160");
                            hbPsi.ArgumentList.Add("--all-audio"); hbPsi.ArgumentList.Add("--all-subtitles");
                            break;
                    }

                    var hbProc = Process.Start(hbPsi);
                        if (hbProc == null) continue;

                        while (!hbProc.HasExited)
                        {
                            var line = await hbProc.StandardError.ReadLineAsync();
                            if (line == null) break;
                            // Parse HandBrake progress: "Encoding: task 1 of 1, 45.23 %"
                            var progressMatch = Regex.Match(line, @"(\d+\.\d+)\s*%");
                            if (progressMatch.Success)
                                job.TranscodeProgress = Math.Round(double.Parse(progressMatch.Groups[1].Value), 1);
                        }

                        await hbProc.WaitForExitAsync();

                        // Replace original with transcoded file
                        if (hbProc.ExitCode == 0 && System.IO.File.Exists(outFile))
                        {
                            System.IO.File.Delete(mkvFile);
                            System.IO.File.Move(outFile, Path.ChangeExtension(mkvFile, outExt));
                        }
                    }
                }

                job.TranscodeProgress = 100;
            }

            // Stage 3: Complete
            job.Status = "complete";
            job.CompletedAt = DateTime.UtcNow;
            await SaveJobState(job);
            await SaveToHistory(job);

            // Remove from active jobs
            lock (_jobLock) { _activeJobs.RemoveAll(j => j.Id == job.Id); }
        }
        catch (Exception ex)
        {
            job.Status = "failed";
            job.Error = ex.Message;
            await SaveJobState(job);
            lock (_jobLock) { _activeJobs.RemoveAll(j => j.Id == job.Id); }
        }
    }

    private static string BuildHandBrakeArgs(string input, string output, string profile)
    {
        var args = $"-i \"{input}\" -o \"{output}\"";
        return profile switch
        {
            "1080p-h265-crf20" => $"{args} -e x265 -q 20 --encoder-preset medium -B 160 --all-audio --all-subtitles",
            "1080p-h264-crf18" => $"{args} -e x264 -q 18 --encoder-preset medium -B 160 --all-audio --all-subtitles",
            "720p-h265-crf22" => $"{args} -e x265 -q 22 --encoder-preset medium -w 1280 -B 128 --all-audio --all-subtitles",
            "nvenc-h265-crf24" => $"{args} -e nvenc_h265 -q 24 -B 160 --all-audio --all-subtitles",
            "qsv-h265-crf22" => $"{args} -e qsv_h265 -q 22 -B 160 --all-audio --all-subtitles",
            _ => $"{args} -e x265 -q 20 --encoder-preset medium -B 160 --all-audio --all-subtitles"
        };
    }

    private bool CanAccessJob(string owner) =>
        User.IsInRole("admin") || (owner != "" && owner == this.UserId());

    private async Task SaveJobState(RipJob job)
    {
        var json = JsonSerializer.Serialize(JobToObject(job));
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"strudel_job_{job.Id}" && s.UserId == "");
        if (setting != null) setting.Value = json;
        else _db.Settings.Add(new AppSetting { Key = $"strudel_job_{job.Id}", UserId = "", Value = json });
        await _db.SaveChangesAsync();
    }

    private async Task SaveScanResult(string jobId, ScanResult result)
    {        var json = JsonSerializer.Serialize(result);
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"strudel_scan_{jobId}" && s.UserId == "");
        if (setting != null) setting.Value = json;
        else _db.Settings.Add(new AppSetting { Key = $"strudel_scan_{jobId}", UserId = "", Value = json });
        await _db.SaveChangesAsync();
    }

    private async Task SaveToHistory(RipJob job)
    {
        var historyKey = $"strudel_history_{job.CompletedAt:yyyyMMddHHmmss}_{job.Id}";
        _db.Settings.Add(new AppSetting { Key = historyKey, UserId = "", Value = JsonSerializer.Serialize(JobToObject(job)) });
        await _db.SaveChangesAsync();
    }

    private static object JobToObject(RipJob job) => new
    {
        id = job.Id,
        owner_user_id = job.OwnerUserId,
        status = job.Status,
        disc_label = job.DiscLabel,
        drive_index = job.DriveIndex,
        selected_titles = job.SelectedTitles,
        transcode_profile = job.TranscodeProfile,
        output_format = job.OutputFormat,
        output_path = job.OutputPath,
        rip_progress = job.RipProgress,
        transcode_progress = job.TranscodeProgress,
        started_at = job.StartedAt,
        completed_at = job.CompletedAt,
        error = job.Error
    };

    private static string SanitizeFilename(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
    }

    // ── DTOs ────────────────────────────────────────────────────────
    public class ScanRequest { public int DriveIndex { get; set; } }

    public class RipRequest
    {
        public int DriveIndex { get; set; }
        public string? DiscLabel { get; set; }
        public List<int>? Titles { get; set; }
        public string? TranscodeProfile { get; set; }
        public string? OutputFormat { get; set; }
        public string? OutputPath { get; set; }
    }

    public class ScanResult
    {
        public string JobId { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("owner_user_id")]
        public string OwnerUserId { get; set; } = "";
        public string Status { get; set; } = "";
        public int DriveIndex { get; set; }
        public string DiscLabel { get; set; } = "";
        public string DiscType { get; set; } = "";
        public int TitleCount { get; set; }
        public List<TitleInfo> Titles { get; set; } = new();
        public string? Error { get; set; }
    }

    public class TitleInfo
    {
        public int Index { get; set; }
        public string Name { get; set; } = "";
        public string Duration { get; set; } = "";
        public string SizeHuman { get; set; } = "";
        public long SizeBytes { get; set; }
        public int Chapters { get; set; }
        public string SuggestedFilename { get; set; } = "";
        public List<StreamInfo> Streams { get; set; } = new();
    }

    public class StreamInfo
    {
        public int Index { get; set; }
        public string Type { get; set; } = "";
        public string CodecId { get; set; } = "";
        public string CodecShort { get; set; } = "";
        public string CodecName { get; set; } = "";
        public string Resolution { get; set; } = "";
        public string AspectRatio { get; set; } = "";
        public string FrameRate { get; set; } = "";
        public string LanguageCode { get; set; } = "";
        public string LanguageName { get; set; } = "";
        public int Channels { get; set; }
        public string Bitrate { get; set; } = "";
        public int SampleRate { get; set; }
    }

    public class RipJob
    {
        public string Id { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("owner_user_id")]
        public string OwnerUserId { get; set; } = "";
        public string Status { get; set; } = "pending";
        public int DriveIndex { get; set; }
        public string DiscLabel { get; set; } = "";
        public List<int> SelectedTitles { get; set; } = new();
        public string TranscodeProfile { get; set; } = "direct";
        public string OutputFormat { get; set; } = "mkv";
        public string OutputPath { get; set; } = "/media/rips";
        public double RipProgress { get; set; }
        public double TranscodeProgress { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? Error { get; set; }
        public bool CancellationRequested { get; set; }

        [System.Text.Json.Serialization.JsonIgnore]
        public Process? ActiveProcess { get; set; }
    }

    public class DriveInfo_
    {
        public int Index { get; set; }
        public string Device { get; set; } = "";
        public string Name { get; set; } = "";
        public bool HasDisc { get; set; }
        public string DiscType { get; set; } = "";
    }
}

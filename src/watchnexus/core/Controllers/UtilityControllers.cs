using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── User Preferences ──────────────────────────────────
[Route("api/user")]
[ApiController]
[Authorize]
public class UserPreferencesController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserPreferencesController(AppDbContext db) => _db = db;

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
        var prefs = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == "user_preferences");
        if (prefs?.Value != null)
        {
            try { return Content(prefs.Value, "application/json"); }
            catch { }
        }
        return Ok(new { visible_tabs = Array.Empty<string>() });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest(new { detail = "preferences must be a JSON object" });
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "user_preferences");
        var merged = MergePreferences(existing?.Value, body);
        if (existing != null) existing.Value = merged;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting
        { Key = "user_preferences", Value = merged, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    // Shallow merge: top-level keys in the update replace stored ones; keys
    // not sent are preserved (a partial PUT must not wipe other preferences).
    internal static string MergePreferences(string? stored, JsonElement update)
    {
        var map = new Dictionary<string, JsonElement>();
        if (!string.IsNullOrEmpty(stored))
        {
            try
            {
                using var doc = JsonDocument.Parse(stored);
                if (doc.RootElement.ValueKind == JsonValueKind.Object)
                    foreach (var p in doc.RootElement.EnumerateObject()) map[p.Name] = p.Value.Clone();
            }
            catch (JsonException) { }
        }
        foreach (var p in update.EnumerateObject()) map[p.Name] = p.Value.Clone();
        return JsonSerializer.Serialize(map);
    }
}

// ── Kodi — REMOVED (no longer a stub; Kodi addon browsing requires a live Kodi instance) ──

// ── Zest (Log/Health viewer) ──────────────────────────────────
[Route("api/zest")]
[ApiController]
[Authorize]
public class ZestController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health()
    {
        var process = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            status = "healthy",
            uptime_seconds = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds,
            memory_mb = Math.Round(process.WorkingSet64 / 1048576.0, 1),
            threads = process.Threads.Count,
            timestamp = DateTime.UtcNow
        });
    }
    private readonly WatchNexus.Core.Services.FileLogSink _sink;
    public ZestController(WatchNexus.Core.Services.FileLogSink sink) => _sink = sink;

    // Same log dir / active file the file logger writes (see Services/FileLogging.cs).
    private string? ActiveLogFile()
    {
        var current = _sink.CurrentFilePath;
        if (current != null && System.IO.File.Exists(current)) return current;
        if (!Directory.Exists(_sink.Directory)) return null;
        return new DirectoryInfo(_sink.Directory)
            .EnumerateFiles(WatchNexus.Core.Services.FileLogSink.FilePrefix + "*.log")
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .FirstOrDefault()?.FullName;
    }

    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var logDir = _sink.Directory;
        var logFiles = Directory.Exists(logDir) ? Directory.GetFiles(logDir, "*.log*") : Array.Empty<string>();
        return Ok(new { log_files = logFiles.Length, total_log_size = logFiles.Sum(f => new FileInfo(f).Length), last_scan = (string?)null });
    }
    [HttpGet("logs")]
    public IActionResult Logs([FromQuery] int lines = 100)
    {
        var logFile = ActiveLogFile();
        if (logFile == null) return Ok(Array.Empty<object>());
        var take = Math.Clamp(lines, 1, 1000);
        var tail = new Queue<string>(take);
        using (var fs = new FileStream(logFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
        using (var reader = new StreamReader(fs))
        {
            string? line;
            while ((line = reader.ReadLine()) != null)
            {
                if (tail.Count == take) tail.Dequeue();
                tail.Enqueue(line);
            }
        }
        return Ok(tail.Select(l => new { line = l, timestamp = DateTime.UtcNow }));
    }
    [HttpPost("logs/clear")]
    [Authorize(Roles = "admin")]
    public IActionResult ClearLogs()
    {
        var logFile = ActiveLogFile();
        if (logFile != null) _sink.Truncate(logFile);
        return Ok(new { status = "cleared" });
    }
}

// ── Adapter (FFmpeg) — delegates to Crucible pipeline ──────────────────────────────────
[Route("api/adapter")]
[ApiController]
[Authorize]
public class AdapterController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdapterController(AppDbContext db) => _db = db;

    [HttpPost("convert")]
    public async Task<IActionResult> Convert([FromBody] JsonElement body)
    {
        var sourcePath = body.TryGetProperty("source_path", out var sp) ? sp.GetString() ?? "" : "";
        var profile = body.TryGetProperty("profile", out var pr) ? pr.GetString() ?? "h265-default" : "h265-default";
        if (string.IsNullOrEmpty(sourcePath))
            return BadRequest(new { status = "error", message = "source_path is required" });
        // Same policy as Crucible: only files inside the configured media roots
        // (checked before File.Exists so this isn't a filesystem probe).
        if (!MediaPaths.IsAllowedPath(sourcePath))
            return BadRequest(new { status = "error", message = "source_path must be inside an allowed media directory" });
        if (!System.IO.File.Exists(sourcePath))
            return NotFound(new { status = "error", message = $"File not found: {sourcePath}" });

        // Check if FFmpeg is installed (cross-platform — Windows/Linux/macOS)
        var ffmpeg = Services.FfmpegLocator.Ffmpeg;
        if (ffmpeg == null)
            return Ok(new
            {
                status = "error",
                message = "FFmpeg is not installed. Install FFmpeg to use media conversion.",
                install_hint = Services.FfmpegLocator.InstallHint()
            });

        // Create a transcode job via Crucible's data model
        var job = new TranscodeJob
        {
            UserId = this.UserId(),
            SourcePath = sourcePath,
            Profile = profile,
            SourceSize = new FileInfo(sourcePath).Length,
        };
        _db.TranscodeJobs.Add(job);
        await _db.SaveChangesAsync();
        return Ok(new { status = "queued", job_id = job.Id, source = sourcePath, profile, message = "Conversion job queued. Monitor via /api/crucible/jobs" });
    }
}

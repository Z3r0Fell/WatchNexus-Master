using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

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
            catch { Log.Error("[UserPreferencesController] GetPreferences failed"); }
        }
        return Ok(new { visible_tabs = Array.Empty<string>() });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "user_preferences");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting
        { Key = "user_preferences", Value = body.GetRawText(), UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
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
    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var logDir = Path.Combine(AppContext.BaseDirectory, "logs");
        var logFiles = Directory.Exists(logDir) ? Directory.GetFiles(logDir, "*.log*") : Array.Empty<string>();
        return Ok(new { log_files = logFiles.Length, total_log_size = logFiles.Sum(f => new FileInfo(f).Length), last_scan = (string?)null });
    }
    [HttpGet("logs")]
    public IActionResult Logs([FromQuery] int lines = 100)
    {
        var logFile = Path.Combine(AppContext.BaseDirectory, "logs", "watchnexus.log");
        if (!System.IO.File.Exists(logFile)) return Ok(Array.Empty<object>());
        var allLines = System.IO.File.ReadAllLines(logFile);
        return Ok(allLines.TakeLast(lines).Select(l => new { line = l, timestamp = DateTime.UtcNow }));
    }
    [HttpPost("logs/clear")]
    public IActionResult ClearLogs()
    {
        var logFile = Path.Combine(AppContext.BaseDirectory, "logs", "watchnexus.log");
        if (System.IO.File.Exists(logFile)) System.IO.File.WriteAllText(logFile, "");
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
        if (!System.IO.File.Exists(sourcePath))
            return NotFound(new { status = "error", message = $"File not found: {sourcePath}" });

        // Check if FFmpeg is installed
        var ffmpeg = new[] { "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg" }
            .FirstOrDefault(System.IO.File.Exists);
        if (ffmpeg == null)
            return Ok(new { status = "error", message = "FFmpeg is not installed. Install FFmpeg to use media conversion.", install_hint = "sudo apt install ffmpeg" });

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

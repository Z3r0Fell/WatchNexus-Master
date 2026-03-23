using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public SettingsController(AppDbContext db, IConfiguration config, IHttpClientFactory httpFactory)
    { _db = db; _config = config; _httpFactory = httpFactory; }

    public record SettingValue(string Value);
    public record TmdbUpdate(string Api_key);
    public record QbitUpdate(string Host = "localhost", int Port = 8080, string Username = "admin", string Password = "", bool Enabled = false);

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _db.Settings.Where(s => s.UserId == UserId || s.UserId == null).ToListAsync();
        return Ok(settings.ToDictionary(s => s.Key, s => s.Value));
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        var s = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && (s.UserId == UserId || s.UserId == null));
        if (s == null || s.Value == null) return Ok(new { key, value = (string?)null });
        // Try to return as parsed JSON if possible
        try
        {
            var doc = JsonDocument.Parse(s.Value);
            return Content(s.Value, "application/json");
        }
        catch
        {
            return Ok(new { key, value = s.Value });
        }
    }

    [HttpPut]
    public async Task<IActionResult> SetBulk([FromBody] JsonElement body)
    {
        foreach (var prop in body.EnumerateObject())
        {
            var key = prop.Name;
            var value = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString()! : prop.Value.GetRawText();
            var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
            if (existing != null) existing.Value = value;
            else _db.Settings.Add(new AppSetting { Key = key, Value = value, UserId = UserId });
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] JsonElement body)
    {
        // Accept both {"value": "..."} and arbitrary JSON objects
        string value;
        if (body.TryGetProperty("value", out var v) || body.TryGetProperty("Value", out v))
            value = v.ValueKind == JsonValueKind.String ? v.GetString()! : v.GetRawText();
        else
            value = body.GetRawText();

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new AppSetting { Key = key, Value = value, UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { key, value });
    }

    [HttpGet("integrations")]
    public async Task<IActionResult> GetIntegrations()
    {
        var tmdbSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.UserId == UserId);
        var qbitSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbittorrent_settings" && s.UserId == UserId);
        var envKey = _config["TMDB_API_KEY"] ?? "";
        var tmdbKey = tmdbSetting?.Value ?? envKey;

        return Ok(new
        {
            tmdb = new { api_key = tmdbKey, has_key = !string.IsNullOrEmpty(tmdbKey), source = !string.IsNullOrEmpty(tmdbSetting?.Value) ? "user" : (!string.IsNullOrEmpty(envKey) ? "env" : "none") },
            qbittorrent = !string.IsNullOrEmpty(qbitSetting?.Value)
                ? JsonSerializer.Deserialize<object>(qbitSetting.Value)
                : new { host = "localhost", port = 8080, username = "admin", password = "", enabled = false }
        });
    }

    [HttpPut("integrations/tmdb")]
    public async Task<IActionResult> UpdateTmdb([FromBody] TmdbUpdate req)
    {
        if (!string.IsNullOrEmpty(req.Api_key))
        {
            var client = _httpFactory.CreateClient();
            try
            {
                var resp = await client.GetAsync($"https://api.themoviedb.org/3/configuration?api_key={req.Api_key}");
                if (!resp.IsSuccessStatusCode) return BadRequest(new { detail = "Invalid TMDB API key" });
            }
            catch { return BadRequest(new { detail = "Could not verify TMDB API key" }); }
        }

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.UserId == UserId);
        if (existing != null) existing.Value = req.Api_key;
        else _db.Settings.Add(new AppSetting { Key = "tmdb_api_key", Value = req.Api_key, UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", has_key = !string.IsNullOrEmpty(req.Api_key) });
    }

    [HttpPut("integrations/qbittorrent")]
    public async Task<IActionResult> UpdateQbit([FromBody] QbitUpdate req)
    {
        var json = JsonSerializer.Serialize(req);
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbittorrent_settings" && s.UserId == UserId);
        if (existing != null) existing.Value = json;
        else _db.Settings.Add(new AppSetting { Key = "qbittorrent_settings", Value = json, UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", settings = req });
    }

    [HttpPost("integrations/qbittorrent/test")]
    public async Task<IActionResult> TestQbit([FromBody] QbitUpdate req)
    {
        try
        {
            var client = _httpFactory.CreateClient();
            var resp = await client.GetAsync($"http://{req.Host}:{req.Port}/api/v2/auth/login");
            return Ok(new { success = resp.IsSuccessStatusCode });
        }
        catch { return Ok(new { success = false, error = "Connection failed" }); }
    }
}

[ApiController]
[Route("api/logs")]
[Authorize]
public class LogsController : ControllerBase
{
    private static readonly string LogDir = Path.Combine(AppContext.BaseDirectory, "logs");

    [HttpGet]
    [HttpGet("list")]
    public IActionResult GetFiles()
    {
        if (!Directory.Exists(LogDir)) return Ok(Array.Empty<object>());
        var files = Directory.GetFiles(LogDir, "*.log*").Select(f =>
        {
            var fi = new FileInfo(f);
            return new { filename = fi.Name, size = fi.Length, modified = fi.LastWriteTimeUtc };
        });
        return Ok(files);
    }

    [HttpGet("latest")]
    public IActionResult GetLatest(int lines = 100)
    {
        var logFile = Path.Combine(LogDir, "watchnexus.log");
        if (!System.IO.File.Exists(logFile)) return Ok(new { entries = Array.Empty<object>(), total = 0 });
        var allLines = System.IO.File.ReadAllLines(logFile);
        var entries = allLines.TakeLast(lines).Select(l => new { line = l, timestamp = DateTime.UtcNow });
        return Ok(new { entries, total = allLines.Length });
    }

    [HttpGet("system")]
    public IActionResult SystemHealth()
    {
        var process = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            uptime_seconds = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds,
            memory_mb = process.WorkingSet64 / 1024.0 / 1024.0,
            cpu_time_seconds = process.TotalProcessorTime.TotalSeconds,
            threads = process.Threads.Count,
        });
    }
}

[ApiController]
[Route("api/downloads")]
[Authorize]
public class DownloadsController : ControllerBase
{
    private readonly AppDbContext _db;
    public DownloadsController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status = null)
    {
        var q = _db.Downloads.AsQueryable();
        if (!string.IsNullOrEmpty(status)) q = q.Where(d => d.Status == status);
        return Ok(await q.OrderByDescending(d => d.CreatedAt).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Add(
        [FromQuery] string? title,
        [FromQuery] string? media_type,
        [FromQuery] int? tmdb_id,
        [FromQuery] long? size)
    {
        var dl = new DownloadItem
        {
            Name = title ?? "Unknown",
            Url = $"tmdb:{tmdb_id}:{media_type}",
            Status = "queued",
            Progress = 0,
            Size = size ?? 0,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Downloads.Add(dl);
        await _db.SaveChangesAsync();
        return Ok(new { id = dl.Id, name = dl.Name, status = dl.Status });
    }

    [HttpPatch("{downloadId}")]
    public async Task<IActionResult> Update(string downloadId, [FromQuery] string? status, [FromQuery] double? progress)
    {
        var dl = await _db.Downloads.FindAsync(downloadId);
        if (dl == null) return NotFound(new { error = "Download not found" });
        if (!string.IsNullOrEmpty(status)) dl.Status = status;
        if (progress.HasValue) dl.Progress = progress.Value;
        await _db.SaveChangesAsync();
        return Ok(new { id = dl.Id, status = dl.Status, progress = dl.Progress });
    }

    [HttpDelete("{downloadId}")]
    public async Task<IActionResult> Delete(string downloadId)
    {
        var dl = await _db.Downloads.FindAsync(downloadId);
        if (dl != null) { _db.Downloads.Remove(dl); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }

    // ── Built-in Download Engine ────────────────────────
    [HttpGet("engine/status")]
    public IActionResult EngineStatus() => Ok(new { engine = "built-in", status = "idle", active_downloads = 0 });

    [HttpGet("engine/torrents")]
    public IActionResult EngineTorrents() => Ok(Array.Empty<object>());

    [HttpGet("engine/{torrentId}")]
    public IActionResult EngineTorrent(string torrentId) => Ok(new { id = torrentId, status = "unknown" });

    [HttpPost("engine/add")]
    public IActionResult EngineAdd(
        [FromQuery] string? magnet,
        [FromQuery] string? save_path,
        [FromQuery] bool sequential = false,
        [FromQuery] string? category = "watchnexus")
    {
        if (string.IsNullOrEmpty(magnet)) return BadRequest(new { detail = "magnet link required" });
        return Ok(new { status = "added", magnet = magnet[..Math.Min(50, magnet.Length)] + "...", category });
    }

    [HttpGet("engine/{torrentId}/files")]
    public IActionResult EngineFiles(string torrentId) => Ok(Array.Empty<object>());

    [HttpPost("engine/{torrentId}/pause")]
    public IActionResult EnginePause(string torrentId) => Ok(new { status = "paused", id = torrentId });

    [HttpPost("engine/{torrentId}/resume")]
    public IActionResult EngineResume(string torrentId) => Ok(new { status = "resumed", id = torrentId });

    [HttpDelete("engine/{torrentId}")]
    public IActionResult EngineRemove(string torrentId, [FromQuery] bool delete_files = false) =>
        Ok(new { status = "removed", id = torrentId, files_deleted = delete_files });

    [HttpPost("engine/{torrentId}/sequential")]
    public IActionResult EngineSequential(string torrentId, [FromQuery] bool enabled = true) =>
        Ok(new { status = "updated", id = torrentId, sequential = enabled });

    [HttpGet("engine/settings")]
    public IActionResult EngineSettings() => Ok(new
    {
        download_path = Path.Combine(AppContext.BaseDirectory, "downloads"),
        max_concurrent = 3,
        sequential_download = false,
        auto_start = true,
        seed_ratio_limit = 1.0,
    });

    [HttpPut("engine/settings")]
    public IActionResult EngineUpdateSettings([FromBody] JsonElement body) => Ok(new { status = "updated" });

    [HttpPost("engine/pause-all")]
    public IActionResult EnginePauseAll() => Ok(new { status = "all_paused" });

    [HttpPost("engine/resume-all")]
    public IActionResult EngineResumeAll() => Ok(new { status = "all_resumed" });

    [HttpPost("engine/remove-completed")]
    public IActionResult EngineRemoveCompleted([FromQuery] bool delete_files = false) =>
        Ok(new { status = "completed_removed", files_deleted = delete_files });
}

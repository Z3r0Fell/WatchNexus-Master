using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
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

    // Settings the user must never be able to overwrite via the generic settings
    // API — security/licensing/infrastructure state the server manages itself.
    private static readonly string[] ReservedPrefixes =
        { "sec_", "fortress", "cellar_license", "jwt", "license_server", "patch_repo", "setup_completed" };

    private static bool IsReservedKey(string key)
    {
        var k = (key ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(k)) return true;
        return ReservedPrefixes.Any(prefix => k.StartsWith(prefix)) || k.Contains("secret");
    }

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
            if (IsReservedKey(key)) continue; // never let internal/security keys be written
            var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
            if (prop.Value.ValueKind == JsonValueKind.Null)
            {
                if (existing != null) _db.Settings.Remove(existing); // null = delete key
                continue;
            }
            var value = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString()! : prop.Value.GetRawText();
            if (existing != null) existing.Value = value;
            else _db.Settings.Add(new AppSetting { Key = key, Value = value, UserId = UserId });
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] JsonElement body)
    {
        if (IsReservedKey(key))
            return BadRequest(new { detail = $"'{key}' is a reserved internal setting and cannot be modified through this API." });

        // Accept both {"value": "..."} and arbitrary JSON objects; null deletes the key
        var target = (body.TryGetProperty("value", out var v) || body.TryGetProperty("Value", out v)) ? v : body;
        if (target.ValueKind == JsonValueKind.Null)
        {
            var toDelete = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
            if (toDelete != null) { _db.Settings.Remove(toDelete); await _db.SaveChangesAsync(); }
            return Ok(new { key, deleted = true });
        }
        var value = target.ValueKind == JsonValueKind.String ? target.GetString()! : target.GetRawText();

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new AppSetting { Key = key, Value = value, UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { key, value });
    }

    [HttpDelete("{key}")]
    public async Task<IActionResult> Delete(string key)
    {
        if (IsReservedKey(key))
            return BadRequest(new { detail = $"'{key}' is a reserved internal setting and cannot be modified through this API." });
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
        if (existing != null) { _db.Settings.Remove(existing); await _db.SaveChangesAsync(); }
        return Ok(new { key, deleted = existing != null });
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
        if (SsrfGuard.IsBlocked(req.Host))
            return BadRequest(new { success = false, detail = "That host is not allowed." });
        try
        {
            var client = _httpFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);
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
    // v1.0.0 ships WITHOUT a built-in torrent engine. These endpoints are
    // honest about that: reads return empty/unavailable, mutations 501.
    // Real downloads go through the qBittorrent integration (/api/qbittorrent).
    private const string EngineUnavailable =
        "The built-in torrent engine is not included in v1.0.0. Connect qBittorrent under Settings → Integrations to manage downloads.";

    private ObjectResult EngineNotImplemented() =>
        StatusCode(StatusCodes.Status501NotImplemented, new { detail = EngineUnavailable });

    [HttpGet("engine/status")]
    public IActionResult EngineStatus() => Ok(new
    {
        engine = "built-in",
        status = "unavailable",
        success = false,
        available = false,
        active_downloads = 0,
        detail = EngineUnavailable,
    });

    [HttpGet("engine/torrents")]
    public IActionResult EngineTorrents() => Ok(Array.Empty<object>());

    [HttpGet("engine/{torrentId}")]
    public IActionResult EngineTorrent(string torrentId) =>
        NotFound(new { detail = "Torrent not found — the built-in engine is not available in this release." });

    [HttpPost("engine/add")]
    public IActionResult EngineAdd() => EngineNotImplemented();

    [HttpGet("engine/{torrentId}/files")]
    public IActionResult EngineFiles(string torrentId) => Ok(Array.Empty<object>());

    [HttpPost("engine/{torrentId}/pause")]
    public IActionResult EnginePause(string torrentId) => EngineNotImplemented();

    [HttpPost("engine/{torrentId}/resume")]
    public IActionResult EngineResume(string torrentId) => EngineNotImplemented();

    [HttpDelete("engine/{torrentId}")]
    public IActionResult EngineRemove(string torrentId) => EngineNotImplemented();

    [HttpPost("engine/{torrentId}/sequential")]
    public IActionResult EngineSequential(string torrentId) => EngineNotImplemented();

    [HttpGet("engine/settings")]
    public IActionResult EngineSettings() => EngineNotImplemented();

    [HttpPut("engine/settings")]
    public IActionResult EngineUpdateSettings() => EngineNotImplemented();

    [HttpPost("engine/pause-all")]
    public IActionResult EnginePauseAll() => EngineNotImplemented();

    [HttpPost("engine/resume-all")]
    public IActionResult EngineResumeAll() => EngineNotImplemented();

    [HttpPost("engine/remove-completed")]
    public IActionResult EngineRemoveCompleted() => EngineNotImplemented();
}

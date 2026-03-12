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
        return s == null ? Ok(new { key, value = (string?)null }) : Ok(new { key, s.Value });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] SettingValue req)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
        if (existing != null) existing.Value = req.Value;
        else _db.Settings.Add(new AppSetting { Key = key, Value = req.Value, UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { key, value = req.Value });
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
    public async Task<IActionResult> GetAll(string? status = null)
    {
        var q = _db.Downloads.AsQueryable();
        if (!string.IsNullOrEmpty(status)) q = q.Where(d => d.Status == status);
        return Ok(await q.OrderByDescending(d => d.CreatedAt).ToListAsync());
    }

    [HttpGet("engine/status")]
    public IActionResult EngineStatus() => Ok(new { engine = "built-in", status = "idle", active_downloads = 0 });
}

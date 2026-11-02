using System.Security.Claims;
using System.Text.Json;
using System.Net;
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

    private static readonly string[] ReservedExact =
        { "api_key", "tmdb_api_key", "crumbs_tmdb", "qbit_config", "qbittorrent_settings", "cellar_license" };

    private static bool IsReservedKey(string key)
    {
        var k = (key ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(k)) return true;
        if (ReservedPrefixes.Any(prefix => k.StartsWith(prefix))) return true;
        if (k.Contains("secret")) return true;
        if (k.Contains("password")) return true;
        if (k.Contains("api_key")) return true;
        if (k.Contains("token")) return true;
        if (ReservedExact.Contains(k)) return true;
        return false;
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

    // Secrets are never echoed back in plaintext. The UI round-trips the masked
    // value, so a save that sends the mask back means "keep the stored secret".
    internal const string SecretMask = "********";

    internal static string MaskSecret(string? secret) =>
        string.IsNullOrEmpty(secret) ? "" : SecretMask + (secret.Length > 4 ? secret[^4..] : "");

    internal static bool IsMasked(string? value) =>
        !string.IsNullOrEmpty(value) && value.StartsWith(SecretMask, StringComparison.Ordinal);

    private static string? ReadProp(JsonElement doc, string name)
    {
        foreach (var prop in doc.EnumerateObject())
            if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                return prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText();
        return null;
    }

    /// <summary>Reads a stored qBittorrent settings row, tolerant of legacy PascalCase and lowercase keys.</summary>
    internal static QbitUpdate? ParseQbit(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var doc = JsonDocument.Parse(json).RootElement;
            if (doc.ValueKind != JsonValueKind.Object) return null;
            var host = ReadProp(doc, "host");
            var port = int.TryParse(ReadProp(doc, "port"), out var p) ? p : 8080;
            var enabled = string.Equals(ReadProp(doc, "enabled"), "true", StringComparison.OrdinalIgnoreCase);
            return new QbitUpdate(string.IsNullOrWhiteSpace(host) ? "localhost" : host!, port,
                ReadProp(doc, "username") ?? "", ReadProp(doc, "password") ?? "", enabled);
        }
        catch (JsonException) { return null; }
    }

    [HttpGet("integrations")]
    public async Task<IActionResult> GetIntegrations()
    {
        var tmdbSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.UserId == UserId);
        var qbitSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbittorrent_settings" && s.UserId == UserId);
        var envKey = _config["TMDB_API_KEY"] ?? "";
        var userKey = tmdbSetting?.Value ?? "";
        var source = !string.IsNullOrEmpty(userKey) ? "user" : (!string.IsNullOrEmpty(envKey) ? "env" : "none");
        var tmdbKey = source == "user" ? userKey : envKey;
        var qbit = ParseQbit(qbitSetting?.Value);

        return Ok(new
        {
            // Never return a key in plaintext (the env key is a server secret).
            tmdb = new
            {
                api_key = source == "user" ? MaskSecret(tmdbKey) : "",
                has_key = !string.IsNullOrEmpty(tmdbKey),
                configured = !string.IsNullOrEmpty(tmdbKey),
                last4 = tmdbKey.Length > 4 ? tmdbKey[^4..] : "",
                source
            },
            qbittorrent = qbit != null
                ? new { host = qbit.Host, port = qbit.Port, username = qbit.Username, password = MaskSecret(qbit.Password), enabled = qbit.Enabled }
                : new { host = "localhost", port = 8080, username = "admin", password = "", enabled = false }
        });
    }

    [HttpPut("integrations/tmdb")]
    public async Task<IActionResult> UpdateTmdb([FromBody] TmdbUpdate req)
    {
        // The UI echoes back the masked key when the user didn't change it.
        if (IsMasked(req.Api_key))
            return Ok(new { status = "unchanged", has_key = true });

        if (!string.IsNullOrEmpty(req.Api_key))
        {
            var client = _httpFactory.CreateClient();
            try
            {
                var resp = await client.GetAsync($"https://api.themoviedb.org/3/configuration?api_key={Uri.EscapeDataString(req.Api_key)}");
                if (!resp.IsSuccessStatusCode) return BadRequest(new { detail = "Invalid TMDB API key" });
            }
            catch { return BadRequest(new { detail = "Could not verify TMDB API key" }); }
        }

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.UserId == UserId);
        if (existing != null) existing.Value = req.Api_key ?? "";
        else _db.Settings.Add(new AppSetting { Key = "tmdb_api_key", Value = req.Api_key ?? "", UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", has_key = !string.IsNullOrEmpty(req.Api_key) });
    }

    [HttpPut("integrations/qbittorrent")]
    public async Task<IActionResult> UpdateQbit([FromBody] QbitUpdate req)
    {
        var host = string.IsNullOrWhiteSpace(req.Host) ? "localhost" : req.Host.Trim();
        if (req.Port < 1 || req.Port > 65535) return BadRequest(new { detail = "Port must be between 1 and 65535." });
        if (SsrfGuard.IsBlocked(host)) return BadRequest(new { detail = "That host is not allowed." });

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbittorrent_settings" && s.UserId == UserId);
        var password = req.Password ?? "";
        if (IsMasked(password)) password = ParseQbit(existing?.Value)?.Password ?? "";

        // Lowercase keys — the same shape qbit_config / QBittorrentClient.ParseConfig read.
        var json = JsonSerializer.Serialize(new { host, port = req.Port, username = req.Username ?? "", password, enabled = req.Enabled });
        if (existing != null) existing.Value = json;
        else _db.Settings.Add(new AppSetting { Key = "qbittorrent_settings", Value = json, UserId = UserId });

        // Keep the per-user qbit_config (what the qBittorrent client actually reads) in sync.
        var cfgJson = JsonSerializer.Serialize(new { host, port = req.Port, username = req.Username ?? "", password });
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == UserId);
        if (cfg != null) cfg.Value = cfgJson;
        else _db.Settings.Add(new AppSetting { Key = "qbit_config", Value = cfgJson, UserId = UserId });

        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", settings = new { host, port = req.Port, username = req.Username ?? "", password = MaskSecret(password), enabled = req.Enabled } });
    }

    [HttpPost("integrations/qbittorrent/test")]
    public async Task<IActionResult> TestQbit([FromBody] QbitUpdate req)
    {
        if (SsrfGuard.IsBlocked(req.Host))
            return BadRequest(new { success = false, detail = "That host is not allowed." });

        if (!IPAddress.TryParse(req.Host, out var ip) && !Uri.CheckHostName(req.Host).Equals(UriHostNameType.Dns))
            return BadRequest(new { success = false, detail = "Invalid host format." });
        if (req.Port < 1 || req.Port > 65535)
            return BadRequest(new { success = false, detail = "Invalid port." });

        var password = req.Password ?? "";
        if (IsMasked(password))
        {
            var stored = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbittorrent_settings" && s.UserId == UserId);
            password = ParseQbit(stored?.Value)?.Password ?? "";
        }

        try
        {
            var client = _httpFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);
            // qBittorrent's login is POST-only and answers 200 "Fails." on bad credentials.
            var resp = await client.PostAsync($"http://{req.Host}:{req.Port}/api/v2/auth/login",
                new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("username", req.Username ?? ""),
                    new KeyValuePair<string, string>("password", password),
                }));
            var body = (await resp.Content.ReadAsStringAsync()).Trim();
            var ok = resp.IsSuccessStatusCode && body.StartsWith("Ok", StringComparison.OrdinalIgnoreCase);
            return Ok(new { success = ok, error = ok ? null : (resp.IsSuccessStatusCode ? "Authentication failed" : $"HTTP {(int)resp.StatusCode}") });
        }
        catch { return Ok(new { success = false, error = "Connection failed" }); }
    }
}

[ApiController]
[Route("api/downloads")]
[Authorize]
public class DownloadsController : ControllerBase
{
    private readonly AppDbContext _db;
    public DownloadsController(AppDbContext db) { _db = db; }

    public record DownloadCreate(string? Title, string? Media_type, int? Tmdb_id, long? Size);

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
        [FromQuery] long? size,
        [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] DownloadCreate? body = null)
    {
        // The frontend sends these as a JSON body; older callers use the query string.
        title ??= body?.Title;
        media_type ??= body?.Media_type;
        tmdb_id ??= body?.Tmdb_id;
        size ??= body?.Size;
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
}

using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ── Churro (qBittorrent) ────────────────────────────────────
[Route("api/qbittorrent")]
[ApiController]
[Authorize]
public class QBittorrentController : ControllerBase
{
    private readonly AppDbContext _db;
    public QBittorrentController(AppDbContext db) => _db = db;

    internal record QbitCfg(string Host, int Port, string Username, string Password);

    /// <summary>
    /// Parses a stored qbit_config row. Tolerant of key casing (legacy rows were
    /// written PascalCase) and of the port being stored as a string.
    /// </summary>
    internal static QbitCfg? ParseCfg(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var doc = JsonDocument.Parse(json).RootElement;
            if (doc.ValueKind != JsonValueKind.Object) return null;
            string? Read(string name)
            {
                foreach (var prop in doc.EnumerateObject())
                    if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                        return prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText();
                return null;
            }
            var host = Read("host");
            var port = int.TryParse(Read("port"), out var p) ? p : 8080;
            return new QbitCfg(string.IsNullOrWhiteSpace(host) ? "localhost" : host!.Trim(), port, Read("username") ?? "", Read("password") ?? "");
        }
        catch (JsonException) { return null; }
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var cfg = await GetQbitConfig();
        if (cfg == null) return Ok(new { connected = false, status = "not_configured" });
        if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(cfg.Host))
            return Ok(new { connected = false, status = "blocked", error = "Host is not allowed." });
        try
        {
            // Every qBittorrent API call except auth/login requires the SID cookie,
            // so log in first; an unauthenticated version probe always gets 403.
            var cookie = await AuthQbit(cfg);
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(5);
            if (cookie != null) http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetAsync($"http://{cfg.Host}:{cfg.Port}/api/v2/app/version");
            if (resp.IsSuccessStatusCode)
            {
                var ver = await resp.Content.ReadAsStringAsync();
                return Ok(new { connected = true, status = "connected", version = ver });
            }
            if (cookie == null)
                return Ok(new { connected = false, status = "auth_failed", error = "qBittorrent rejected the saved username/password." });
            return Ok(new { connected = false, status = "unreachable" });
        }
        catch (Exception ex) { return Ok(new { connected = false, status = "error", error = ex.Message }); }
    }

    [HttpGet("torrents")]
    public async Task<IActionResult> Torrents()
    {
        var cfg = await GetQbitConfig();
        if (cfg == null) return Ok(Array.Empty<object>());
        try
        {
            var cookie = await AuthQbit(cfg);
            if (cookie == null) return Ok(Array.Empty<object>());
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetStringAsync($"http://{cfg.Host}:{cfg.Port}/api/v2/torrents/info");
            return Content(resp, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpPost("add")]
    public async Task<IActionResult> Add([FromQuery] string? url, [FromQuery] string? magnet, [FromQuery] string? category)
    {
        var cfg = await GetQbitConfig();
        if (cfg == null) return BadRequest(new { detail = "qBittorrent not configured" });
        var link = magnet ?? url ?? "";
        if (string.IsNullOrWhiteSpace(link)) return BadRequest(new { detail = "A magnet link or torrent URL is required" });
        try
        {
            var cookie = await AuthQbit(cfg);
            if (cookie == null) return BadRequest(new { detail = "qBittorrent auth failed" });
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            using var content = new MultipartFormDataContent();
            content.Add(new StringContent(link), "urls");
            if (!string.IsNullOrEmpty(category)) content.Add(new StringContent(category), "category");
            var resp = await http.PostAsync($"http://{cfg.Host}:{cfg.Port}/api/v2/torrents/add", content);
            var body = (await resp.Content.ReadAsStringAsync()).Trim();
            // qBittorrent answers 200 "Fails." when it rejects the torrent.
            if (!resp.IsSuccessStatusCode || body.StartsWith("Fails", StringComparison.OrdinalIgnoreCase))
                return StatusCode(502, new { detail = $"qBittorrent rejected the torrent ({(int)resp.StatusCode} {body})" });
            return Ok(new { status = "added" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("pause/{hash}")]
    public async Task<IActionResult> Pause(string hash) => await QbitAction($"torrents/pause?hashes={Uri.EscapeDataString(hash)}");
    [HttpPost("resume/{hash}")]
    public async Task<IActionResult> Resume(string hash) => await QbitAction($"torrents/resume?hashes={Uri.EscapeDataString(hash)}");
    [HttpDelete("delete/{hash}")]
    public async Task<IActionResult> Delete(string hash, [FromQuery] bool delete_files = false) =>
        await QbitAction($"torrents/delete?hashes={Uri.EscapeDataString(hash)}&deleteFiles={(delete_files ? "true" : "false")}");

    [HttpGet("files/{hash}")]
    public async Task<IActionResult> Files(string hash)
    {
        var cfg = await GetQbitConfig();
        if (cfg == null) return Ok(Array.Empty<object>());
        try
        {
            var cookie = await AuthQbit(cfg);
            if (cookie == null) return Ok(Array.Empty<object>());
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetStringAsync($"http://{cfg.Host}:{cfg.Port}/api/v2/torrents/files?hash={Uri.EscapeDataString(hash)}");
            return Content(resp, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var cfg = await GetQbitConfig();
        if (cfg == null) return Ok(new { host = "localhost", port = 8080, username = "", password = "", configured = false });
        // Never echo the stored password; the UI sends the mask back to mean "unchanged".
        return Ok(new { host = cfg.Host, port = cfg.Port, username = cfg.Username, password = SettingsController.MaskSecret(cfg.Password), configured = true });
    }

    public record QbitConfigRequest(string? Host, int? Port, string? Username, string? Password);

    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] QbitConfigRequest req)
    {
        var h = string.IsNullOrWhiteSpace(req.Host) ? "localhost" : req.Host!.Trim();
        var p = req.Port ?? 8080;
        if (p < 1 || p > 65535) return BadRequest(new { detail = "Port must be between 1 and 65535." });
        if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(h))
            return BadRequest(new { detail = "That host is not allowed." });

        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        var password = req.Password ?? "";
        if (SettingsController.IsMasked(password)) password = ParseCfg(cfg?.Value)?.Password ?? "";

        var value = JsonSerializer.Serialize(new { host = h, port = p, username = req.Username ?? "", password });
        if (cfg != null) { cfg.Value = value; }
        else { _db.Settings.Add(new AppSetting { Key = "qbit_config", UserId = this.UserId(), Value = value }); }
        await _db.SaveChangesAsync();
        return Ok(new { saved = true, host = h, port = p });
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] QbitConfigRequest req)
    {
        var h = string.IsNullOrWhiteSpace(req.Host) ? "localhost" : req.Host!.Trim();
        var p = req.Port ?? 8080;
        if (p < 1 || p > 65535) return BadRequest(new { success = false, error = "Invalid port" });
        if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(h))
            return BadRequest(new { success = false, detail = "That host is not allowed." });

        // DNS-based SSRF check: resolve hostname and verify no resolved IP targets
        // cloud metadata/link-local. Loopback and private IPs are allowed because
        // qBittorrent legitimately runs on localhost or the LAN.
        if (!IPAddress.TryParse(h, out _))
        {
            try
            {
                var addresses = await Dns.GetHostAddressesAsync(h);
                if (addresses.Length == 0 || addresses.Any(addr => WatchNexus.Core.Auth.SsrfGuard.IsBlocked(addr.ToString())))
                    return BadRequest(new { success = false, detail = "Host resolved to a blocked address." });
            }
            catch { return BadRequest(new { success = false, detail = "Unable to resolve host." }); }
        }

        var password = req.Password ?? "";
        if (SettingsController.IsMasked(password)) password = (await GetQbitConfig())?.Password ?? "";

        try
        {
            var cfg = new QbitCfg(h, p, req.Username ?? "", password);
            var cookie = await AuthQbit(cfg);
            if (cookie == null) return Ok(new { success = false, error = "Login failed — check the username and password." });
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(5);
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetAsync($"http://{h}:{p}/api/v2/app/version");
            if (resp.IsSuccessStatusCode)
                return Ok(new { success = true, version = await resp.Content.ReadAsStringAsync() });
            return Ok(new { success = false, error = $"HTTP {resp.StatusCode}" });
        }
        catch (Exception ex) { return Ok(new { success = false, error = ex.Message }); }
    }

    private async Task<QbitCfg?> GetQbitConfig()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        return ParseCfg(cfg?.Value);
    }

    /// <summary>Logs in and returns the SID cookie, or null on blocked host / bad credentials.</summary>
    private async Task<string?> AuthQbit(QbitCfg cfg)
    {
        if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(cfg.Host)) return null;
        var http = this.Http();
        http.Timeout = TimeSpan.FromSeconds(5);
        using var content = new FormUrlEncodedContent(new[] {
            new KeyValuePair<string, string>("username", cfg.Username),
            new KeyValuePair<string, string>("password", cfg.Password)
        });
        var resp = await http.PostAsync($"http://{cfg.Host}:{cfg.Port}/api/v2/auth/login", content);
        if (resp.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            // Send only "SID=..." back, not the cookie attributes.
            var first = cookies.FirstOrDefault();
            return first?.Split(';')[0];
        }
        return null;
    }

    private async Task<IActionResult> QbitAction(string path)
    {
        var cfg = await GetQbitConfig();
        if (cfg == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var cookie = await AuthQbit(cfg);
            if (cookie == null) return BadRequest(new { detail = "Auth failed" });
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.PostAsync($"http://{cfg.Host}:{cfg.Port}/api/v2/{path}", null);
            if (!resp.IsSuccessStatusCode)
                return StatusCode(502, new { detail = $"qBittorrent returned HTTP {(int)resp.StatusCode}" });
            return Ok(new { status = "ok" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }
}

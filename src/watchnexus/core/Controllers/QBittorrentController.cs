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

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        if (cfg?.Value == null) return Ok(new { connected = false, status = "not_configured" });
        try
        {
            var doc = JsonDocument.Parse(cfg.Value).RootElement;
            var host = doc.TryGetProperty("host", out var h) ? h.GetString() : "localhost";
            var port = doc.TryGetProperty("port", out var p) ? p.GetInt32() : 8080;
            if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(host))
                return Ok(new { connected = false, status = "blocked", error = "Host is not allowed." });
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(5);
            var resp = await http.GetAsync($"http://{host}:{port}/api/v2/app/version");
            if (resp.IsSuccessStatusCode)
            {
                var ver = await resp.Content.ReadAsStringAsync();
                return Ok(new { connected = true, status = "connected", version = ver });
            }
            return Ok(new { connected = false, status = "unreachable" });
        }
        catch (Exception ex) { return Ok(new { connected = false, status = "error", error = ex.Message }); }
    }

    [HttpGet("torrents")]
    public async Task<IActionResult> Torrents()
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return Ok(Array.Empty<object>());
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return Ok(Array.Empty<object>());
            if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(host))
                return Ok(Array.Empty<object>());
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetStringAsync($"http://{host}:{port}/api/v2/torrents/info");
            return Content(resp, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpPost("add")]
    public async Task<IActionResult> Add([FromQuery] string? url, [FromQuery] string? magnet, [FromQuery] string? category)
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return BadRequest(new { detail = "qBittorrent not configured" });
        var link = magnet ?? url ?? "";
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return BadRequest(new { detail = "qBittorrent auth failed" });
            if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(host))
                return BadRequest(new { detail = "That host is not allowed." });
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var content = new MultipartFormDataContent();
            content.Add(new StringContent(link), "urls");
            if (!string.IsNullOrEmpty(category)) content.Add(new StringContent(category), "category");
            await http.PostAsync($"http://{host}:{port}/api/v2/torrents/add", content);
            return Ok(new { status = "added" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("pause/{hash}")]
    public async Task<IActionResult> Pause(string hash) => await QbitAction($"torrents/pause?hashes={hash}");
    [HttpPost("resume/{hash}")]
    public async Task<IActionResult> Resume(string hash) => await QbitAction($"torrents/resume?hashes={hash}");
    [HttpDelete("delete/{hash}")]
    public async Task<IActionResult> Delete(string hash, [FromQuery] bool delete_files = false) =>
        await QbitAction($"torrents/delete?hashes={hash}&deleteFiles={delete_files}");

    [HttpGet("files/{hash}")]
    public async Task<IActionResult> Files(string hash)
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return Ok(Array.Empty<object>());
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return Ok(Array.Empty<object>());
            if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(host))
                return Ok(Array.Empty<object>());
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetStringAsync($"http://{host}:{port}/api/v2/torrents/files?hash={hash}");
            return Content(resp, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        if (cfg?.Value == null) return Ok(new { host = "localhost", port = 8080, username = "", password = "", configured = false });
        try
        {
            var doc = JsonDocument.Parse(cfg.Value).RootElement;
            return Ok(new
            {
                host = doc.TryGetProperty("host", out var h) ? h.GetString() : "localhost",
                port = doc.TryGetProperty("port", out var p) ? p.GetInt32() : 8080,
                username = doc.TryGetProperty("username", out var u) ? u.GetString() : "",
                password = doc.TryGetProperty("password", out var pw) ? pw.GetString() : "",
                configured = true
            });
        }
        catch { return Ok(new { host = "localhost", port = 8080, username = "", password = "", configured = false }); }
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

        var value = JsonSerializer.Serialize(new { host = h, port = p, username = req.Username ?? "", password = req.Password ?? "" });
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        if (cfg != null) { cfg.Value = value; }
        else { _db.Settings.Add(new AppSetting { Key = "qbit_config", UserId = this.UserId(), Value = value }); }
        await _db.SaveChangesAsync();
        return Ok(new { saved = true, host = h, port = p });
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] QbitConfigRequest req)
    {
        var h = req.Host ?? "localhost";
        var p = req.Port ?? 8080;
        if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(h))
            return BadRequest(new { success = false, detail = "That host is not allowed." });
        try
        {
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(5);
            var resp = await http.GetAsync($"http://{h}:{p}/api/v2/app/version");
            if (resp.IsSuccessStatusCode)
                return Ok(new { success = true, version = await resp.Content.ReadAsStringAsync() });
            return Ok(new { success = false, error = $"HTTP {resp.StatusCode}" });
        }
        catch (Exception ex) { return Ok(new { success = false, error = ex.Message }); }
    }

    private async Task<JsonElement?> GetQbitConfig()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        if (cfg?.Value == null) return null;
        return JsonDocument.Parse(cfg.Value).RootElement;
    }

    private async Task<(string host, int port, string? cookie)> AuthQbit(JsonElement cfg)
    {
        var host = cfg.TryGetProperty("host", out var h) ? h.GetString() ?? "localhost" : "localhost";
        var port = cfg.TryGetProperty("port", out var p) ? p.GetInt32() : 8080;
        if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(host))
            return (host, port, null);
        var username = cfg.TryGetProperty("username", out var u) ? u.GetString() ?? "" : "";
        var password = cfg.TryGetProperty("password", out var pw) ? pw.GetString() ?? "" : "";
        var http = this.Http();
        http.Timeout = TimeSpan.FromSeconds(5);
        var content = new FormUrlEncodedContent(new[] {
            new KeyValuePair<string, string>("username", username),
            new KeyValuePair<string, string>("password", password)
        });
        var resp = await http.PostAsync($"http://{host}:{port}/api/v2/auth/login", content);
        if (resp.Headers.TryGetValues("Set-Cookie", out var cookies))
            return (host, port, cookies.FirstOrDefault());
        return (host, port, null);
    }

    private async Task<IActionResult> QbitAction(string path)
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return BadRequest(new { detail = "Auth failed" });
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            await http.PostAsync($"http://{host}:{port}/api/v2/{path}", null);
            return Ok(new { status = "ok" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }
}

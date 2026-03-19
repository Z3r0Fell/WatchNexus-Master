using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Ladle — Usenet Downloader.
/// Proxies to SABnzbd for NZB downloading, queue management, history, and server status.
/// </summary>
[Route("api/gadgets/ladle")]
[ApiController]
[Authorize]
public class LadleController : ControllerBase
{
    private readonly AppDbContext _db;
    public LadleController(AppDbContext db) => _db = db;

    private const string ConfigKey = "ladle_config";

    // ── Configuration ──────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var cfg = await GetSabConfig();
        return Ok(new { configured = cfg.url != null, url = cfg.url });
    }

    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] JsonElement body)
    {
        var uid = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ConfigKey);
        var value = body.GetRawText();
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = ConfigKey, Value = value, UserId = uid });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestConnection()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "SABnzbd not configured" });
        try
        {
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(10);
            var resp = await http.GetStringAsync($"{cfg.url}/api?mode=version&apikey={cfg.apiKey}&output=json");
            var doc = JsonDocument.Parse(resp);
            var version = doc.RootElement.TryGetProperty("version", out var v) ? v.GetString() : "unknown";
            return Ok(new { success = true, version, message = $"SABnzbd v{version} connected" });
        }
        catch (Exception ex) { return Ok(new { success = false, error = ex.Message }); }
    }

    // ── Status / Speed ──────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return Ok(new { connected = false, status = "not_configured" });
        return await SabApi(cfg, "queue", "&limit=0");
    }

    [HttpGet("server-stats")]
    public async Task<IActionResult> ServerStats()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "server_stats");
    }

    // ── Queue ──────────────────────────────────
    [HttpGet("queue")]
    public async Task<IActionResult> Queue([FromQuery] int start = 0, [FromQuery] int limit = 50)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return Ok(new { slots = Array.Empty<object>() });
        return await SabApi(cfg, "queue", $"&start={start}&limit={limit}");
    }

    [HttpPost("add")]
    public async Task<IActionResult> AddNzb([FromBody] JsonElement body)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "SABnzbd not configured" });
        var nzbUrl = body.TryGetProperty("url", out var u) ? u.GetString() : null;
        var name = body.TryGetProperty("name", out var n) ? n.GetString() : null;
        var category = body.TryGetProperty("category", out var c) ? c.GetString() : null;
        var priority = body.TryGetProperty("priority", out var p) ? p.GetInt32() : 0;

        if (string.IsNullOrEmpty(nzbUrl)) return BadRequest(new { detail = "NZB URL required" });

        try
        {
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(15);
            var url = $"{cfg.url}/api?mode=addurl&apikey={cfg.apiKey}&output=json&name={Uri.EscapeDataString(nzbUrl)}&priority={priority}";
            if (!string.IsNullOrEmpty(name)) url += $"&nzbname={Uri.EscapeDataString(name)}";
            if (!string.IsNullOrEmpty(category)) url += $"&cat={Uri.EscapeDataString(category)}";
            var resp = await http.GetStringAsync(url);
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("pause")]
    public async Task<IActionResult> PauseAll()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "pause");
    }

    [HttpPost("resume")]
    public async Task<IActionResult> ResumeAll()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "resume");
    }

    [HttpPost("pause/{nzoId}")]
    public async Task<IActionResult> PauseItem(string nzoId)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "queue", $"&name=pause&value={nzoId}");
    }

    [HttpPost("resume/{nzoId}")]
    public async Task<IActionResult> ResumeItem(string nzoId)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "queue", $"&name=resume&value={nzoId}");
    }

    [HttpDelete("queue/{nzoId}")]
    public async Task<IActionResult> DeleteItem(string nzoId, [FromQuery] bool delete_files = false)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        var delFiles = delete_files ? "True" : "False";
        return await SabApi(cfg, "queue", $"&name=delete&value={nzoId}&del_files={delFiles}");
    }

    // ── History ──────────────────────────────────
    [HttpGet("history")]
    public async Task<IActionResult> History([FromQuery] int start = 0, [FromQuery] int limit = 50)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return Ok(new { slots = Array.Empty<object>() });
        return await SabApi(cfg, "history", $"&start={start}&limit={limit}");
    }

    [HttpDelete("history/{nzoId}")]
    public async Task<IActionResult> DeleteHistory(string nzoId)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "history", $"&name=delete&value={nzoId}");
    }

    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "history", "&name=delete&value=all");
    }

    // ── Categories ──────────────────────────────────
    [HttpGet("categories")]
    public async Task<IActionResult> Categories()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return Ok(Array.Empty<string>());
        return await SabApi(cfg, "get_cats");
    }

    // ── Speed Limit ──────────────────────────────────
    [HttpGet("speedlimit")]
    public async Task<IActionResult> GetSpeedLimit()
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await SabApi(cfg, "config", "&name=speedlimit");
    }

    [HttpPut("speedlimit")]
    public async Task<IActionResult> SetSpeedLimit([FromBody] JsonElement body)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        var limit = body.TryGetProperty("limit", out var l) ? l.GetInt32() : 0;
        return await SabApi(cfg, "config", $"&name=speedlimit&value={limit}");
    }

    // ── Priority Management ──────────────────────────────────
    [HttpPut("priority/{nzoId}")]
    public async Task<IActionResult> SetPriority(string nzoId, [FromBody] JsonElement body)
    {
        var cfg = await GetSabConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        var priority = body.TryGetProperty("priority", out var p) ? p.GetInt32() : 0;
        return await SabApi(cfg, "queue", $"&name=priority&value={nzoId}&value2={priority}");
    }

    // ── Helpers ──────────────────────────────────
    private async Task<(string? url, string? apiKey)> GetSabConfig()
    {
        var uid = this.UserId();
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ConfigKey);
        if (cfg?.Value == null) return (null, null);
        var doc = JsonDocument.Parse(cfg.Value).RootElement;
        return (
            doc.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null,
            doc.TryGetProperty("api_key", out var ak) ? ak.GetString() : null
        );
    }

    private async Task<IActionResult> SabApi((string? url, string? apiKey) cfg, string mode, string extra = "")
    {
        try
        {
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(15);
            var resp = await http.GetStringAsync($"{cfg.url}/api?mode={mode}&apikey={cfg.apiKey}&output=json{extra}");
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }
}

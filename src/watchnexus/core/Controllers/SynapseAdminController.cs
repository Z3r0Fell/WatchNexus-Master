using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Synapse Admin API gadget — C# port of aiohttp-based Synapse admin calls.
/// Handles: user management, room administration, server statistics, purge history.
/// Uses the Synapse Admin API via HttpClient.
/// </summary>
[Route("api/gadgets/synapse-admin")]
[ApiController]
[Authorize]
public class SynapseAdminController : ControllerBase
{
    private readonly AppDbContext _db;
    public SynapseAdminController(AppDbContext db) => _db = db;

    // ── Server Stats ──────────────────────────────────
    [HttpGet("server/version")]
    public async Task<IActionResult> ServerVersion()
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Synapse not configured" });
        return await ProxyGet(cfg, "/_synapse/admin/v1/server_version");
    }

    [HttpGet("server/rooms")]
    public async Task<IActionResult> ListRooms([FromQuery] int limit = 100, [FromQuery] int from = 0,
        [FromQuery] string order_by = "joined_members", [FromQuery] string dir = "desc")
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg,
            $"/_synapse/admin/v2/rooms?limit={limit}&from={from}&order_by={order_by}&dir={dir}");
    }

    [HttpGet("server/rooms/{roomId}")]
    public async Task<IActionResult> RoomDetails(string roomId)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, $"/_synapse/admin/v1/rooms/{Uri.EscapeDataString(roomId)}");
    }

    [HttpGet("server/rooms/{roomId}/members")]
    public async Task<IActionResult> RoomMembers(string roomId)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, $"/_synapse/admin/v1/rooms/{Uri.EscapeDataString(roomId)}/members");
    }

    // ── User Management ──────────────────────────────────
    [HttpGet("users")]
    public async Task<IActionResult> ListUsers([FromQuery] int limit = 100, [FromQuery] int from = 0,
        [FromQuery] string? name = null, [FromQuery] bool? guests = null, [FromQuery] bool? deactivated = null)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        var url = $"/_synapse/admin/v2/users?limit={limit}&from={from}";
        if (!string.IsNullOrEmpty(name)) url += $"&name={Uri.EscapeDataString(name)}";
        if (guests.HasValue) url += $"&guests={guests.Value.ToString().ToLower()}";
        if (deactivated.HasValue) url += $"&deactivated={deactivated.Value.ToString().ToLower()}";
        return await ProxyGet(cfg, url);
    }

    [HttpGet("users/{userId}")]
    public async Task<IActionResult> UserDetails(string userId)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, $"/_synapse/admin/v2/users/{Uri.EscapeDataString(userId)}");
    }

    [HttpPut("users/{userId}")]
    public async Task<IActionResult> ModifyUser(string userId, [FromBody] JsonElement body)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            var resp = await http.PutAsync(
                $"{cfg.url}/_synapse/admin/v2/users/{Uri.EscapeDataString(userId)}", content);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("users/{userId}/deactivate")]
    public async Task<IActionResult> DeactivateUser(string userId)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var content = new StringContent("{\"erase\":false}", Encoding.UTF8, "application/json");
            var resp = await http.PostAsync(
                $"{cfg.url}/_synapse/admin/v1/deactivate/{Uri.EscapeDataString(userId)}", content);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("users/{userId}/reset-password")]
    public async Task<IActionResult> ResetPassword(string userId, [FromBody] JsonElement body)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            var resp = await http.PostAsync(
                $"{cfg.url}/_synapse/admin/v1/reset_password/{Uri.EscapeDataString(userId)}", content);
            return Ok(new { status = resp.IsSuccessStatusCode ? "reset" : "failed" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    // ── Media Management ──────────────────────────────────
    [HttpGet("media/{serverName}")]
    public async Task<IActionResult> ServerMedia(string serverName, [FromQuery] int limit = 100, [FromQuery] int from = 0)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg,
            $"/_synapse/admin/v1/media/{Uri.EscapeDataString(serverName)}?limit={limit}&from={from}");
    }

    [HttpDelete("media/{serverName}/{mediaId}")]
    public async Task<IActionResult> DeleteMedia(string serverName, string mediaId)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var resp = await http.DeleteAsync(
                $"{cfg.url}/_synapse/admin/v1/media/{Uri.EscapeDataString(serverName)}/{mediaId}");
            return Ok(new { status = resp.IsSuccessStatusCode ? "deleted" : "failed" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    // ── Room Admin ──────────────────────────────────
    [HttpDelete("rooms/{roomId}")]
    public async Task<IActionResult> DeleteRoom(string roomId, [FromBody] JsonElement body)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var req = new HttpRequestMessage(HttpMethod.Delete,
                $"{cfg.url}/_synapse/admin/v2/rooms/{Uri.EscapeDataString(roomId)}");
            req.Content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            var resp = await http.SendAsync(req);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("rooms/{roomId}/purge")]
    public async Task<IActionResult> PurgeHistory(string roomId, [FromBody] JsonElement body)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            var resp = await http.PostAsync(
                $"{cfg.url}/_synapse/admin/v1/purge_history/{Uri.EscapeDataString(roomId)}", content);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    // ── Registration Tokens ──────────────────────────────────
    [HttpGet("registration-tokens")]
    public async Task<IActionResult> ListTokens()
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, "/_synapse/admin/v1/registration_tokens");
    }

    [HttpPost("registration-tokens")]
    public async Task<IActionResult> CreateToken([FromBody] JsonElement body)
    {
        var cfg = await GetConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            var resp = await http.PostAsync($"{cfg.url}/_synapse/admin/v1/registration_tokens", content);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    // ── Config Storage ──────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetSynapseConfig()
    {
        var cfg = await GetConfig();
        return Ok(new { configured = cfg.url != null, url = cfg.url });
    }

    [HttpPut("config")]
    public async Task<IActionResult> SaveSynapseConfig([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "synapse_admin_config");
        var value = body.GetRawText();
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "synapse_admin_config", Value = value, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    // ── Helpers ──────────────────────────────────
    private async Task<(string? url, string? token)> GetConfig()
    {
        var uid = this.UserId();
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == "synapse_admin_config");
        if (cfg?.Value == null) return (null, null);
        var doc = JsonDocument.Parse(cfg.Value).RootElement;
        return (
            doc.TryGetProperty("homeserver", out var hs) ? hs.GetString()?.TrimEnd('/') : null,
            doc.TryGetProperty("admin_token", out var at) ? at.GetString() : null
        );
    }

    private HttpClient BuildClient((string? url, string? token) cfg)
    {
        var http = this.Http();
        http.Timeout = TimeSpan.FromSeconds(15);
        if (!string.IsNullOrEmpty(cfg.token))
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", cfg.token);
        return http;
    }

    private async Task<IActionResult> ProxyGet((string? url, string? token) cfg, string path)
    {
        try
        {
            var http = BuildClient(cfg);
            var resp = await http.GetStringAsync($"{cfg.url}{path}");
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }
}

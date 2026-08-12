using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Matrix Client-Server API gadget — C# port of mautrix-python functionality.
/// Handles: sending messages, room management, event handling, user lookup.
/// Uses the Matrix Client-Server API v1.1+ via HttpClient.
/// </summary>
// ── Marzipan (Matrix Chat) ──────────────────────────────────
[Route("api/gadgets/matrix")]
[ApiController]
[Authorize]
public class MatrixController : ControllerBase
{
    private readonly AppDbContext _db;
    public MatrixController(AppDbContext db) => _db = db;

    // ── Configuration ──────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var userId = this.UserId();
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "matrix_config");
        if (cfg?.Value == null) return Ok(new { configured = false });
        return Ok(new { configured = true, config = JsonSerializer.Deserialize<object>(cfg.Value) });
    }

    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "matrix_config");
        var value = body.GetRawText();
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "matrix_config", Value = value, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestConnection()
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return BadRequest(new { detail = "Matrix not configured" });
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var resp = await http.GetStringAsync($"{homeserver}/_matrix/client/v3/account/whoami");
            var doc = JsonDocument.Parse(resp);
            var matrixUserId = doc.RootElement.TryGetProperty("user_id", out var uid) ? uid.GetString() : "unknown";
            return Ok(new { success = true, user_id = matrixUserId, homeserver });
        }
        catch (Exception ex)
        {
            return Ok(new { success = false, error = ex.Message });
        }
    }

    // ── Room Management ──────────────────────────────────
    [HttpGet("rooms")]
    public async Task<IActionResult> ListRooms()
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return Ok(Array.Empty<object>());
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var resp = await http.GetStringAsync($"{homeserver}/_matrix/client/v3/joined_rooms");
            var doc = JsonDocument.Parse(resp);
            var rooms = new List<object>();
            if (doc.RootElement.TryGetProperty("joined_rooms", out var joined))
            {
                foreach (var roomId in joined.EnumerateArray())
                {
                    var id = roomId.GetString()!;
                    string? name = null;
                    try
                    {
                        var stateResp = await http.GetStringAsync(
                            $"{homeserver}/_matrix/client/v3/rooms/{Uri.EscapeDataString(id)}/state/m.room.name");
                        var stateDoc = JsonDocument.Parse(stateResp);
                        name = stateDoc.RootElement.TryGetProperty("name", out var n) ? n.GetString() : null;
                    }
                    catch { }
                    rooms.Add(new { room_id = id, name = name ?? id });
                }
            }
            return Ok(rooms);
        }
        catch (Exception ex) { return Ok(new { error = ex.Message, rooms = Array.Empty<object>() }); }
    }

    [HttpPost("rooms/create")]
    public async Task<IActionResult> CreateRoom([FromBody] JsonElement body)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return BadRequest(new { detail = "Matrix not configured" });
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            var resp = await http.PostAsync($"{homeserver}/_matrix/client/v3/createRoom", content);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("rooms/{roomId}/invite")]
    public async Task<IActionResult> InviteUser(string roomId, [FromBody] JsonElement body)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return BadRequest(new { detail = "Matrix not configured" });
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
            var resp = await http.PostAsync(
                $"{homeserver}/_matrix/client/v3/rooms/{Uri.EscapeDataString(roomId)}/invite", content);
            return Ok(new { status = resp.IsSuccessStatusCode ? "invited" : "failed" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("rooms/{roomId}/join")]
    public async Task<IActionResult> JoinRoom(string roomId)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return BadRequest(new { detail = "Matrix not configured" });
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var resp = await http.PostAsync(
                $"{homeserver}/_matrix/client/v3/join/{Uri.EscapeDataString(roomId)}",
                new StringContent("{}", Encoding.UTF8, "application/json"));
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("rooms/{roomId}/leave")]
    public async Task<IActionResult> LeaveRoom(string roomId)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return BadRequest(new { detail = "Matrix not configured" });
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var resp = await http.PostAsync(
                $"{homeserver}/_matrix/client/v3/rooms/{Uri.EscapeDataString(roomId)}/leave",
                new StringContent("{}", Encoding.UTF8, "application/json"));
            return Ok(new { status = "left" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("rooms/{roomId}/members")]
    public async Task<IActionResult> RoomMembers(string roomId)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return Ok(Array.Empty<object>());
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var resp = await http.GetStringAsync(
                $"{homeserver}/_matrix/client/v3/rooms/{Uri.EscapeDataString(roomId)}/members");
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return Ok(new { error = ex.Message }); }
    }

    // ── Messaging ──────────────────────────────────
    [HttpPost("rooms/{roomId}/send")]
    public async Task<IActionResult> SendMessage(string roomId, [FromBody] JsonElement body)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return BadRequest(new { detail = "Matrix not configured" });

        var msgType = body.TryGetProperty("msgtype", out var mt) ? mt.GetString() ?? "m.text" : "m.text";
        var msgBody = body.TryGetProperty("body", out var mb) ? mb.GetString() ?? "" : "";
        var formattedBody = body.TryGetProperty("formatted_body", out var fb) ? fb.GetString() : null;

        var payload = new Dictionary<string, object>
        {
            ["msgtype"] = msgType,
            ["body"] = msgBody,
        };
        if (formattedBody != null)
        {
            payload["format"] = "org.matrix.custom.html";
            payload["formatted_body"] = formattedBody;
        }

        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var txnId = Guid.NewGuid().ToString("N");
            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var resp = await http.PutAsync(
                $"{homeserver}/_matrix/client/v3/rooms/{Uri.EscapeDataString(roomId)}/send/m.room.message/{txnId}",
                content);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("rooms/{roomId}/messages")]
    public async Task<IActionResult> GetMessages(string roomId, [FromQuery] int limit = 50, [FromQuery] string dir = "b")
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return Ok(Array.Empty<object>());
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var resp = await http.GetStringAsync(
                $"{homeserver}/_matrix/client/v3/rooms/{Uri.EscapeDataString(roomId)}/messages?limit={limit}&dir={dir}");
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return Ok(new { error = ex.Message }); }
    }

    // ── Event Sync ──────────────────────────────────
    [HttpGet("sync")]
    public async Task<IActionResult> Sync([FromQuery] string? since = null, [FromQuery] int timeout = 0)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return BadRequest(new { detail = "Matrix not configured" });
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            http.Timeout = TimeSpan.FromSeconds(Math.Max(timeout / 1000 + 10, 30));
            var url = $"{homeserver}/_matrix/client/v3/sync?timeout={timeout}";
            if (!string.IsNullOrEmpty(since)) url += $"&since={Uri.EscapeDataString(since)}";
            var resp = await http.GetStringAsync(url);
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return Ok(new { error = ex.Message }); }
    }

    // ── User Lookup ──────────────────────────────────
    [HttpGet("users/search")]
    public async Task<IActionResult> SearchUsers([FromQuery] string q = "", [FromQuery] int limit = 10)
    {
        var (homeserver, token, _) = await GetMatrixConfig();
        if (homeserver == null) return Ok(Array.Empty<object>());
        try
        {
            var http = this.Http();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var content = new StringContent(
                JsonSerializer.Serialize(new { search_term = q, limit }),
                Encoding.UTF8, "application/json");
            var resp = await http.PostAsync($"{homeserver}/_matrix/client/v3/user_directory/search", content);
            var result = await resp.Content.ReadAsStringAsync();
            return Content(result, "application/json");
        }
        catch (Exception ex) { return Ok(new { error = ex.Message }); }
    }

    // ── Helpers ──────────────────────────────────
    private async Task<(string? homeserver, string? token, string? userId)> GetMatrixConfig()
    {
        var uid = this.UserId();
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == "matrix_config");
        if (cfg?.Value == null) return (null, null, null);
        var doc = JsonDocument.Parse(cfg.Value).RootElement;
        var homeserver = doc.TryGetProperty("homeserver", out var hs) ? hs.GetString() : null;
        if (homeserver != null && SsrfGuard.IsBlockedUrl(homeserver)) homeserver = null;
        return (
            homeserver,
            doc.TryGetProperty("access_token", out var at) ? at.GetString() : null,
            doc.TryGetProperty("user_id", out var ui) ? ui.GetString() : null
        );
    }
}

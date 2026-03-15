using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Jellyfin Media Server gadget — C# port of aiohttp-based Jellyfin API calls.
/// Handles: library browsing, playback info, user sessions, server info.
/// </summary>
[Route("api/gadgets/jellyfin")]
[ApiController]
[Authorize]
public class JellyfinController : ControllerBase
{
    private readonly AppDbContext _db;
    public JellyfinController(AppDbContext db) => _db = db;

    // ── Configuration ──────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var cfg = await GetJellyfinConfig();
        return Ok(new { configured = cfg.url != null, url = cfg.url });
    }

    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "jellyfin_config");
        var value = body.GetRawText();
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "jellyfin_config", Value = value, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestConnection()
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Jellyfin not configured" });
        try
        {
            var http = BuildClient(cfg);
            var resp = await http.GetStringAsync($"{cfg.url}/System/Info/Public");
            var doc = JsonDocument.Parse(resp);
            return Ok(new
            {
                success = true,
                server_name = doc.RootElement.TryGetProperty("ServerName", out var sn) ? sn.GetString() : "Unknown",
                version = doc.RootElement.TryGetProperty("Version", out var v) ? v.GetString() : null,
                id = doc.RootElement.TryGetProperty("Id", out var id) ? id.GetString() : null,
            });
        }
        catch (Exception ex) { return Ok(new { success = false, error = ex.Message }); }
    }

    // ── Server Info ──────────────────────────────────
    [HttpGet("info")]
    public async Task<IActionResult> ServerInfo()
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, "/System/Info");
    }

    [HttpGet("activity")]
    public async Task<IActionResult> ActivityLog([FromQuery] int limit = 25)
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, $"/System/ActivityLog/Entries?Limit={limit}");
    }

    // ── Library ──────────────────────────────────
    [HttpGet("libraries")]
    public async Task<IActionResult> Libraries()
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, "/Library/VirtualFolders");
    }

    [HttpGet("items")]
    public async Task<IActionResult> Items([FromQuery] string? parentId = null, [FromQuery] int limit = 50,
        [FromQuery] int startIndex = 0, [FromQuery] string? searchTerm = null,
        [FromQuery] string? includeItemTypes = null, [FromQuery] string sortBy = "SortName",
        [FromQuery] string sortOrder = "Ascending")
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        var url = $"/Items?Limit={limit}&StartIndex={startIndex}&SortBy={sortBy}&SortOrder={sortOrder}&Recursive=true&Fields=Overview,Genres,People,Studios,CommunityRating";
        if (!string.IsNullOrEmpty(parentId)) url += $"&ParentId={parentId}";
        if (!string.IsNullOrEmpty(searchTerm)) url += $"&SearchTerm={Uri.EscapeDataString(searchTerm)}";
        if (!string.IsNullOrEmpty(includeItemTypes)) url += $"&IncludeItemTypes={includeItemTypes}";
        if (!string.IsNullOrEmpty(cfg.jellyfinUserId)) url += $"&UserId={cfg.jellyfinUserId}";
        return await ProxyGet(cfg, url);
    }

    [HttpGet("items/{itemId}")]
    public async Task<IActionResult> ItemDetails(string itemId)
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        var url = $"/Items/{itemId}";
        if (!string.IsNullOrEmpty(cfg.jellyfinUserId)) url += $"?UserId={cfg.jellyfinUserId}";
        return await ProxyGet(cfg, url);
    }

    [HttpGet("items/{itemId}/similar")]
    public async Task<IActionResult> SimilarItems(string itemId, [FromQuery] int limit = 10)
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, $"/Items/{itemId}/Similar?Limit={limit}");
    }

    [HttpGet("items/{itemId}/images/{imageType}")]
    public async Task<IActionResult> ItemImage(string itemId, string imageType)
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            var resp = await http.GetAsync($"{cfg.url}/Items/{itemId}/Images/{imageType}");
            if (!resp.IsSuccessStatusCode) return NotFound();
            var contentType = resp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var data = await resp.Content.ReadAsByteArrayAsync();
            return File(data, contentType);
        }
        catch { return NotFound(); }
    }

    // ── Playback / Sessions ──────────────────────────────────
    [HttpGet("sessions")]
    public async Task<IActionResult> Sessions()
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, "/Sessions");
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users()
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        return await ProxyGet(cfg, "/Users");
    }

    [HttpGet("latest")]
    public async Task<IActionResult> LatestMedia([FromQuery] int limit = 20)
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        if (string.IsNullOrEmpty(cfg.jellyfinUserId)) return BadRequest(new { detail = "Jellyfin user ID not set" });
        return await ProxyGet(cfg, $"/Users/{cfg.jellyfinUserId}/Items/Latest?Limit={limit}&Fields=Overview,Genres");
    }

    [HttpGet("resume")]
    public async Task<IActionResult> ResumeItems([FromQuery] int limit = 10)
    {
        var cfg = await GetJellyfinConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        if (string.IsNullOrEmpty(cfg.jellyfinUserId)) return BadRequest(new { detail = "Jellyfin user ID not set" });
        return await ProxyGet(cfg, $"/Users/{cfg.jellyfinUserId}/Items/Resume?Limit={limit}");
    }

    // ── OMDB Integration (direct) ──────────────────────────────────
    [HttpGet("omdb")]
    public async Task<IActionResult> OmdbLookup([FromQuery] string? title = null, [FromQuery] string? imdbId = null)
    {
        var userId = this.UserId();
        var omdbKey = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "omdb_api_key");
        var apiKey = omdbKey?.Value;
        if (string.IsNullOrEmpty(apiKey)) return BadRequest(new { detail = "OMDB API key not configured" });

        var http = this.Http();
        var url = $"https://www.omdbapi.com/?apikey={apiKey}";
        if (!string.IsNullOrEmpty(imdbId)) url += $"&i={Uri.EscapeDataString(imdbId)}";
        else if (!string.IsNullOrEmpty(title)) url += $"&t={Uri.EscapeDataString(title)}";
        else return BadRequest(new { detail = "Provide title or imdbId" });

        try
        {
            var resp = await http.GetStringAsync(url);
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("omdb/search")]
    public async Task<IActionResult> OmdbSearch([FromQuery] string q = "", [FromQuery] int page = 1)
    {
        var userId = this.UserId();
        var omdbKey = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "omdb_api_key");
        var apiKey = omdbKey?.Value;
        if (string.IsNullOrEmpty(apiKey)) return BadRequest(new { detail = "OMDB API key not configured" });

        var http = this.Http();
        try
        {
            var resp = await http.GetStringAsync(
                $"https://www.omdbapi.com/?apikey={apiKey}&s={Uri.EscapeDataString(q)}&page={page}");
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    // ── Helpers ──────────────────────────────────
    private async Task<(string? url, string? apiKey, string? jellyfinUserId)> GetJellyfinConfig()
    {
        var uid = this.UserId();
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == "jellyfin_config");
        if (cfg?.Value == null) return (null, null, null);
        var doc = JsonDocument.Parse(cfg.Value).RootElement;
        return (
            doc.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null,
            doc.TryGetProperty("api_key", out var ak) ? ak.GetString() : null,
            doc.TryGetProperty("user_id", out var ui) ? ui.GetString() : null
        );
    }

    private HttpClient BuildClient((string? url, string? apiKey, string? jellyfinUserId) cfg)
    {
        var http = this.Http();
        http.Timeout = TimeSpan.FromSeconds(15);
        if (!string.IsNullOrEmpty(cfg.apiKey))
            http.DefaultRequestHeaders.Add("X-Emby-Token", cfg.apiKey);
        return http;
    }

    private async Task<IActionResult> ProxyGet((string? url, string? apiKey, string? jellyfinUserId) cfg, string path)
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

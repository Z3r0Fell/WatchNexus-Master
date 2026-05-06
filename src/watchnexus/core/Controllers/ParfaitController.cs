using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// PARFAIT — Jellyseerr Integration (Ultra)
// Proxies to a user-configured Jellyseerr instance for advanced media
// request management, discovery, and approval workflows.
// ══════════════════════════════════════════════════════════════════════
[Route("api/parfait")]
[ApiController]
[Authorize]
public class ParfaitController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    public ParfaitController(AppDbContext db, IHttpClientFactory httpFactory)
    {
        _db = db;
        _httpFactory = httpFactory;
    }

    // ── Settings Key ────────────────────────────────────────────────
    private const string CFG_KEY = "parfait_config";

    private async Task<(string? url, string? apiKey)> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == CFG_KEY && s.UserId == "");
        if (setting?.Value == null) return (null, null);
        try
        {
            var doc = JsonDocument.Parse(setting.Value).RootElement;
            var url = doc.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null;
            var key = doc.TryGetProperty("api_key", out var k) ? k.GetString() : null;
            return (url, key);
        }
        catch { return (null, null); }
    }

    private HttpClient BuildClient(string apiKey)
    {
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(15);
        http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
        http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/2.8.4 Parfait");
        return http;
    }

    // ── Connection Status ───────────────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var (url, apiKey) = await GetConfig();
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return Ok(new { connected = false, configured = false, message = "Jellyseerr not configured. Set URL and API key in settings." });

        try
        {
            using var http = BuildClient(apiKey);
            var resp = await http.GetAsync($"{url}/api/v1/status");
            if (!resp.IsSuccessStatusCode)
                return Ok(new { connected = false, configured = true, status_code = (int)resp.StatusCode, message = "Cannot reach Jellyseerr. Check URL and API key." });

            var body = await resp.Content.ReadAsStringAsync();
            var data = JsonDocument.Parse(body).RootElement;
            return Ok(new
            {
                connected = true,
                configured = true,
                version = data.TryGetProperty("version", out var v) ? v.GetString() : "unknown",
                commit_tag = data.TryGetProperty("commitTag", out var ct) ? ct.GetString() : null,
                update_available = data.TryGetProperty("updateAvailable", out var ua) && ua.GetBoolean(),
                requests_count = data.TryGetProperty("restartRequired", out _) ? 0 : 0,
            });
        }
        catch (Exception ex)
        {
            return Ok(new { connected = false, configured = true, message = $"Connection error: {ex.Message}" });
        }
    }

    // ── Configure Jellyseerr ────────────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetSettings()
    {
        var (url, apiKey) = await GetConfig();
        return Ok(new
        {
            url = url ?? "",
            api_key = !string.IsNullOrEmpty(apiKey) ? apiKey[..4] + "****" + apiKey[^4..] : "",
            configured = !string.IsNullOrEmpty(url) && !string.IsNullOrEmpty(apiKey)
        });
    }

    [HttpPost("config")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var url = body.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null;
        var apiKey = body.TryGetProperty("api_key", out var k) ? k.GetString() : null;
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { success = false, message = "URL and API key are required" });

        // Test the connection first
        try
        {
            using var http = BuildClient(apiKey);
            var resp = await http.GetAsync($"{url}/api/v1/status");
            if (!resp.IsSuccessStatusCode)
                return BadRequest(new { success = false, message = $"Cannot connect to Jellyseerr at {url} (HTTP {(int)resp.StatusCode})" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = $"Connection failed: {ex.Message}" });
        }

        var configData = JsonSerializer.Serialize(new { url, api_key = apiKey });
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == CFG_KEY && s.UserId == "");
        if (existing != null)
            existing.Value = configData;
        else
            _db.Settings.Add(new AppSetting { Key = CFG_KEY, UserId = "", Value = configData });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Jellyseerr connected successfully" });
    }

    // ── Requests ────────────────────────────────────────────────────
    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests([FromQuery] int take = 20, [FromQuery] int skip = 0, [FromQuery] string? filter = null)
    {
        var (url, apiKey) = await GetConfig();
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return Ok(new { results = Array.Empty<object>(), pageInfo = new { pages = 0, results = 0 } });

        try
        {
            using var http = BuildClient(apiKey);
            var filterQuery = !string.IsNullOrEmpty(filter) ? $"&filter={filter}" : "";
            var resp = await http.GetAsync($"{url}/api/v1/request?take={take}&skip={skip}{filterQuery}");
            if (!resp.IsSuccessStatusCode) return StatusCode((int)resp.StatusCode);
            var body = await resp.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest([FromBody] JsonElement body)
    {
        var (url, apiKey) = await GetConfig();
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { message = "Jellyseerr not configured" });

        try
        {
            using var http = BuildClient(apiKey);
            var content = new StringContent(body.GetRawText(), System.Text.Encoding.UTF8, "application/json");
            var resp = await http.PostAsync($"{url}/api/v1/request", content);
            var resBody = await resp.Content.ReadAsStringAsync();
            return Content(resBody, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("requests/{id}/approve")]
    public async Task<IActionResult> ApproveRequest(int id)
    {
        return await ProxyPost($"/api/v1/request/{id}/approve");
    }

    [HttpPost("requests/{id}/decline")]
    public async Task<IActionResult> DeclineRequest(int id)
    {
        return await ProxyPost($"/api/v1/request/{id}/decline");
    }

    [HttpDelete("requests/{id}")]
    public async Task<IActionResult> DeleteRequest(int id)
    {
        return await ProxyDelete($"/api/v1/request/{id}");
    }

    // ── Discover / Search ───────────────────────────────────────────
    [HttpGet("discover/movies")]
    public async Task<IActionResult> DiscoverMovies([FromQuery] int page = 1)
    {
        return await ProxyGet($"/api/v1/discover/movies?page={page}");
    }

    [HttpGet("discover/tv")]
    public async Task<IActionResult> DiscoverTV([FromQuery] int page = 1)
    {
        return await ProxyGet($"/api/v1/discover/tv?page={page}");
    }

    [HttpGet("discover/trending")]
    public async Task<IActionResult> DiscoverTrending([FromQuery] int page = 1)
    {
        return await ProxyGet($"/api/v1/discover/trending?page={page}");
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string query, [FromQuery] int page = 1)
    {
        return await ProxyGet($"/api/v1/search?query={Uri.EscapeDataString(query)}&page={page}");
    }

    // ── Media Details ───────────────────────────────────────────────
    [HttpGet("movie/{id}")]
    public async Task<IActionResult> MovieDetails(int id)
    {
        return await ProxyGet($"/api/v1/movie/{id}");
    }

    [HttpGet("tv/{id}")]
    public async Task<IActionResult> TVDetails(int id)
    {
        return await ProxyGet($"/api/v1/tv/{id}");
    }

    // ── Users ───────────────────────────────────────────────────────
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] int take = 20, [FromQuery] int skip = 0)
    {
        return await ProxyGet($"/api/v1/user?take={take}&skip={skip}");
    }

    // ── Request Count / Stats ───────────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var (url, apiKey) = await GetConfig();
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return Ok(new { total = 0, pending = 0, approved = 0, declined = 0, available = 0 });

        try
        {
            using var http = BuildClient(apiKey);
            var resp = await http.GetAsync($"{url}/api/v1/request/count");
            if (!resp.IsSuccessStatusCode)
                return Ok(new { total = 0, pending = 0, approved = 0, declined = 0, available = 0 });
            var body = await resp.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch { return Ok(new { total = 0, pending = 0, approved = 0, declined = 0, available = 0 }); }
    }

    // ── Proxy Helpers ───────────────────────────────────────────────
    private async Task<IActionResult> ProxyGet(string path)
    {
        var (url, apiKey) = await GetConfig();
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { message = "Jellyseerr not configured" });
        try
        {
            using var http = BuildClient(apiKey);
            var resp = await http.GetAsync($"{url}{path}");
            var body = await resp.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    private async Task<IActionResult> ProxyPost(string path)
    {
        var (url, apiKey) = await GetConfig();
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { message = "Jellyseerr not configured" });
        try
        {
            using var http = BuildClient(apiKey);
            var resp = await http.PostAsync($"{url}{path}", null);
            var body = await resp.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    private async Task<IActionResult> ProxyDelete(string path)
    {
        var (url, apiKey) = await GetConfig();
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { message = "Jellyseerr not configured" });
        try
        {
            using var http = BuildClient(apiKey);
            var resp = await http.DeleteAsync($"{url}{path}");
            var body = await resp.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }
}

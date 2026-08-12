using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// MENU — Built-in Media Request & Discovery Manager (Ultra)
// Inspired by Seerr/Jellyseerr. Native implementation providing:
// - TMDB-powered discovery (trending, popular, upcoming, search)
// - User request system with approval workflow
// - Sonarr & Radarr integration for automatic fulfillment
// - Availability status tracking against local library
// ══════════════════════════════════════════════════════════════════════
[Route("api/menu")]
[ApiController]
[Authorize]
public class MenuController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    public MenuController(AppDbContext db, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _db = db;
        _httpFactory = httpFactory;
        _config = config;
    }

    // ── Config Keys ─────────────────────────────────────────────────
    private const string TMDB_KEY = "tmdb_api_key";
    private const string RADARR_KEY = "menu_radarr";
    private const string SONARR_KEY = "menu_sonarr";

    private async Task<string?> GetTmdbKey()
    {
        var dbKey = (await _db.Settings.FirstOrDefaultAsync(s => s.Key == TMDB_KEY && s.Value != null))?.Value;
        return dbKey ?? _config["TMDB_API_KEY"];
    }

    private async Task<(string? url, string? apiKey)> GetServiceConfig(string key)
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == "");
        if (setting?.Value == null) return (null, null);
        try
        {
            var doc = JsonDocument.Parse(setting.Value).RootElement;
            var url = doc.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null;
            if (url != null && SsrfGuard.IsBlockedUrl(url)) url = null;
            return (
                url,
                doc.TryGetProperty("api_key", out var k) ? k.GetString() : null
            );
        }
        catch { return (null, null); }
    }

    // ═══════════════════════════════════════════════════════════════
    // DISCOVERY (TMDB-Powered)
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("discover/trending")]
    public async Task<IActionResult> Trending([FromQuery] string type = "all", [FromQuery] int page = 1)
    {
        var apiKey = await GetTmdbKey();
        if (string.IsNullOrEmpty(apiKey)) return Ok(new { results = Array.Empty<object>(), page = 1, total_pages = 0 });
        var url = $"https://api.themoviedb.org/3/trending/{type}/week?api_key={apiKey}&page={page}";
        return await TmdbGet(url);
    }

    [HttpGet("discover/movies")]
    public async Task<IActionResult> DiscoverMovies([FromQuery] int page = 1, [FromQuery] string sort = "popularity.desc")
    {
        var apiKey = await GetTmdbKey();
        if (string.IsNullOrEmpty(apiKey)) return Ok(new { results = Array.Empty<object>(), page = 1, total_pages = 0 });
        var url = $"https://api.themoviedb.org/3/discover/movie?api_key={apiKey}&page={page}&sort_by={sort}&include_adult=false";
        return await TmdbGet(url);
    }

    [HttpGet("discover/tv")]
    public async Task<IActionResult> DiscoverTV([FromQuery] int page = 1, [FromQuery] string sort = "popularity.desc")
    {
        var apiKey = await GetTmdbKey();
        if (string.IsNullOrEmpty(apiKey)) return Ok(new { results = Array.Empty<object>(), page = 1, total_pages = 0 });
        var url = $"https://api.themoviedb.org/3/discover/tv?api_key={apiKey}&page={page}&sort_by={sort}&include_adult=false";
        return await TmdbGet(url);
    }

    [HttpGet("discover/upcoming")]
    public async Task<IActionResult> Upcoming([FromQuery] int page = 1)
    {
        var apiKey = await GetTmdbKey();
        if (string.IsNullOrEmpty(apiKey)) return Ok(new { results = Array.Empty<object>(), page = 1, total_pages = 0 });
        var url = $"https://api.themoviedb.org/3/movie/upcoming?api_key={apiKey}&page={page}";
        return await TmdbGet(url);
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string query, [FromQuery] int page = 1)
    {
        if (string.IsNullOrWhiteSpace(query)) return Ok(new { results = Array.Empty<object>() });
        var apiKey = await GetTmdbKey();
        if (string.IsNullOrEmpty(apiKey)) return Ok(new { results = Array.Empty<object>() });
        var url = $"https://api.themoviedb.org/3/search/multi?api_key={apiKey}&query={Uri.EscapeDataString(query)}&page={page}&include_adult=false";
        return await TmdbGet(url);
    }

    [HttpGet("movie/{id}")]
    public async Task<IActionResult> MovieDetail(int id)
    {
        var apiKey = await GetTmdbKey();
        if (string.IsNullOrEmpty(apiKey)) return NotFound();
        var url = $"https://api.themoviedb.org/3/movie/{id}?api_key={apiKey}&append_to_response=credits,videos,recommendations,similar";
        return await TmdbGet(url);
    }

    [HttpGet("tv/{id}")]
    public async Task<IActionResult> TVDetail(int id)
    {
        var apiKey = await GetTmdbKey();
        if (string.IsNullOrEmpty(apiKey)) return NotFound();
        var url = $"https://api.themoviedb.org/3/tv/{id}?api_key={apiKey}&append_to_response=credits,videos,recommendations,similar";
        return await TmdbGet(url);
    }

    // ═══════════════════════════════════════════════════════════════
    // REQUESTS
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests([FromQuery] string? status = null, [FromQuery] int take = 30, [FromQuery] int skip = 0)
    {
        var requests = await _db.Settings
            .Where(s => s.Key.StartsWith("menu_request:"))
            .OrderByDescending(s => s.Key)
            .ToListAsync();

        var results = new List<object>();
        foreach (var req in requests)
        {
            try
            {
                var doc = JsonDocument.Parse(req.Value ?? "{}").RootElement;
                var reqStatus = doc.TryGetProperty("status", out var st) ? st.GetString() : "pending";
                if (!string.IsNullOrEmpty(status) && reqStatus != status) continue;
                results.Add(new
                {
                    id = req.Key.Replace("menu_request:", ""),
                    title = doc.TryGetProperty("title", out var t) ? t.GetString() : "",
                    media_type = doc.TryGetProperty("media_type", out var mt) ? mt.GetString() : "movie",
                    tmdb_id = doc.TryGetProperty("tmdb_id", out var tid) ? tid.GetInt32() : 0,
                    poster_path = doc.TryGetProperty("poster_path", out var pp) ? pp.GetString() : null,
                    overview = doc.TryGetProperty("overview", out var ov) ? ov.GetString() : "",
                    status = reqStatus,
                    requested_by = doc.TryGetProperty("requested_by", out var rb) ? rb.GetString() : "",
                    requested_at = doc.TryGetProperty("requested_at", out var ra) ? ra.GetString() : "",
                    decided_at = doc.TryGetProperty("decided_at", out var da) ? da.GetString() : null,
                    decided_by = doc.TryGetProperty("decided_by", out var db2) ? db2.GetString() : null,
                    year = doc.TryGetProperty("year", out var y) ? y.GetString() : null,
                    vote_average = doc.TryGetProperty("vote_average", out var va) ? va.GetDouble() : 0,
                });
            }
            catch { }
        }

        return Ok(new
        {
            results = results.Skip(skip).Take(take),
            total = results.Count,
            page_info = new { total = results.Count, taken = take, skipped = skip }
        });
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest([FromBody] JsonElement body)
    {
        var mediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "movie" : "movie";
        var tmdbId = body.TryGetProperty("tmdb_id", out var tid) ? tid.GetInt32() : 0;
        var title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
        var posterPath = body.TryGetProperty("poster_path", out var pp) ? pp.GetString() : null;
        var overview = body.TryGetProperty("overview", out var ov) ? ov.GetString() : "";
        var year = body.TryGetProperty("year", out var y) ? y.GetString() : null;
        var voteAverage = body.TryGetProperty("vote_average", out var va) ? va.GetDouble() : 0;

        if (tmdbId == 0) return BadRequest(new { success = false, message = "tmdb_id is required" });

        // Check for duplicate
        var existingKey = $"menu_request:{mediaType}_{tmdbId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == existingKey);
        if (existing != null)
            return Conflict(new { success = false, message = "This title has already been requested" });

        var userId = this.UserId();
        var requestData = JsonSerializer.Serialize(new
        {
            title, media_type = mediaType, tmdb_id = tmdbId, poster_path = posterPath,
            overview, year, vote_average = voteAverage,
            status = "pending",
            requested_by = userId,
            requested_at = DateTime.UtcNow.ToString("o"),
        });

        _db.Settings.Add(new AppSetting { Key = existingKey, UserId = "", Value = requestData });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, id = $"{mediaType}_{tmdbId}", message = $"'{title}' has been requested!" });
    }

    [HttpPost("requests/{id}/approve")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ApproveRequest(string id)
    {
        return await UpdateRequestStatus(id, "approved");
    }

    [HttpPost("requests/{id}/decline")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeclineRequest(string id)
    {
        return await UpdateRequestStatus(id, "declined");
    }

    [HttpDelete("requests/{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteRequest(string id)
    {
        var key = $"menu_request:{id}";
        var req = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (req == null) return NotFound(new { success = false, message = "Request not found" });
        _db.Settings.Remove(req);
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Request deleted" });
    }

    [HttpGet("requests/stats")]
    public async Task<IActionResult> RequestStats()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("menu_request:")).ToListAsync();
        int pending = 0, approved = 0, declined = 0, available = 0;
        foreach (var s in all)
        {
            try
            {
                var doc = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                var st = doc.TryGetProperty("status", out var v) ? v.GetString() : "pending";
                if (st == "pending") pending++;
                else if (st == "approved") approved++;
                else if (st == "declined") declined++;
                else if (st == "available") available++;
            }
            catch { }
        }
        return Ok(new { total = all.Count, pending, approved, declined, available });
    }

    // ═══════════════════════════════════════════════════════════════
    // SONARR INTEGRATION
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("sonarr/config")]
    public async Task<IActionResult> GetSonarrConfig()
    {
        var (url, apiKey) = await GetServiceConfig(SONARR_KEY);
        return Ok(new { url = url ?? "", api_key = !string.IsNullOrEmpty(apiKey) ? "****" + apiKey[^4..] : "", configured = !string.IsNullOrEmpty(url) });
    }

    [HttpPost("sonarr/config")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SaveSonarrConfig([FromBody] JsonElement body)
    {
        return await SaveServiceConfig(SONARR_KEY, body, "/api/v3/system/status");
    }

    [HttpGet("sonarr/profiles")]
    public async Task<IActionResult> SonarrProfiles()
    {
        return await ProxyServiceGet(SONARR_KEY, "/api/v3/qualityprofile");
    }

    [HttpGet("sonarr/rootfolders")]
    public async Task<IActionResult> SonarrRootFolders()
    {
        return await ProxyServiceGet(SONARR_KEY, "/api/v3/rootfolder");
    }

    [HttpPost("sonarr/add")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SonarrAdd([FromBody] JsonElement body)
    {
        var (url, apiKey) = await GetServiceConfig(SONARR_KEY);
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { success = false, message = "Sonarr not configured" });

        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(15);
            http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
            var content = new StringContent(body.GetRawText(), System.Text.Encoding.UTF8, "application/json");
            var resp = await http.PostAsync($"{url}/api/v3/series", content);
            var resBody = await resp.Content.ReadAsStringAsync();
            if (resp.IsSuccessStatusCode)
                return Ok(new { success = true, message = "Series added to Sonarr" });
            return StatusCode((int)resp.StatusCode, new { success = false, message = resBody });
        }
        catch (Exception ex) { return StatusCode(500, new { success = false, message = ex.Message }); }
    }

    // ═══════════════════════════════════════════════════════════════
    // RADARR INTEGRATION
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("radarr/config")]
    public async Task<IActionResult> GetRadarrConfig()
    {
        var (url, apiKey) = await GetServiceConfig(RADARR_KEY);
        return Ok(new { url = url ?? "", api_key = !string.IsNullOrEmpty(apiKey) ? "****" + apiKey[^4..] : "", configured = !string.IsNullOrEmpty(url) });
    }

    [HttpPost("radarr/config")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SaveRadarrConfig([FromBody] JsonElement body)
    {
        return await SaveServiceConfig(RADARR_KEY, body, "/api/v3/system/status");
    }

    [HttpGet("radarr/profiles")]
    public async Task<IActionResult> RadarrProfiles()
    {
        return await ProxyServiceGet(RADARR_KEY, "/api/v3/qualityprofile");
    }

    [HttpGet("radarr/rootfolders")]
    public async Task<IActionResult> RadarrRootFolders()
    {
        return await ProxyServiceGet(RADARR_KEY, "/api/v3/rootfolder");
    }

    [HttpPost("radarr/add")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RadarrAdd([FromBody] JsonElement body)
    {
        var (url, apiKey) = await GetServiceConfig(RADARR_KEY);
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { success = false, message = "Radarr not configured" });

        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(15);
            http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
            var content = new StringContent(body.GetRawText(), System.Text.Encoding.UTF8, "application/json");
            var resp = await http.PostAsync($"{url}/api/v3/movie", content);
            var resBody = await resp.Content.ReadAsStringAsync();
            if (resp.IsSuccessStatusCode)
                return Ok(new { success = true, message = "Movie added to Radarr" });
            return StatusCode((int)resp.StatusCode, new { success = false, message = resBody });
        }
        catch (Exception ex) { return StatusCode(500, new { success = false, message = ex.Message }); }
    }

    // ═══════════════════════════════════════════════════════════════
    // FULFILLMENT — Approve + Send to Sonarr/Radarr
    // ═══════════════════════════════════════════════════════════════

    [HttpPost("requests/{id}/fulfill")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> FulfillRequest(string id)
    {
        var key = $"menu_request:{id}";
        var req = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (req?.Value == null) return NotFound(new { success = false, message = "Request not found" });

        var doc = JsonDocument.Parse(req.Value).RootElement;
        var mediaType = doc.TryGetProperty("media_type", out var mt) ? mt.GetString() : "movie";
        var tmdbId = doc.TryGetProperty("tmdb_id", out var tid) ? tid.GetInt32() : 0;
        var title = doc.TryGetProperty("title", out var t) ? t.GetString() : "";

        // Try to send to Radarr/Sonarr
        string? error = null;
        if (mediaType == "movie")
        {
            var (url, apiKey) = await GetServiceConfig(RADARR_KEY);
            if (!string.IsNullOrEmpty(url) && !string.IsNullOrEmpty(apiKey))
            {
                try
                {
                    using var http = _httpFactory.CreateClient();
                    http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
                    // Get root folders and quality profiles
                    var rfResp = await http.GetStringAsync($"{url}/api/v3/rootfolder");
                    var qpResp = await http.GetStringAsync($"{url}/api/v3/qualityprofile");
                    var rootFolders = JsonDocument.Parse(rfResp).RootElement;
                    var profiles = JsonDocument.Parse(qpResp).RootElement;
                    var rootPath = rootFolders.GetArrayLength() > 0 ? rootFolders[0].GetProperty("path").GetString() : "/movies";
                    var profileId = profiles.GetArrayLength() > 0 ? profiles[0].GetProperty("id").GetInt32() : 1;

                    var addBody = JsonSerializer.Serialize(new
                    {
                        tmdbId, title, qualityProfileId = profileId,
                        rootFolderPath = rootPath, monitored = true, addOptions = new { searchForMovie = true }
                    });
                    var content = new StringContent(addBody, System.Text.Encoding.UTF8, "application/json");
                    var resp = await http.PostAsync($"{url}/api/v3/movie", content);
                    if (!resp.IsSuccessStatusCode)
                        error = $"Radarr returned {(int)resp.StatusCode}";
                }
                catch (Exception ex) { error = ex.Message; }
            }
            else error = "Radarr not configured";
        }
        else if (mediaType == "tv")
        {
            var (url, apiKey) = await GetServiceConfig(SONARR_KEY);
            if (!string.IsNullOrEmpty(url) && !string.IsNullOrEmpty(apiKey))
            {
                try
                {
                    using var http = _httpFactory.CreateClient();
                    http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
                    var rfResp = await http.GetStringAsync($"{url}/api/v3/rootfolder");
                    var qpResp = await http.GetStringAsync($"{url}/api/v3/qualityprofile");
                    var rootFolders = JsonDocument.Parse(rfResp).RootElement;
                    var profiles = JsonDocument.Parse(qpResp).RootElement;
                    var rootPath = rootFolders.GetArrayLength() > 0 ? rootFolders[0].GetProperty("path").GetString() : "/tv";
                    var profileId = profiles.GetArrayLength() > 0 ? profiles[0].GetProperty("id").GetInt32() : 1;

                    // Lookup TVDB ID via TMDB
                    var tmdbKey = await GetTmdbKey();
                    var tvdbId = 0;
                    if (!string.IsNullOrEmpty(tmdbKey))
                    {
                        using var tmdbHttp = _httpFactory.CreateClient();
                        var extResp = await tmdbHttp.GetStringAsync($"https://api.themoviedb.org/3/tv/{tmdbId}/external_ids?api_key={tmdbKey}");
                        var ext = JsonDocument.Parse(extResp).RootElement;
                        tvdbId = ext.TryGetProperty("tvdb_id", out var tvdb) ? tvdb.GetInt32() : 0;
                    }

                    var addBody = JsonSerializer.Serialize(new
                    {
                        tvdbId, title, qualityProfileId = profileId,
                        rootFolderPath = rootPath, monitored = true, addOptions = new { searchForMissingEpisodes = true }
                    });
                    var content = new StringContent(addBody, System.Text.Encoding.UTF8, "application/json");
                    var resp = await http.PostAsync($"{url}/api/v3/series", content);
                    if (!resp.IsSuccessStatusCode)
                        error = $"Sonarr returned {(int)resp.StatusCode}";
                }
                catch (Exception ex) { error = ex.Message; }
            }
            else error = "Sonarr not configured";
        }

        // Update request status
        await UpdateRequestStatus(id, error == null ? "available" : "approved");

        return Ok(new
        {
            success = error == null,
            message = error == null ? $"'{title}' sent to {(mediaType == "tv" ? "Sonarr" : "Radarr")} for download" : $"Approved but fulfillment failed: {error}",
            sent_to = mediaType == "tv" ? "sonarr" : "radarr"
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    private async Task<IActionResult> UpdateRequestStatus(string id, string newStatus)
    {
        var key = $"menu_request:{id}";
        var req = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (req?.Value == null) return NotFound(new { success = false, message = "Request not found" });

        try
        {
            var data = JsonSerializer.Deserialize<Dictionary<string, object>>(req.Value) ?? new();
            data["status"] = newStatus;
            data["decided_at"] = DateTime.UtcNow.ToString("o");
            data["decided_by"] = this.UserId();
            req.Value = JsonSerializer.Serialize(data);
            await _db.SaveChangesAsync();
            return Ok(new { success = true, status = newStatus, message = $"Request {newStatus}" });
        }
        catch (Exception ex) { return StatusCode(500, new { success = false, message = ex.Message }); }
    }

    private async Task<IActionResult> TmdbGet(string url)
    {
        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/1.0.0 Menu");
            var resp = await http.GetAsync(url);
            var body = await resp.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    private async Task<IActionResult> SaveServiceConfig(string configKey, JsonElement body, string testPath)
    {
        var url = body.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null;
        var apiKey = body.TryGetProperty("api_key", out var k) ? k.GetString() : null;
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { success = false, message = "URL and API key are required" });

        // Test connection
        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
            var resp = await http.GetAsync($"{url}{testPath}");
            if (!resp.IsSuccessStatusCode)
                return BadRequest(new { success = false, message = $"Connection failed (HTTP {(int)resp.StatusCode})" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = $"Connection error: {ex.Message}" });
        }

        var configData = JsonSerializer.Serialize(new { url, api_key = apiKey });
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == configKey && s.UserId == "");
        if (existing != null) existing.Value = configData;
        else _db.Settings.Add(new AppSetting { Key = configKey, UserId = "", Value = configData });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Connected successfully" });
    }

    private async Task<IActionResult> ProxyServiceGet(string configKey, string path)
    {
        var (url, apiKey) = await GetServiceConfig(configKey);
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return Ok(Array.Empty<object>());
        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
            var resp = await http.GetAsync($"{url}{path}");
            var body = await resp.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }
}

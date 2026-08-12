using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Brine — Usenet Indexer/Search.
/// Proxies to Prowlarr or any Newznab-compatible indexer for NZB searching.
/// </summary>
[Route("api/brine")]
[Route("api/gadgets/brine")]
[ApiController]
[Authorize]
public class BrineController : ControllerBase
{
    private readonly AppDbContext _db;
    public BrineController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "brine", version = "1.0.0", status = "active", description = "Usenet indexer: search NZBs via Newznab-compatible indexers" });

    private const string ConfigKey = "brine_config";

    // ── Configuration ──────────────────────────────────
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var cfg = await GetBrineConfig();
        return Ok(new { configured = cfg.url != null, url = cfg.url, type = cfg.type });
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
        var cfg = await GetBrineConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Usenet indexer not configured" });
        try
        {
            var http = BuildClient(cfg);
            if (cfg.type == "prowlarr")
            {
                var resp = await http.GetStringAsync($"{cfg.url}/api/v1/health");
                return Ok(new { success = true, type = "prowlarr", message = "Prowlarr connected" });
            }
            else
            {
                var resp = await http.GetStringAsync($"{cfg.url}/api?t=caps&apikey={cfg.apiKey}");
                return Ok(new { success = true, type = "newznab", message = "Newznab indexer connected" });
            }
        }
        catch (Exception ex) { return Ok(new { success = false, error = ex.Message }); }
    }

    // ── Prowlarr: Indexers ──────────────────────────────────
    [HttpGet("indexers")]
    public async Task<IActionResult> Indexers()
    {
        var cfg = await GetBrineConfig();
        if (cfg.url == null || cfg.type != "prowlarr") return Ok(Array.Empty<object>());
        return await ProxyGet(cfg, "/api/v1/indexer");
    }

    [HttpGet("indexers/stats")]
    public async Task<IActionResult> IndexerStats()
    {
        var cfg = await GetBrineConfig();
        if (cfg.url == null || cfg.type != "prowlarr") return Ok(Array.Empty<object>());
        return await ProxyGet(cfg, "/api/v1/indexerstats");
    }

    // ── Search ──────────────────────────────────
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q = "", [FromQuery] string? type = null,
        [FromQuery] int limit = 50, [FromQuery] int offset = 0, [FromQuery] string? categories = null,
        [FromQuery] string? indexerIds = null)
    {
        var cfg = await GetBrineConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Usenet indexer not configured" });

        try
        {
            var http = BuildClient(cfg);
            string resp;

            if (cfg.type == "prowlarr")
            {
                var url = $"{cfg.url}/api/v1/search?query={Uri.EscapeDataString(q)}&limit={limit}&offset={offset}&type=search";
                if (!string.IsNullOrEmpty(categories)) url += $"&categories={categories}";
                if (!string.IsNullOrEmpty(indexerIds)) url += $"&indexerIds={indexerIds}";
                resp = await http.GetStringAsync(url);
            }
            else
            {
                var url = $"{cfg.url}/api?t=search&q={Uri.EscapeDataString(q)}&apikey={cfg.apiKey}&limit={limit}&offset={offset}&o=json";
                if (!string.IsNullOrEmpty(categories)) url += $"&cat={categories}";
                resp = await http.GetStringAsync(url);
            }
            return Content(resp, "application/json");
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("search/movie")]
    public async Task<IActionResult> SearchMovie([FromQuery] string? q = null, [FromQuery] string? imdbId = null,
        [FromQuery] int? tmdbId = null, [FromQuery] int limit = 50)
    {
        var cfg = await GetBrineConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            if (cfg.type == "prowlarr")
            {
                var url = $"{cfg.url}/api/v1/search?type=movie&limit={limit}&categories=2000,2010,2020,2030,2040,2045,2050,2060";
                if (!string.IsNullOrEmpty(q)) url += $"&query={Uri.EscapeDataString(q)}";
                if (!string.IsNullOrEmpty(imdbId)) url += $"&imdbId={imdbId}";
                if (tmdbId.HasValue) url += $"&tmdbId={tmdbId}";
                var resp = await http.GetStringAsync(url);
                return Content(resp, "application/json");
            }
            else
            {
                var url = $"{cfg.url}/api?t=movie&apikey={cfg.apiKey}&limit={limit}&o=json";
                if (!string.IsNullOrEmpty(q)) url += $"&q={Uri.EscapeDataString(q)}";
                if (!string.IsNullOrEmpty(imdbId)) url += $"&imdbid={imdbId}";
                var resp = await http.GetStringAsync(url);
                return Content(resp, "application/json");
            }
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("search/tv")]
    public async Task<IActionResult> SearchTv([FromQuery] string? q = null, [FromQuery] string? imdbId = null,
        [FromQuery] int? tvdbId = null, [FromQuery] int? season = null, [FromQuery] int? episode = null,
        [FromQuery] int limit = 50)
    {
        var cfg = await GetBrineConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            if (cfg.type == "prowlarr")
            {
                var url = $"{cfg.url}/api/v1/search?type=tvsearch&limit={limit}&categories=5000,5010,5020,5030,5040,5045,5050,5060";
                if (!string.IsNullOrEmpty(q)) url += $"&query={Uri.EscapeDataString(q)}";
                if (!string.IsNullOrEmpty(imdbId)) url += $"&imdbId={imdbId}";
                if (tvdbId.HasValue) url += $"&tvdbId={tvdbId}";
                if (season.HasValue) url += $"&season={season}";
                if (episode.HasValue) url += $"&episode={episode}";
                var resp = await http.GetStringAsync(url);
                return Content(resp, "application/json");
            }
            else
            {
                var url = $"{cfg.url}/api?t=tvsearch&apikey={cfg.apiKey}&limit={limit}&o=json";
                if (!string.IsNullOrEmpty(q)) url += $"&q={Uri.EscapeDataString(q)}";
                if (!string.IsNullOrEmpty(imdbId)) url += $"&imdbid={imdbId}";
                if (tvdbId.HasValue) url += $"&tvdbid={tvdbId}";
                if (season.HasValue) url += $"&season={season}";
                if (episode.HasValue) url += $"&ep={episode}";
                var resp = await http.GetStringAsync(url);
                return Content(resp, "application/json");
            }
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    // ── Grab/Download NZB ──────────────────────────────────
    [HttpPost("grab")]
    public async Task<IActionResult> Grab([FromBody] JsonElement body)
    {
        var cfg = await GetBrineConfig();
        if (cfg.url == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var http = BuildClient(cfg);
            if (cfg.type == "prowlarr")
            {
                var guid = body.TryGetProperty("guid", out var g) ? g.GetString() : null;
                var indexerId = body.TryGetProperty("indexer_id", out var ii) ? ii.GetInt32() : 0;
                if (string.IsNullOrEmpty(guid)) return BadRequest(new { detail = "guid required" });
                var payload = JsonSerializer.Serialize(new { guid, indexerId });
                var resp = await http.PostAsync($"{cfg.url}/api/v1/search",
                    new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
                return Ok(new { status = resp.IsSuccessStatusCode ? "grabbed" : "failed" });
            }
            else
            {
                var nzbUrl = body.TryGetProperty("nzb_url", out var nu) ? nu.GetString() : null;
                return Ok(new { status = "nzb_url_provided", url = nzbUrl });
            }
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    // ── Categories Reference ──────────────────────────────────
    [HttpGet("categories")]
    public IActionResult Categories() => Ok(new[]
    {
        new { id = 2000, name = "Movies", sub = new[] { new { id = 2010, name = "Foreign" }, new { id = 2020, name = "Other" }, new { id = 2030, name = "SD" }, new { id = 2040, name = "HD" }, new { id = 2045, name = "UHD" }, new { id = 2050, name = "BluRay" }, new { id = 2060, name = "3D" } } },
        new { id = 5000, name = "TV", sub = new[] { new { id = 5010, name = "Foreign" }, new { id = 5020, name = "SD" }, new { id = 5030, name = "HD" }, new { id = 5040, name = "UHD" }, new { id = 5045, name = "Other" }, new { id = 5050, name = "Sport" }, new { id = 5060, name = "Anime" } } },
        new { id = 3000, name = "Audio", sub = new[] { new { id = 3010, name = "MP3" }, new { id = 3020, name = "Video" }, new { id = 3030, name = "Audiobook" }, new { id = 3040, name = "Lossless" } } },
    });

    // ── Helpers ──────────────────────────────────
    private async Task<(string? url, string? apiKey, string type)> GetBrineConfig()
    {
        var uid = this.UserId();
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ConfigKey);
        if (cfg?.Value == null) return (null, null, "prowlarr");
        var doc = JsonDocument.Parse(cfg.Value).RootElement;
        var url = doc.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null;
        if (url != null && SsrfGuard.IsBlockedUrl(url)) url = null;
        return (
            url,
            doc.TryGetProperty("api_key", out var ak) ? ak.GetString() : null,
            doc.TryGetProperty("type", out var t) ? t.GetString() ?? "prowlarr" : "prowlarr"
        );
    }

    private HttpClient BuildClient((string? url, string? apiKey, string type) cfg)
    {
        var http = this.Http();
        http.Timeout = TimeSpan.FromSeconds(30);
        if (!string.IsNullOrEmpty(cfg.apiKey) && cfg.type == "prowlarr")
            http.DefaultRequestHeaders.Add("X-Api-Key", cfg.apiKey);
        return http;
    }

    private async Task<IActionResult> ProxyGet((string? url, string? apiKey, string type) cfg, string path)
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

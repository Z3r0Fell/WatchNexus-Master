using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>TMDB proxy — forwards calls to themoviedb.org API using configured key</summary>
[ApiController]
[Route("api/tmdb")]
[Authorize]
public class TmdbProxyController : ControllerBase
{
    private readonly IHttpClientFactory _http;
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private const string TMDB_BASE = "https://api.themoviedb.org/3";

    public TmdbProxyController(IHttpClientFactory http, AppDbContext db, IConfiguration config) { _http = http; _db = db; _config = config; }

    private async Task<string?> GetApiKey()
    {
        // Check DB first (user-configured key)
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.Value != null);
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value);
                if (doc.RootElement.TryGetProperty("api_key", out var ak))
                    return ak.GetString();
            }
            catch { }
            return setting.Value;
        }
        // Check legacy crumbs_tmdb key
        var crumbs = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "crumbs_tmdb" && s.Value != null);
        if (crumbs?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(crumbs.Value);
                if (doc.RootElement.TryGetProperty("api_key", out var ak))
                    return ak.GetString();
            }
            catch { }
        }
        // Fall back to environment/config
        return _config["TMDB_API_KEY"];
    }

    private async Task<IActionResult> ProxyGet(string path, Dictionary<string, string>? extra = null)
    {
        var key = await GetApiKey();
        if (string.IsNullOrEmpty(key))
            return Ok(new { results = Array.Empty<object>(), page = 1, total_pages = 0, total_results = 0 });

        var client = _http.CreateClient();
        var qs = $"?api_key={key}&language=en-US";
        if (extra != null)
            foreach (var kv in extra)
                qs += $"&{kv.Key}={Uri.EscapeDataString(kv.Value)}";

        try
        {
            var resp = await client.GetAsync($"{TMDB_BASE}{path}{qs}");
            var json = await resp.Content.ReadAsStringAsync();
            return Content(json, "application/json");
        }
        catch
        {
            return Ok(new { results = Array.Empty<object>(), page = 1, total_pages = 0, total_results = 0 });
        }
    }

    [HttpGet("search")]
    public Task<IActionResult> Search(string query, int page = 1, string media_type = "multi") =>
        ProxyGet($"/search/{media_type}", new() { ["query"] = query, ["page"] = page.ToString() });

    [HttpGet("trending")]
    public Task<IActionResult> TrendingDefault() =>
        ProxyGet("/trending/all/day");

    [HttpGet("trending/{mediaType}/{timeWindow}")]
    public Task<IActionResult> Trending(string mediaType, string timeWindow) =>
        ProxyGet($"/trending/{mediaType}/{timeWindow}");

    [HttpGet("popular/{mediaType}")]
    public Task<IActionResult> Popular(string mediaType, int page = 1) =>
        ProxyGet($"/{mediaType}/popular", new() { ["page"] = page.ToString() });

    [HttpGet("movie/now_playing")]
    public Task<IActionResult> NowPlaying(int page = 1) =>
        ProxyGet("/movie/now_playing", new() { ["page"] = page.ToString() });

    [HttpGet("tv/on_the_air")]
    public Task<IActionResult> OnTheAir(int page = 1) =>
        ProxyGet("/tv/on_the_air", new() { ["page"] = page.ToString() });

    [HttpGet("movie/{id}")]
    public Task<IActionResult> MovieDetail(int id) =>
        ProxyGet($"/movie/{id}", new() { ["append_to_response"] = "credits,similar,videos,images" });

    [HttpGet("tv/{id}")]
    public Task<IActionResult> TvDetail(int id) =>
        ProxyGet($"/tv/{id}", new() { ["append_to_response"] = "credits,similar,videos,images" });

    [HttpGet("tv/{id}/season/{seasonNum}")]
    public Task<IActionResult> Season(int id, int seasonNum) =>
        ProxyGet($"/tv/{id}/season/{seasonNum}");

    [HttpGet("discover/{mediaType}")]
    public Task<IActionResult> Discover(string mediaType, int page = 1, string? with_genres = null, string? sort_by = null)
    {
        var p = new Dictionary<string, string> { ["page"] = page.ToString() };
        if (!string.IsNullOrEmpty(with_genres)) p["with_genres"] = with_genres;
        if (!string.IsNullOrEmpty(sort_by)) p["sort_by"] = sort_by;
        return ProxyGet($"/discover/{mediaType}", p);
    }

    [HttpGet("genres/{mediaType}")]
    public Task<IActionResult> Genres(string mediaType) =>
        ProxyGet($"/genre/{mediaType}/list");
}

/// <summary>Watchlist — per-user list of saved items</summary>
[ApiController]
[Route("api/watchlist")]
[Authorize]
public class WatchlistController : ControllerBase
{
    private readonly AppDbContext _db;
    public WatchlistController(AppDbContext db) { _db = db; }

    private string UserId => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "";

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var items = await _db.Settings
            .Where(s => s.UserId == UserId && s.Key.StartsWith("watchlist:"))
            .ToListAsync();
        var list = items.Select(s =>
        {
            try { return JsonSerializer.Deserialize<object>(s.Value); }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] JsonElement item)
    {
        var tmdbId = item.TryGetProperty("tmdb_id", out var id) ? id.ToString() :
                     item.TryGetProperty("id", out var id2) ? id2.ToString() : Guid.NewGuid().ToString();
        var key = $"watchlist:{tmdbId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
        if (existing != null)
            existing.Value = item.GetRawText();
        else
            _db.Settings.Add(new Shared.AppSetting { Key = key, Value = item.GetRawText(), UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "added", tmdb_id = tmdbId });
    }

    [HttpDelete("{tmdbId}")]
    public async Task<IActionResult> Remove(string tmdbId)
    {
        var key = $"watchlist:{tmdbId}";
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
        if (item != null) { _db.Settings.Remove(item); await _db.SaveChangesAsync(); }
        return Ok(new { status = "removed" });
    }
}

/// <summary>Watch progress — per-user continue watching state</summary>
[ApiController]
[Route("api/watch-progress")]
[Authorize]
public class WatchProgressController : ControllerBase
{
    private readonly AppDbContext _db;
    public WatchProgressController(AppDbContext db) { _db = db; }

    private string UserId => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "";

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var items = await _db.Settings
            .Where(s => s.UserId == UserId && s.Key.StartsWith("progress:"))
            .ToListAsync();
        var list = items.Select(s =>
        {
            try { return JsonSerializer.Deserialize<object>(s.Value); }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(list);
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _db.Settings
            .Where(s => s.UserId == UserId && s.Key.StartsWith("progress:"))
            .ToListAsync();
        var list = items.Select(s =>
        {
            try { return JsonSerializer.Deserialize<object>(s.Value); }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Update([FromBody] JsonElement progress)
    {
        var tmdbId = progress.TryGetProperty("tmdb_id", out var id) ? id.ToString() : "";
        var mediaType = progress.TryGetProperty("media_type", out var mt) ? mt.GetString() : "movie";
        var key = $"progress:{tmdbId}:{mediaType}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == UserId);
        if (existing != null)
            existing.Value = progress.GetRawText();
        else
            _db.Settings.Add(new Shared.AppSetting { Key = key, Value = progress.GetRawText(), UserId = UserId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(string? tmdb_id = null, string? media_type = null, int? season = null, int? episode = null)
    {
        var prefix = $"progress:{tmdb_id}";
        var items = await _db.Settings.Where(s => s.UserId == UserId && s.Key.StartsWith(prefix)).ToListAsync();
        _db.Settings.RemoveRange(items);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpDelete("all")]
    public async Task<IActionResult> ClearAll()
    {
        var items = await _db.Settings.Where(s => s.UserId == UserId && s.Key.StartsWith("progress:")).ToListAsync();
        _db.Settings.RemoveRange(items);
        await _db.SaveChangesAsync();
        return Ok(new { status = "cleared" });
    }
}

/// <summary>Next-up — returns the next episode/item to watch</summary>
[ApiController]
[Route("api/next-up")]
[Authorize]
public class NextUpController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(Array.Empty<object>());
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>Bridge routes for legacy /api/marmalade/* endpoints used by some frontend pages</summary>
[ApiController]
[Route("api/marmalade")]
[Authorize]
public class MarmaladeBridgeController : ControllerBase
{
    private readonly AppDbContext _db;
    public MarmaladeBridgeController(AppDbContext db) { _db = db; }

    [HttpGet("libraries")]
    public async Task<IActionResult> GetLibraries() =>
        Ok(await _db.Libraries.OrderByDescending(l => l.CreatedAt).ToListAsync());

    [HttpGet("media")]
    public async Task<IActionResult> GetMedia(string? library_id = null, string? media_type = null, int limit = 50, int offset = 0)
    {
        var q = _db.MediaItems.AsQueryable();
        if (!string.IsNullOrEmpty(library_id)) q = q.Where(m => m.LibraryId == library_id);
        if (!string.IsNullOrEmpty(media_type)) q = q.Where(m => m.MediaType == media_type);
        var items = await q.OrderBy(m => m.Title).Skip(offset).Take(limit).ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, m.FilePath, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime
        }));
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        return Ok(new
        {
            total_libraries = await _db.Libraries.CountAsync(),
            total_media = await _db.MediaItems.CountAsync(),
            total_size = await _db.MediaItems.SumAsync(m => m.FileSize),
        });
    }

    [HttpGet("media/recent")]
    public async Task<IActionResult> RecentMedia(int limit = 20) =>
        Ok(await _db.MediaItems.OrderByDescending(m => m.CreatedAt).Take(limit)
            .Select(m => new { m.Id, m.Title, m.Year, m.Rating, poster_url = m.PosterUrl,
                backdrop_url = m.BackdropUrl, media_type = m.MediaType, m.Overview })
            .ToListAsync());
}

/// <summary>Preferences endpoint for user settings persistence</summary>
[ApiController]
[Route("api/preferences")]
[Authorize]
public class PreferencesController : ControllerBase
{
    private readonly AppDbContext _db;
    public PreferencesController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var prefs = await _db.Settings.Where(s => s.UserId == userId).ToListAsync();
        return Ok(prefs.ToDictionary(s => s.Key, s => s.Value));
    }

    [HttpPost]
    public async Task<IActionResult> Set([FromBody] Dictionary<string, string> prefs)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        foreach (var (key, value) in prefs)
        {
            var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == userId);
            if (existing != null) existing.Value = value;
            else _db.Settings.Add(new Shared.AppSetting { Key = key, Value = value, UserId = userId });
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

/// <summary>Dashboard stats endpoint</summary>
[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    public DashboardController(AppDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        return Ok(new
        {
            total_libraries = await _db.Libraries.CountAsync(),
            total_media = await _db.MediaItems.CountAsync(),
            total_movies = await _db.MediaItems.CountAsync(m => m.MediaType == "movies"),
            total_tv = await _db.MediaItems.CountAsync(m => m.MediaType == "tv"),
            total_size = await _db.MediaItems.SumAsync(m => m.FileSize),
            recent_media = await _db.MediaItems.OrderByDescending(m => m.CreatedAt).Take(10).Select(m => new
            {
                m.Id, m.Title, m.Year, m.Rating, poster_url = m.PosterUrl, media_type = m.MediaType
            }).ToListAsync(),
        });
    }
}

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
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IServiceScopeFactory _scopeFactory;

    public MarmaladeBridgeController(AppDbContext db, IConfiguration config, IHttpClientFactory httpFactory, IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _config = config;
        _httpFactory = httpFactory;
        _scopeFactory = scopeFactory;
    }

    [HttpGet("libraries")]
    public async Task<IActionResult> GetLibraries() =>
        Ok((await _db.Libraries.OrderByDescending(l => l.CreatedAt).ToListAsync())
            .Select(l => new {
                l.Id, l.Name, l.Path, media_type = l.MediaType,
                item_count = l.ItemCount, total_size = l.TotalSize,
                scan_status = l.ScanStatus, last_scanned_at = l.LastScannedAt,
                created_at = l.CreatedAt
            }));

    [HttpPost("libraries")]
    public async Task<IActionResult> AddLibrary([FromQuery] string name, [FromQuery] string path, [FromQuery] string media_type = "movies")
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(path))
            return BadRequest(new { detail = "Name and path are required" });

        var typeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Movie"] = "movies", ["Movies"] = "movies", ["movies"] = "movies",
            ["TvShow"] = "tv", ["TV Shows"] = "tv", ["tv"] = "tv",
            ["Music"] = "music", ["Anime"] = "anime",
        };

        var lib = new Library
        {
            Name = name,
            Path = path,
            MediaType = typeMap.GetValueOrDefault(media_type, media_type.ToLower()),
        };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();
        return Ok(new {
            lib.Id, lib.Name, lib.Path, media_type = lib.MediaType,
            item_count = 0, total_size = 0L,
            scan_status = "idle", last_scanned_at = (DateTime?)null,
            created_at = lib.CreatedAt
        });
    }

    [HttpDelete("libraries/{id}")]
    public async Task<IActionResult> DeleteLibrary(string id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound();
        _db.MediaItems.RemoveRange(_db.MediaItems.Where(m => m.LibraryId == id));
        _db.Libraries.Remove(lib);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("libraries/{id}/scan")]
    public async Task<IActionResult> ScanLibrary(string id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound(new { detail = "Library not found" });

        var extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { ".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".webm",
          ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma" };

        var newCount = 0; var updated = 0;
        try
        {
            if (!Directory.Exists(lib.Path))
                return Ok(new { @new = 0, updated = 0, total = 0, errors = new[] { $"Path not found: {lib.Path}" } });

            var files = Directory.EnumerateFiles(lib.Path, "*.*", SearchOption.AllDirectories)
                .Where(f => extensions.Contains(System.IO.Path.GetExtension(f)))
                .ToList();

            long totalSize = 0;
            foreach (var file in files)
            {
                var fi = new FileInfo(file);
                totalSize += fi.Length;
                var existing = await _db.MediaItems.FirstOrDefaultAsync(m => m.FilePath == file && m.LibraryId == id);
                if (existing != null) { updated++; continue; }

                var cleanName = System.IO.Path.GetFileNameWithoutExtension(file)
                    .Replace('.', ' ').Replace('_', ' ');

                _db.MediaItems.Add(new MediaItem
                {
                    LibraryId = id, Title = cleanName,
                    FilePath = file, FileSize = fi.Length,
                    MediaType = lib.MediaType,
                });
                newCount++;
            }

            lib.ItemCount = await _db.MediaItems.CountAsync(m => m.LibraryId == id) + newCount;
            lib.TotalSize = totalSize;
            lib.ScanStatus = "completed";
            lib.LastScannedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            return Ok(new { @new = newCount, updated, total = newCount + updated, errors = new[] { ex.Message } });
        }

        return Ok(new { @new = newCount, updated, total = newCount + updated, errors = Array.Empty<string>() });
    }

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

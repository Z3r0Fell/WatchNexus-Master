using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

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

            // Resolve TMDB API key for metadata fetching
            var tmdbKey = _config["TMDB_API_KEY"] ?? "";
            if (string.IsNullOrEmpty(tmdbKey))
            {
                var ts = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.Value != null);
                if (ts != null) {
                    try { var d = System.Text.Json.JsonDocument.Parse(ts.Value ?? "{}"); if (d.RootElement.TryGetProperty("api_key", out var a)) tmdbKey = a.GetString() ?? ""; else tmdbKey = ts.Value ?? ""; } catch { tmdbKey = ts.Value ?? ""; }
                }
            }
            if (string.IsNullOrEmpty(tmdbKey))
            {
                var cs = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "crumbs_tmdb" && s.Value != null);
                if (cs != null) { try { var d = System.Text.Json.JsonDocument.Parse(cs.Value ?? "{}"); if (d.RootElement.TryGetProperty("api_key", out var a)) tmdbKey = a.GetString() ?? ""; } catch { } }
            }

            var http = _httpFactory.CreateClient();
            long totalSize = 0;
            foreach (var file in files)
            {
                var fi = new FileInfo(file);
                totalSize += fi.Length;
                var existing = await _db.MediaItems.FirstOrDefaultAsync(m => m.FilePath == file && m.LibraryId == id);
                if (existing != null) { updated++; continue; }

                var rawName = System.IO.Path.GetFileNameWithoutExtension(file)
                    .Replace('.', ' ').Replace('_', ' ');
                // Parse out quality tags and year
                var cleanName = System.Text.RegularExpressions.Regex.Replace(rawName,
                    @"\b(S\d{1,2}E\d{1,2}|[Ss]\d{1,2}|1080p|720p|480p|2160p|4K|BluRay|WEB|HDRip|BRRip|HDTV|x264|x265|HEVC|AAC|DTS)\b.*", "",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
                if (string.IsNullOrEmpty(cleanName)) cleanName = rawName;

                var item = new MediaItem
                {
                    LibraryId = id, Title = cleanName,
                    FilePath = file, FileSize = fi.Length,
                    MediaType = lib.MediaType,
                };

                // Fetch TMDB metadata for poster/backdrop
                if (!string.IsNullOrEmpty(tmdbKey))
                {
                    try
                    {
                        var searchType = lib.MediaType == "tv" ? "tv" : "movie";
                        var searchResp = await http.GetStringAsync($"https://api.themoviedb.org/3/search/{searchType}?api_key={tmdbKey}&query={Uri.EscapeDataString(cleanName)}");
                        var doc = System.Text.Json.JsonDocument.Parse(searchResp);
                        var results = doc.RootElement.GetProperty("results");
                        if (results.GetArrayLength() > 0)
                        {
                            var first = results[0];
                            item.TmdbId = first.GetProperty("id").GetInt32();
                            var titleProp = searchType == "tv" ? "name" : "title";
                            if (first.TryGetProperty(titleProp, out var t)) item.Title = t.GetString() ?? cleanName;
                            if (first.TryGetProperty("poster_path", out var pp) && pp.ValueKind == System.Text.Json.JsonValueKind.String)
                                item.PosterUrl = $"https://image.tmdb.org/t/p/w500{pp.GetString()}";
                            if (first.TryGetProperty("backdrop_path", out var bp) && bp.ValueKind == System.Text.Json.JsonValueKind.String)
                                item.BackdropUrl = $"https://image.tmdb.org/t/p/w1280{bp.GetString()}";
                            if (first.TryGetProperty("overview", out var ov))
                                item.Overview = ov.GetString();
                            if (first.TryGetProperty("vote_average", out var ra))
                                item.Rating = (float)ra.GetDouble();
                        }
                    }
                    catch { /* skip metadata fetch errors */ }
                }

                _db.MediaItems.Add(item);
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

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        return Ok(new
        {
            status = "running",
            version = "2.8.3",
            total_libraries = await _db.Libraries.CountAsync(),
            total_media = await _db.MediaItems.CountAsync(),
            total_size = await _db.MediaItems.SumAsync(m => m.FileSize),
        });
    }

    [HttpGet("media/{id}")]
    public async Task<IActionResult> GetMediaItem(string id)
    {
        var m = await _db.MediaItems.FindAsync(id);
        if (m == null) return NotFound(new { detail = "Media item not found" });
        return Ok(new
        {
            m.Id, m.Title, m.Overview, m.FilePath, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime, library_id = m.LibraryId,
            created_at = m.CreatedAt
        });
    }

    [HttpGet("media/search")]
    public async Task<IActionResult> SearchMedia(string? query = null, int limit = 50)
    {
        var q = _db.MediaItems.AsQueryable();
        if (!string.IsNullOrWhiteSpace(query))
            q = q.Where(m => m.Title != null && m.Title.ToLower().Contains(query.ToLower()));
        var items = await q.OrderBy(m => m.Title).Take(limit).ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, m.FilePath, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime
        }));
    }

    [HttpGet("continue-watching")]
    public async Task<IActionResult> ContinueWatching(int limit = 10)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var items = await _db.Settings
            .Where(s => s.UserId == userId && s.Key.StartsWith("progress:"))
            .OrderByDescending(s => s.Key)
            .Take(limit)
            .ToListAsync();
        var list = items.Select(s => {
            try { return System.Text.Json.JsonSerializer.Deserialize<object>(s.Value ?? "{}"); }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(list);
    }

    [HttpGet("tv-series")]
    public async Task<IActionResult> GetTVSeries(string? library_id = null)
    {
        var q = _db.MediaItems.Where(m => m.MediaType == "tv");
        if (!string.IsNullOrEmpty(library_id)) q = q.Where(m => m.LibraryId == library_id);
        var items = await q.OrderBy(m => m.Title).ToListAsync();
        // Group by title (series name)
        var series = items.GroupBy(m => m.Title?.Split(" - ").FirstOrDefault() ?? m.Title)
            .Select(g => new
            {
                title = g.Key,
                episodes = g.Select(m => new
                {
                    m.Id, m.Title, m.FilePath, file_size = m.FileSize,
                    poster_url = m.PosterUrl, m.Year, m.Runtime
                }).ToList(),
                total_episodes = g.Count()
            }).ToList();
        return Ok(series);
    }

    [HttpPost("libraries/{id}/refresh-metadata")]
    public async Task<IActionResult> RefreshMetadata(string id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound(new { detail = "Library not found" });
        // Get TMDB API key from settings - check multiple sources
        var tmdbApiKey = "";
        var tmdbSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.Value != null);
        if (tmdbSetting != null)
        {
            try
            {
                var doc = System.Text.Json.JsonDocument.Parse(tmdbSetting.Value ?? "{}");
                if (doc.RootElement.TryGetProperty("api_key", out var ak))
                    tmdbApiKey = ak.GetString() ?? "";
                else
                    tmdbApiKey = tmdbSetting.Value ?? "";
            }
            catch { tmdbApiKey = tmdbSetting.Value ?? ""; }
        }
        if (string.IsNullOrEmpty(tmdbApiKey))
        {
            // Check legacy crumbs_tmdb key
            var crumbsSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "crumbs_tmdb" && s.Value != null);
            if (crumbsSetting != null)
            {
                try
                {
                    var doc = System.Text.Json.JsonDocument.Parse(crumbsSetting.Value ?? "{}");
                    if (doc.RootElement.TryGetProperty("api_key", out var ak))
                        tmdbApiKey = ak.GetString() ?? "";
                }
                catch { }
            }
        }
        if (string.IsNullOrEmpty(tmdbApiKey))
        {
            tmdbApiKey = _config["TMDB_API_KEY"] ?? "";
        }
        if (string.IsNullOrEmpty(tmdbApiKey))
            return Ok(new { status = "skipped", reason = "No TMDB API key configured" });

        var items = await _db.MediaItems.Where(m => m.LibraryId == id).ToListAsync();
        var updated = 0;
        var http = _httpFactory.CreateClient();
        foreach (var item in items)
        {
            if (item.TmdbId != null) { updated++; continue; }
            try
            {
                var searchUrl = $"https://api.themoviedb.org/3/search/{(lib.MediaType == "tv" ? "tv" : "movie")}?api_key={tmdbApiKey}&query={Uri.EscapeDataString(item.Title ?? "")}";
                var resp = await http.GetStringAsync(searchUrl);
                var doc = System.Text.Json.JsonDocument.Parse(resp);
                var results = doc.RootElement.GetProperty("results");
                if (results.GetArrayLength() > 0)
                {
                    var first = results[0];
                    item.TmdbId = first.GetProperty("id").GetInt32();
                    if (first.TryGetProperty("poster_path", out var poster) && poster.ValueKind == System.Text.Json.JsonValueKind.String)
                        item.PosterUrl = $"https://image.tmdb.org/t/p/w500{poster.GetString()}";
                    if (first.TryGetProperty("backdrop_path", out var backdrop) && backdrop.ValueKind == System.Text.Json.JsonValueKind.String)
                        item.BackdropUrl = $"https://image.tmdb.org/t/p/w1280{backdrop.GetString()}";
                    if (first.TryGetProperty("overview", out var overview))
                        item.Overview = overview.GetString();
                    if (first.TryGetProperty("vote_average", out var rating))
                        item.Rating = (float)rating.GetDouble();
                    updated++;
                }
            }
            catch { /* skip failed items */ }
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "completed", updated, total = items.Count });
    }

    [HttpPost("media/{id}/progress")]
    public async Task<IActionResult> UpdateProgress(string id, float progress = 0)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var media = await _db.MediaItems.FindAsync(id);
        if (media == null) return NotFound();
        var key = $"progress:local:{id}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == userId);
        var json = System.Text.Json.JsonSerializer.Serialize(new {
            media_id = id, title = media.Title, media_type = media.MediaType,
            progress, tmdb_id = media.TmdbId, poster_url = media.PosterUrl,
            backdrop_path = media.BackdropUrl
        });
        if (existing != null)
            existing.Value = json;
        else
            _db.Settings.Add(new Shared.AppSetting { Key = key, Value = json, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "updated" });
    }

    [HttpPost("media/{id}/watched")]
    public async Task<IActionResult> MarkWatched(string id, bool watched = true)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var media = await _db.MediaItems.FindAsync(id);
        if (media == null) return NotFound();
        var key = $"progress:local:{id}";
        if (watched)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(new {
                media_id = id, title = media.Title, media_type = media.MediaType,
                progress = 100.0, tmdb_id = media.TmdbId
            });
            var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == userId);
            if (existing != null) existing.Value = json;
            else _db.Settings.Add(new Shared.AppSetting { Key = key, Value = json, UserId = userId });
        }
        else
        {
            var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key && s.UserId == userId);
            if (existing != null) _db.Settings.Remove(existing);
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = watched ? "watched" : "unwatched" });
    }

    [HttpGet("stream/{id}")]
    public async Task<IActionResult> GetStreamInfo(string id, string quality = "original")
    {
        var media = await _db.MediaItems.FindAsync(id);
        if (media == null) return NotFound(new { detail = "Media not found" });
        if (string.IsNullOrEmpty(media.FilePath) || !System.IO.File.Exists(media.FilePath))
            return Ok(new { error = "File not found on disk", file_path = media.FilePath });
        var fi = new FileInfo(media.FilePath);
        return Ok(new
        {
            media.Id, media.Title, file_path = media.FilePath,
            file_size = fi.Length, media_type = media.MediaType,
            stream_url = $"/api/marmalade/stream/{id}/file",
            quality, format = System.IO.Path.GetExtension(media.FilePath).TrimStart('.')
        });
    }

    [HttpGet("stream/{id}/file")]
    [AllowAnonymous]
    public async Task<IActionResult> StreamFile(string id)
    {
        var media = await _db.MediaItems.FindAsync(id);
        if (media == null) return NotFound();
        if (string.IsNullOrEmpty(media.FilePath) || !System.IO.File.Exists(media.FilePath))
            return NotFound(new { detail = "File not found" });
        var ext = System.IO.Path.GetExtension(media.FilePath).ToLower();
        var mime = ext switch
        {
            ".mp4" => "video/mp4",
            ".mkv" => "video/x-matroska",
            ".avi" => "video/x-msvideo",
            ".mov" => "video/quicktime",
            ".webm" => "video/webm",
            ".mp3" => "audio/mpeg",
            ".flac" => "audio/flac",
            ".wav" => "audio/wav",
            ".m4a" => "audio/mp4",
            _ => "application/octet-stream"
        };
        var stream = new FileStream(media.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return File(stream, mime, enableRangeProcessing: true);
    }
}

/// <summary>Alias for /api/library → delegates to /api/libraries endpoints</summary>
[ApiController]
[Route("api/library")]
[Authorize]
public class LibraryAliasController : ControllerBase
{
    private readonly AppDbContext _db;
    public LibraryAliasController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? media_type = null)
    {
        var q = _db.MediaItems.AsQueryable();
        if (!string.IsNullOrEmpty(media_type)) q = q.Where(m => m.MediaType == media_type);
        var items = await q.OrderBy(m => m.Title).ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, m.FilePath, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] System.Text.Json.JsonElement item)
    {
        var mediaItem = new MediaItem
        {
            Title = item.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            MediaType = item.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "movies" : "movies",
            FilePath = item.TryGetProperty("file_path", out var fp) && fp.GetString() != null ? fp.GetString()! : "",
            Overview = item.TryGetProperty("overview", out var o) ? o.GetString() : null,
            PosterUrl = item.TryGetProperty("poster_url", out var p) ? p.GetString() : null,
            BackdropUrl = item.TryGetProperty("backdrop_url", out var b) ? b.GetString() : null,
            TmdbId = item.TryGetProperty("tmdb_id", out var tid) && tid.ValueKind == System.Text.Json.JsonValueKind.Number ? tid.GetInt32() : null,
            Year = item.TryGetProperty("year", out var y) && y.ValueKind == System.Text.Json.JsonValueKind.Number ? y.GetInt32() : null,
        };
        _db.MediaItems.Add(mediaItem);
        await _db.SaveChangesAsync();
        return Ok(new
        {
            mediaItem.Id, mediaItem.Title, media_type = mediaItem.MediaType,
            poster_url = mediaItem.PosterUrl, backdrop_url = mediaItem.BackdropUrl,
            status = "added"
        });
    }
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

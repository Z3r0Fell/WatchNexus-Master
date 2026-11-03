using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
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

    private string UserId => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "";

    /// <summary>Media items in the caller's libraries. Every item lookup goes through this
    /// so other users' item ids behave as if they don't exist (404).</summary>
    private IQueryable<MediaItem> UserMedia() => LibraryMedia.ForUser(_db, UserId);

    private Task<MediaItem?> FindUserMediaAsync(string id) => UserMedia().FirstOrDefaultAsync(m => m.Id == id);

    public MarmaladeBridgeController(AppDbContext db, IConfiguration config, IHttpClientFactory httpFactory, IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _config = config;
        _httpFactory = httpFactory;
        _scopeFactory = scopeFactory;
    }

    [HttpGet("libraries")]
    public async Task<IActionResult> GetLibraries() =>
        Ok((await _db.Libraries.Where(l => l.UserId == UserId).OrderByDescending(l => l.CreatedAt).ToListAsync())
            .Select(l => new {
                l.Id, l.Name, l.Path, media_type = l.MediaType,
                item_count = l.ItemCount, total_size = l.TotalSize,
                scan_status = l.ScanStatus, last_scanned_at = l.LastScannedAt,
                created_at = l.CreatedAt
            }));

    public record AddLibraryRequest(
        [property: System.Text.Json.Serialization.JsonPropertyName("name")] string? Name,
        [property: System.Text.Json.Serialization.JsonPropertyName("path")] string? Path,
        [property: System.Text.Json.Serialization.JsonPropertyName("media_type")] string? MediaType);

    // The frontend (marmaladeApi.addLibrary) posts a JSON body; older callers
    // passed name/path/media_type on the query string, so both are accepted.
    [HttpPost("libraries")]
    public async Task<IActionResult> AddLibrary(
        [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] AddLibraryRequest? body,
        [FromQuery(Name = "name")] string? queryName,
        [FromQuery(Name = "path")] string? queryPath,
        [FromQuery(Name = "media_type")] string? queryMediaType)
    {
        var name = !string.IsNullOrWhiteSpace(body?.Name) ? body!.Name : queryName;
        var path = !string.IsNullOrWhiteSpace(body?.Path) ? body!.Path : queryPath;
        var media_type = !string.IsNullOrWhiteSpace(body?.MediaType) ? body!.MediaType!
            : !string.IsNullOrWhiteSpace(queryMediaType) ? queryMediaType! : "movies";
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(path))
            return BadRequest(new { detail = "Name and path are required" });

        var trimmedPath = path.Trim();
        // Library roots must live under a configured media root so scanned items
        // can actually be streamed. Prevents registration of arbitrary folders.
        if (!MediaPaths.IsAllowedPath(trimmedPath))
            return BadRequest(new
            {
                detail = $"Path is outside the configured media roots. Add the parent directory to MEDIA_ROOT / MEDIA_ROOTS, or place media under /data/media (in Docker).",
                path = trimmedPath
            });
        if (!Directory.Exists(trimmedPath))
            return BadRequest(new
            {
                detail = $"Path not found on this server: {trimmedPath}. If you're running WatchNexus in Docker, use the in-container path (e.g. /data/media/Movies) or pick a folder below — the container can't see host paths.",
                path = trimmedPath
            });

        var typeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Movie"] = "movies", ["Movies"] = "movies", ["movies"] = "movies",
            ["TvShow"] = "tv", ["TV Shows"] = "tv", ["tv"] = "tv",
            ["Music"] = "music", ["Anime"] = "anime",
        };

        var lib = new Library
        {
            UserId = UserId,
            Name = name.Trim(),
            Path = trimmedPath,
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
        var lib = await _db.Libraries.FirstOrDefaultAsync(l => l.Id == id && l.UserId == UserId);
        if (lib == null) return NotFound();
        _db.MediaItems.RemoveRange(_db.MediaItems.Where(m => m.LibraryId == id));
        _db.Libraries.Remove(lib);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("libraries/{id}/scan")]
    public async Task<IActionResult> ScanLibrary(string id)
    {
        var lib = await _db.Libraries.FirstOrDefaultAsync(l => l.Id == id && l.UserId == UserId);
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
                        // Anime searches TMDB TV first, then movies; TmdbKind records which.
                        var hit = await LibraryMedia.SearchTmdbAsync(http, tmdbKey, cleanName, null, lib.MediaType);
                        if (hit is (var first, var searchType))
                        {
                            item.TmdbId = first.GetProperty("id").GetInt32();
                            item.TmdbKind = searchType;
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
        // Libraries are per-user: only return items from the caller's libraries.
        var q = UserMedia();
        if (!string.IsNullOrEmpty(library_id)) q = q.Where(m => m.LibraryId == library_id);
        if (!string.IsNullOrEmpty(media_type))
        {
            // Scanned items carry their library's media_type ("movies", "tv"),
            // while pages historically asked for "movie" / "episode".
            var types = MediaTypeAliases(media_type);
            q = q.Where(m => types.Contains(m.MediaType));
        }
        var items = await q.OrderBy(m => m.Title).Skip(offset).Take(limit).ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, file_path = (string?)null, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, tmdb_kind = m.TmdbKind, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime, library_id = m.LibraryId
        }));
    }

    internal static string[] MediaTypeAliases(string mediaType) => mediaType.Trim().ToLowerInvariant() switch
    {
        "movie" or "movies" => new[] { "movie", "movies" },
        "tv" or "episode" or "tv_shows" => new[] { "tv", "episode", "tv_shows" },
        var other => new[] { other },
    };

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        return Ok(new
        {
            total_libraries = await _db.Libraries.CountAsync(l => l.UserId == UserId),
            total_media = await UserMedia().CountAsync(),
            total_size = await UserMedia().SumAsync(m => m.FileSize),
        });
    }

    [HttpGet("media/recent")]
    public async Task<IActionResult> RecentMedia(int limit = 20)
    {
        var items = await UserMedia().OrderByDescending(m => m.CreatedAt).Take(limit * 3)
            .Select(m => new { m.Id, m.Title, m.Year, m.Rating, poster_url = m.PosterUrl,
                backdrop_url = m.BackdropUrl, media_type = m.MediaType, m.Overview, tmdb_id = m.TmdbId, tmdb_kind = m.TmdbKind })
            .ToListAsync();

        // Deduplicate TV shows by TMDB ID — show series once, not each episode
        var seen = new HashSet<string>();
        var result = new List<object>();
        foreach (var item in items)
        {
            if (result.Count >= limit) break;
            var isEpisodic = item.media_type == "tv" || item.media_type == "episode" || item.media_type == "anime";
            var key = (item.tmdb_id.HasValue && isEpisodic)
                ? $"tv:{item.tmdb_id}" : $"item:{item.Id}";
            if (seen.Contains(key)) continue;
            seen.Add(key);

            // For TV shows, relabel media_type
            var mediaType = (item.media_type == "episode") ? "tv" : item.media_type;
            // `id` is the library item id (what /watch/:id plays); tmdb_id is
            // included so clients can also link to the TMDB details page.
            result.Add(new { item.Id, item.Title, item.Year, item.Rating, item.poster_url, item.backdrop_url, media_type = mediaType, item.Overview, item.tmdb_id, item.tmdb_kind });
        }
        return Ok(result);
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        return Ok(new
        {
            status = "running",
            version = "1.0.1",
            total_libraries = await _db.Libraries.CountAsync(l => l.UserId == UserId),
            total_media = await UserMedia().CountAsync(),
            total_size = await UserMedia().SumAsync(m => m.FileSize),
        });
    }

    [HttpGet("media/{id}")]
    public async Task<IActionResult> GetMediaItem(string id)
    {
        var m = await FindUserMediaAsync(id);
        if (m == null) return NotFound(new { detail = "Media item not found" });
        return Ok(new
        {
            m.Id, m.Title, m.Overview, file_path = (string?)null, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, tmdb_kind = m.TmdbKind, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime, library_id = m.LibraryId,
            created_at = m.CreatedAt
        });
    }

    // Local library items matching a TMDB id — lets the TMDB details page offer
    // "Play" for titles (and individual episodes) that exist on disk.
    [HttpGet("media/by-tmdb/{tmdbId:int}")]
    public async Task<IActionResult> GetMediaByTmdb(int tmdbId)
    {
        var items = await UserMedia().Where(m => m.TmdbId == tmdbId)
            .OrderBy(m => m.FilePath).Take(2000).ToListAsync();
        return Ok(items.Select(m =>
        {
            var ep = LibraryMedia.ParseEpisode(string.IsNullOrEmpty(m.FilePath) ? m.Title : m.FilePath);
            return new
            {
                m.Id, m.Title, media_type = m.MediaType, tmdb_id = m.TmdbId, tmdb_kind = m.TmdbKind,
                season_number = ep?.season,
                episode_number = ep?.episode,
            };
        }));
    }

    [HttpGet("media/search")]
    public async Task<IActionResult> SearchMedia(string? query = null, int limit = 50)
    {
        var q = UserMedia();
        if (!string.IsNullOrWhiteSpace(query))
            q = q.Where(m => m.Title != null && m.Title.ToLower().Contains(query.ToLower()));
        var items = await q.OrderBy(m => m.Title).Take(limit).ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, file_path = (string?)null, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, tmdb_kind = m.TmdbKind, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime, library_id = m.LibraryId
        }));
    }

    // No intro/credits detection service exists yet; return the shape the
    // VideoPlayer reads ({ segments: [{ type, start, end }] }) with no segments.
    [HttpGet("media/{id}/skip-segments")]
    public async Task<IActionResult> GetSkipSegments(string id)
    {
        if (await FindUserMediaAsync(id) == null) return NotFound(new { detail = "Media item not found" });
        return Ok(new { segments = Array.Empty<object>() });
    }

    // Next SxxEyy episode of the same series (same TMDB id, or same series
    // folder when unmatched) in the same library. 404 when there is none.
    [HttpGet("media/{id}/next-episode")]
    public async Task<IActionResult> GetNextEpisode(string id)
    {
        var current = await FindUserMediaAsync(id);
        if (current == null) return NotFound(new { detail = "Media item not found" });
        var currentEp = LibraryMedia.ParseEpisode(current.FilePath);
        if (currentEp == null) return NotFound(new { detail = "Not an episode" });

        var q = UserMedia().Where(m => m.LibraryId == current.LibraryId && m.Id != current.Id);
        if (current.TmdbId.HasValue) q = q.Where(m => m.TmdbId == current.TmdbId);
        var currentFolder = LibraryMedia.SeriesFolder(current.FilePath);
        var candidates = (await q.ToListAsync())
            .Where(m => current.TmdbId.HasValue || LibraryMedia.SeriesFolder(m.FilePath) == currentFolder)
            .Select(m => (item: m, ep: LibraryMedia.ParseEpisode(m.FilePath)))
            .Where(x => x.ep != null && x.ep.Value.CompareTo(currentEp.Value) > 0)
            .OrderBy(x => x.ep!.Value.season).ThenBy(x => x.ep!.Value.episode)
            .ToList();
        if (candidates.Count == 0) return NotFound(new { detail = "No next episode" });

        var (next, nextEp) = candidates[0];
        return Ok(new
        {
            id = next.Id,
            title = next.Title,
            series_name = current.Title,
            season_number = nextEp!.Value.season,
            episode_number = nextEp.Value.episode,
            thumbnail = next.BackdropUrl ?? next.PosterUrl,
            media_type = next.MediaType,
            tmdb_id = next.TmdbId,
        });
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
        var q = UserMedia().Where(m => m.MediaType == "tv" || m.MediaType == "episode");
        if (!string.IsNullOrEmpty(library_id)) q = q.Where(m => m.LibraryId == library_id);
        var items = await q.OrderBy(m => m.Title).ToListAsync();

        // Parse season/episode from file names and titles
        var episodeRegex = new System.Text.RegularExpressions.Regex(
            @"[Ss](\d{1,2})[Ee](\d{1,2})", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Group by TMDB ID first, then by series name for items without TMDB ID
        var grouped = new Dictionary<string, List<(MediaItem item, int season, int episode)>>();

        foreach (var item in items)
        {
            // Extract season/episode
            int seasonNum = 1, episodeNum = 0;
            var match = episodeRegex.Match(item.FilePath ?? item.Title ?? "");
            if (match.Success)
            {
                seasonNum = int.Parse(match.Groups[1].Value);
                episodeNum = int.Parse(match.Groups[2].Value);
            }

            // Extract series name (title before S01E01, or TMDB title, or cleaned filename)
            var seriesName = item.Title ?? "Unknown";
            var nameMatch = System.Text.RegularExpressions.Regex.Match(
                item.FilePath ?? "", @"[/\\]?([^/\\]+?)\s*[Ss]\d{1,2}[Ee]\d{1,2}",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (nameMatch.Success)
                seriesName = nameMatch.Groups[1].Value.Replace('.', ' ').Replace('_', ' ').Trim();
            else if (item.TmdbId.HasValue)
                seriesName = item.Title ?? seriesName;

            // Group key: prefer TMDB ID, fall back to series name
            var key = item.TmdbId.HasValue ? $"tmdb:{item.TmdbId}" : $"name:{seriesName.ToLower()}";
            if (!grouped.ContainsKey(key))
                grouped[key] = new List<(MediaItem, int, int)>();
            grouped[key].Add((item, seasonNum, episodeNum));
        }

        // Build series response
        var series = grouped.Select(kvp =>
        {
            var firstItem = kvp.Value.First().item;
            var seriesName = firstItem.Title ?? "Unknown";

            // Group by season
            var seasons = kvp.Value
                .GroupBy(e => e.season)
                .OrderBy(g => g.Key)
                .Select(seasonGroup => new
                {
                    season_number = seasonGroup.Key,
                    episode_count = seasonGroup.Count(),
                    episodes = seasonGroup.OrderBy(e => e.episode).Select(e => new
                    {
                        e.item.Id,
                        title = e.item.Title ?? $"Episode {e.episode}",
                        episode_number = e.episode > 0 ? e.episode : (int?)null,
                        size = e.item.FileSize,
                        watched = false,
                        file_path = (string?)null,
                    }).ToList()
                }).ToList();

            return new
            {
                series_name = seriesName,
                tmdb_id = firstItem.TmdbId,
                poster_url = firstItem.PosterUrl,
                backdrop_url = firstItem.BackdropUrl,
                overview = firstItem.Overview,
                rating = firstItem.Rating,
                total_episodes = kvp.Value.Count,
                seasons
            };
        }).OrderBy(s => s.series_name).ToList();

        return Ok(series);
    }

    [HttpPost("libraries/{id}/refresh-metadata")]
    public async Task<IActionResult> RefreshMetadata(string id)
    {
        var lib = await _db.Libraries.FirstOrDefaultAsync(l => l.Id == id && l.UserId == UserId);
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
                var hit = await LibraryMedia.SearchTmdbAsync(http, tmdbApiKey, item.Title ?? "", null, lib.MediaType);
                if (hit is (var first, var kind))
                {
                    item.TmdbId = first.GetProperty("id").GetInt32();
                    item.TmdbKind = kind;
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
        var media = await FindUserMediaAsync(id);
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
        var media = await FindUserMediaAsync(id);
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
        var media = await FindUserMediaAsync(id);
        if (media == null) return NotFound(new { detail = "Media not found" });
        if (string.IsNullOrEmpty(media.FilePath) || !System.IO.File.Exists(media.FilePath))
            return NotFound(new { detail = "Media file not found on disk" });
        var fi = new FileInfo(media.FilePath);
        var streamToken = StreamToken.Issue(id, _config["Jwt:Secret"] ?? "", TimeSpan.FromHours(6));
        return Ok(new
        {
            media.Id, media.Title, file_path = media.FilePath,
            file_size = fi.Length, media_type = media.MediaType,
            stream_url = $"/api/marmalade/stream/{id}/file?token={streamToken}",
            quality, format = System.IO.Path.GetExtension(media.FilePath).TrimStart('.')
        });
    }

    // Mints a short-lived signed URL the HTML5 player can use directly. The
    // browser's <video> element can't attach our bearer token, so playback is
    // authorised here (requires a valid session) and the resulting token is
    // validated by StreamFile below.
    [HttpGet("stream/{id}/authorize")]
    public async Task<IActionResult> AuthorizeStream(string id)
    {
        var media = await FindUserMediaAsync(id);
        if (media == null) return NotFound(new { detail = "Media not found" });
        // Fail fast with a clear message instead of handing the player a URL
        // that will 404 (the <video> element can't surface the reason).
        if (string.IsNullOrEmpty(media.FilePath) || !MediaPaths.IsAllowedPath(media.FilePath) || !System.IO.File.Exists(media.FilePath))
            return NotFound(new { detail = "Media file not found on disk" });
        var token = StreamToken.Issue(id, _config["Jwt:Secret"] ?? "", TimeSpan.FromHours(6));
        return Ok(new { stream_url = $"/api/marmalade/stream/{id}/file?token={token}" });
    }

    // AllowAnonymous because a <video src> request can't carry a bearer token —
    // access is instead gated by a short-lived HMAC stream token issued by
    // AuthorizeStream / GetStreamInfo.
    [HttpGet("stream/{id}/file")]
    [AllowAnonymous]
    public async Task<IActionResult> StreamFile(string id, [FromQuery] string? token)
    {
        if (!StreamToken.Validate(id, token, _config["Jwt:Secret"] ?? ""))
            return Unauthorized(new { detail = "Invalid or expired stream token." });
        var media = await _db.MediaItems.FindAsync(id);
        if (media == null) return NotFound();
        // Defense in depth: never stream a path outside the media roots, even for
        // rows added before path validation existed.
        if (string.IsNullOrEmpty(media.FilePath) || !MediaPaths.IsAllowedPath(media.FilePath) || !System.IO.File.Exists(media.FilePath))
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

    private string UserId => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "";

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? media_type = null)
    {
        // Libraries are per-user: only the caller's items.
        var q = LibraryMedia.ForUser(_db, UserId);
        if (!string.IsNullOrEmpty(media_type)) q = q.Where(m => m.MediaType == media_type);
        var items = await q.OrderBy(m => m.Title).ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, file_path = (string?)null, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] System.Text.Json.JsonElement item)
    {
        if (item.ValueKind != System.Text.Json.JsonValueKind.Object)
            return BadRequest(new { detail = "JSON object body required" });
        // Every item must belong to one of the caller's libraries: an item with no
        // library violates the Library FK and is invisible to every user anyway.
        var libraryId = item.TryGetProperty("library_id", out var lid) && lid.ValueKind == System.Text.Json.JsonValueKind.String
            ? lid.GetString() : null;
        if (string.IsNullOrEmpty(libraryId) || !await _db.Libraries.AnyAsync(l => l.Id == libraryId && l.UserId == UserId))
            return BadRequest(new { detail = "library_id must reference one of your libraries" });
        var mediaItem = new MediaItem
        {
            LibraryId = libraryId,
            Title = item.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            MediaType = item.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "movies" : "movies",
            FilePath = item.TryGetProperty("file_path", out var fp) && fp.GetString() != null ? fp.GetString()! : "",
            Overview = item.TryGetProperty("overview", out var o) ? o.GetString() : null,
            PosterUrl = item.TryGetProperty("poster_url", out var p) ? p.GetString() : null,
            BackdropUrl = item.TryGetProperty("backdrop_url", out var b) ? b.GetString() : null,
            TmdbId = item.TryGetProperty("tmdb_id", out var tid) && tid.ValueKind == System.Text.Json.JsonValueKind.Number ? tid.GetInt32() : null,
            Year = item.TryGetProperty("year", out var y) && y.ValueKind == System.Text.Json.JsonValueKind.Number ? y.GetInt32() : null,
        };
        // Only paths under the configured media roots may be added — prevents
        // arbitrary server files from becoming streamable via /api/marmalade/stream.
        if (string.IsNullOrEmpty(mediaItem.FilePath) || !MediaPaths.IsAllowedPath(mediaItem.FilePath))
            return BadRequest(new { detail = "file_path must be inside a configured media root (MEDIA_ROOT / MEDIA_ROOTS, or the standard /data/media, /data/rips, /data/transcoded, /data/offline directories)" });
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
        // Scoped to the caller's libraries (see LibraryMedia.ForUser).
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "";
        var media = LibraryMedia.ForUser(_db, userId);
        return Ok(new
        {
            total_libraries = await _db.Libraries.CountAsync(l => l.UserId == userId),
            total_media = await media.CountAsync(),
            total_movies = await media.CountAsync(m => m.MediaType == "movies"),
            total_tv = await media.CountAsync(m => m.MediaType == "tv"),
            total_size = await media.SumAsync(m => m.FileSize),
            recent_media = await media.OrderByDescending(m => m.CreatedAt).Take(10).Select(m => new
            {
                m.Id, m.Title, m.Year, m.Rating, poster_url = m.PosterUrl, media_type = m.MediaType
            }).ToListAsync(),
        });
    }
}

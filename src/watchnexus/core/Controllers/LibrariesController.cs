using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

[ApiController]
[Route("api/libraries")]
[Authorize]
public class LibrariesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IServiceScopeFactory _scopeFactory;
    private static readonly Dictionary<string, object> _scanJobs = new();

    public LibrariesController(AppDbContext db, IConfiguration config, IHttpClientFactory httpFactory, IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _config = config;
        _httpFactory = httpFactory;
        _scopeFactory = scopeFactory;
    }

    public record LibraryRequest(string Name, string Path, string MediaType);

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var libs = await _db.Libraries.OrderByDescending(l => l.CreatedAt).ToListAsync();
        return Ok(libs.Select(l => new
        {
            l.Id, l.Name, l.Path, media_type = l.MediaType,
            item_count = l.ItemCount, total_size = l.TotalSize,
            scan_status = l.ScanStatus, last_scanned_at = l.LastScannedAt,
            created_at = l.CreatedAt
        }));
    }

    [HttpGet("recent")]
    public async Task<IActionResult> Recent(int limit = 20)
    {
        var items = await _db.MediaItems
            .OrderByDescending(m => m.Id)
            .Take(limit)
            .ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, m.FilePath, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound(new { detail = "Library not found" });
        return Ok(new
        {
            lib.Id, lib.Name, lib.Path, media_type = lib.MediaType,
            item_count = lib.ItemCount, total_size = lib.TotalSize,
            scan_status = lib.ScanStatus, last_scanned_at = lib.LastScannedAt,
            created_at = lib.CreatedAt
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] LibraryRequest req)
    {
        var typeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Movie"] = "movies", ["Movies"] = "movies", ["movies"] = "movies",
            ["TvShow"] = "tv", ["TV Shows"] = "tv", ["tv"] = "tv",
            ["Music"] = "music", ["Anime"] = "anime", ["Podcast"] = "music",
        };
        var lib = new Library
        {
            Name = req.Name,
            Path = req.Path,
            MediaType = typeMap.GetValueOrDefault(req.MediaType, req.MediaType.ToLower()),
        };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();
        return Ok(new
        {
            lib.Id, lib.Name, lib.Path, media_type = lib.MediaType,
            item_count = 0, total_size = 0L,
            scan_status = "idle", last_scanned_at = (DateTime?)null,
            created_at = lib.CreatedAt
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] LibraryRequest req)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound();
        lib.Name = req.Name;
        lib.Path = req.Path;
        await _db.SaveChangesAsync();
        return Ok(new
        {
            lib.Id, lib.Name, lib.Path, media_type = lib.MediaType,
            item_count = lib.ItemCount, total_size = lib.TotalSize,
            scan_status = lib.ScanStatus, last_scanned_at = lib.LastScannedAt,
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound();
        _db.MediaItems.RemoveRange(_db.MediaItems.Where(m => m.LibraryId == id));
        _db.Libraries.Remove(lib);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("{id}/scan")]
    public async Task<IActionResult> Scan(string id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound(new { detail = "Library not found" });

        if (_scanJobs.ContainsKey(id))
            return Ok(_scanJobs[id]);

        var job = new Dictionary<string, object>
        {
            ["job_id"] = Guid.NewGuid().ToString()[..8],
            ["library_id"] = id,
            ["library_name"] = lib.Name,
            ["status"] = "scanning",
            ["started_at"] = DateTime.UtcNow,
            ["progress"] = 0,
        };
        _scanJobs[id] = job;

        // Run scan in background
        _ = Task.Run(async () => await RunScanBackground(id, lib.Path, lib.Name, lib.MediaType));

        return Ok(job);
    }

    [HttpGet("{id}/scan/status")]
    public IActionResult ScanStatus(string id)
    {
        if (_scanJobs.TryGetValue(id, out var job))
            return Ok(job);
        return Ok(new { library_id = id, status = "idle", progress = 0 });
    }

    [HttpGet("{id}/media")]
    public async Task<IActionResult> GetMedia(string id, int limit = 50, int offset = 0)
    {
        var items = await _db.MediaItems
            .Where(m => m.LibraryId == id)
            .OrderBy(m => m.Title)
            .Skip(offset).Take(limit)
            .ToListAsync();
        return Ok(items.Select(m => new
        {
            m.Id, m.Title, m.Overview, m.FilePath, file_size = m.FileSize,
            media_type = m.MediaType, tmdb_id = m.TmdbId, imdb_id = m.ImdbId,
            m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl,
            m.Genres, m.Year, m.Runtime
        }));
    }

    private async Task RunScanBackground(string libraryId, string libPath, string libName, string mediaType)
    {
        var newCount = 0; var updated = 0; var errors = new List<string>();
        var extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { ".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".webm",
          ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma" };

        try
        {
            if (!Directory.Exists(libPath))
            {
                UpdateJob(libraryId, "failed", errors: new[] { $"Path not found: {libPath}" });
                return;
            }

            var files = Directory.EnumerateFiles(libPath, "*.*", SearchOption.AllDirectories)
                .Where(f => extensions.Contains(System.IO.Path.GetExtension(f)))
                .ToList();

            var tmdbKey = _config["TMDB_API_KEY"] ?? "";
            long totalSize = 0;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

            foreach (var file in files)
            {
                try
                {
                    var fi = new FileInfo(file);
                    totalSize += fi.Length;
                    var title = ParseTitle(System.IO.Path.GetFileNameWithoutExtension(file));

                    var existing = await db.MediaItems.FirstOrDefaultAsync(m => m.FilePath == file && m.LibraryId == libraryId);
                    if (existing != null) { updated++; continue; }

                    var item = new MediaItem
                    {
                        LibraryId = libraryId,
                        Title = title.name,
                        Year = title.year,
                        FilePath = file,
                        FileSize = fi.Length,
                        MediaType = mediaType,
                    };

                    // Fetch TMDB metadata
                    if (!string.IsNullOrEmpty(tmdbKey))
                    {
                        var meta = await FetchTmdbMetadataStatic(httpFactory, tmdbKey, title.name, title.year, mediaType);
                        if (meta != null)
                        {
                            item.TmdbId = meta.TmdbId;
                            item.Title = meta.Title ?? item.Title;
                            item.Overview = meta.Overview;
                            item.Rating = meta.Rating;
                            item.PosterUrl = meta.PosterUrl;
                            item.BackdropUrl = meta.BackdropUrl;
                            item.Genres = meta.Genres;
                            item.Runtime = meta.Runtime;
                        }
                    }

                    db.MediaItems.Add(item);
                    newCount++;
                }
                catch (Exception ex) { errors.Add($"{file}: {ex.Message}"); }
            }

            await db.SaveChangesAsync();

            // Update library stats
            var dbLib = await db.Libraries.FindAsync(libraryId);
            if (dbLib != null)
            {
                dbLib.ItemCount = await db.MediaItems.CountAsync(m => m.LibraryId == libraryId);
                dbLib.TotalSize = totalSize;
                dbLib.ScanStatus = "completed";
                dbLib.LastScannedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }

            UpdateJob(libraryId, "completed", newCount, updated, newCount + updated, errors.ToArray());
        }
        catch (Exception ex)
        {
            errors.Add(ex.Message);
            UpdateJob(libraryId, "failed", errors: errors.ToArray());
        }
    }

    private void UpdateJob(string id, string status, int newItems = 0, int updatedItems = 0, int total = 0, string[]? errors = null)
    {
        if (_scanJobs.TryGetValue(id, out var jobObj) && jobObj is Dictionary<string, object> job)
        {
            job["status"] = status;
            job["completed_at"] = DateTime.UtcNow;
            job["progress"] = 100;
            job["new"] = newItems;
            job["updated"] = updatedItems;
            job["total"] = total;
            job["errors"] = errors ?? Array.Empty<string>();
            job["error_count"] = errors?.Length ?? 0;
        }
    }

    private static (string name, int? year) ParseTitle(string filename)
    {
        var cleaned = Regex.Replace(filename, @"[\._]", " ");
        var yearMatch = Regex.Match(cleaned, @"(.*?)\s*[\(\[]?(\d{4})[\)\]]?");
        if (yearMatch.Success)
            return (yearMatch.Groups[1].Value.Trim(), int.Parse(yearMatch.Groups[2].Value));
        // Remove quality tags
        cleaned = Regex.Replace(cleaned, @"\b(1080p|720p|480p|2160p|4K|BluRay|WEB|HDRip|BRRip|HDTV)\b.*", "", RegexOptions.IgnoreCase).Trim();
        return (cleaned, null);
    }

    private static async Task<TmdbResult?> FetchTmdbMetadataStatic(IHttpClientFactory httpFactory, string apiKey, string title, int? year, string mediaType)
    {
        try
        {
            var client = httpFactory.CreateClient();
            var searchType = mediaType == "tv" ? "tv" : "movie";
            var url = $"https://api.themoviedb.org/3/search/{searchType}?api_key={apiKey}&query={Uri.EscapeDataString(title)}";
            if (year.HasValue) url += $"&year={year}";

            var resp = await client.GetAsync(url);
            if (!resp.IsSuccessStatusCode) return null;

            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var results = json.GetProperty("results");
            if (results.GetArrayLength() == 0) return null;

            var first = results[0];
            var tmdbId = first.GetProperty("id").GetInt32();

            // Fetch detailed info
            var detailResp = await client.GetAsync($"https://api.themoviedb.org/3/{searchType}/{tmdbId}?api_key={apiKey}");
            if (!detailResp.IsSuccessStatusCode) return null;

            var detail = await detailResp.Content.ReadFromJsonAsync<JsonElement>();
            var poster = detail.TryGetProperty("poster_path", out var pp) && pp.ValueKind != JsonValueKind.Null
                ? $"https://image.tmdb.org/t/p/w500{pp.GetString()}" : null;
            var backdrop = detail.TryGetProperty("backdrop_path", out var bp) && bp.ValueKind != JsonValueKind.Null
                ? $"https://image.tmdb.org/t/p/original{bp.GetString()}" : null;

            var titleProp = searchType == "tv" ? "name" : "title";
            var genres = detail.TryGetProperty("genres", out var g)
                ? string.Join(", ", g.EnumerateArray().Select(x => x.GetProperty("name").GetString()))
                : null;
            var runtime = detail.TryGetProperty("runtime", out var rt) && rt.ValueKind == JsonValueKind.Number
                ? rt.GetInt32() : (int?)null;

            return new TmdbResult
            {
                TmdbId = tmdbId,
                Title = detail.TryGetProperty(titleProp, out var t) ? t.GetString() : title,
                Overview = detail.TryGetProperty("overview", out var o) ? o.GetString() : null,
                Rating = detail.TryGetProperty("vote_average", out var v) ? v.GetDouble() : null,
                PosterUrl = poster,
                BackdropUrl = backdrop,
                Genres = genres,
                Runtime = runtime,
            };
        }
        catch { return null; }
    }

    private class TmdbResult
    {
        public int TmdbId { get; set; }
        public string? Title { get; set; }
        public string? Overview { get; set; }
        public double? Rating { get; set; }
        public string? PosterUrl { get; set; }
        public string? BackdropUrl { get; set; }
        public string? Genres { get; set; }
        public int? Runtime { get; set; }
    }
}

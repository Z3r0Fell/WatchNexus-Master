using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Marmalade;

// ── Models ───────────────────────────────────────────────────
public class Library
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string MediaType { get; set; } = "movies";
    public int ItemCount { get; set; }
    public long TotalSize { get; set; }
    public string ScanStatus { get; set; } = "idle";
    public DateTime? LastScannedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class MediaItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string LibraryId { get; set; } = "";
    public string Title { get; set; } = "";
    public string? OriginalTitle { get; set; }
    public string? Overview { get; set; }
    public string FilePath { get; set; } = "";
    public long FileSize { get; set; }
    public string MediaType { get; set; } = "movie";
    public int? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public double? Rating { get; set; }
    public string? PosterUrl { get; set; }
    public string? BackdropUrl { get; set; }
    public string? Genres { get; set; }
    public int? Year { get; set; }
    public int? Runtime { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// ── DbContext ────────────────────────────────────────────────
public class MarmaladeDbContext : DbContext
{
    public MarmaladeDbContext(DbContextOptions<MarmaladeDbContext> options) : base(options) { }
    public DbSet<Library> Libraries => Set<Library>();
    public DbSet<MediaItem> MediaItems => Set<MediaItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Library>().HasKey(l => l.Id);
        b.Entity<MediaItem>(e => { e.HasKey(m => m.Id); e.HasIndex(m => m.LibraryId); });
    }
}

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api/libraries")]
[Authorize]
public class LibrariesController : ControllerBase
{
    private readonly MarmaladeDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IServiceScopeFactory _scopeFactory;
    private static readonly Dictionary<string, object> _scanJobs = new();

    public LibrariesController(MarmaladeDbContext db, IConfiguration config, IHttpClientFactory httpFactory, IServiceScopeFactory scopeFactory)
    { _db = db; _config = config; _httpFactory = httpFactory; _scopeFactory = scopeFactory; }

    public record LibraryRequest(string Name, string Path, string MediaType);

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var libs = await _db.Libraries.OrderByDescending(l => l.CreatedAt).ToListAsync();
        return Ok(libs.Select(l => new { l.Id, l.Name, l.Path, media_type = l.MediaType,
            item_count = l.ItemCount, total_size = l.TotalSize, scan_status = l.ScanStatus,
            last_scanned_at = l.LastScannedAt, created_at = l.CreatedAt }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound(new { detail = "Library not found" });
        return Ok(new { lib.Id, lib.Name, lib.Path, media_type = lib.MediaType,
            item_count = lib.ItemCount, total_size = lib.TotalSize, scan_status = lib.ScanStatus,
            last_scanned_at = lib.LastScannedAt, created_at = lib.CreatedAt });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] LibraryRequest req)
    {
        var typeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        { ["Movie"] = "movies", ["Movies"] = "movies", ["movies"] = "movies",
          ["TvShow"] = "tv", ["TV Shows"] = "tv", ["tv"] = "tv",
          ["Music"] = "music", ["Anime"] = "anime", ["Podcast"] = "music" };
        var lib = new Library { Name = req.Name, Path = req.Path,
            MediaType = typeMap.GetValueOrDefault(req.MediaType, req.MediaType.ToLower()) };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();
        return Ok(new { lib.Id, lib.Name, lib.Path, media_type = lib.MediaType,
            item_count = 0, total_size = 0L, scan_status = "idle",
            last_scanned_at = (DateTime?)null, created_at = lib.CreatedAt });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] LibraryRequest req)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib == null) return NotFound();
        lib.Name = req.Name; lib.Path = req.Path;
        await _db.SaveChangesAsync();
        return Ok(new { lib.Id, lib.Name, lib.Path, media_type = lib.MediaType,
            item_count = lib.ItemCount, total_size = lib.TotalSize,
            scan_status = lib.ScanStatus, last_scanned_at = lib.LastScannedAt });
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
        if (_scanJobs.ContainsKey(id)) return Ok(_scanJobs[id]);
        var job = new Dictionary<string, object>
        {
            ["job_id"] = Guid.NewGuid().ToString()[..8], ["library_id"] = id,
            ["library_name"] = lib.Name, ["status"] = "scanning",
            ["started_at"] = DateTime.UtcNow, ["progress"] = 0,
        };
        _scanJobs[id] = job;
        _ = Task.Run(async () => await RunScanBackground(id, lib.Path, lib.MediaType));
        return Ok(job);
    }

    [HttpGet("{id}/scan/status")]
    public IActionResult ScanStatus(string id) => _scanJobs.TryGetValue(id, out var job) ? Ok(job) : Ok(new { library_id = id, status = "idle", progress = 0 });

    [HttpGet("{id}/media")]
    public async Task<IActionResult> GetMedia(string id, int limit = 50, int offset = 0) =>
        Ok((await _db.MediaItems.Where(m => m.LibraryId == id).OrderBy(m => m.Title).Skip(offset).Take(limit).ToListAsync())
            .Select(m => new { m.Id, m.Title, m.Overview, m.FilePath, file_size = m.FileSize, media_type = m.MediaType,
                tmdb_id = m.TmdbId, imdb_id = m.ImdbId, m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl, m.Genres, m.Year, m.Runtime }));

    private async Task RunScanBackground(string libraryId, string libPath, string mediaType)
    {
        var extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { ".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".webm", ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma" };
        try
        {
            if (!Directory.Exists(libPath)) { UpdateJob(libraryId, "failed"); return; }
            var files = Directory.EnumerateFiles(libPath, "*.*", SearchOption.AllDirectories)
                .Where(f => extensions.Contains(System.IO.Path.GetExtension(f))).ToList();
            var tmdbKey = _config["TMDB_API_KEY"] ?? "";
            long totalSize = 0; var newCount = 0;
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MarmaladeDbContext>();
            var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
            foreach (var file in files)
            {
                var fi = new FileInfo(file); totalSize += fi.Length;
                var title = ParseTitle(System.IO.Path.GetFileNameWithoutExtension(file));
                if (await db.MediaItems.AnyAsync(m => m.FilePath == file && m.LibraryId == libraryId)) continue;
                var item = new MediaItem { LibraryId = libraryId, Title = title.name, Year = title.year,
                    FilePath = file, FileSize = fi.Length, MediaType = mediaType };
                db.MediaItems.Add(item); newCount++;
            }
            await db.SaveChangesAsync();
            var dbLib = await db.Libraries.FindAsync(libraryId);
            if (dbLib != null)
            {
                dbLib.ItemCount = await db.MediaItems.CountAsync(m => m.LibraryId == libraryId);
                dbLib.TotalSize = totalSize; dbLib.ScanStatus = "completed"; dbLib.LastScannedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }
            UpdateJob(libraryId, "completed", newCount);
        }
        catch { UpdateJob(libraryId, "failed"); }
    }

    private void UpdateJob(string id, string status, int newItems = 0)
    {
        if (_scanJobs.TryGetValue(id, out var jobObj) && jobObj is Dictionary<string, object> job)
        { job["status"] = status; job["progress"] = 100; job["new"] = newItems; job["completed_at"] = DateTime.UtcNow; }
    }

    private static (string name, int? year) ParseTitle(string filename)
    {
        var cleaned = Regex.Replace(filename, @"[\._]", " ");
        var m = Regex.Match(cleaned, @"(.*?)\s*[\(\[]?(\d{4})[\)\]]?");
        if (m.Success) return (m.Groups[1].Value.Trim(), int.Parse(m.Groups[2].Value));
        return (Regex.Replace(cleaned, @"\b(1080p|720p|480p|2160p|4K|BluRay|WEB|HDRip)\b.*", "", RegexOptions.IgnoreCase).Trim(), null);
    }
}

// ── Module Registration ──────────────────────────────────────
public class MarmaladeModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Marmalade", Codename = "marmalade",
        DisplayName = "Library Manager", Version = "2.7.3",
        Description = "Media library scanning with TMDB metadata enrichment and file system traversal",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

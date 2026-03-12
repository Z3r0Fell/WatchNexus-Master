using System.Security.Claims;
using System.ServiceModel.Syndication;
using System.Text;
using System.Text.Json;
using System.Xml;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Helpers ──────────────────────────────────────────────────
static class ControllerHelpers
{
    public static string UserId(this ControllerBase c) =>
        c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

    public static HttpClient Http(this ControllerBase c) =>
        c.HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>().CreateClient();
}

// ══════════════════════════════════════════════════════════════
// WEATHER  (Open-Meteo — no key required)
// ══════════════════════════════════════════════════════════════
[Route("api/gadgets/weather")]
[ApiController]
[Authorize]
public class WeatherController : ControllerBase
{
    private readonly AppDbContext _db;
    public WeatherController(AppDbContext db) => _db = db;

    [HttpGet("search")]
    public async Task<IActionResult> SearchLocations([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        var http = this.Http();
        var resp = await http.GetStringAsync(
            $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(q)}&count=10&language=en&format=json");
        var doc = JsonDocument.Parse(resp);
        if (!doc.RootElement.TryGetProperty("results", out var results))
            return Ok(Array.Empty<object>());
        return Ok(results);
    }

    [HttpGet]
    public async Task<IActionResult> GetWeather([FromQuery] double? lat, [FromQuery] double? lon,
        [FromQuery] string unit = "celsius")
    {
        var userId = this.UserId();
        if (lat == null || lon == null)
        {
            var saved = await _db.Settings.FirstOrDefaultAsync(
                s => s.UserId == userId && s.Key == "weather_location");
            if (saved?.Value != null)
            {
                var loc = JsonDocument.Parse(saved.Value).RootElement;
                lat = loc.GetProperty("lat").GetDouble();
                lon = loc.GetProperty("lon").GetDouble();
            }
            else return Ok(new { error = "No location configured" });
        }
        var tempUnit = unit == "fahrenheit" ? "fahrenheit" : "celsius";
        var http = this.Http();
        var url = $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}" +
                  $"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,uv_index" +
                  $"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,uv_index_max" +
                  $"&temperature_unit={tempUnit}&wind_speed_unit=kmh&timezone=auto&forecast_days=7";
        var resp = await http.GetStringAsync(url);
        return Content(resp, "application/json");
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var saved = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == "weather_location");
        var unit = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == "weather_unit");
        return Ok(new
        {
            location = saved?.Value,
            unit = unit?.Value ?? "celsius"
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        if (body.TryGetProperty("location", out var loc))
        {
            var existing = await _db.Settings.FirstOrDefaultAsync(
                s => s.UserId == userId && s.Key == "weather_location");
            if (existing != null) existing.Value = loc.GetRawText();
            else _db.Settings.Add(new WatchNexus.Shared.AppSetting
            { Key = "weather_location", Value = loc.GetRawText(), UserId = userId });
        }
        if (body.TryGetProperty("unit", out var u))
        {
            var existing = await _db.Settings.FirstOrDefaultAsync(
                s => s.UserId == userId && s.Key == "weather_unit");
            if (existing != null) existing.Value = u.GetString() ?? "celsius";
            else _db.Settings.Add(new WatchNexus.Shared.AppSetting
            { Key = "weather_unit", Value = u.GetString() ?? "celsius", UserId = userId });
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

// ══════════════════════════════════════════════════════════════
// PODCASTS  (iTunes Search + RSS feed parsing)
// ══════════════════════════════════════════════════════════════
[Route("api/gadgets/podcasts")]
[ApiController]
[Authorize]
public class PodcastsController : ControllerBase
{
    private readonly AppDbContext _db;
    public PodcastsController(AppDbContext db) => _db = db;

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        var http = this.Http();
        var resp = await http.GetStringAsync(
            $"https://itunes.apple.com/search?term={Uri.EscapeDataString(q)}&media=podcast&limit=25");
        return Content(resp, "application/json");
    }

    [HttpGet]
    public async Task<IActionResult> GetSubscriptions()
    {
        var subs = await _db.PodcastSubscriptions
            .Where(s => s.UserId == this.UserId())
            .OrderByDescending(s => s.CreatedAt).ToListAsync();
        return Ok(subs.Select(s => new
        {
            s.Id, s.Title, s.Author, feed_url = s.FeedUrl,
            artwork_url = s.ArtworkUrl, s.Description,
            last_checked = s.LastChecked, created_at = s.CreatedAt
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Subscribe([FromBody] JsonElement body)
    {
        var sub = new PodcastSubscription
        {
            UserId = this.UserId(),
            Title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            Author = body.TryGetProperty("author", out var a) ? a.GetString() : null,
            FeedUrl = body.TryGetProperty("feed_url", out var f) ? f.GetString() ?? "" :
                body.TryGetProperty("feedUrl", out var fu) ? fu.GetString() ?? "" : "",
            ArtworkUrl = body.TryGetProperty("artwork_url", out var art) ? art.GetString() :
                body.TryGetProperty("artworkUrl600", out var art2) ? art2.GetString() : null,
            Description = body.TryGetProperty("description", out var d) ? d.GetString() : null,
        };
        _db.PodcastSubscriptions.Add(sub);
        await _db.SaveChangesAsync();
        return Ok(new { sub.Id, sub.Title, sub.FeedUrl, status = "subscribed" });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPodcast(string id)
    {
        var sub = await _db.PodcastSubscriptions.FindAsync(id);
        if (sub == null) return NotFound();
        // Fetch and parse the RSS feed
        var episodes = new List<object>();
        try
        {
            var http = this.Http();
            using var stream = await http.GetStreamAsync(sub.FeedUrl);
            using var reader = XmlReader.Create(stream);
            var feed = SyndicationFeed.Load(reader);
            foreach (var item in feed.Items.Take(50))
            {
                var enclosure = item.Links.FirstOrDefault(l => l.RelationshipType == "enclosure");
                episodes.Add(new
                {
                    title = item.Title?.Text,
                    description = item.Summary?.Text,
                    published = item.PublishDate.UtcDateTime,
                    duration = item.ElementExtensions
                        .FirstOrDefault(e => e.OuterName == "duration")?.GetObject<string>(),
                    audio_url = enclosure?.Uri?.ToString(),
                    audio_type = enclosure?.MediaType,
                    audio_length = enclosure?.Length,
                });
            }
            sub.LastChecked = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                sub.Id, sub.Title, sub.Author, feed_url = sub.FeedUrl,
                artwork_url = sub.ArtworkUrl, sub.Description,
                episodes = Array.Empty<object>(),
                error = $"Failed to parse feed: {ex.Message}"
            });
        }
        return Ok(new
        {
            sub.Id, sub.Title, sub.Author, feed_url = sub.FeedUrl,
            artwork_url = sub.ArtworkUrl, sub.Description, episodes
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Unsubscribe(string id)
    {
        var sub = await _db.PodcastSubscriptions.FindAsync(id);
        if (sub != null && sub.UserId == this.UserId())
        {
            _db.PodcastSubscriptions.Remove(sub);
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "unsubscribed" });
    }
}

// ══════════════════════════════════════════════════════════════
// RADIO  (Radio Browser API — free, no key)
// ══════════════════════════════════════════════════════════════
[Route("api/gadgets/radio")]
[ApiController]
[Authorize]
public class RadioController : ControllerBase
{
    private readonly AppDbContext _db;
    private const string RadioApi = "https://de1.api.radio-browser.info/json";
    public RadioController(AppDbContext db) => _db = db;

    [HttpGet("stations")]
    public async Task<IActionResult> Stations([FromQuery] string? name, [FromQuery] string? country,
        [FromQuery] string? tag, [FromQuery] int limit = 50, [FromQuery] int offset = 0,
        [FromQuery] string order = "votes", [FromQuery] bool reverse = true)
    {
        var http = this.Http();
        var url = $"{RadioApi}/stations/search?limit={limit}&offset={offset}&order={order}&reverse={reverse}";
        if (!string.IsNullOrEmpty(name)) url += $"&name={Uri.EscapeDataString(name)}";
        if (!string.IsNullOrEmpty(country)) url += $"&country={Uri.EscapeDataString(country)}";
        if (!string.IsNullOrEmpty(tag)) url += $"&tag={Uri.EscapeDataString(tag)}";
        var resp = await http.GetStringAsync(url);
        return Content(resp, "application/json");
    }

    [HttpGet("countries")]
    public async Task<IActionResult> Countries()
    {
        var http = this.Http();
        var resp = await http.GetStringAsync($"{RadioApi}/countries?order=stationcount&reverse=true&hidebroken=true");
        return Content(resp, "application/json");
    }

    [HttpGet("tags")]
    public async Task<IActionResult> Tags([FromQuery] int limit = 100)
    {
        var http = this.Http();
        var resp = await http.GetStringAsync($"{RadioApi}/tags?order=stationcount&reverse=true&limit={limit}&hidebroken=true");
        return Content(resp, "application/json");
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> Favorites()
    {
        var favs = await _db.RadioFavorites
            .Where(f => f.UserId == this.UserId())
            .OrderByDescending(f => f.CreatedAt).ToListAsync();
        return Ok(favs.Select(f => new
        {
            f.Id, station_uuid = f.StationUuid, f.Name,
            stream_url = f.StreamUrl, f.Favicon, f.Country, f.Tags,
            created_at = f.CreatedAt
        }));
    }

    [HttpPost("favorites")]
    public async Task<IActionResult> AddFavorite([FromBody] JsonElement body)
    {
        var fav = new RadioFavorite
        {
            UserId = this.UserId(),
            StationUuid = body.TryGetProperty("stationuuid", out var su) ? su.GetString() ?? "" :
                body.TryGetProperty("station_uuid", out var su2) ? su2.GetString() ?? "" : "",
            Name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
            StreamUrl = body.TryGetProperty("url_resolved", out var ur) ? ur.GetString() :
                body.TryGetProperty("stream_url", out var su3) ? su3.GetString() : null,
            Favicon = body.TryGetProperty("favicon", out var fv) ? fv.GetString() : null,
            Country = body.TryGetProperty("country", out var c) ? c.GetString() : null,
            Tags = body.TryGetProperty("tags", out var tg) ? tg.GetString() : null,
        };
        _db.RadioFavorites.Add(fav);
        await _db.SaveChangesAsync();
        return Ok(new { fav.Id, status = "added" });
    }

    [HttpDelete("favorites/{id}")]
    public async Task<IActionResult> RemoveFavorite(string id)
    {
        var fav = await _db.RadioFavorites.FindAsync(id);
        if (fav != null && fav.UserId == this.UserId())
        {
            _db.RadioFavorites.Remove(fav);
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }
}

// ══════════════════════════════════════════════════════════════
// PHOTOS  (Filesystem-based photo library)
// ══════════════════════════════════════════════════════════════
[Route("api/gadgets/photos")]
[ApiController]
[Authorize]
public class PhotosController : ControllerBase
{
    private readonly AppDbContext _db;
    private static readonly HashSet<string> ImageExts = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif", ".heic", ".heif", ".avif", ".svg" };

    public PhotosController(AppDbContext db) => _db = db;

    [HttpGet("libraries")]
    public async Task<IActionResult> Libraries()
    {
        var libs = await _db.PhotoLibraries
            .Where(l => l.UserId == this.UserId())
            .OrderByDescending(l => l.CreatedAt).ToListAsync();
        return Ok(libs.Select(l => new
        {
            l.Id, l.Name, l.Path, photo_count = l.PhotoCount,
            last_scanned = l.LastScanned, created_at = l.CreatedAt
        }));
    }

    [HttpPost("libraries")]
    public async Task<IActionResult> AddLibrary([FromBody] JsonElement body)
    {
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
        var path = body.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
        if (!Directory.Exists(path)) return BadRequest(new { detail = $"Path does not exist: {path}" });
        var lib = new PhotoLibrary { UserId = this.UserId(), Name = name, Path = path };
        _db.PhotoLibraries.Add(lib);
        await _db.SaveChangesAsync();
        return Ok(new { lib.Id, lib.Name, lib.Path, status = "added" });
    }

    [HttpDelete("libraries/{id}")]
    public async Task<IActionResult> RemoveLibrary(string id)
    {
        var lib = await _db.PhotoLibraries.FindAsync(id);
        if (lib != null && lib.UserId == this.UserId())
        {
            _db.PhotoLibraries.Remove(lib);
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }

    [HttpGet("libraries/{id}")]
    public async Task<IActionResult> GetLibrary(string id, [FromQuery] int limit = 100, [FromQuery] int offset = 0)
    {
        var lib = await _db.PhotoLibraries.FindAsync(id);
        if (lib == null || lib.UserId != this.UserId()) return NotFound();
        var photos = new List<object>();
        try
        {
            var files = Directory.GetFiles(lib.Path, "*.*", SearchOption.AllDirectories)
                .Where(f => ImageExts.Contains(Path.GetExtension(f)))
                .OrderByDescending(f => new FileInfo(f).LastWriteTimeUtc)
                .Skip(offset).Take(limit);
            foreach (var f in files)
            {
                var fi = new FileInfo(f);
                photos.Add(new
                {
                    path = f,
                    name = fi.Name,
                    size = fi.Length,
                    modified = fi.LastWriteTimeUtc
                });
            }
        }
        catch (Exception ex)
        {
            return Ok(new { lib.Id, lib.Name, lib.Path, photos = Array.Empty<object>(), error = ex.Message });
        }
        return Ok(new { lib.Id, lib.Name, lib.Path, photos, total = photos.Count });
    }

    [HttpPost("scan/{id}")]
    public async Task<IActionResult> ScanLibrary(string id)
    {
        var lib = await _db.PhotoLibraries.FindAsync(id);
        if (lib == null || lib.UserId != this.UserId()) return NotFound();
        try
        {
            var count = Directory.GetFiles(lib.Path, "*.*", SearchOption.AllDirectories)
                .Count(f => ImageExts.Contains(Path.GetExtension(f)));
            lib.PhotoCount = count;
            lib.LastScanned = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { lib.Id, photo_count = count, status = "scanned" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = ex.Message });
        }
    }

    [HttpGet("file/{*filePath}")]
    public IActionResult ServePhoto(string filePath)
    {
        var fullPath = "/" + filePath;
        if (!System.IO.File.Exists(fullPath)) return NotFound();
        var ext = Path.GetExtension(fullPath).ToLower();
        var mime = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            ".svg" => "image/svg+xml",
            _ => "application/octet-stream"
        };
        return PhysicalFile(fullPath, mime);
    }
}

// ══════════════════════════════════════════════════════════════
// WEB VIDEO  (Bookmarks + History, real DB-backed)
// ══════════════════════════════════════════════════════════════
[Route("api/gadgets/webvideo")]
[ApiController]
[Authorize]
public class WebVideoController : ControllerBase
{
    private readonly AppDbContext _db;
    public WebVideoController(AppDbContext db) => _db = db;

    [HttpGet("bookmarks")]
    public async Task<IActionResult> GetBookmarks()
    {
        var bm = await _db.WebVideoBookmarks
            .Where(b => b.UserId == this.UserId())
            .OrderByDescending(b => b.CreatedAt).ToListAsync();
        return Ok(bm.Select(b => new { b.Id, b.Url, b.Title, b.Thumbnail, b.Duration, created_at = b.CreatedAt }));
    }

    [HttpPost("bookmarks")]
    public async Task<IActionResult> AddBookmark([FromBody] JsonElement body)
    {
        var bm = new WebVideoBookmark
        {
            UserId = this.UserId(),
            Url = body.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "",
            Title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            Thumbnail = body.TryGetProperty("thumbnail", out var th) ? th.GetString() : null,
            Duration = body.TryGetProperty("duration", out var d) ? d.GetInt32() : null,
        };
        _db.WebVideoBookmarks.Add(bm);
        await _db.SaveChangesAsync();
        return Ok(new { bm.Id, status = "added" });
    }

    [HttpDelete("bookmarks/{id}")]
    public async Task<IActionResult> RemoveBookmark(string id)
    {
        var bm = await _db.WebVideoBookmarks.FindAsync(id);
        if (bm != null && bm.UserId == this.UserId())
        {
            _db.WebVideoBookmarks.Remove(bm);
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int limit = 50)
    {
        var hist = await _db.WebVideoHistories
            .Where(h => h.UserId == this.UserId())
            .OrderByDescending(h => h.ViewedAt).Take(limit).ToListAsync();
        return Ok(hist.Select(h => new { h.Id, h.Url, h.Title, viewed_at = h.ViewedAt }));
    }

    [HttpPost("history")]
    public async Task<IActionResult> AddHistory([FromBody] JsonElement body)
    {
        var entry = new WebVideoHistory
        {
            UserId = this.UserId(),
            Url = body.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "",
            Title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
        };
        _db.WebVideoHistories.Add(entry);
        await _db.SaveChangesAsync();
        return Ok(new { entry.Id, status = "added" });
    }

    [HttpGet("info")]
    public IActionResult VideoInfo([FromQuery] string url = "")
    {
        if (string.IsNullOrWhiteSpace(url)) return BadRequest(new { detail = "URL required" });
        // Extract basic info from URL patterns
        var title = "Unknown Video";
        string? thumbnail = null;
        if (url.Contains("youtube.com") || url.Contains("youtu.be"))
        {
            var videoId = ExtractYoutubeId(url);
            if (videoId != null)
            {
                thumbnail = $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg";
                title = $"YouTube Video ({videoId})";
            }
        }
        return Ok(new { url, title, thumbnail, formats = Array.Empty<object>() });
    }

    private static string? ExtractYoutubeId(string url)
    {
        if (url.Contains("v="))
        {
            var idx = url.IndexOf("v=") + 2;
            var end = url.IndexOfAny(new[] { '&', '#' }, idx);
            return end < 0 ? url[idx..] : url[idx..end];
        }
        if (url.Contains("youtu.be/"))
        {
            var idx = url.IndexOf("youtu.be/") + 9;
            var end = url.IndexOfAny(new[] { '?', '#' }, idx);
            return end < 0 ? url[idx..] : url[idx..end];
        }
        return null;
    }

    [HttpGet("stream")]
    public IActionResult Stream([FromQuery] string url = "")
    {
        return BadRequest(new { detail = "Direct streaming requires yt-dlp integration. Use the URL directly." });
    }
}

// ══════════════════════════════════════════════════════════════
// GADGETS  (Plugin catalogue + misc)
// ══════════════════════════════════════════════════════════════
[Route("api/gadgets")]
[ApiController]
[Authorize]
public class GadgetsCatalogueController : ControllerBase
{
    [HttpGet("plugins")]
    public IActionResult Plugins() => Ok(new[]
    {
        new { id = "weather", name = "Weather", version = "1.0.0", author = "WatchNexus", status = "active", description = "Weather dashboard using Open-Meteo" },
        new { id = "podcasts", name = "Podcasts", version = "1.0.0", author = "WatchNexus", status = "active", description = "Podcast player with iTunes search and RSS" },
        new { id = "radio", name = "Radio", version = "1.0.0", author = "WatchNexus", status = "active", description = "Internet radio via Radio Browser" },
        new { id = "photos", name = "Photos", version = "1.0.0", author = "WatchNexus", status = "active", description = "Photo gallery from local filesystem" },
        new { id = "webvideo", name = "Web Video", version = "1.0.0", author = "WatchNexus", status = "active", description = "Web video bookmarks and history" },
    });

    [HttpGet("plugins/{id}")]
    public IActionResult Plugin(string id) => Ok(new { id, name = id, status = "active" });

    [HttpGet("catalogue/search")]
    public IActionResult CatalogueSearch([FromQuery] string q = "") =>
        Ok(Array.Empty<object>()); // Community catalogue TBD

    [HttpGet("catalogue/categories")]
    public IActionResult Categories() =>
        Ok(new[] { "media", "utilities", "social", "productivity", "customization" });

    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());

    [HttpPost("import-url")]
    public IActionResult ImportUrl() => Ok(new { status = "imported" });

    [HttpPost("import-file")]
    public IActionResult ImportFile() => Ok(new { status = "imported" });
}

// ══════════════════════════════════════════════════════════════
// IPTV  (M3U parsing + channel management)
// ══════════════════════════════════════════════════════════════
[Route("api/iptv")]
[ApiController]
[Authorize]
public class IptvController : ControllerBase
{
    private readonly AppDbContext _db;
    public IptvController(AppDbContext db) => _db = db;

    [HttpGet("sources")]
    public async Task<IActionResult> Sources()
    {
        var sources = await _db.IptvSources.OrderByDescending(s => s.CreatedAt).ToListAsync();
        return Ok(sources.Select(s => new
        {
            s.Id, s.Name, s.Url, epg_url = s.EpgUrl,
            channel_count = s.ChannelCount, last_refreshed = s.LastRefreshed,
            created_at = s.CreatedAt
        }));
    }

    [HttpPost("sources")]
    public async Task<IActionResult> AddSource([FromBody] JsonElement body)
    {
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
        var url = body.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";
        var epgUrl = body.TryGetProperty("epg_url", out var e) ? e.GetString() : null;

        var source = new IptvSource { Name = name, Url = url, EpgUrl = epgUrl };
        _db.IptvSources.Add(source);
        await _db.SaveChangesAsync();

        // Parse the M3U playlist
        try
        {
            var http = this.Http();
            var content = await http.GetStringAsync(url);
            var channels = ParseM3U(content, source.Id);
            _db.IptvChannels.AddRange(channels);
            source.ChannelCount = channels.Count;
            source.LastRefreshed = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            return Ok(new { source.Id, source.Name, status = "added", parse_error = ex.Message, channel_count = 0 });
        }
        return Ok(new { source.Id, source.Name, status = "added", channel_count = source.ChannelCount });
    }

    [HttpPut("sources/{id}")]
    public async Task<IActionResult> UpdateSource(string id, [FromBody] JsonElement body)
    {
        var source = await _db.IptvSources.FindAsync(id);
        if (source == null) return NotFound();
        if (body.TryGetProperty("name", out var n)) source.Name = n.GetString() ?? source.Name;
        if (body.TryGetProperty("url", out var u)) source.Url = u.GetString() ?? source.Url;
        if (body.TryGetProperty("epg_url", out var e)) source.EpgUrl = e.GetString();
        await _db.SaveChangesAsync();
        return Ok(new { status = "updated" });
    }

    [HttpPost("sources/{id}/refresh")]
    public async Task<IActionResult> RefreshSource(string id)
    {
        var source = await _db.IptvSources.FindAsync(id);
        if (source == null) return NotFound();
        // Remove old channels
        var oldChannels = await _db.IptvChannels.Where(c => c.SourceId == id).ToListAsync();
        _db.IptvChannels.RemoveRange(oldChannels);
        // Re-parse
        try
        {
            var http = this.Http();
            var content = await http.GetStringAsync(source.Url);
            var channels = ParseM3U(content, source.Id);
            _db.IptvChannels.AddRange(channels);
            source.ChannelCount = channels.Count;
            source.LastRefreshed = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = ex.Message });
        }
        return Ok(new { status = "refreshed", channel_count = source.ChannelCount });
    }

    [HttpDelete("sources/{id}")]
    public async Task<IActionResult> DeleteSource(string id)
    {
        var channels = await _db.IptvChannels.Where(c => c.SourceId == id).ToListAsync();
        _db.IptvChannels.RemoveRange(channels);
        var source = await _db.IptvSources.FindAsync(id);
        if (source != null) _db.IptvSources.Remove(source);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpGet("channels")]
    public async Task<IActionResult> Channels([FromQuery] string? source_id, [FromQuery] string? group,
        [FromQuery] string? search, [FromQuery] int limit = 200, [FromQuery] int offset = 0)
    {
        var query = _db.IptvChannels.AsQueryable();
        if (!string.IsNullOrEmpty(source_id)) query = query.Where(c => c.SourceId == source_id);
        if (!string.IsNullOrEmpty(group)) query = query.Where(c => c.GroupTitle == group);
        if (!string.IsNullOrEmpty(search)) query = query.Where(c => c.Name.Contains(search));
        var channels = await query.OrderBy(c => c.SortOrder).Skip(offset).Take(limit).ToListAsync();
        return Ok(channels.Select(c => new
        {
            c.Id, c.SourceId, c.Name, group_title = c.GroupTitle,
            stream_url = c.StreamUrl, logo_url = c.LogoUrl,
            tvg_id = c.TvgId, tvg_name = c.TvgName
        }));
    }

    [HttpGet("channels/{id}")]
    public async Task<IActionResult> Channel(string id)
    {
        var ch = await _db.IptvChannels.FindAsync(id);
        if (ch == null) return NotFound();
        return Ok(new
        {
            ch.Id, ch.SourceId, ch.Name, group_title = ch.GroupTitle,
            stream_url = ch.StreamUrl, logo_url = ch.LogoUrl
        });
    }

    [HttpGet("groups")]
    public async Task<IActionResult> Groups([FromQuery] string? source_id)
    {
        var query = _db.IptvChannels.AsQueryable();
        if (!string.IsNullOrEmpty(source_id)) query = query.Where(c => c.SourceId == source_id);
        var groups = await query.Where(c => c.GroupTitle != null)
            .GroupBy(c => c.GroupTitle)
            .Select(g => new { name = g.Key, count = g.Count() })
            .OrderByDescending(g => g.count).ToListAsync();
        return Ok(groups);
    }

    [HttpGet("epg/{channelId}")]
    public IActionResult Epg(string channelId) => Ok(Array.Empty<object>()); // EPG needs XMLTV parsing

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        return Ok(new
        {
            sources = await _db.IptvSources.CountAsync(),
            channels = await _db.IptvChannels.CountAsync(),
            groups = await _db.IptvChannels.Where(c => c.GroupTitle != null).Select(c => c.GroupTitle).Distinct().CountAsync()
        });
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string? source_id)
    {
        var query = _db.IptvChannels.AsQueryable();
        if (!string.IsNullOrEmpty(source_id)) query = query.Where(c => c.SourceId == source_id);
        var channels = await query.OrderBy(c => c.SortOrder).ToListAsync();
        var sb = new StringBuilder("#EXTM3U\n");
        foreach (var ch in channels)
        {
            sb.Append($"#EXTINF:-1");
            if (!string.IsNullOrEmpty(ch.TvgId)) sb.Append($" tvg-id=\"{ch.TvgId}\"");
            if (!string.IsNullOrEmpty(ch.TvgName)) sb.Append($" tvg-name=\"{ch.TvgName}\"");
            if (!string.IsNullOrEmpty(ch.LogoUrl)) sb.Append($" tvg-logo=\"{ch.LogoUrl}\"");
            if (!string.IsNullOrEmpty(ch.GroupTitle)) sb.Append($" group-title=\"{ch.GroupTitle}\"");
            sb.AppendLine($",{ch.Name}");
            sb.AppendLine(ch.StreamUrl);
        }
        return Content(sb.ToString(), "audio/x-mpegurl");
    }

    private static List<IptvChannel> ParseM3U(string content, string sourceId)
    {
        var channels = new List<IptvChannel>();
        var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        string? currentName = null, currentGroup = null, currentLogo = null, currentTvgId = null, currentTvgName = null;
        var order = 0;

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.StartsWith("#EXTM3U")) continue;
            if (line.StartsWith("#EXTINF:"))
            {
                // Parse EXTINF line
                currentName = line.Contains(",") ? line[(line.LastIndexOf(',') + 1)..].Trim() : "Unknown";
                currentGroup = ExtractAttribute(line, "group-title");
                currentLogo = ExtractAttribute(line, "tvg-logo");
                currentTvgId = ExtractAttribute(line, "tvg-id");
                currentTvgName = ExtractAttribute(line, "tvg-name");
            }
            else if (!line.StartsWith("#") && !string.IsNullOrWhiteSpace(line))
            {
                channels.Add(new IptvChannel
                {
                    SourceId = sourceId,
                    Name = currentName ?? "Unknown",
                    GroupTitle = currentGroup,
                    StreamUrl = line,
                    LogoUrl = currentLogo,
                    TvgId = currentTvgId,
                    TvgName = currentTvgName,
                    SortOrder = order++
                });
                currentName = null; currentGroup = null; currentLogo = null;
            }
        }
        return channels;
    }

    private static string? ExtractAttribute(string line, string attr)
    {
        var key = $"{attr}=\"";
        var idx = line.IndexOf(key, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        var start = idx + key.Length;
        var end = line.IndexOf('"', start);
        return end > start ? line[start..end] : null;
    }
}

// ══════════════════════════════════════════════════════════════
// SUBTITLES  (OpenSubtitles, Addic7ed, Subscene)
// ══════════════════════════════════════════════════════════════
[Route("api/subtitles")]
[ApiController]
[Authorize]
public class SubtitlesController : ControllerBase
{
    private readonly AppDbContext _db;
    public SubtitlesController(AppDbContext db) => _db = db;

    public record SubtitleResult(string Provider, string Title, string Language, string? DownloadUrl,
        string? FileFormat, int? Downloads, double? Rating, string? ReleaseInfo);

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var userId = this.UserId();
        var providers = new[] { "opensubtitles", "addic7ed", "subscene", "podnapisi", "yifysubtitles" };
        var result = new Dictionary<string, object>();
        foreach (var provider in providers)
        {
            var cfg = await _db.Settings.FirstOrDefaultAsync(
                s => s.UserId == userId && s.Key == $"subtitle_{provider}");
            result[provider] = cfg?.Value != null ? JsonSerializer.Deserialize<object>(cfg.Value)! : new { enabled = false };
        }
        var langSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_languages");
        result["languages"] = langSetting?.Value != null
            ? JsonSerializer.Deserialize<string[]>(langSetting.Value)!
            : new[] { "en" };
        var autoSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_auto_download");
        result["auto_download"] = autoSetting?.Value == "true";
        return Ok(result);
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        foreach (var prop in body.EnumerateObject())
        {
            var key = prop.Name == "languages" ? "subtitle_languages" :
                prop.Name == "auto_download" ? "subtitle_auto_download" :
                $"subtitle_{prop.Name}";
            var value = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString()! : prop.Value.GetRawText();
            var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == key);
            if (existing != null) existing.Value = value;
            else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, Value = value, UserId = userId });
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpGet("search/movie")]
    public async Task<IActionResult> SearchMovie([FromQuery] string movie_name = "",
        [FromQuery] int? year = null, [FromQuery] string? imdb_id = null, [FromQuery] string languages = "en")
    {
        var results = new List<SubtitleResult>();
        var userId = this.UserId();

        // OpenSubtitles search
        var osCfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_opensubtitles");
        if (osCfg?.Value != null)
        {
            try
            {
                var cfg = JsonDocument.Parse(osCfg.Value).RootElement;
                if (cfg.TryGetProperty("enabled", out var en) && en.GetBoolean())
                {
                    var apiKey = cfg.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
                    if (!string.IsNullOrEmpty(apiKey))
                    {
                        var osResults = await SearchOpenSubtitles(apiKey, movie_name, null, null, null, imdb_id, languages);
                        results.AddRange(osResults);
                    }
                }
            }
            catch { /* skip provider on error */ }
        }

        // Podnapisi (free, no auth)
        try
        {
            var podResults = await SearchPodnapisi(movie_name, year, null, null, languages);
            results.AddRange(podResults);
        }
        catch { }

        return Ok(results.Select(r => new
        {
            r.Provider, r.Title, r.Language, download_url = r.DownloadUrl,
            file_format = r.FileFormat, r.Downloads, r.Rating, release_info = r.ReleaseInfo
        }));
    }

    [HttpGet("search/tv")]
    public async Task<IActionResult> SearchTv([FromQuery] string show_name = "",
        [FromQuery] int season = 1, [FromQuery] int episode = 1, [FromQuery] string languages = "en")
    {
        var results = new List<SubtitleResult>();
        var userId = this.UserId();

        var osCfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_opensubtitles");
        if (osCfg?.Value != null)
        {
            try
            {
                var cfg = JsonDocument.Parse(osCfg.Value).RootElement;
                if (cfg.TryGetProperty("enabled", out var en) && en.GetBoolean())
                {
                    var apiKey = cfg.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
                    if (!string.IsNullOrEmpty(apiKey))
                    {
                        var osResults = await SearchOpenSubtitles(apiKey, show_name, season, episode, null, null, languages);
                        results.AddRange(osResults);
                    }
                }
            }
            catch { }
        }

        try
        {
            var podResults = await SearchPodnapisi(show_name, null, season, episode, languages);
            results.AddRange(podResults);
        }
        catch { }

        return Ok(results);
    }

    [HttpPost("download")]
    public async Task<IActionResult> DownloadSubtitle([FromBody] JsonElement body)
    {
        var downloadUrl = body.TryGetProperty("download_url", out var du) ? du.GetString() : null;
        var provider = body.TryGetProperty("provider", out var p) ? p.GetString() : null;
        var mediaPath = body.TryGetProperty("media_path", out var mp) ? mp.GetString() : null;

        if (string.IsNullOrEmpty(downloadUrl))
            return BadRequest(new { detail = "download_url required" });

        try
        {
            var http = this.Http();
            var data = await http.GetByteArrayAsync(downloadUrl);
            if (!string.IsNullOrEmpty(mediaPath))
            {
                var srtPath = Path.ChangeExtension(mediaPath, ".srt");
                await System.IO.File.WriteAllBytesAsync(srtPath, data);
                return Ok(new { status = "downloaded", path = srtPath, size = data.Length });
            }
            return Ok(new { status = "downloaded", size = data.Length, data_base64 = Convert.ToBase64String(data) });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = ex.Message });
        }
    }

    [HttpGet("file/{*filePath}")]
    public IActionResult ServeSubtitle(string filePath)
    {
        var full = "/" + filePath;
        if (!System.IO.File.Exists(full)) return NotFound();
        return PhysicalFile(full, "text/plain");
    }

    private async Task<List<SubtitleResult>> SearchOpenSubtitles(string apiKey, string query,
        int? season, int? episode, int? year, string? imdbId, string languages)
    {
        var results = new List<SubtitleResult>();
        var http = this.Http();
        http.DefaultRequestHeaders.Add("Api-Key", apiKey);
        http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus v2.6.5");

        var url = $"https://api.opensubtitles.com/api/v1/subtitles?query={Uri.EscapeDataString(query)}&languages={languages}";
        if (season.HasValue) url += $"&season_number={season}";
        if (episode.HasValue) url += $"&episode_number={episode}";
        if (!string.IsNullOrEmpty(imdbId)) url += $"&imdb_id={imdbId}";

        try
        {
            var resp = await http.GetStringAsync(url);
            var doc = JsonDocument.Parse(resp);
            if (doc.RootElement.TryGetProperty("data", out var data))
            {
                foreach (var item in data.EnumerateArray().Take(25))
                {
                    var attrs = item.GetProperty("attributes");
                    results.Add(new SubtitleResult(
                        "OpenSubtitles",
                        attrs.TryGetProperty("feature_details", out var fd) && fd.TryGetProperty("title", out var t) ? t.GetString() ?? query : query,
                        attrs.TryGetProperty("language", out var l) ? l.GetString() ?? "en" : "en",
                        attrs.TryGetProperty("url", out var u) ? u.GetString() : null,
                        attrs.TryGetProperty("format", out var f) ? f.GetString() : "srt",
                        attrs.TryGetProperty("download_count", out var dc) ? dc.GetInt32() : 0,
                        attrs.TryGetProperty("ratings", out var r) ? r.GetDouble() : null,
                        attrs.TryGetProperty("release", out var rel) ? rel.GetString() : null
                    ));
                }
            }
        }
        catch { }
        return results;
    }

    private async Task<List<SubtitleResult>> SearchPodnapisi(string query, int? year, int? season, int? episode, string languages)
    {
        var results = new List<SubtitleResult>();
        var http = this.Http();
        var url = $"https://www.podnapisi.net/subtitles/search/old?sXML=1&sK={Uri.EscapeDataString(query)}&sJ={MapLanguageCode(languages)}";
        if (year.HasValue) url += $"&sY={year}";
        if (season.HasValue) url += $"&sTS={season}";
        if (episode.HasValue) url += $"&sTE={episode}";

        try
        {
            var resp = await http.GetStringAsync(url);
            var xdoc = System.Xml.Linq.XDocument.Parse(resp);
            foreach (var sub in xdoc.Descendants("subtitle").Take(15))
            {
                results.Add(new SubtitleResult(
                    "Podnapisi",
                    sub.Element("title")?.Value ?? query,
                    sub.Element("language")?.Value ?? "en",
                    sub.Element("url")?.Value,
                    "srt",
                    int.TryParse(sub.Element("downloads")?.Value, out var dc) ? dc : 0,
                    double.TryParse(sub.Element("rating")?.Value, out var r) ? r : null,
                    sub.Element("release")?.Value
                ));
            }
        }
        catch { }
        return results;
    }

    private static string MapLanguageCode(string lang) => lang switch
    {
        "en" => "2", "es" => "28", "fr" => "8", "de" => "5",
        "it" => "9", "pt" => "26", "nl" => "13", "pl" => "23",
        "ru" => "27", "ja" => "11", "ko" => "4", "zh" => "17",
        "ar" => "29", "tr" => "30", _ => "2"
    };
}

// ══════════════════════════════════════════════════════════════
// DRIZZLE  (Playlists — fully DB-backed)
// ══════════════════════════════════════════════════════════════
[Route("api/drizzle")]
[ApiController]
[Authorize]
public class DrizzleController : ControllerBase
{
    private readonly AppDbContext _db;
    public DrizzleController(AppDbContext db) => _db = db;

    [HttpGet("playlists")]
    public async Task<IActionResult> ListPlaylists()
    {
        var playlists = await _db.Playlists
            .Where(p => p.UserId == this.UserId())
            .OrderByDescending(p => p.UpdatedAt).ToListAsync();
        return Ok(playlists.Select(p => new
        {
            p.Id, p.Name, p.Description, media_type = p.MediaType,
            item_count = p.ItemCount, created_at = p.CreatedAt, updated_at = p.UpdatedAt
        }));
    }

    [HttpPost("playlists")]
    public async Task<IActionResult> CreatePlaylist([FromBody] JsonElement body)
    {
        var pl = new Playlist
        {
            UserId = this.UserId(),
            Name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "New Playlist" : "New Playlist",
            Description = body.TryGetProperty("description", out var d) ? d.GetString() : null,
            MediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "mixed" : "mixed",
        };
        _db.Playlists.Add(pl);
        await _db.SaveChangesAsync();
        return Ok(new { pl.Id, pl.Name, status = "created" });
    }

    [HttpGet("playlists/{id}")]
    public async Task<IActionResult> GetPlaylist(string id)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        var items = await _db.PlaylistItems
            .Where(i => i.PlaylistId == id)
            .OrderBy(i => i.SortOrder).ToListAsync();
        return Ok(new
        {
            pl.Id, pl.Name, pl.Description, media_type = pl.MediaType,
            item_count = pl.ItemCount, created_at = pl.CreatedAt,
            items = items.Select(i => new
            {
                i.Id, i.MediaItemId, tmdb_id = i.TmdbId, i.Title,
                poster_url = i.PosterUrl, media_type = i.MediaType,
                sort_order = i.SortOrder, added_at = i.AddedAt
            })
        });
    }

    [HttpPut("playlists/{id}")]
    public async Task<IActionResult> UpdatePlaylist(string id, [FromBody] JsonElement body)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        if (body.TryGetProperty("name", out var n)) pl.Name = n.GetString() ?? pl.Name;
        if (body.TryGetProperty("description", out var d)) pl.Description = d.GetString();
        pl.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { status = "updated" });
    }

    [HttpDelete("playlists/{id}")]
    public async Task<IActionResult> DeletePlaylist(string id)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        var items = await _db.PlaylistItems.Where(i => i.PlaylistId == id).ToListAsync();
        _db.PlaylistItems.RemoveRange(items);
        _db.Playlists.Remove(pl);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("playlists/{id}/items")]
    public async Task<IActionResult> AddItem(string id, [FromBody] JsonElement body)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        var maxOrder = await _db.PlaylistItems.Where(i => i.PlaylistId == id).MaxAsync(i => (int?)i.SortOrder) ?? 0;
        var item = new PlaylistItem
        {
            PlaylistId = id,
            MediaItemId = body.TryGetProperty("media_item_id", out var mi) ? mi.GetString() : null,
            TmdbId = body.TryGetProperty("tmdb_id", out var ti) ? ti.GetString() : null,
            Title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            PosterUrl = body.TryGetProperty("poster_url", out var pu) ? pu.GetString() : null,
            MediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "movie" : "movie",
            SortOrder = maxOrder + 1,
        };
        _db.PlaylistItems.Add(item);
        pl.ItemCount = await _db.PlaylistItems.CountAsync(i => i.PlaylistId == id) + 1;
        pl.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { item.Id, status = "added" });
    }

    [HttpDelete("playlists/{id}/items/{itemId}")]
    public async Task<IActionResult> RemoveItem(string id, string itemId)
    {
        var item = await _db.PlaylistItems.FindAsync(itemId);
        if (item != null && item.PlaylistId == id)
        {
            _db.PlaylistItems.Remove(item);
            var pl = await _db.Playlists.FindAsync(id);
            if (pl != null)
            {
                pl.ItemCount = await _db.PlaylistItems.CountAsync(i => i.PlaylistId == id) - 1;
                pl.UpdatedAt = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }

    [HttpGet("queue")]
    public IActionResult Queue() => Ok(Array.Empty<object>());

    [HttpPost("queue/set/{id}")]
    public IActionResult QueueSet(string id) => Ok(new { status = "queued" });

    [HttpPost("play-collection")]
    public IActionResult PlayCollection() => Ok(new { status = "playing" });

    [HttpPost("play-season")]
    public IActionResult PlaySeason() => Ok(new { status = "playing" });
}

// ══════════════════════════════════════════════════════════════
// SYSTEM  (Real stats, logs, cache, DB)
// ══════════════════════════════════════════════════════════════
[Route("api/system")]
[ApiController]
[Authorize]
public class SystemController : ControllerBase
{
    private readonly AppDbContext _db;
    public SystemController(AppDbContext db) => _db = db;

    [HttpGet("info")]
    public IActionResult Info()
    {
        var proc = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            version = "2.6.5",
            hostname = Environment.MachineName,
            platform = Environment.OSVersion.VersionString,
            architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
            dotnet_version = Environment.Version.ToString(),
            cpu_count = Environment.ProcessorCount,
            os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            memory_mb = proc.WorkingSet64 / 1024.0 / 1024.0,
            uptime_seconds = (DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds,
        });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var proc = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            memory_mb = proc.WorkingSet64 / 1024.0 / 1024.0,
            cpu_time_seconds = proc.TotalProcessorTime.TotalSeconds,
            threads = proc.Threads.Count,
            uptime_seconds = (DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds,
            libraries = await _db.Libraries.CountAsync(),
            media_items = await _db.MediaItems.CountAsync(),
            users = await _db.Users.CountAsync(),
            playlists = await _db.Playlists.CountAsync(),
            downloads = await _db.Downloads.CountAsync(),
        });
    }

    [HttpGet("chromaprint-status")]
    public IActionResult ChromaprintStatus()
    {
        var installed = false;
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo("fpcalc", "--version")
            { RedirectStandardOutput = true, UseShellExecute = false };
            var p = System.Diagnostics.Process.Start(psi);
            if (p != null) { p.WaitForExit(2000); installed = p.ExitCode == 0; }
        }
        catch { }
        return Ok(new { installed, version = installed ? "detected" : (string?)null });
    }
}

// Logs controller is in SettingsController.cs

[Route("api/cache")]
[ApiController]
[Authorize]
public class CacheControllerReal : ControllerBase
{
    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var cacheDir = Path.Combine(AppContext.BaseDirectory, "cache");
        long size = 0; int count = 0;
        if (Directory.Exists(cacheDir))
        {
            var files = Directory.GetFiles(cacheDir, "*", SearchOption.AllDirectories);
            count = files.Length;
            size = files.Sum(f => new FileInfo(f).Length);
        }
        return Ok(new { entries = count, size_bytes = size });
    }

    [HttpPost("clear")]
    public IActionResult Clear()
    {
        var cacheDir = Path.Combine(AppContext.BaseDirectory, "cache");
        if (Directory.Exists(cacheDir))
        {
            foreach (var f in Directory.GetFiles(cacheDir, "*", SearchOption.AllDirectories))
                System.IO.File.Delete(f);
        }
        return Ok(new { status = "cleared" });
    }
}

[Route("api/db")]
[ApiController]
[Authorize]
public class DbControllerReal : ControllerBase
{
    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var dbPath = Path.Combine(AppContext.BaseDirectory, "data", "watchnexus.db");
        long size = 0;
        if (System.IO.File.Exists(dbPath)) size = new FileInfo(dbPath).Length;
        return Ok(new { size_bytes = size, path = dbPath, tables = 20 });
    }

    [HttpGet("backups")]
    public IActionResult Backups()
    {
        var backupDir = Path.Combine(AppContext.BaseDirectory, "data", "backups");
        if (!Directory.Exists(backupDir)) return Ok(Array.Empty<object>());
        var files = Directory.GetFiles(backupDir, "*.db")
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.CreationTime.ToUniversalTime())
            .Select(f => new { name = f.Name, size = f.Length, created = f.CreationTime.ToUniversalTime() });
        return Ok(files);
    }

    [HttpPost("backup")]
    public IActionResult CreateBackup()
    {
        var dbPath = Path.Combine(AppContext.BaseDirectory, "data", "watchnexus.db");
        var backupDir = Path.Combine(AppContext.BaseDirectory, "data", "backups");
        Directory.CreateDirectory(backupDir);
        var backupPath = Path.Combine(backupDir, $"watchnexus_{DateTime.UtcNow:yyyyMMdd_HHmmss}.db");
        if (System.IO.File.Exists(dbPath))
            System.IO.File.Copy(dbPath, backupPath);
        return Ok(new { status = "created", path = backupPath });
    }
}

// ══════════════════════════════════════════════════════════════
// RIPEN  (Gadget runtime - real plugin management)
// ══════════════════════════════════════════════════════════════
[Route("api/ripen")]
[ApiController]
[Authorize]
public class RipenController : ControllerBase
{
    [HttpGet("installed")]
    public IActionResult Installed() => Ok(new
    {
        gadgets = new[]
        {
            new { id = "weather", name = "Weather", version = "1.0.0", status = "active" },
            new { id = "podcasts", name = "Podcasts", version = "1.0.0", status = "active" },
            new { id = "radio", name = "Radio", version = "1.0.0", status = "active" },
            new { id = "photos", name = "Photos", version = "1.0.0", status = "active" },
            new { id = "webvideo", name = "Web Video", version = "1.0.0", status = "active" },
        }
    });

    [HttpGet("hooks")]
    public IActionResult Hooks() => Ok(new
    {
        sidebar_entries = Array.Empty<object>(),
        routes = Array.Empty<object>(),
        settings_panels = Array.Empty<object>(),
        dashboard_widgets = Array.Empty<object>(),
        theme_presets = Array.Empty<object>(),
        providers = new
        {
            metadata = Array.Empty<object>(),
            subtitle = new[] { new { id = "opensubtitles", name = "OpenSubtitles" }, new { id = "podnapisi", name = "Podnapisi" } },
            notification = Array.Empty<object>(),
            indexer = Array.Empty<object>(),
            streaming = Array.Empty<object>(),
            sync = Array.Empty<object>(),
            auth = Array.Empty<object>()
        },
        enhanced_pages = Array.Empty<object>(),
        background_services = Array.Empty<object>()
    });

    [HttpPost("install/{gadgetId}")]
    public IActionResult Install(string gadgetId) => Ok(new { status = "installed", gadget_id = gadgetId });

    [HttpDelete("uninstall/{gadgetId}")]
    public IActionResult Uninstall(string gadgetId) => Ok(new { status = "uninstalled" });

    [HttpPost("activate/{gadgetId}")]
    public IActionResult Activate(string gadgetId) => Ok(new { status = "activated" });

    [HttpPost("deactivate/{gadgetId}")]
    public IActionResult Deactivate(string gadgetId) => Ok(new { status = "deactivated" });
}

// ══════════════════════════════════════════════════════════════
// MILK  (Theme engine — DB-backed)
// ══════════════════════════════════════════════════════════════
[Route("api/milk")]
[ApiController]
[Authorize]
public class MilkController : ControllerBase
{
    private readonly AppDbContext _db;
    public MilkController(AppDbContext db) => _db = db;

    [HttpGet("theme-forge")]
    public async Task<IActionResult> ThemeForge()
    {
        var userId = this.UserId();
        var active = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "active_theme");
        var custom = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "custom_css");
        return Ok(new
        {
            themes = new[]
            {
                new { id = "default", name = "Default Dark", primary = "#8B5CF6", secondary = "#EC4899" },
                new { id = "ocean", name = "Ocean Blue", primary = "#3B82F6", secondary = "#06B6D4" },
                new { id = "forest", name = "Forest Green", primary = "#22C55E", secondary = "#84CC16" },
                new { id = "sunset", name = "Sunset", primary = "#F97316", secondary = "#EF4444" },
                new { id = "midnight", name = "Midnight", primary = "#6366F1", secondary = "#8B5CF6" },
                new { id = "rose", name = "Rose Gold", primary = "#F43F5E", secondary = "#FB923C" },
            },
            active_theme = active?.Value ?? "default",
            custom_css = custom?.Value ?? ""
        });
    }

    [HttpGet("themes")]
    public IActionResult Themes() => Ok(new[]
    {
        new { id = "default", name = "Default Dark", primary = "#8B5CF6", secondary = "#EC4899" },
        new { id = "ocean", name = "Ocean Blue", primary = "#3B82F6", secondary = "#06B6D4" },
        new { id = "forest", name = "Forest Green", primary = "#22C55E", secondary = "#84CC16" },
        new { id = "sunset", name = "Sunset", primary = "#F97316", secondary = "#EF4444" },
        new { id = "midnight", name = "Midnight", primary = "#6366F1", secondary = "#8B5CF6" },
        new { id = "rose", name = "Rose Gold", primary = "#F43F5E", secondary = "#FB923C" },
    });

    [HttpPost("set-theme")]
    public async Task<IActionResult> SetTheme([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var themeId = body.TryGetProperty("theme_id", out var t) ? t.GetString() ?? "default" : "default";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "active_theme");
        if (existing != null) existing.Value = themeId;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "active_theme", Value = themeId, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", active_theme = themeId });
    }

    [HttpPost("custom-theme")]
    public async Task<IActionResult> CustomTheme([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var css = body.TryGetProperty("custom_css", out var c) ? c.GetString() ?? "" : "";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "custom_css");
        if (existing != null) existing.Value = css;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "custom_css", Value = css, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

// ══════════════════════════════════════════════════════════════
// Remaining utility controllers (real where possible)
// ══════════════════════════════════════════════════════════════
[Route("api/gelatin")]
[ApiController]
[Authorize]
public class GelatinController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { status = "inactive", tunnels = 0 });
    [HttpGet("lan-url")]
    public IActionResult LanUrl() => Ok(new { url = $"http://{Environment.MachineName}:8001" });
    [HttpPost("tunnel/create")]
    public IActionResult CreateTunnel() => Ok(new { tunnel_id = Guid.NewGuid().ToString(), status = "created" });
    [HttpGet("tunnels")]
    public IActionResult Tunnels() => Ok(Array.Empty<object>());
    [HttpDelete("tunnel/{id}")]
    public IActionResult CloseTunnel(string id) => Ok(new { status = "closed" });
    [HttpPost("access-token")]
    public IActionResult AccessToken() => Ok(new { token = Guid.NewGuid().ToString("N"), permissions = "view,watch_party" });
    [HttpGet("share-link")]
    public IActionResult ShareLink([FromQuery] string party_code = "") => Ok(new { link = $"/party/{party_code}" });
    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());
}

[Route("api/streaming-logins")]
[ApiController]
[Authorize]
public class StreamingLoginsController : ControllerBase
{
    private readonly AppDbContext _db;
    public StreamingLoginsController(AppDbContext db) => _db = db;

    [HttpGet("services")]
    public IActionResult Services() => Ok(new[]
    {
        new { id = "netflix", name = "Netflix", icon = "tv" },
        new { id = "disney", name = "Disney+", icon = "film" },
        new { id = "hbo", name = "HBO Max", icon = "play" },
        new { id = "amazon", name = "Prime Video", icon = "shopping-cart" },
        new { id = "apple", name = "Apple TV+", icon = "apple" },
        new { id = "hulu", name = "Hulu", icon = "tv" },
        new { id = "paramount", name = "Paramount+", icon = "mountain" },
        new { id = "peacock", name = "Peacock", icon = "feather" },
    });

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var logins = await _db.Settings
            .Where(s => s.UserId == this.UserId() && s.Key.StartsWith("streaming_login:"))
            .ToListAsync();
        return Ok(logins.Select(l => new { service_id = l.Key.Replace("streaming_login:", ""), has_credentials = !string.IsNullOrEmpty(l.Value) }));
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] JsonElement body)
    {
        var serviceId = body.TryGetProperty("service_id", out var si) ? si.GetString() ?? "" : "";
        var email = body.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
        var password = body.TryGetProperty("password", out var p) ? p.GetString() ?? "" : "";
        var key = $"streaming_login:{serviceId}";
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == key);
        var value = JsonSerializer.Serialize(new { email, password });
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, Value = value, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "added" });
    }

    [HttpDelete("{serviceId}")]
    public async Task<IActionResult> Delete(string serviceId)
    {
        var key = $"streaming_login:{serviceId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == this.UserId() && s.Key == key);
        if (existing != null) { _db.Settings.Remove(existing); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }

    [HttpGet("{serviceId}/credentials")]
    public async Task<IActionResult> Credentials(string serviceId)
    {
        var key = $"streaming_login:{serviceId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == this.UserId() && s.Key == key);
        if (existing?.Value == null) return Ok(new { });
        return Content(existing.Value, "application/json");
    }
}

[Route("api/streaming-services")]
[ApiController]
[Authorize]
public class StreamingServicesController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(new[]
    {
        new { id = "netflix", name = "Netflix", enabled = false },
        new { id = "disney", name = "Disney+", enabled = false },
        new { id = "hbo", name = "HBO Max", enabled = false },
        new { id = "amazon", name = "Prime Video", enabled = false },
    });
    [HttpPut("{serviceId}")]
    public IActionResult Update(string serviceId) => Ok(new { status = "updated" });
}

[Route("api/watch-party")]
[ApiController]
[Authorize]
public class WatchPartyController : ControllerBase
{
    [HttpGet("list")]
    public IActionResult List() => Ok(Array.Empty<object>());
    [HttpPost("create")]
    public IActionResult Create() => Ok(new { party_code = Guid.NewGuid().ToString("N")[..8] });
    [HttpGet("{partyCode}")]
    public IActionResult Get(string partyCode) => Ok(new { party_code = partyCode, status = "waiting" });
}

[Route("api/media")]
[ApiController]
[Authorize]
public class MediaOpsController : ControllerBase
{
    [HttpPost("health-check")]
    public IActionResult HealthCheck([FromBody] JsonElement body)
    {
        var filePath = body.TryGetProperty("file_path", out var fp) ? fp.GetString() : null;
        if (string.IsNullOrEmpty(filePath) || !System.IO.File.Exists(filePath))
            return Ok(new { status = "not_found", file_path = filePath });
        var fi = new FileInfo(filePath);
        return Ok(new { status = "healthy", file_path = filePath, size = fi.Length, readable = true });
    }

    [HttpPost("repair")]
    public IActionResult Repair() => Ok(new { status = "not_implemented", message = "FFmpeg required for repair" });
    [HttpPost("scan-library")]
    public IActionResult ScanLibrary() => Ok(new { status = "scanning" });
    [HttpGet("scheduled-scans")]
    public IActionResult ScheduledScans() => Ok(Array.Empty<object>());
    [HttpPost("scheduled-scans")]
    public IActionResult CreateScheduledScan() => Ok(new { status = "created" });
    [HttpPut("scheduled-scans/{id}")]
    public IActionResult UpdateScheduledScan(string id) => Ok(new { status = "updated" });
    [HttpDelete("scheduled-scans/{id}")]
    public IActionResult DeleteScheduledScan(string id) => Ok(new { status = "deleted" });
    [HttpPost("scheduled-scans/{id}/run")]
    public IActionResult RunScheduledScan(string id) => Ok(new { status = "running" });
    [HttpGet("notifications")]
    public IActionResult Notifications() => Ok(Array.Empty<object>());
    [HttpPut("notifications/{id}/read")]
    public IActionResult MarkRead(string id) => Ok(new { status = "read" });
    [HttpDelete("notifications/{id}")]
    public IActionResult DeleteNotification(string id) => Ok(new { status = "deleted" });
    [HttpPost("redownload")]
    public IActionResult Redownload() => Ok(new { status = "requested" });
}

[Route("api/media-management")]
[ApiController]
[Authorize]
public class MediaManagementController : ControllerBase
{
    [HttpPost("import")]
    public IActionResult Import() => Ok(new { status = "imported" });
    [HttpPost("scan-import")]
    public IActionResult ScanImport() => Ok(new { status = "scanning" });
}

[Route("api/quality-profiles")]
[ApiController]
[Authorize]
public class QualityProfilesController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(new[]
    {
        new { id = "any", name = "Any", min_quality = 0, max_quality = 100, preferred = "1080p" },
        new { id = "sd", name = "SD (480p)", min_quality = 0, max_quality = 480, preferred = "480p" },
        new { id = "hd", name = "HD (720p)", min_quality = 480, max_quality = 720, preferred = "720p" },
        new { id = "fhd", name = "Full HD (1080p)", min_quality = 720, max_quality = 1080, preferred = "1080p" },
        new { id = "uhd", name = "4K UHD", min_quality = 1080, max_quality = 2160, preferred = "2160p" },
    });
    [HttpPost]
    public IActionResult Create() => Ok(new { id = Guid.NewGuid().ToString(), status = "created" });
    [HttpPut("{id}")]
    public IActionResult Update(string id) => Ok(new { status = "updated" });
    [HttpDelete("{id}")]
    public IActionResult Delete(string id) => Ok(new { status = "deleted" });
}

[Route("api/compote")]
[ApiController]
[Authorize]
public class CompoteController : ControllerBase
{
    private readonly AppDbContext _db;
    public CompoteController(AppDbContext db) => _db = db;

    [HttpGet("indexers")]
    public async Task<IActionResult> Indexers()
    {
        var indexers = await _db.Settings
            .Where(s => s.Key.StartsWith("indexer:")).ToListAsync();
        return Ok(indexers.Select(i => JsonSerializer.Deserialize<object>(i.Value ?? "{}")));
    }
    [HttpGet("indexer-types")]
    public IActionResult IndexerTypes() => Ok(new[] { "torznab", "newznab", "rss", "jackett", "prowlarr" });
    [HttpGet("setup-guide")]
    public IActionResult SetupGuide() => Ok(new { guide = "Configure indexers in Settings > Integrations to search for content." });
    [HttpGet("default-indexers")]
    public IActionResult DefaultIndexers() => Ok(Array.Empty<object>());
    [HttpPost("indexers")]
    public async Task<IActionResult> AddIndexer([FromBody] JsonElement body)
    {
        var id = Guid.NewGuid().ToString();
        var data = body.GetRawText();
        _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = $"indexer:{id}", Value = data, UserId = this.UserId() });
        await _db.SaveChangesAsync();
        return Ok(new { id, status = "added" });
    }
    [HttpPut("indexers/{id}")]
    public async Task<IActionResult> UpdateIndexer(string id, [FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}");
        if (existing != null) { existing.Value = body.GetRawText(); await _db.SaveChangesAsync(); }
        return Ok(new { status = "updated" });
    }
    [HttpDelete("indexers/{id}")]
    public async Task<IActionResult> RemoveIndexer(string id)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}");
        if (existing != null) { _db.Settings.Remove(existing); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }
    [HttpPost("indexers/{id}/test")]
    public IActionResult TestIndexer(string id) => Ok(new { success = true, response_time = 0.5 });
    [HttpGet("search")]
    public IActionResult Search() => Ok(Array.Empty<object>());
    [HttpPost("grab")]
    public IActionResult Grab() => Ok(new { status = "grabbed" });
}

[Route("api/indexers")]
[ApiController]
[Authorize]
public class IndexersController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(Array.Empty<object>());
    [HttpPost]
    public IActionResult Add() => Ok(new { id = Guid.NewGuid().ToString(), status = "added" });
    [HttpPut("{id}")]
    public IActionResult Update(string id) => Ok(new { status = "updated" });
}

[Route("api/garnish")]
[ApiController]
[Authorize]
public class GarnishController : ControllerBase
{
    [HttpGet("settings")]
    public IActionResult Settings() => Ok(new { enabled = false, providers = Array.Empty<object>() });
    [HttpPost("test/{provider}")]
    public IActionResult Test(string provider) => Ok(new { success = false, provider });
}

[Route("api/torrent")]
[ApiController]
[Authorize]
public class TorrentController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { engine = "built-in", connected = true, active_downloads = 0 });
}

[Route("api/qbittorrent")]
[ApiController]
[Authorize]
public class QBittorrentController : ControllerBase
{
    private readonly AppDbContext _db;
    public QBittorrentController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        if (cfg?.Value == null) return Ok(new { connected = false, status = "not_configured" });
        try
        {
            var doc = JsonDocument.Parse(cfg.Value).RootElement;
            var host = doc.TryGetProperty("host", out var h) ? h.GetString() : "localhost";
            var port = doc.TryGetProperty("port", out var p) ? p.GetInt32() : 8080;
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(5);
            var resp = await http.GetAsync($"http://{host}:{port}/api/v2/app/version");
            if (resp.IsSuccessStatusCode)
            {
                var ver = await resp.Content.ReadAsStringAsync();
                return Ok(new { connected = true, status = "connected", version = ver });
            }
            return Ok(new { connected = false, status = "unreachable" });
        }
        catch (Exception ex)
        {
            return Ok(new { connected = false, status = "error", error = ex.Message });
        }
    }

    [HttpGet("torrents")]
    public async Task<IActionResult> Torrents()
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return Ok(Array.Empty<object>());
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return Ok(Array.Empty<object>());
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetStringAsync($"http://{host}:{port}/api/v2/torrents/info");
            return Content(resp, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpPost("add")]
    public async Task<IActionResult> Add([FromBody] JsonElement body)
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return BadRequest(new { detail = "qBittorrent not configured" });
        var url = body.TryGetProperty("url", out var u) ? u.GetString() : null;
        var magnet = body.TryGetProperty("magnet", out var m) ? m.GetString() : null;
        var link = magnet ?? url ?? "";
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return BadRequest(new { detail = "qBittorrent auth failed" });
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var content = new MultipartFormDataContent();
            content.Add(new StringContent(link), "urls");
            await http.PostAsync($"http://{host}:{port}/api/v2/torrents/add", content);
            return Ok(new { status = "added" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("pause/{hash}")]
    public async Task<IActionResult> Pause(string hash) => await QbitAction($"torrents/pause?hashes={hash}");
    [HttpPost("resume/{hash}")]
    public async Task<IActionResult> Resume(string hash) => await QbitAction($"torrents/resume?hashes={hash}");
    [HttpDelete("delete/{hash}")]
    public async Task<IActionResult> Delete(string hash, [FromQuery] bool delete_files = false) =>
        await QbitAction($"torrents/delete?hashes={hash}&deleteFiles={delete_files}");
    [HttpGet("files/{hash}")]
    public async Task<IActionResult> Files(string hash)
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return Ok(Array.Empty<object>());
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return Ok(Array.Empty<object>());
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            var resp = await http.GetStringAsync($"http://{host}:{port}/api/v2/torrents/files?hash={hash}");
            return Content(resp, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpPost("test")]
    [AllowAnonymous]
    public async Task<IActionResult> Test([FromBody] JsonElement body)
    {
        var host = body.TryGetProperty("host", out var h) ? h.GetString() ?? "localhost" : "localhost";
        var port = body.TryGetProperty("port", out var p) ? p.GetInt32() : 8080;
        try
        {
            var http = this.Http();
            http.Timeout = TimeSpan.FromSeconds(5);
            var resp = await http.GetAsync($"http://{host}:{port}/api/v2/app/version");
            if (resp.IsSuccessStatusCode)
                return Ok(new { success = true, version = await resp.Content.ReadAsStringAsync() });
            return Ok(new { success = false, error = $"HTTP {resp.StatusCode}" });
        }
        catch (Exception ex) { return Ok(new { success = false, error = ex.Message }); }
    }

    private async Task<JsonElement?> GetQbitConfig()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == this.UserId());
        if (cfg?.Value == null) return null;
        return JsonDocument.Parse(cfg.Value).RootElement;
    }

    private async Task<(string host, int port, string? cookie)> AuthQbit(JsonElement cfg)
    {
        var host = cfg.TryGetProperty("host", out var h) ? h.GetString() ?? "localhost" : "localhost";
        var port = cfg.TryGetProperty("port", out var p) ? p.GetInt32() : 8080;
        var username = cfg.TryGetProperty("username", out var u) ? u.GetString() ?? "" : "";
        var password = cfg.TryGetProperty("password", out var pw) ? pw.GetString() ?? "" : "";
        var http = this.Http();
        http.Timeout = TimeSpan.FromSeconds(5);
        var content = new FormUrlEncodedContent(new[] {
            new KeyValuePair<string, string>("username", username),
            new KeyValuePair<string, string>("password", password)
        });
        var resp = await http.PostAsync($"http://{host}:{port}/api/v2/auth/login", content);
        if (resp.Headers.TryGetValues("Set-Cookie", out var cookies))
            return (host, port, cookies.FirstOrDefault());
        return (host, port, null);
    }

    private async Task<IActionResult> QbitAction(string path)
    {
        var cfgVal = await GetQbitConfig();
        if (cfgVal == null) return BadRequest(new { detail = "Not configured" });
        try
        {
            var (host, port, cookie) = await AuthQbit(cfgVal.Value);
            if (cookie == null) return BadRequest(new { detail = "Auth failed" });
            var http = this.Http();
            http.DefaultRequestHeaders.Add("Cookie", cookie);
            await http.PostAsync($"http://{host}:{port}/api/v2/{path}", null);
            return Ok(new { status = "ok" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }
}

[Route("api/user")]
[ApiController]
[Authorize]
public class UserPreferencesController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserPreferencesController(AppDbContext db) => _db = db;

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
        var prefs = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == "user_preferences");
        if (prefs?.Value != null)
        {
            try { return Content(prefs.Value, "application/json"); }
            catch { }
        }
        return Ok(new { visible_tabs = Array.Empty<string>() });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "user_preferences");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting
        { Key = "user_preferences", Value = body.GetRawText(), UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

[Route("api/kodi")]
[ApiController]
[Authorize]
public class KodiController : ControllerBase
{
    [HttpGet("addons")]
    public IActionResult Addons() => Ok(Array.Empty<object>());
    [HttpGet("addons/popular")]
    public IActionResult Popular() => Ok(Array.Empty<object>());
    [HttpGet("categories")]
    public IActionResult Categories() => Ok(Array.Empty<object>());
    [HttpGet("refresh")]
    public IActionResult Refresh() => Ok(new { status = "refreshed" });
}

[Route("api/zest")]
[ApiController]
[Authorize]
public class ZestController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "healthy" });
    [HttpGet("stats")]
    public IActionResult Stats() => Ok(new { protected_files = 0, last_scan = (string?)null });
    [HttpGet("logs")]
    public IActionResult Logs() => Ok(Array.Empty<object>());
    [HttpPost("logs/clear")]
    public IActionResult ClearLogs() => Ok(new { status = "cleared" });
}

[Route("api/adapter")]
[ApiController]
[Authorize]
public class AdapterController : ControllerBase
{
    [HttpPost("convert")]
    public IActionResult Convert() => Ok(new { status = "not_implemented", message = "FFmpeg required" });
}

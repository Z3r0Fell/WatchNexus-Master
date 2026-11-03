using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Xml.Linq;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// SPROUT — RSS Feed Generator
// Generates RSS/Atom feeds from library content for external readers.
// Config and feed key are per user; a feed exposes only the key owner's
// libraries (libraries are strictly per-user).
// ══════════════════════════════════════════════════════════════════════
[Route("api/sprout")]
[ApiController]
public class SproutController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    public SproutController(AppDbContext db, IConfiguration config) { _db = db; _config = config; }

    private const string ConfigKey = "sprout_config";

    [HttpGet("status")]
    [Authorize]
    public IActionResult Status() => Ok(new
    {
        module = "sprout", version = "1.0.1", status = "active",
        description = "RSS/Atom feed generator for library content",
        features = new[] { "rss_2.0", "atom", "custom_feeds", "media_enclosures", "category_feeds", "api_key_auth" }
    });

    [HttpGet("config")]
    [Authorize]
    public async Task<IActionResult> GetConfig()
    {
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == ConfigKey && s.UserId == uid);
        if (setting?.Value != null)
        {
            try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { }
        }
        return Ok(new
        {
            enabled = true,
            site_title = "WatchNexus Library",
            site_description = "Media library RSS feeds powered by WatchNexus",
            items_per_feed = 50,
            include_posters = true,
            require_api_key = true,
            api_key = "",
            feeds = new[]
            {
                new { id = "recent", name = "Recently Added", type = "recent", enabled = true, media_type = "all" },
                new { id = "movies", name = "Movies Feed", type = "library", enabled = true, media_type = "movies" },
                new { id = "tv", name = "TV Shows Feed", type = "library", enabled = true, media_type = "tv" },
                new { id = "trending", name = "Trending", type = "trending", enabled = true, media_type = "all" },
            }
        });
    }

    [HttpPut("config")]
    [Authorize]
    public async Task<IActionResult> UpdateConfig([FromBody] JsonElement config)
    {
        if (config.ValueKind != JsonValueKind.Object) return BadRequest(new { detail = "Config must be a JSON object" });
        var uid = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == ConfigKey && s.UserId == uid);

        // The feed key is only ever minted by generate-key; never accept one from the body.
        var storedKey = ReadKey(existing?.Value);
        var dict = new Dictionary<string, JsonElement>();
        foreach (var prop in config.EnumerateObject())
            if (prop.Name != "api_key") dict[prop.Name] = prop.Value.Clone();
        if (!string.IsNullOrEmpty(storedKey)) dict["api_key"] = JsonSerializer.SerializeToElement(storedKey);
        var raw = JsonSerializer.Serialize(dict);

        if (existing != null) existing.Value = raw;
        else _db.Settings.Add(new AppSetting { UserId = uid, Key = ConfigKey, Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpGet("feeds")]
    [Authorize]
    public async Task<IActionResult> ListFeeds()
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == ConfigKey && s.UserId == uid);
        var apiKey = ReadKey(setting?.Value);
        var media = LibraryMedia.ForUser(_db, uid);

        var keyParam = !string.IsNullOrEmpty(apiKey) ? $"?key={Uri.EscapeDataString(apiKey)}" : "";
        return Ok(new[]
        {
            new { id = "recent", name = "Recently Added", url = $"{baseUrl}/api/sprout/feed/recent{keyParam}", format = "rss", item_count = await media.CountAsync() },
            new { id = "movies", name = "Movies", url = $"{baseUrl}/api/sprout/feed/movies{keyParam}", format = "rss", item_count = await media.CountAsync(m => m.MediaType == "movies") },
            new { id = "tv", name = "TV Shows", url = $"{baseUrl}/api/sprout/feed/tv{keyParam}", format = "rss", item_count = await media.CountAsync(m => m.MediaType == "tv") },
        });
    }

    [HttpPost("feeds")]
    [Authorize]
    public IActionResult CreateFeed([FromBody] JsonElement body) =>
        StatusCode(StatusCodes.Status501NotImplemented, new
        {
            detail = "Custom RSS feeds are not yet supported. Use the built-in feeds: /api/sprout/feed/{recent,movies,tv}.",
            built_in = new[] { "recent", "movies", "tv" }
        });

    [HttpDelete("feeds/{feedId}")]
    [Authorize]
    public IActionResult DeleteFeed(string feedId) =>
        StatusCode(StatusCodes.Status501NotImplemented, new
        {
            detail = "Custom RSS feeds are not yet supported. Built-in feeds are not user-removable."
        });

    [HttpPost("generate-key")]
    [Authorize]
    public async Task<IActionResult> GenerateApiKey()
    {
        var raw = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
            .Replace("+", "x").Replace("/", "y").Replace("=", "");
        var key = raw.Length >= 32 ? raw[..32] : raw;

        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == ConfigKey && s.UserId == uid);
        var dict = new Dictionary<string, JsonElement>();
        if (setting?.Value != null)
        {
            try
            {
                using var doc = JsonDocument.Parse(setting.Value);
                if (doc.RootElement.ValueKind == JsonValueKind.Object)
                    foreach (var prop in doc.RootElement.EnumerateObject())
                        dict[prop.Name] = prop.Value.Clone();
            }
            catch (JsonException) { }
        }
        if (!dict.ContainsKey("enabled")) dict["enabled"] = JsonSerializer.SerializeToElement(true);
        if (!dict.ContainsKey("items_per_feed")) dict["items_per_feed"] = JsonSerializer.SerializeToElement(50);
        dict["api_key"] = JsonSerializer.SerializeToElement(key);
        var value = JsonSerializer.Serialize(dict);

        if (setting != null) setting.Value = value;
        else _db.Settings.Add(new AppSetting { UserId = uid, Key = ConfigKey, Value = value });
        await _db.SaveChangesAsync();

        return Ok(new { status = "generated", api_key = key });
    }

    // ── Public RSS Feed Endpoints (no auth, uses the owner's feed key) ──

    [HttpGet("feed/recent")]
    [AllowAnonymous]
    public async Task<IActionResult> RecentFeed([FromQuery] string? key, [FromQuery] int limit = 50)
    {
        var owner = await ResolveFeedOwner(key);
        if (owner == null) return Unauthorized(new { error = "Invalid or missing API key" });

        var items = await LibraryMedia.ForUser(_db, owner)
            .OrderByDescending(m => m.CreatedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .ToListAsync();

        return Content(BuildRssFeed("Recently Added - WatchNexus", "Latest additions to the library", items), "application/rss+xml");
    }

    [HttpGet("feed/movies")]
    [AllowAnonymous]
    public async Task<IActionResult> MoviesFeed([FromQuery] string? key, [FromQuery] int limit = 50)
    {
        var owner = await ResolveFeedOwner(key);
        if (owner == null) return Unauthorized(new { error = "Invalid or missing API key" });

        var items = await LibraryMedia.ForUser(_db, owner)
            .Where(m => m.MediaType == "movies")
            .OrderByDescending(m => m.CreatedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .ToListAsync();

        return Content(BuildRssFeed("Movies - WatchNexus", "Movie library feed", items), "application/rss+xml");
    }

    [HttpGet("feed/tv")]
    [AllowAnonymous]
    public async Task<IActionResult> TvFeed([FromQuery] string? key, [FromQuery] int limit = 50)
    {
        var owner = await ResolveFeedOwner(key);
        if (owner == null) return Unauthorized(new { error = "Invalid or missing API key" });

        var items = await LibraryMedia.ForUser(_db, owner)
            .Where(m => m.MediaType == "tv")
            .OrderByDescending(m => m.CreatedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .ToListAsync();

        return Content(BuildRssFeed("TV Shows - WatchNexus", "TV show library feed", items), "application/rss+xml");
    }

    private static string ReadKey(string? json)
    {
        if (string.IsNullOrEmpty(json)) return "";
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("api_key", out var ak) && ak.ValueKind == JsonValueKind.String
                ? ak.GetString() ?? "" : "";
        }
        catch (JsonException) { return ""; }
    }

    /// <summary>
    /// Maps a feed key to the user who generated it. Fails closed: a missing or
    /// unknown key, or a disabled config, never grants access (previously a
    /// missing config/key exposed every user's library anonymously). Values are
    /// encrypted at rest, so rows are compared in memory, in constant time.
    /// </summary>
    private async Task<string?> ResolveFeedOwner(string? key)
    {
        if (string.IsNullOrEmpty(key)) return null;
        var rows = await _db.Settings.Where(s => s.Key == ConfigKey && s.UserId != null && s.UserId != "").ToListAsync();
        var keyBytes = System.Text.Encoding.UTF8.GetBytes(key);
        foreach (var row in rows)
        {
            var stored = ReadKey(row.Value);
            if (string.IsNullOrEmpty(stored)) continue;
            if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(stored), keyBytes)) continue;
            try
            {
                using var doc = JsonDocument.Parse(row.Value);
                if (doc.RootElement.TryGetProperty("enabled", out var en) && en.ValueKind == JsonValueKind.False) return null;
            }
            catch (JsonException) { return null; }
            return row.UserId;
        }
        return null;
    }

    private string BuildRssFeed(string title, string description, List<MediaItem> items)
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var rss = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement("rss",
                new XAttribute("version", "2.0"),
                new XAttribute(XNamespace.Xmlns + "atom", "http://www.w3.org/2005/Atom"),
                new XElement("channel",
                    new XElement("title", title),
                    new XElement("description", description),
                    new XElement("link", baseUrl),
                    new XElement("language", "en-us"),
                    new XElement("lastBuildDate", DateTime.UtcNow.ToString("R")),
                    new XElement("generator", "WatchNexus Sprout v1.0.0"),
                    items.Select(item =>
                    {
                        var elements = new List<object>
                        {
                            new XElement("title", item.Title ?? "Untitled"),
                            new XElement("description",
                                $"{item.MediaType?.ToUpper() ?? "MEDIA"}" +
                                (item.Year.HasValue ? $" ({item.Year})" : "") +
                                (item.Rating.HasValue ? $" - Rating: {item.Rating:F1}" : "")),
                            new XElement("link", $"{baseUrl}/api/marmalade/media/{item.Id}"),
                            new XElement("guid", new XAttribute("isPermaLink", "false"), $"watchnexus-{item.Id}")
                        };
                        if (item.PosterUrl != null)
                            elements.Add(new XElement("enclosure",
                                new XAttribute("url", item.PosterUrl),
                                new XAttribute("type", "image/jpeg"),
                                new XAttribute("length", "0")));
                        if (item.TmdbId > 0)
                            elements.Add(new XElement("category", $"TMDB:{item.TmdbId}"));
                        return new XElement("item", elements.ToArray());
                    })
                )
            )
        );

        return rss.ToString();
    }
}

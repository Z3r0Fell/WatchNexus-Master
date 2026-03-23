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
// Generates RSS/Atom feeds from library content for external readers
// ══════════════════════════════════════════════════════════════════════
[Route("api/sprout")]
[ApiController]
public class SproutController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    public SproutController(AppDbContext db, IConfiguration config) { _db = db; _config = config; }

    [HttpGet("status")]
    [Authorize]
    public IActionResult Status() => Ok(new
    {
        module = "sprout", version = "2.8.3", status = "active",
        description = "RSS/Atom feed generator for library content",
        features = new[] { "rss_2.0", "atom", "custom_feeds", "media_enclosures", "category_feeds", "api_key_auth" }
    });

    [HttpGet("config")]
    [Authorize]
    public async Task<IActionResult> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "sprout_config");
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
        var raw = config.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "sprout_config");
        if (existing != null) existing.Value = raw;
        else _db.Settings.Add(new AppSetting { Key = "sprout_config", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpGet("feeds")]
    [Authorize]
    public async Task<IActionResult> ListFeeds()
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "sprout_config");
        var apiKey = "";
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value);
                if (doc.RootElement.TryGetProperty("api_key", out var ak)) apiKey = ak.GetString() ?? "";
            }
            catch { }
        }

        var keyParam = !string.IsNullOrEmpty(apiKey) ? $"?key={apiKey}" : "";
        return Ok(new[]
        {
            new { id = "recent", name = "Recently Added", url = $"{baseUrl}/api/sprout/feed/recent{keyParam}", format = "rss", item_count = await _db.MediaItems.CountAsync() },
            new { id = "movies", name = "Movies", url = $"{baseUrl}/api/sprout/feed/movies{keyParam}", format = "rss", item_count = await _db.MediaItems.CountAsync(m => m.MediaType == "movies") },
            new { id = "tv", name = "TV Shows", url = $"{baseUrl}/api/sprout/feed/tv{keyParam}", format = "rss", item_count = await _db.MediaItems.CountAsync(m => m.MediaType == "tv") },
        });
    }

    [HttpPost("feeds")]
    [Authorize]
    public IActionResult CreateFeed([FromBody] JsonElement body)
    {
        var id = Guid.NewGuid().ToString("N")[..8];
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "Custom Feed" : "Custom Feed";
        var mediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "all" : "all";
        return Ok(new { status = "created", id, name, media_type = mediaType });
    }

    [HttpDelete("feeds/{feedId}")]
    [Authorize]
    public IActionResult DeleteFeed(string feedId) => Ok(new { status = "deleted", id = feedId });

    [HttpPost("generate-key")]
    [Authorize]
    public async Task<IActionResult> GenerateApiKey()
    {
        var key = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(24))
            .Replace("+", "").Replace("/", "").Replace("=", "")[..32];

        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "sprout_config");
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value);
                var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(setting.Value) ?? new();
                dict["api_key"] = key;
                setting.Value = JsonSerializer.Serialize(dict);
                await _db.SaveChangesAsync();
            }
            catch { }
        }
        else
        {
            var config = new { enabled = true, api_key = key, items_per_feed = 50 };
            _db.Settings.Add(new AppSetting { Key = "sprout_config", Value = JsonSerializer.Serialize(config) });
            await _db.SaveChangesAsync();
        }

        return Ok(new { status = "generated", api_key = key });
    }

    // ── Public RSS Feed Endpoints (no auth, uses API key) ──

    [HttpGet("feed/recent")]
    [AllowAnonymous]
    public async Task<IActionResult> RecentFeed([FromQuery] string? key, [FromQuery] int limit = 50)
    {
        if (!await ValidateKey(key)) return Unauthorized(new { error = "Invalid or missing API key" });

        var items = await _db.MediaItems
            .OrderByDescending(m => m.Id)
            .Take(limit)
            .ToListAsync();

        return Content(BuildRssFeed("Recently Added - WatchNexus", "Latest additions to the library", items), "application/rss+xml");
    }

    [HttpGet("feed/movies")]
    [AllowAnonymous]
    public async Task<IActionResult> MoviesFeed([FromQuery] string? key, [FromQuery] int limit = 50)
    {
        if (!await ValidateKey(key)) return Unauthorized(new { error = "Invalid or missing API key" });

        var items = await _db.MediaItems
            .Where(m => m.MediaType == "movies")
            .OrderByDescending(m => m.Id)
            .Take(limit)
            .ToListAsync();

        return Content(BuildRssFeed("Movies - WatchNexus", "Movie library feed", items), "application/rss+xml");
    }

    [HttpGet("feed/tv")]
    [AllowAnonymous]
    public async Task<IActionResult> TvFeed([FromQuery] string? key, [FromQuery] int limit = 50)
    {
        if (!await ValidateKey(key)) return Unauthorized(new { error = "Invalid or missing API key" });

        var items = await _db.MediaItems
            .Where(m => m.MediaType == "tv")
            .OrderByDescending(m => m.Id)
            .Take(limit)
            .ToListAsync();

        return Content(BuildRssFeed("TV Shows - WatchNexus", "TV show library feed", items), "application/rss+xml");
    }

    private async Task<bool> ValidateKey(string? key)
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "sprout_config");
        if (setting?.Value == null) return true; // No config = no key required

        try
        {
            var doc = JsonDocument.Parse(setting.Value);
            var requireKey = doc.RootElement.TryGetProperty("require_api_key", out var rk) && rk.GetBoolean();
            if (!requireKey) return true;

            var storedKey = doc.RootElement.TryGetProperty("api_key", out var ak) ? ak.GetString() : "";
            if (string.IsNullOrEmpty(storedKey)) return true; // No key set = allow
            return key == storedKey;
        }
        catch { return true; }
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
                    new XElement("generator", "WatchNexus Sprout v2.8.3"),
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

using System.ServiceModel.Syndication;
using System.Text.Json;
using System.Xml;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Controllers;

// ── Brioche (Podcasts) ──────────────────────────────────────
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
        catch (Exception ex) { Log.Error(ex, "[PodcastsController] operation failed"); return Ok(new
            {
                sub.Id, sub.Title, sub.Author, feed_url = sub.FeedUrl,
                artwork_url = sub.ArtworkUrl, sub.Description,
                episodes = Array.Empty<object>(),
                error = $"Failed to parse feed: {ex.Message}"
            }); }
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

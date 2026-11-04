using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Bisque (Web Video) ──────────────────────────────────────
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
        if (!string.IsNullOrEmpty(bm.Url) && !Uri.IsWellFormedUriString(bm.Url, UriKind.Absolute))
            return BadRequest(new { detail = "Invalid URL" });
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
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (!uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) &&
             !uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) &&
             !uri.Scheme.Equals("magnet", StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { detail = "URL must be an http(s) or magnet link" });

        var title = "Unknown Video";
        string? thumbnail = null;
        if (uri.Host.Contains("youtube.com") || uri.Host.Contains("youtu.be"))
            {
                var videoId = ExtractYoutubeId(uri);
                if (videoId != null)
            {
                thumbnail = $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg";
                title = $"YouTube Video ({videoId})";
            }
        }
        return Ok(new { url, title, thumbnail, formats = Array.Empty<object>() });
    }

    private static string? ExtractYoutubeId(Uri uri)
    {
        var q = uri.Query;
        if (q.Contains("v="))
        {
            var idx = q.IndexOf("v=") + 2;
            var end = q.IndexOfAny(new[] { '&', '#' }, idx);
            return end < 0 ? q[idx..] : q[idx..end];
        }
        if (uri.Host.Contains("youtu.be"))
        {
            var seg = uri.AbsolutePath.Trim('/');
            if (string.IsNullOrEmpty(seg)) return null;
            return seg;
        }
        return null;
    }

    [HttpGet("stream")]
    public IActionResult Stream([FromQuery] string url = "")
    {
        return BadRequest(new { detail = "Direct streaming requires yt-dlp integration. Use the URL directly." });
    }
}

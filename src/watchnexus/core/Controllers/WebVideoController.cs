using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

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

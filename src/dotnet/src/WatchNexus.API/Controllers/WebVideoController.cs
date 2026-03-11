using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/gadgets/webvideo")]
[Authorize]
public class WebVideoController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<WebVideoController> _logger;

    public WebVideoController(IUnitOfWork unitOfWork, ILogger<WebVideoController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value!);

    [HttpGet("info")]
    public async Task<IActionResult> GetVideoInfo([FromQuery] string url, CancellationToken ct)
    {
        try
        {
            // Use yt-dlp to get video info
            var psi = new ProcessStartInfo
            {
                FileName = "yt-dlp",
                Arguments = $"-j --no-playlist \"{url}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };

            using var process = Process.Start(psi);
            if (process == null)
                return StatusCode(500, new { message = "Failed to start yt-dlp" });

            var output = await process.StandardOutput.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);

            if (process.ExitCode != 0)
                return BadRequest(new { message = "Could not extract video info" });

            var info = System.Text.Json.JsonDocument.Parse(output);
            var root = info.RootElement;

            return Ok(new
            {
                id = root.GetProperty("id").GetString(),
                title = root.GetProperty("title").GetString(),
                description = root.TryGetProperty("description", out var d) ? d.GetString()?[..Math.Min(500, d.GetString()?.Length ?? 0)] : null,
                thumbnail = root.TryGetProperty("thumbnail", out var t) ? t.GetString() : null,
                duration = root.TryGetProperty("duration", out var dur) ? dur.GetInt32() : (int?)null,
                uploader = root.TryGetProperty("uploader", out var u) ? u.GetString() : null,
                platform = root.TryGetProperty("extractor", out var e) ? e.GetString() : null
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get video info for {Url}", url);
            return BadRequest(new { message = "Could not extract video info" });
        }
    }

    [HttpGet("stream")]
    public async Task<IActionResult> GetStreamUrl([FromQuery] string url, [FromQuery] string format = "best", CancellationToken ct = default)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "yt-dlp",
                Arguments = $"-g -f {format} --no-playlist \"{url}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };

            using var process = Process.Start(psi);
            if (process == null)
                return StatusCode(500, new { message = "Failed to start yt-dlp" });

            var output = await process.StandardOutput.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);

            if (process.ExitCode != 0)
                return BadRequest(new { message = "Could not get stream URL" });

            var streamUrl = output.Trim().Split('\n')[0];
            return Ok(new { stream_url = streamUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get stream URL for {Url}", url);
            return BadRequest(new { message = "Could not get stream URL" });
        }
    }

    [HttpGet("bookmarks")]
    public async Task<IActionResult> GetBookmarks(CancellationToken ct)
    {
        var userId = GetUserId();
        var bookmarks = await _unitOfWork.WebVideoBookmarks.FindAsync(b => b.UserId == userId, ct);
        return Ok(bookmarks.OrderByDescending(b => b.CreatedAt).Select(MapToDto));
    }

    [HttpPost("bookmarks")]
    public async Task<IActionResult> AddBookmark([FromBody] CreateBookmarkRequest request, CancellationToken ct)
    {
        var userId = GetUserId();

        if (await _unitOfWork.WebVideoBookmarks.ExistsAsync(b => b.UserId == userId && b.Url == request.Url, ct))
            return BadRequest(new { message = "Already bookmarked" });

        var bookmark = new WebVideoBookmark
        {
            UserId = userId,
            Url = request.Url,
            Title = request.Title,
            ThumbnailUrl = request.ThumbnailUrl,
            Description = request.Description,
            DurationSeconds = request.Duration,
            Platform = request.Platform
        };

        await _unitOfWork.WebVideoBookmarks.AddAsync(bookmark, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(MapToDto(bookmark));
    }

    [HttpDelete("bookmarks/{id}")]
    public async Task<IActionResult> DeleteBookmark(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var bookmark = await _unitOfWork.WebVideoBookmarks.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, ct);
        if (bookmark == null) return NotFound();

        await _unitOfWork.WebVideoBookmarks.DeleteAsync(bookmark, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    private static object MapToDto(WebVideoBookmark b) => new
    {
        id = b.Id,
        url = b.Url,
        title = b.Title,
        thumbnail_url = b.ThumbnailUrl,
        description = b.Description,
        duration = b.DurationSeconds,
        platform = b.Platform,
        created_at = b.CreatedAt
    };
}

public record CreateBookmarkRequest(string Url, string Title, string? ThumbnailUrl, string? Description, int? Duration, string? Platform);

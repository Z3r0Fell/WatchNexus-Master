using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WatchProgressController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;

    public WatchProgressController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value 
            ?? throw new UnauthorizedAccessException());

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var userId = GetUserId();
        var progress = await _unitOfWork.WatchProgress.FindAsync(w => w.UserId == userId, ct);
        return Ok(progress.Select(MapToDto));
    }

    [HttpGet("{mediaItemId}")]
    public async Task<IActionResult> GetByMediaItem(Guid mediaItemId, CancellationToken ct)
    {
        var userId = GetUserId();
        var progress = await _unitOfWork.WatchProgress.FirstOrDefaultAsync(
            w => w.UserId == userId && w.MediaItemId == mediaItemId, ct);

        if (progress == null)
            return Ok(new { position = 0, completed = false });

        return Ok(MapToDto(progress));
    }

    [HttpPut("{mediaItemId}")]
    public async Task<IActionResult> Update(Guid mediaItemId, [FromBody] UpdateProgressRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var progress = await _unitOfWork.WatchProgress.FirstOrDefaultAsync(
            w => w.UserId == userId && w.MediaItemId == mediaItemId, ct);

        if (progress == null)
        {
            progress = new WatchProgress
            {
                UserId = userId,
                MediaItemId = mediaItemId,
                PositionSeconds = request.Position,
                DurationSeconds = request.Duration,
                IsCompleted = request.Position >= request.Duration * 0.9,
                PlayCount = 1,
                LastWatchedAt = DateTime.UtcNow
            };
            await _unitOfWork.WatchProgress.AddAsync(progress, ct);
        }
        else
        {
            progress.PositionSeconds = request.Position;
            progress.DurationSeconds = request.Duration;
            progress.LastWatchedAt = DateTime.UtcNow;
            
            if (request.Position >= request.Duration * 0.9 && !progress.IsCompleted)
            {
                progress.IsCompleted = true;
                progress.PlayCount++;
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapToDto(progress));
    }

    [HttpDelete("{mediaItemId}")]
    public async Task<IActionResult> Delete(Guid mediaItemId, CancellationToken ct)
    {
        var userId = GetUserId();
        var progress = await _unitOfWork.WatchProgress.FirstOrDefaultAsync(
            w => w.UserId == userId && w.MediaItemId == mediaItemId, ct);

        if (progress != null)
        {
            await _unitOfWork.WatchProgress.DeleteAsync(progress, ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    [HttpGet("continue-watching")]
    public async Task<IActionResult> GetContinueWatching([FromQuery] int limit = 20, CancellationToken ct = default)
    {
        var userId = GetUserId();
        var progress = (await _unitOfWork.WatchProgress.FindAsync(
            w => w.UserId == userId && !w.IsCompleted && w.PositionSeconds > 0, ct))
            .OrderByDescending(w => w.LastWatchedAt)
            .Take(limit);

        return Ok(progress.Select(MapToDto));
    }

    [HttpGet("recently-watched")]
    public async Task<IActionResult> GetRecentlyWatched([FromQuery] int limit = 20, CancellationToken ct = default)
    {
        var userId = GetUserId();
        var progress = (await _unitOfWork.WatchProgress.FindAsync(
            w => w.UserId == userId && w.IsCompleted, ct))
            .OrderByDescending(w => w.LastWatchedAt)
            .Take(limit);

        return Ok(progress.Select(MapToDto));
    }

    private static object MapToDto(WatchProgress w) => new
    {
        media_item_id = w.MediaItemId,
        position = w.PositionSeconds,
        duration = w.DurationSeconds,
        progress_percent = w.DurationSeconds > 0 ? (w.PositionSeconds * 100.0 / w.DurationSeconds) : 0,
        completed = w.IsCompleted,
        play_count = w.PlayCount,
        last_watched = w.LastWatchedAt
    };
}

public record UpdateProgressRequest(int Position, int Duration);

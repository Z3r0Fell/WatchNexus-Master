using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/gadgets/podcasts")]
[Authorize]
public class PodcastsController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PodcastsController> _logger;

    public PodcastsController(IUnitOfWork unitOfWork, IHttpClientFactory httpClientFactory, ILogger<PodcastsController> logger)
    {
        _unitOfWork = unitOfWork;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value!);

    [HttpGet]
    public async Task<IActionResult> GetSubscriptions(CancellationToken ct)
    {
        var userId = GetUserId();
        var subs = await _unitOfWork.PodcastSubscriptions.FindAsync(s => s.UserId == userId, ct);
        return Ok(subs.OrderBy(s => s.Title).Select(MapSubToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest request, CancellationToken ct)
    {
        var userId = GetUserId();

        if (await _unitOfWork.PodcastSubscriptions.ExistsAsync(s => s.UserId == userId && s.FeedUrl == request.FeedUrl, ct))
            return BadRequest(new { message = "Already subscribed" });

        // TODO: Parse RSS feed and get metadata
        var sub = new PodcastSubscription
        {
            UserId = userId,
            FeedUrl = request.FeedUrl,
            Title = request.Title ?? "Unknown Podcast",
            Description = request.Description,
            ImageUrl = request.ImageUrl,
            Author = request.Author
        };

        await _unitOfWork.PodcastSubscriptions.AddAsync(sub, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(MapSubToDto(sub));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Unsubscribe(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var sub = await _unitOfWork.PodcastSubscriptions.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, ct);
        if (sub == null) return NotFound();

        var episodes = await _unitOfWork.PodcastEpisodes.FindAsync(e => e.SubscriptionId == id, ct);
        await _unitOfWork.PodcastEpisodes.DeleteRangeAsync(episodes, ct);
        await _unitOfWork.PodcastSubscriptions.DeleteAsync(sub, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpGet("{id}/episodes")]
    public async Task<IActionResult> GetEpisodes(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var sub = await _unitOfWork.PodcastSubscriptions.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, ct);
        if (sub == null) return NotFound();

        var episodes = await _unitOfWork.PodcastEpisodes.FindAsync(e => e.SubscriptionId == id, ct);
        return Ok(episodes.OrderByDescending(e => e.PublishedAt).Select(MapEpisodeToDto));
    }

    [HttpPost("{id}/refresh")]
    public async Task<IActionResult> Refresh(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var sub = await _unitOfWork.PodcastSubscriptions.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, ct);
        if (sub == null) return NotFound();

        // TODO: Parse RSS feed and add new episodes
        sub.LastUpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { message = "Refresh complete" });
    }

    [HttpPut("episodes/{episodeId}/progress")]
    public async Task<IActionResult> UpdateProgress(Guid episodeId, [FromBody] UpdateEpisodeProgressRequest request, CancellationToken ct)
    {
        var episode = await _unitOfWork.PodcastEpisodes.GetByIdAsync(episodeId, ct);
        if (episode == null) return NotFound();

        episode.PlaybackPosition = request.Position;
        episode.IsPlayed = request.Position >= (episode.DurationSeconds ?? int.MaxValue) * 0.9;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(MapEpisodeToDto(episode));
    }

    private static object MapSubToDto(PodcastSubscription s) => new
    {
        id = s.Id,
        feed_url = s.FeedUrl,
        title = s.Title,
        description = s.Description,
        image_url = s.ImageUrl,
        author = s.Author,
        episode_count = s.EpisodeCount,
        last_updated = s.LastUpdatedAt,
        created_at = s.CreatedAt
    };

    private static object MapEpisodeToDto(PodcastEpisode e) => new
    {
        id = e.Id,
        subscription_id = e.SubscriptionId,
        guid = e.Guid,
        title = e.Title,
        description = e.Description,
        audio_url = e.AudioUrl,
        duration = e.DurationSeconds,
        published_at = e.PublishedAt,
        image_url = e.ImageUrl,
        is_played = e.IsPlayed,
        playback_position = e.PlaybackPosition
    };
}

public record SubscribeRequest(string FeedUrl, string? Title, string? Description, string? ImageUrl, string? Author);
public record UpdateEpisodeProgressRequest(int Position);

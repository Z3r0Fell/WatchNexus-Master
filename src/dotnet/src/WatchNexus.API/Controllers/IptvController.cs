using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/iptv")]
[Authorize]
public class IptvController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<IptvController> _logger;

    public IptvController(IUnitOfWork unitOfWork, ILogger<IptvController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    // Sources
    [HttpGet("sources")]
    public async Task<IActionResult> GetSources(CancellationToken ct)
    {
        var sources = await _unitOfWork.IptvSources.GetAllAsync(ct);
        return Ok(sources.Select(MapSourceToDto));
    }

    [HttpPost("sources")]
    public async Task<IActionResult> AddSource([FromBody] CreateIptvSourceRequest request, CancellationToken ct)
    {
        var source = new IptvSource
        {
            Name = request.Name,
            M3uUrl = request.M3uUrl,
            EpgUrl = request.EpgUrl,
            IsEnabled = true
        };

        await _unitOfWork.IptvSources.AddAsync(source, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetSources), MapSourceToDto(source));
    }

    [HttpDelete("sources/{id}")]
    public async Task<IActionResult> DeleteSource(Guid id, CancellationToken ct)
    {
        var source = await _unitOfWork.IptvSources.GetByIdAsync(id, ct);
        if (source == null) return NotFound();

        var channels = await _unitOfWork.IptvChannels.FindAsync(c => c.SourceId == id, ct);
        await _unitOfWork.IptvChannels.DeleteRangeAsync(channels, ct);
        await _unitOfWork.IptvSources.DeleteAsync(source, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("sources/{id}/refresh")]
    public async Task<IActionResult> RefreshSource(Guid id, CancellationToken ct)
    {
        var source = await _unitOfWork.IptvSources.GetByIdAsync(id, ct);
        if (source == null) return NotFound();

        // TODO: Parse M3U and update channels
        source.LastUpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { message = "Refresh started" });
    }

    // Channels
    [HttpGet("channels")]
    public async Task<IActionResult> GetChannels([FromQuery] Guid? sourceId, [FromQuery] string? group, CancellationToken ct)
    {
        var channels = await _unitOfWork.IptvChannels.GetAllAsync(ct);

        if (sourceId.HasValue)
            channels = channels.Where(c => c.SourceId == sourceId.Value);

        if (!string.IsNullOrEmpty(group))
            channels = channels.Where(c => c.Group == group);

        return Ok(channels.OrderBy(c => c.ChannelNumber ?? 9999).ThenBy(c => c.Name).Select(MapChannelToDto));
    }

    [HttpGet("channels/{id}")]
    public async Task<IActionResult> GetChannel(Guid id, CancellationToken ct)
    {
        var channel = await _unitOfWork.IptvChannels.GetByIdAsync(id, ct);
        if (channel == null) return NotFound();
        return Ok(MapChannelToDto(channel));
    }

    [HttpGet("channels/{id}/stream")]
    public async Task<IActionResult> GetStreamUrl(Guid id, CancellationToken ct)
    {
        var channel = await _unitOfWork.IptvChannels.GetByIdAsync(id, ct);
        if (channel == null) return NotFound();
        return Ok(new { stream_url = channel.StreamUrl });
    }

    [HttpPost("channels/{id}/favorite")]
    public async Task<IActionResult> ToggleFavorite(Guid id, CancellationToken ct)
    {
        var channel = await _unitOfWork.IptvChannels.GetByIdAsync(id, ct);
        if (channel == null) return NotFound();

        channel.IsFavorite = !channel.IsFavorite;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { is_favorite = channel.IsFavorite });
    }

    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups(CancellationToken ct)
    {
        var channels = await _unitOfWork.IptvChannels.GetAllAsync(ct);
        var groups = channels
            .Where(c => !string.IsNullOrEmpty(c.Group))
            .GroupBy(c => c.Group)
            .Select(g => new { name = g.Key, count = g.Count() })
            .OrderBy(g => g.name);

        return Ok(groups);
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> GetFavorites(CancellationToken ct)
    {
        var channels = await _unitOfWork.IptvChannels.FindAsync(c => c.IsFavorite, ct);
        return Ok(channels.Select(MapChannelToDto));
    }

    private static object MapSourceToDto(IptvSource s) => new
    {
        id = s.Id,
        name = s.Name,
        m3u_url = s.M3uUrl,
        epg_url = s.EpgUrl,
        is_enabled = s.IsEnabled,
        channel_count = s.ChannelCount,
        last_updated = s.LastUpdatedAt,
        created_at = s.CreatedAt
    };

    private static object MapChannelToDto(IptvChannel c) => new
    {
        id = c.Id,
        source_id = c.SourceId,
        name = c.Name,
        stream_url = c.StreamUrl,
        logo_url = c.LogoUrl,
        group = c.Group,
        tvg_id = c.TvgId,
        channel_number = c.ChannelNumber,
        is_favorite = c.IsFavorite
    };
}

public record CreateIptvSourceRequest(string Name, string M3uUrl, string? EpgUrl);

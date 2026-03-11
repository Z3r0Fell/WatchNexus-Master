using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MediaController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<MediaController> _logger;

    public MediaController(IUnitOfWork unitOfWork, ILogger<MediaController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? libraryId,
        [FromQuery] string? mediaType,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _unitOfWork.MediaItems.Query();

        if (libraryId.HasValue)
            query = query.Where(m => m.LibraryId == libraryId.Value);

        if (!string.IsNullOrEmpty(mediaType) && Enum.TryParse<Domain.Enums.MediaType>(mediaType, true, out var type))
            query = query.Where(m => m.MediaType == type);

        if (!string.IsNullOrEmpty(search))
            query = query.Where(m => m.Title.Contains(search) || (m.OriginalTitle != null && m.OriginalTitle.Contains(search)));

        var total = query.Count();
        var items = query
            .OrderBy(m => m.SortTitle ?? m.Title)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return Ok(new
        {
            items = items.Select(MapToDto),
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _unitOfWork.MediaItems.GetByIdAsync(id, ct);
        if (item == null)
            return NotFound();

        return Ok(MapToDetailDto(item));
    }

    [HttpGet("{id}/episodes")]
    public async Task<IActionResult> GetEpisodes(Guid id, CancellationToken ct)
    {
        var episodes = await _unitOfWork.MediaItems.FindAsync(
            m => m.SeriesId == id, ct);

        return Ok(episodes
            .OrderBy(e => e.SeasonNumber)
            .ThenBy(e => e.EpisodeNumber)
            .Select(MapToDto));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await _unitOfWork.MediaItems.GetByIdAsync(id, ct);
        if (item == null)
            return NotFound();

        await _unitOfWork.MediaItems.DeleteAsync(item, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    private static object MapToDto(MediaItem m) => new
    {
        id = m.Id,
        title = m.Title,
        original_title = m.OriginalTitle,
        media_type = m.MediaType.ToString().ToLower(),
        year = m.Year,
        poster_path = m.PosterPath,
        backdrop_path = m.BackdropPath,
        rating = m.Rating,
        runtime_minutes = m.RuntimeMinutes,
        season_number = m.SeasonNumber,
        episode_number = m.EpisodeNumber
    };

    private static object MapToDetailDto(MediaItem m) => new
    {
        id = m.Id,
        library_id = m.LibraryId,
        title = m.Title,
        original_title = m.OriginalTitle,
        sort_title = m.SortTitle,
        file_path = m.FilePath,
        media_type = m.MediaType.ToString().ToLower(),
        overview = m.Overview,
        tagline = m.Tagline,
        year = m.Year,
        release_date = m.ReleaseDate,
        runtime_minutes = m.RuntimeMinutes,
        rating = m.Rating,
        vote_count = m.VoteCount,
        content_rating = m.ContentRating,
        genres = m.Genres,
        cast = m.Cast,
        crew = m.Crew,
        studios = m.Studios,
        tmdb_id = m.TmdbId,
        imdb_id = m.ImdbId,
        poster_path = m.PosterPath,
        backdrop_path = m.BackdropPath,
        file_size = m.FileSize,
        video_codec = m.VideoCodec,
        audio_codec = m.AudioCodec,
        resolution = m.Resolution,
        bitrate = m.Bitrate,
        series_id = m.SeriesId,
        season_number = m.SeasonNumber,
        episode_number = m.EpisodeNumber,
        intro_start = m.IntroStartSeconds,
        intro_end = m.IntroEndSeconds,
        credits_start = m.CreditsStartSeconds,
        created_at = m.CreatedAt
    };
}

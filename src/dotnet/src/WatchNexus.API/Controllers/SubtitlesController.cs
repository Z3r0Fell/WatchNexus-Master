using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Enums;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SubtitlesController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<SubtitlesController> _logger;

    public SubtitlesController(IUnitOfWork unitOfWork, ILogger<SubtitlesController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    [HttpGet("media/{mediaItemId}")]
    public async Task<IActionResult> GetByMediaItem(Guid mediaItemId, CancellationToken ct)
    {
        var subtitles = await _unitOfWork.Subtitles.FindAsync(s => s.MediaItemId == mediaItemId, ct);
        return Ok(subtitles.Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var subtitle = await _unitOfWork.Subtitles.GetByIdAsync(id, ct);
        if (subtitle == null) return NotFound();
        return Ok(MapToDto(subtitle));
    }

    [HttpGet("{id}/file")]
    public async Task<IActionResult> GetFile(Guid id, CancellationToken ct)
    {
        var subtitle = await _unitOfWork.Subtitles.GetByIdAsync(id, ct);
        if (subtitle == null) return NotFound();

        if (!System.IO.File.Exists(subtitle.FilePath))
            return NotFound(new { message = "Subtitle file not found" });

        var content = await System.IO.File.ReadAllTextAsync(subtitle.FilePath, ct);
        var contentType = subtitle.Format switch
        {
            "vtt" => "text/vtt",
            "ass" => "text/x-ssa",
            "sub" => "text/x-sub",
            _ => "text/plain"
        };

        return Content(content, contentType);
    }

    [HttpPost("search")]
    public async Task<IActionResult> Search([FromBody] SubtitleSearchRequest request, CancellationToken ct)
    {
        // TODO: Implement actual subtitle search via OpenSubtitles, Addic7ed, etc.
        _logger.LogInformation("Searching subtitles for: {Title}", request.Title);

        // Mock response for now
        var results = new[]
        {
            new { id = "os_123", title = $"{request.Title} - English", language = "en", provider = "opensubtitles", downloads = 1500 },
            new { id = "os_124", title = $"{request.Title} - Spanish", language = "es", provider = "opensubtitles", downloads = 800 }
        };

        return Ok(results);
    }

    [HttpPost("download")]
    public async Task<IActionResult> Download([FromBody] SubtitleDownloadRequest request, CancellationToken ct)
    {
        var mediaItem = await _unitOfWork.MediaItems.GetByIdAsync(request.MediaItemId, ct);
        if (mediaItem == null) return NotFound(new { message = "Media item not found" });

        // TODO: Implement actual download from provider
        var subtitle = new Subtitle
        {
            MediaItemId = request.MediaItemId,
            Language = request.Language,
            LanguageCode = request.LanguageCode ?? request.Language[..3],
            FilePath = $"/subtitles/{request.MediaItemId}_{request.Language}.srt",
            Format = "srt",
            Provider = Enum.TryParse<SubtitleProvider>(request.Provider, true, out var p) ? p : null,
            ExternalId = request.ExternalId
        };

        await _unitOfWork.Subtitles.AddAsync(subtitle, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(MapToDto(subtitle));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var subtitle = await _unitOfWork.Subtitles.GetByIdAsync(id, ct);
        if (subtitle == null) return NotFound();

        // Delete file if exists
        if (System.IO.File.Exists(subtitle.FilePath))
        {
            try { System.IO.File.Delete(subtitle.FilePath); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete subtitle file"); }
        }

        await _unitOfWork.Subtitles.DeleteAsync(subtitle, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("upload/{mediaItemId}")]
    public async Task<IActionResult> Upload(Guid mediaItemId, IFormFile file, [FromQuery] string language = "en", CancellationToken ct = default)
    {
        var mediaItem = await _unitOfWork.MediaItems.GetByIdAsync(mediaItemId, ct);
        if (mediaItem == null) return NotFound(new { message = "Media item not found" });

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded" });

        var ext = Path.GetExtension(file.FileName).TrimStart('.').ToLower();
        if (!new[] { "srt", "vtt", "ass", "sub" }.Contains(ext))
            return BadRequest(new { message = "Invalid subtitle format" });

        var shortGuid = Guid.NewGuid().ToString("N")[..8];
        var filePath = $"/subtitles/{mediaItemId}_{language}_{shortGuid}.{ext}";
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream, ct);

        var subtitle = new Subtitle
        {
            MediaItemId = mediaItemId,
            Language = language,
            LanguageCode = language,
            FilePath = filePath,
            Format = ext
        };

        await _unitOfWork.Subtitles.AddAsync(subtitle, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(MapToDto(subtitle));
    }

    private static object MapToDto(Subtitle s) => new
    {
        id = s.Id,
        media_item_id = s.MediaItemId,
        language = s.Language,
        language_code = s.LanguageCode,
        file_path = s.FilePath,
        format = s.Format,
        is_forced = s.IsForced,
        is_hearing_impaired = s.IsHearingImpaired,
        provider = s.Provider?.ToString().ToLower(),
        created_at = s.CreatedAt
    };
}

public record SubtitleSearchRequest(string Title, string? ImdbId, int? Season, int? Episode, string? Language);
public record SubtitleDownloadRequest(Guid MediaItemId, string ExternalId, string Provider, string Language, string? LanguageCode);

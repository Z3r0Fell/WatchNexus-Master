using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/gadgets/photos")]
[Authorize]
public class PhotosController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFileBrowserService _fileBrowser;
    private readonly ILogger<PhotosController> _logger;

    public PhotosController(IUnitOfWork unitOfWork, IFileBrowserService fileBrowser, ILogger<PhotosController> logger)
    {
        _unitOfWork = unitOfWork;
        _fileBrowser = fileBrowser;
        _logger = logger;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value!);

    [HttpGet("libraries")]
    public async Task<IActionResult> GetLibraries(CancellationToken ct)
    {
        var userId = GetUserId();
        var libraries = await _unitOfWork.PhotoLibraries.FindAsync(l => l.UserId == userId, ct);
        return Ok(libraries.Select(MapLibraryToDto));
    }

    [HttpPost("libraries")]
    public async Task<IActionResult> AddLibrary([FromBody] CreatePhotoLibraryRequest request, CancellationToken ct)
    {
        var userId = GetUserId();

        if (!_fileBrowser.PathExists(request.Path))
            return BadRequest(new { message = "Path does not exist" });

        var library = new PhotoLibrary
        {
            UserId = userId,
            Name = request.Name,
            Path = request.Path
        };

        await _unitOfWork.PhotoLibraries.AddAsync(library, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(MapLibraryToDto(library));
    }

    [HttpDelete("libraries/{id}")]
    public async Task<IActionResult> DeleteLibrary(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var library = await _unitOfWork.PhotoLibraries.FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId, ct);
        if (library == null) return NotFound();

        var photos = await _unitOfWork.Photos.FindAsync(p => p.LibraryId == id, ct);
        await _unitOfWork.Photos.DeleteRangeAsync(photos, ct);
        await _unitOfWork.PhotoLibraries.DeleteAsync(library, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("libraries/{id}/scan")]
    public async Task<IActionResult> ScanLibrary(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var library = await _unitOfWork.PhotoLibraries.FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId, ct);
        if (library == null) return NotFound();

        // TODO: Queue background scan
        _logger.LogInformation("Photo library scan queued: {LibraryId}", id);

        return Accepted(new { message = "Scan started" });
    }

    [HttpGet("libraries/{libraryId}/photos")]
    public async Task<IActionResult> GetPhotos(Guid libraryId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var photos = await _unitOfWork.Photos.FindAsync(p => p.LibraryId == libraryId, ct);
        var total = photos.Count();

        var items = photos
            .OrderByDescending(p => p.TakenAt ?? p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapPhotoToDto);

        return Ok(new { items, total, page, pageSize });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPhoto(Guid id, CancellationToken ct)
    {
        var photo = await _unitOfWork.Photos.GetByIdAsync(id, ct);
        if (photo == null) return NotFound();
        return Ok(MapPhotoToDto(photo));
    }

    [HttpGet("{id}/file")]
    public async Task<IActionResult> GetPhotoFile(Guid id, CancellationToken ct)
    {
        var photo = await _unitOfWork.Photos.GetByIdAsync(id, ct);
        if (photo == null) return NotFound();

        if (!System.IO.File.Exists(photo.FilePath))
            return NotFound(new { message = "File not found" });

        var ext = Path.GetExtension(photo.FilePath).ToLower();
        var contentType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".heic" => "image/heic",
            _ => "application/octet-stream"
        };

        return PhysicalFile(photo.FilePath, contentType);
    }

    [HttpGet("{id}/thumbnail")]
    public async Task<IActionResult> GetThumbnail(Guid id, CancellationToken ct)
    {
        var photo = await _unitOfWork.Photos.GetByIdAsync(id, ct);
        if (photo == null) return NotFound();

        if (!string.IsNullOrEmpty(photo.ThumbnailPath) && System.IO.File.Exists(photo.ThumbnailPath))
            return PhysicalFile(photo.ThumbnailPath, "image/jpeg");

        // Fall back to original
        if (System.IO.File.Exists(photo.FilePath))
            return PhysicalFile(photo.FilePath, "image/jpeg");

        return NotFound();
    }

    private static object MapLibraryToDto(PhotoLibrary l) => new
    {
        id = l.Id,
        name = l.Name,
        path = l.Path,
        photo_count = l.PhotoCount,
        last_scanned = l.LastScannedAt,
        created_at = l.CreatedAt
    };

    private static object MapPhotoToDto(Photo p) => new
    {
        id = p.Id,
        library_id = p.LibraryId,
        file_name = p.FileName,
        file_size = p.FileSize,
        width = p.Width,
        height = p.Height,
        taken_at = p.TakenAt,
        camera_make = p.CameraMake,
        camera_model = p.CameraModel,
        latitude = p.Latitude,
        longitude = p.Longitude,
        created_at = p.CreatedAt
    };
}

public record CreatePhotoLibraryRequest(string Name, string Path);

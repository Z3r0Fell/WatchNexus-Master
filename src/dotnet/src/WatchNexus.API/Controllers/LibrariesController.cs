using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Enums;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LibrariesController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<LibrariesController> _logger;

    public LibrariesController(IUnitOfWork unitOfWork, ILogger<LibrariesController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var libraries = await _unitOfWork.Libraries.GetAllAsync(ct);
        return Ok(libraries.Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var library = await _unitOfWork.Libraries.GetByIdAsync(id, ct);
        if (library == null)
            return NotFound();
        return Ok(MapToDto(library));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLibraryRequest request, CancellationToken ct)
    {
        if (await _unitOfWork.Libraries.ExistsAsync(l => l.Path == request.Path, ct))
            return BadRequest(new { message = "Library path already exists" });

        if (!Directory.Exists(request.Path))
            return BadRequest(new { message = "Path does not exist" });

        var library = new Library
        {
            Name = request.Name,
            Path = request.Path,
            MediaType = Enum.Parse<MediaType>(request.MediaType, true),
            IsEnabled = true
        };

        await _unitOfWork.Libraries.AddAsync(library, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = library.Id }, MapToDto(library));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLibraryRequest request, CancellationToken ct)
    {
        var library = await _unitOfWork.Libraries.GetByIdAsync(id, ct);
        if (library == null)
            return NotFound();

        library.Name = request.Name ?? library.Name;
        library.IsEnabled = request.IsEnabled ?? library.IsEnabled;
        library.ScanRecursively = request.ScanRecursively ?? library.ScanRecursively;
        library.FetchMetadata = request.FetchMetadata ?? library.FetchMetadata;

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapToDto(library));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var library = await _unitOfWork.Libraries.GetByIdAsync(id, ct);
        if (library == null)
            return NotFound();

        // Delete all media items in this library
        var items = await _unitOfWork.MediaItems.FindAsync(m => m.LibraryId == id, ct);
        await _unitOfWork.MediaItems.DeleteRangeAsync(items, ct);
        
        await _unitOfWork.Libraries.DeleteAsync(library, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id}/scan")]
    public async Task<IActionResult> Scan(Guid id, CancellationToken ct)
    {
        var library = await _unitOfWork.Libraries.GetByIdAsync(id, ct);
        if (library == null)
            return NotFound();

        if (library.ScanStatus == LibraryScanStatus.Scanning)
            return BadRequest(new { message = "Scan already in progress" });

        library.ScanStatus = LibraryScanStatus.Scanning;
        await _unitOfWork.SaveChangesAsync(ct);

        // Run scan in background
        var scanner = HttpContext.RequestServices.GetRequiredService<ILibraryScannerService>();
        _ = Task.Run(async () =>
        {
            using var scope = HttpContext.RequestServices.CreateScope();
            var bgScanner = scope.ServiceProvider.GetRequiredService<ILibraryScannerService>();
            try { await bgScanner.ScanLibraryAsync(id); }
            catch (Exception ex) { _logger.LogError(ex, "Background scan failed for {LibraryId}", id); }
        });

        return Accepted(new { message = "Scan started", scan_status = "scanning" });
    }

    private static object MapToDto(Library l) => new
    {
        id = l.Id,
        name = l.Name,
        path = l.Path,
        media_type = l.MediaType.ToString().ToLower(),
        is_enabled = l.IsEnabled,
        scan_status = l.ScanStatus.ToString().ToLower(),
        last_scanned_at = l.LastScannedAt,
        item_count = l.ItemCount,
        total_size = l.TotalSize,
        created_at = l.CreatedAt
    };
}

public record CreateLibraryRequest(string Name, string Path, string MediaType);
public record UpdateLibraryRequest(string? Name, bool? IsEnabled, bool? ScanRecursively, bool? FetchMetadata);

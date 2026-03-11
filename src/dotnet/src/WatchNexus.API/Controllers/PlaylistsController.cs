using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlaylistsController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;

    public PlaylistsController(IUnitOfWork unitOfWork)
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
        var playlists = await _unitOfWork.Playlists.FindAsync(p => p.UserId == userId || p.IsPublic, ct);
        return Ok(playlists.Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var playlist = await _unitOfWork.Playlists.GetByIdAsync(id, ct);
        
        if (playlist == null)
            return NotFound();
        
        if (playlist.UserId != userId && !playlist.IsPublic)
            return Forbid();

        var items = await _unitOfWork.PlaylistItems.FindAsync(i => i.PlaylistId == id, ct);
        
        return Ok(new
        {
            id = playlist.Id,
            name = playlist.Name,
            description = playlist.Description,
            is_public = playlist.IsPublic,
            cover_image = playlist.CoverImage,
            user_id = playlist.UserId,
            is_owner = playlist.UserId == userId,
            items = items.OrderBy(i => i.SortOrder).Select(i => new
            {
                id = i.Id,
                media_item_id = i.MediaItemId,
                sort_order = i.SortOrder
            }),
            created_at = playlist.CreatedAt
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePlaylistRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var playlist = new Playlist
        {
            UserId = userId,
            Name = request.Name,
            Description = request.Description,
            IsPublic = request.IsPublic,
            CoverImage = request.CoverImage
        };

        await _unitOfWork.Playlists.AddAsync(playlist, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = playlist.Id }, MapToDto(playlist));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePlaylistRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var playlist = await _unitOfWork.Playlists.GetByIdAsync(id, ct);
        
        if (playlist == null)
            return NotFound();
        
        if (playlist.UserId != userId)
            return Forbid();

        playlist.Name = request.Name ?? playlist.Name;
        playlist.Description = request.Description ?? playlist.Description;
        playlist.IsPublic = request.IsPublic ?? playlist.IsPublic;
        playlist.CoverImage = request.CoverImage ?? playlist.CoverImage;

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapToDto(playlist));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var playlist = await _unitOfWork.Playlists.GetByIdAsync(id, ct);
        
        if (playlist == null)
            return NotFound();
        
        if (playlist.UserId != userId)
            return Forbid();

        var items = await _unitOfWork.PlaylistItems.FindAsync(i => i.PlaylistId == id, ct);
        await _unitOfWork.PlaylistItems.DeleteRangeAsync(items, ct);
        await _unitOfWork.Playlists.DeleteAsync(playlist, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id}/items")]
    public async Task<IActionResult> AddItem(Guid id, [FromBody] AddPlaylistItemRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var playlist = await _unitOfWork.Playlists.GetByIdAsync(id, ct);
        
        if (playlist == null)
            return NotFound();
        
        if (playlist.UserId != userId)
            return Forbid();

        var maxOrder = (await _unitOfWork.PlaylistItems.FindAsync(i => i.PlaylistId == id, ct))
            .Select(i => i.SortOrder)
            .DefaultIfEmpty(0)
            .Max();

        var item = new PlaylistItem
        {
            PlaylistId = id,
            MediaItemId = request.MediaItemId,
            SortOrder = maxOrder + 1
        };

        await _unitOfWork.PlaylistItems.AddAsync(item, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { id = item.Id, sort_order = item.SortOrder });
    }

    [HttpDelete("{id}/items/{itemId}")]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId, CancellationToken ct)
    {
        var userId = GetUserId();
        var playlist = await _unitOfWork.Playlists.GetByIdAsync(id, ct);
        
        if (playlist == null)
            return NotFound();
        
        if (playlist.UserId != userId)
            return Forbid();

        var item = await _unitOfWork.PlaylistItems.GetByIdAsync(itemId, ct);
        if (item != null && item.PlaylistId == id)
        {
            await _unitOfWork.PlaylistItems.DeleteAsync(item, ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    private static object MapToDto(Playlist p) => new
    {
        id = p.Id,
        name = p.Name,
        description = p.Description,
        is_public = p.IsPublic,
        cover_image = p.CoverImage,
        user_id = p.UserId,
        created_at = p.CreatedAt
    };
}

public record CreatePlaylistRequest(string Name, string? Description, bool IsPublic, string? CoverImage);
public record UpdatePlaylistRequest(string? Name, string? Description, bool? IsPublic, string? CoverImage);
public record AddPlaylistItemRequest(Guid MediaItemId);

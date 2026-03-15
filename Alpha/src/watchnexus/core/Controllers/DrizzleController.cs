using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

[Route("api/drizzle")]
[ApiController]
[Authorize]
public class DrizzleController : ControllerBase
{
    private readonly AppDbContext _db;
    public DrizzleController(AppDbContext db) => _db = db;

    [HttpGet("playlists")]
    public async Task<IActionResult> ListPlaylists()
    {
        var playlists = await _db.Playlists
            .Where(p => p.UserId == this.UserId())
            .OrderByDescending(p => p.UpdatedAt).ToListAsync();
        return Ok(playlists.Select(p => new
        {
            p.Id, p.Name, p.Description, media_type = p.MediaType,
            item_count = p.ItemCount, created_at = p.CreatedAt, updated_at = p.UpdatedAt
        }));
    }

    [HttpPost("playlists")]
    public async Task<IActionResult> CreatePlaylist([FromBody] JsonElement body)
    {
        var pl = new Playlist
        {
            UserId = this.UserId(),
            Name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "New Playlist" : "New Playlist",
            Description = body.TryGetProperty("description", out var d) ? d.GetString() : null,
            MediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "mixed" : "mixed",
        };
        _db.Playlists.Add(pl);
        await _db.SaveChangesAsync();
        return Ok(new { pl.Id, pl.Name, status = "created" });
    }

    [HttpGet("playlists/{id}")]
    public async Task<IActionResult> GetPlaylist(string id)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        var items = await _db.PlaylistItems
            .Where(i => i.PlaylistId == id)
            .OrderBy(i => i.SortOrder).ToListAsync();
        return Ok(new
        {
            pl.Id, pl.Name, pl.Description, media_type = pl.MediaType,
            item_count = pl.ItemCount, created_at = pl.CreatedAt,
            items = items.Select(i => new
            {
                i.Id, i.MediaItemId, tmdb_id = i.TmdbId, i.Title,
                poster_url = i.PosterUrl, media_type = i.MediaType,
                sort_order = i.SortOrder, added_at = i.AddedAt
            })
        });
    }

    [HttpPut("playlists/{id}")]
    public async Task<IActionResult> UpdatePlaylist(string id, [FromBody] JsonElement body)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        if (body.TryGetProperty("name", out var n)) pl.Name = n.GetString() ?? pl.Name;
        if (body.TryGetProperty("description", out var d)) pl.Description = d.GetString();
        pl.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { status = "updated" });
    }

    [HttpDelete("playlists/{id}")]
    public async Task<IActionResult> DeletePlaylist(string id)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        var items = await _db.PlaylistItems.Where(i => i.PlaylistId == id).ToListAsync();
        _db.PlaylistItems.RemoveRange(items);
        _db.Playlists.Remove(pl);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("playlists/{id}/items")]
    public async Task<IActionResult> AddItem(string id, [FromBody] JsonElement body)
    {
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        var maxOrder = await _db.PlaylistItems.Where(i => i.PlaylistId == id).MaxAsync(i => (int?)i.SortOrder) ?? 0;
        var item = new PlaylistItem
        {
            PlaylistId = id,
            MediaItemId = body.TryGetProperty("media_item_id", out var mi) ? mi.GetString() : null,
            TmdbId = body.TryGetProperty("tmdb_id", out var ti) ? ti.GetString() : null,
            Title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            PosterUrl = body.TryGetProperty("poster_url", out var pu) ? pu.GetString() : null,
            MediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "movie" : "movie",
            SortOrder = maxOrder + 1,
        };
        _db.PlaylistItems.Add(item);
        pl.ItemCount = await _db.PlaylistItems.CountAsync(i => i.PlaylistId == id) + 1;
        pl.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { item.Id, status = "added" });
    }

    [HttpDelete("playlists/{id}/items/{itemId}")]
    public async Task<IActionResult> RemoveItem(string id, string itemId)
    {
        var item = await _db.PlaylistItems.FindAsync(itemId);
        if (item != null && item.PlaylistId == id)
        {
            _db.PlaylistItems.Remove(item);
            var pl = await _db.Playlists.FindAsync(id);
            if (pl != null)
            {
                pl.ItemCount = await _db.PlaylistItems.CountAsync(i => i.PlaylistId == id) - 1;
                pl.UpdatedAt = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }

    [HttpGet("queue")]
    public IActionResult Queue() => Ok(Array.Empty<object>());
    [HttpPost("queue/set/{id}")]
    public IActionResult QueueSet(string id) => Ok(new { status = "queued" });
    [HttpPost("play-collection")]
    public IActionResult PlayCollection() => Ok(new { status = "playing" });
    [HttpPost("play-season")]
    public IActionResult PlaySeason() => Ok(new { status = "playing" });
}

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
        // Both frontend consumers (PlaylistsManager, AddToPlaylistButton) read data.playlists.
        return Ok(new
        {
            playlists = playlists.Select(p => new
            {
                p.Id, p.Name, p.Description, media_type = p.MediaType,
                item_count = p.ItemCount, created_at = p.CreatedAt, updated_at = p.UpdatedAt
            })
        });
    }

    [HttpPost("playlists")]
    public async Task<IActionResult> CreatePlaylist(
        [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] JsonElement body,
        [FromQuery] string? name = null)
    {
        // The UI posts ?name=... with no body; JSON-body callers are also supported.
        var hasBody = body.ValueKind == JsonValueKind.Object;
        var pl = new Playlist
        {
            UserId = this.UserId(),
            Name = Str(body, hasBody, "name") ?? (string.IsNullOrWhiteSpace(name) ? "New Playlist" : name),
            Description = Str(body, hasBody, "description"),
            MediaType = Str(body, hasBody, "media_type") ?? "mixed",
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
        if (body.ValueKind != JsonValueKind.Object) return BadRequest(new { detail = "JSON object body required" });
        // tmdb_id arrives as a number from the UI (GetString() on a number threw → 500);
        // the UI also sends poster_path rather than poster_url.
        var item = new PlaylistItem
        {
            PlaylistId = id,
            MediaItemId = Str(body, true, "media_item_id"),
            TmdbId = Str(body, true, "tmdb_id"),
            Title = Str(body, true, "title") ?? "",
            PosterUrl = Str(body, true, "poster_url") ?? Str(body, true, "poster_path"),
            MediaType = Str(body, true, "media_type") ?? "movie",
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
        // Ownership check: previously any user could delete items from another user's playlist.
        var pl = await _db.Playlists.FindAsync(id);
        if (pl == null || pl.UserId != this.UserId()) return NotFound();
        var item = await _db.PlaylistItems.FindAsync(itemId);
        if (item != null && item.PlaylistId == id)
        {
            _db.PlaylistItems.Remove(item);
            pl.ItemCount = await _db.PlaylistItems.CountAsync(i => i.PlaylistId == id) - 1;
            pl.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }

    private static string? Str(JsonElement body, bool isObject, string name)
    {
        if (!isObject || !body.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }

    [HttpGet("queue")]
    public IActionResult Queue() => Ok(Array.Empty<object>());
    // The play queue is not persisted server-side (GET always returns empty),
    // so clearing it is an idempotent acknowledgement.
    [HttpDelete("queue")]
    public IActionResult ClearQueue() => Ok(new { status = "cleared" });
    [HttpPost("queue/set/{id}")]
    public IActionResult QueueSet(string id) => Ok(new { status = "queued" });
    [HttpPost("play-collection")]
    public IActionResult PlayCollection() => Ok(new { status = "playing" });
    [HttpPost("play-season")]
    public IActionResult PlaySeason() => Ok(new { status = "playing" });
}

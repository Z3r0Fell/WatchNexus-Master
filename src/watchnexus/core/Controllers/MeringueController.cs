using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Meringue — User Request System.
/// Users browse TMDB and request movies/TV shows. Admins approve or reject.
/// </summary>
[Route("api/meringue")]
[ApiController]
[Authorize]
public class MeringueController : ControllerBase
{
    private readonly AppDbContext _db;
    public MeringueController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "meringue", version = "2.8.4", status = "active", description = "Media request system: users request movies/TV shows, admins approve" });

    // ── Submit Request ──────────────────────────────────
    [HttpPost("request")]
    public async Task<IActionResult> Submit([FromBody] JsonElement body)
    {
        var uid = this.UserId();
        var tmdbId = body.TryGetProperty("tmdb_id", out var tid) && tid.ValueKind == JsonValueKind.Number ? tid.GetInt32() : 0;
        var title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
        
        if (tmdbId == 0 && string.IsNullOrWhiteSpace(title))
            return BadRequest(new { detail = "Either tmdb_id or title is required" });

        // Check for duplicate by tmdb_id or title
        MediaRequest? existing = null;
        if (tmdbId > 0)
            existing = await _db.MediaRequests
                .FirstOrDefaultAsync(r => r.TmdbId == tmdbId && r.UserId == uid && r.Status == "pending");
        else
            existing = await _db.MediaRequests
                .FirstOrDefaultAsync(r => r.Title == title && r.UserId == uid && r.Status == "pending");
        if (existing != null) return Ok(new { status = "already_requested", id = existing.Id });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == uid);
        var req = new MediaRequest
        {
            UserId = uid,
            Username = user?.Username ?? "unknown",
            TmdbId = tmdbId,
            MediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "movie" : "movie",
            Title = title,
            PosterUrl = body.TryGetProperty("poster_url", out var p) ? p.GetString() : null,
            Overview = body.TryGetProperty("overview", out var o) || body.TryGetProperty("description", out o) ? o.GetString() : null,
        };
        _db.MediaRequests.Add(req);
        await _db.SaveChangesAsync();
        return Ok(new { status = "requested", id = req.Id });
    }

    // ── My Requests ──────────────────────────────────
    [HttpGet("my-requests")]
    public async Task<IActionResult> MyRequests()
    {
        var uid = this.UserId();
        var requests = await _db.MediaRequests
            .Where(r => r.UserId == uid)
            .OrderByDescending(r => r.RequestedAt)
            .Select(r => new { r.Id, r.TmdbId, r.MediaType, r.Title, r.PosterUrl, r.Status, r.AdminNotes, r.RequestedAt, r.ReviewedAt })
            .ToListAsync();
        return Ok(requests);
    }

    // ── All Requests (admin view) ──────────────────────────────────
    [HttpGet("requests")]
    public async Task<IActionResult> AllRequests([FromQuery] string? status = null)
    {
        var query = _db.MediaRequests.AsQueryable();
        if (!string.IsNullOrEmpty(status)) query = query.Where(r => r.Status == status);
        var requests = await query
            .OrderByDescending(r => r.RequestedAt)
            .Select(r => new { r.Id, r.UserId, r.Username, r.TmdbId, r.MediaType, r.Title, r.PosterUrl, r.Overview, r.Status, r.AdminNotes, r.ReviewedBy, r.RequestedAt, r.ReviewedAt })
            .ToListAsync();
        return Ok(requests);
    }

    // ── Approve/Reject ──────────────────────────────────
    [HttpPut("requests/{id}/approve")]
    public async Task<IActionResult> Approve(string id, [FromBody] JsonElement? body = null)
    {
        var req = await _db.MediaRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (req == null) return NotFound(new { detail = "Request not found" });
        req.Status = "approved";
        req.ReviewedBy = this.UserId();
        req.ReviewedAt = DateTime.UtcNow;
        if (body.HasValue && body.Value.TryGetProperty("notes", out var n)) req.AdminNotes = n.GetString();
        await _db.SaveChangesAsync();
        return Ok(new { status = "approved", id });
    }

    [HttpPut("requests/{id}/reject")]
    public async Task<IActionResult> Reject(string id, [FromBody] JsonElement? body = null)
    {
        var req = await _db.MediaRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (req == null) return NotFound(new { detail = "Request not found" });
        req.Status = "rejected";
        req.ReviewedBy = this.UserId();
        req.ReviewedAt = DateTime.UtcNow;
        if (body.HasValue && body.Value.TryGetProperty("notes", out var n)) req.AdminNotes = n.GetString();
        await _db.SaveChangesAsync();
        return Ok(new { status = "rejected", id });
    }

    [HttpPut("requests/{id}/fulfill")]
    public async Task<IActionResult> Fulfill(string id)
    {
        var req = await _db.MediaRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (req == null) return NotFound(new { detail = "Request not found" });
        req.Status = "fulfilled";
        req.ReviewedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { status = "fulfilled", id });
    }

    [HttpDelete("requests/{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var uid = this.UserId();
        var req = await _db.MediaRequests.FirstOrDefaultAsync(r => r.Id == id && r.UserId == uid);
        if (req == null) return NotFound();
        _db.MediaRequests.Remove(req);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    // ── Stats ──────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var total = await _db.MediaRequests.CountAsync();
        var pending = await _db.MediaRequests.CountAsync(r => r.Status == "pending");
        var approved = await _db.MediaRequests.CountAsync(r => r.Status == "approved");
        var rejected = await _db.MediaRequests.CountAsync(r => r.Status == "rejected");
        var fulfilled = await _db.MediaRequests.CountAsync(r => r.Status == "fulfilled");
        return Ok(new { total, pending, approved, rejected, fulfilled });
    }
}

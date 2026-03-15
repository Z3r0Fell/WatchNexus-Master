using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Bot status controller — exposes data from the BotBackgroundService.
/// Provides: inactivity reports, featured film, token drip status.
/// </summary>
// ── Yeast (Background Automation) ───────────────────────────
[Route("api/gadgets/bot")]
[ApiController]
[Authorize]
public class BotController : ControllerBase
{
    private readonly AppDbContext _db;
    public BotController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status()
    {
        return Ok(new
        {
            service = "BotBackgroundService",
            status = "running",
            features = new[]
            {
                new { id = "inactivity_check", name = "Room Inactivity Monitor", interval = "30 min" },
                new { id = "token_drip", name = "Registration Token Drip", interval = "30 min" },
                new { id = "featured_film", name = "Featured Film Rotation", interval = "30 min" },
            }
        });
    }

    [HttpGet("inactive-rooms")]
    public async Task<IActionResult> InactiveRooms()
    {
        var report = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == $"bot_inactive_rooms:{this.UserId()}");
        if (report?.Value == null) return Ok(new { checked_at = (string?)null, inactive_rooms = Array.Empty<string>() });
        return Content(report.Value, "application/json");
    }

    [HttpGet("featured-film")]
    public async Task<IActionResult> FeaturedFilm()
    {
        var report = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == $"bot_featured_film:{this.UserId()}");
        if (report?.Value == null) return Ok(new { selected_at = (string?)null, message = "No featured film yet. Configure Jellyfin and enable featured film rotation." });
        return Content(report.Value, "application/json");
    }

    [HttpPost("featured-film/refresh")]
    public IActionResult RefreshFeaturedFilm()
    {
        // The background service will pick this up on next iteration
        return Ok(new { status = "queued", message = "Featured film will be refreshed on next background cycle (up to 30 min)" });
    }
}

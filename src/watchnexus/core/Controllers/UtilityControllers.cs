using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── User Preferences ──────────────────────────────────
[Route("api/user")]
[ApiController]
[Authorize]
public class UserPreferencesController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserPreferencesController(AppDbContext db) => _db = db;

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
        var prefs = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == "user_preferences");
        if (prefs?.Value != null)
        {
            try { return Content(prefs.Value, "application/json"); }
            catch { }
        }
        return Ok(new { visible_tabs = Array.Empty<string>() });
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "user_preferences");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting
        { Key = "user_preferences", Value = body.GetRawText(), UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

// ── Kodi ──────────────────────────────────
[Route("api/kodi")]
[ApiController]
[Authorize]
public class KodiController : ControllerBase
{
    [HttpGet("addons")]
    public IActionResult Addons() => Ok(Array.Empty<object>());
    [HttpGet("addons/popular")]
    public IActionResult Popular() => Ok(Array.Empty<object>());
    [HttpGet("categories")]
    public IActionResult Categories() => Ok(Array.Empty<object>());
    [HttpGet("refresh")]
    public IActionResult Refresh() => Ok(new { status = "refreshed" });
}

// ── Zest (Log/Health viewer) ──────────────────────────────────
[Route("api/zest")]
[ApiController]
[Authorize]
public class ZestController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "healthy" });
    [HttpGet("stats")]
    public IActionResult Stats() => Ok(new { protected_files = 0, last_scan = (string?)null });
    [HttpGet("logs")]
    public IActionResult Logs() => Ok(Array.Empty<object>());
    [HttpPost("logs/clear")]
    public IActionResult ClearLogs() => Ok(new { status = "cleared" });
}

// ── Adapter (FFmpeg) ──────────────────────────────────
[Route("api/adapter")]
[ApiController]
[Authorize]
public class AdapterController : ControllerBase
{
    [HttpPost("convert")]
    public IActionResult Convert() => Ok(new { status = "not_implemented", message = "FFmpeg required" });
}

using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Rind — Parental Controls.
/// Content rating filters, PIN-lock profiles, per-user restrictions, and library access controls.
/// </summary>
[Route("api/rind")]
[ApiController]
[Authorize]
public class RindController : ControllerBase
{
    private readonly AppDbContext _db;
    public RindController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "rind", version = "2.9.0", status = "active", description = "Parental controls: content rating filters, PIN locks, and per-user restrictions" });

    private const string ProfileKey = "rind_profile";
    private const string PinKey = "rind_pin";

    // ── Get Profile ──────────────────────────────────
    // Frontend alias
    [HttpGet("profiles")]
    public Task<IActionResult> GetProfiles() => GetProfile();

    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ProfileKey);
        if (setting == null)
            return Ok(new
            {
                configured = false,
                max_rating = "NR",
                pin_enabled = false,
                restricted_genres = Array.Empty<string>(),
                allowed_libraries = Array.Empty<string>(),
                hide_unrated = false,
            });
        try
        {
            var doc = JsonDocument.Parse(setting.Value);
            return Ok(doc.RootElement);
        }
        catch { return Ok(new { configured = false }); }
    }

    // ── Save Profile ──────────────────────────────────
    [HttpPut("profile")]
    public async Task<IActionResult> SaveProfile([FromBody] JsonElement body)
    {
        var uid = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ProfileKey);
        var value = body.GetRawText();
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = ProfileKey, Value = value, UserId = uid });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    // ── PIN Management ──────────────────────────────────
    [HttpPost("pin/set")]
    public async Task<IActionResult> SetPin([FromBody] JsonElement body)
    {
        var pin = body.TryGetProperty("pin", out var p) ? p.GetString() : null;
        if (string.IsNullOrEmpty(pin) || pin.Length < 4) return BadRequest(new { detail = "PIN must be at least 4 characters" });
        var uid = this.UserId();
        var hashed = BCrypt.Net.BCrypt.HashPassword(pin);
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
        if (existing != null) existing.Value = hashed;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = PinKey, Value = hashed, UserId = uid });
        await _db.SaveChangesAsync();
        return Ok(new { status = "pin_set" });
    }

    [HttpPost("pin/verify")]
    public async Task<IActionResult> VerifyPin([FromBody] JsonElement body)
    {
        var pin = body.TryGetProperty("pin", out var p) ? p.GetString() : null;
        if (string.IsNullOrEmpty(pin)) return BadRequest(new { detail = "PIN required" });
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
        if (setting == null) return Ok(new { valid = true, message = "No PIN set" });
        var valid = BCrypt.Net.BCrypt.Verify(pin, setting.Value);
        return Ok(new { valid });
    }

    [HttpDelete("pin")]
    public async Task<IActionResult> RemovePin()
    {
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
        if (setting != null) { _db.Settings.Remove(setting); await _db.SaveChangesAsync(); }
        return Ok(new { status = "pin_removed" });
    }

    // ── Content Ratings Reference ──────────────────────────────────
    [HttpGet("ratings")]
    public IActionResult Ratings() => Ok(new[]
    {
        new { code = "G", label = "General Audiences", description = "All ages admitted", order = 1 },
        new { code = "PG", label = "Parental Guidance", description = "Some material may not be suitable for children", order = 2 },
        new { code = "PG-13", label = "Parents Strongly Cautioned", description = "Some material may be inappropriate for children under 13", order = 3 },
        new { code = "R", label = "Restricted", description = "Under 17 requires accompanying parent or adult guardian", order = 4 },
        new { code = "NC-17", label = "Adults Only", description = "No one 17 and under admitted", order = 5 },
        new { code = "NR", label = "Not Rated", description = "Content has not been rated", order = 6 },
    });

    // ── Check Content Access (used by other controllers) ──────────────────────────────────
    [HttpGet("check")]
    public async Task<IActionResult> CheckAccess([FromQuery] string? rating = null, [FromQuery] string? genre = null, [FromQuery] string? library_id = null)
    {
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ProfileKey);
        if (setting == null) return Ok(new { allowed = true, reason = "No restrictions configured" });

        var doc = JsonDocument.Parse(setting.Value).RootElement;
        var maxRating = doc.TryGetProperty("max_rating", out var mr) ? mr.GetString() ?? "NR" : "NR";
        var ratingOrder = new Dictionary<string, int> { ["G"] = 1, ["PG"] = 2, ["PG-13"] = 3, ["R"] = 4, ["NC-17"] = 5, ["NR"] = 6 };

        if (!string.IsNullOrEmpty(rating) && ratingOrder.ContainsKey(rating) && ratingOrder.ContainsKey(maxRating))
        {
            if (ratingOrder[rating] > ratingOrder[maxRating])
                return Ok(new { allowed = false, reason = $"Content rated {rating} exceeds maximum allowed {maxRating}" });
        }

        if (!string.IsNullOrEmpty(genre) && doc.TryGetProperty("restricted_genres", out var rg))
        {
            var restricted = rg.EnumerateArray().Select(x => x.GetString()?.ToLower()).ToList();
            if (restricted.Contains(genre.ToLower()))
                return Ok(new { allowed = false, reason = $"Genre '{genre}' is restricted" });
        }

        if (!string.IsNullOrEmpty(library_id) && doc.TryGetProperty("allowed_libraries", out var al))
        {
            var allowed = al.EnumerateArray().Select(x => x.GetString()).ToList();
            if (allowed.Count > 0 && !allowed.Contains(library_id))
                return Ok(new { allowed = false, reason = "Library access restricted" });
        }

        return Ok(new { allowed = true });
    }

    // ── Admin: Manage User Profiles ──────────────────────────────────
    [HttpGet("admin/profiles")]
    public async Task<IActionResult> AdminProfiles()
    {
        var profiles = await _db.Settings
            .Where(s => s.Key == ProfileKey)
            .ToListAsync();
        var result = profiles.Select(p =>
        {
            try
            {
                var doc = JsonDocument.Parse(p.Value);
                return new { user_id = p.UserId, profile = (object)doc.RootElement.ToString() };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(result);
    }

    [HttpPut("admin/profiles/{userId}")]
    public async Task<IActionResult> AdminSetProfile(string userId, [FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == ProfileKey);
        var value = body.GetRawText();
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = ProfileKey, Value = value, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", user_id = userId });
    }
}

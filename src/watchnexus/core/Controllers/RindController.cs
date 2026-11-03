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
    public IActionResult Status() => Ok(new { module = "rind", version = "1.0.1", status = "active", description = "Parental controls: content rating filters, PIN locks, and per-user restrictions" });

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
        var pinSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
        var pinEnabled = pinSetting != null;
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ProfileKey);
        if (setting == null)
            return Ok(new
            {
                configured = false,
                max_rating = "NR",
                pin_enabled = pinEnabled,
                restricted_genres = Array.Empty<string>(),
                allowed_libraries = Array.Empty<string>(),
                hide_unrated = false,
            });
        try
        {
            // Never expose a PIN (legacy rows may still contain a plaintext
            // "pin" field saved before the strip-in-SaveProfile fix). Drop it.
            var doc = JsonDocument.Parse(setting.Value).RootElement;
            var profile = new Dictionary<string, object?>
            {
                ["configured"] = true,
                ["pin_enabled"] = pinEnabled,
            };
            foreach (var prop in doc.EnumerateObject())
            {
                if (string.Equals(prop.Name, "pin", StringComparison.OrdinalIgnoreCase)) continue;
                profile[prop.Name] = prop.Value.ValueKind switch
                {
                    JsonValueKind.String => prop.Value.GetString(),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Number => prop.Value.TryGetInt64(out var l) ? (object)l : prop.Value.GetDouble(),
                    _ => prop.Value.GetRawText(),
                };
            }
            return Ok(profile);
        }
        catch { return Ok(new { configured = false, pin_enabled = pinEnabled }); }
    }

    // ── Save Profile ──────────────────────────────────
    [HttpPut("profile")]
    public async Task<IActionResult> SaveProfile([FromBody] JsonElement body)
    {
        var uid = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == ProfileKey);

        // Strip any "pin" from the stored profile — the PIN lives only in the
        // BCrypt-hashed /pin/set row, never in the profile JSON.
        string? pinToHash = null;
        var clean = new Dictionary<string, JsonElement>();
        foreach (var prop in body.EnumerateObject())
        {
            if (string.Equals(prop.Name, "pin", StringComparison.OrdinalIgnoreCase))
            {
                pinToHash = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : null;
                continue;
            }
            if (string.Equals(prop.Name, "current_pin", StringComparison.OrdinalIgnoreCase)) continue;
            clean[prop.Name] = prop.Value.Clone();
        }
        var value = JsonSerializer.Serialize(clean);
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = ProfileKey, Value = value, UserId = uid });

        // Hash the PIN through the dedicated path (BCrypt), never plaintext.
        if (!string.IsNullOrEmpty(pinToHash))
        {
            if (pinToHash.Length < 4)
                return BadRequest(new { detail = "PIN must be at least 4 characters" });
            var pinSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
            // Replacing an existing PIN requires the current one (re-typing the
            // same PIN is a no-op and allowed).
            if (pinSetting != null && !SafeVerify(pinToHash, pinSetting.Value) && !CurrentPinMatches(body, pinSetting.Value))
                return StatusCode(403, new { detail = "Current PIN is incorrect" });
            var hashed = BCrypt.Net.BCrypt.HashPassword(pinToHash);
            if (pinSetting != null) pinSetting.Value = hashed;
            else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = PinKey, Value = hashed, UserId = uid });
        }

        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    // ── PIN Management ──────────────────────────────────
    [HttpPost("pin/set")]
    public async Task<IActionResult> SetPin([FromBody] JsonElement body)
    {
        var pin = body.TryGetProperty("pin", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
        if (string.IsNullOrEmpty(pin) || pin.Length < 4) return BadRequest(new { detail = "PIN must be at least 4 characters" });
        var uid = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
        // Changing an existing PIN requires the current one, otherwise the PIN
        // protects nothing.
        if (existing != null && !CurrentPinMatches(body, existing.Value))
            return StatusCode(403, new { detail = "Current PIN is incorrect" });
        var hashed = BCrypt.Net.BCrypt.HashPassword(pin);
        if (existing != null) existing.Value = hashed;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = PinKey, Value = hashed, UserId = uid });
        await _db.SaveChangesAsync();
        return Ok(new { status = "pin_set" });
    }

    [HttpPost("pin/verify")]
    public async Task<IActionResult> VerifyPin([FromBody] JsonElement body)
    {
        var pin = body.TryGetProperty("pin", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
        if (string.IsNullOrEmpty(pin)) return BadRequest(new { detail = "PIN required" });
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
        if (setting == null) return Ok(new { valid = true, message = "No PIN set" });
        var valid = SafeVerify(pin, setting.Value);
        return Ok(new { valid });
    }

    private static bool SafeVerify(string pin, string? hash)
    {
        try { return !string.IsNullOrEmpty(hash) && BCrypt.Net.BCrypt.Verify(pin, hash); }
        catch (BCrypt.Net.SaltParseException) { return false; }
    }

    private static bool CurrentPinMatches(JsonElement body, string? hash)
    {
        var current = body.TryGetProperty("current_pin", out var cp) && cp.ValueKind == JsonValueKind.String ? cp.GetString() : null;
        return !string.IsNullOrEmpty(current) && SafeVerify(current, hash);
    }

    [HttpDelete("pin")]
    public async Task<IActionResult> RemovePin([FromQuery] string? current_pin = null)
    {
        var uid = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == PinKey);
        if (setting != null)
        {
            if (string.IsNullOrEmpty(current_pin) || !SafeVerify(current_pin, setting.Value))
                return StatusCode(403, new { detail = "Current PIN is incorrect" });
            _db.Settings.Remove(setting);
            await _db.SaveChangesAsync();
        }
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

        JsonElement doc;
        try { doc = JsonDocument.Parse(setting.Value).RootElement; }
        catch (JsonException) { return Ok(new { allowed = true, reason = "No restrictions configured" }); }
        var maxRating = doc.TryGetProperty("max_rating", out var mr) && mr.ValueKind == JsonValueKind.String ? mr.GetString() ?? "NR" : "NR";
        var ratingOrder = new Dictionary<string, int> { ["G"] = 1, ["PG"] = 2, ["PG-13"] = 3, ["R"] = 4, ["NC-17"] = 5, ["NR"] = 6 };

        if (!string.IsNullOrEmpty(rating) && ratingOrder.ContainsKey(rating) && ratingOrder.ContainsKey(maxRating))
        {
            if (ratingOrder[rating] > ratingOrder[maxRating])
                return Ok(new { allowed = false, reason = $"Content rated {rating} exceeds maximum allowed {maxRating}" });
        }

        // The UI stores "blocked_genres"; older rows use "restricted_genres".
        if (!string.IsNullOrEmpty(genre) &&
            ((doc.TryGetProperty("restricted_genres", out var rg) && rg.ValueKind == JsonValueKind.Array) ||
             (doc.TryGetProperty("blocked_genres", out rg) && rg.ValueKind == JsonValueKind.Array)))
        {
            var restricted = rg.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()?.ToLower()).ToList();
            if (restricted.Contains(genre.ToLower()))
                return Ok(new { allowed = false, reason = $"Genre '{genre}' is restricted" });
        }

        if (!string.IsNullOrEmpty(library_id) && doc.TryGetProperty("allowed_libraries", out var al) && al.ValueKind == JsonValueKind.Array)
        {
            var allowed = al.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()).ToList();
            if (allowed.Count > 0 && !allowed.Contains(library_id))
                return Ok(new { allowed = false, reason = "Library access restricted" });
        }

        return Ok(new { allowed = true });
    }

    // ── Admin: Manage User Profiles ──────────────────────────────────
    [HttpGet("admin/profiles")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminProfiles()
    {
        var profiles = await _db.Settings
            .Where(s => s.Key == ProfileKey)
            .ToListAsync();
        var result = profiles.Select(p =>
        {
            try
            {
                var doc = JsonDocument.Parse(p.Value).RootElement;
                // Strip any legacy plaintext "pin" before it leaves the server.
                var clean = new Dictionary<string, JsonElement>();
                foreach (var prop in doc.EnumerateObject())
                {
                    if (string.Equals(prop.Name, "pin", StringComparison.OrdinalIgnoreCase)) continue;
                    clean[prop.Name] = prop.Value.Clone();
                }
                return new { user_id = p.UserId, profile = JsonSerializer.Serialize(clean) };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(result);
    }

    [HttpPut("admin/profiles/{userId}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminSetProfile(string userId, [FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == ProfileKey);
        // Strip any PIN from the stored profile (admin-typed PINs must go
        // through the BCrypt path, not the profile JSON).
        var clean = new Dictionary<string, JsonElement>();
        foreach (var prop in body.EnumerateObject())
        {
            if (string.Equals(prop.Name, "pin", StringComparison.OrdinalIgnoreCase)) continue;
            clean[prop.Name] = prop.Value.Clone();
        }
        var value = JsonSerializer.Serialize(clean);
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = ProfileKey, Value = value, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", user_id = userId });
    }
}

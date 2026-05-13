using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Security.Cryptography;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// CELLAR — License Tier Management & Activation
// Manages Standard/Pro/Ultra licensing via serial number activation.
// ══════════════════════════════════════════════════════════════════════
[Route("api/cellar")]
[ApiController]
[Authorize]
public class CellarController : ControllerBase
{
    private readonly AppDbContext _db;
    public CellarController(AppDbContext db) => _db = db;

    // ── Tier Definitions ────────────────────────────────────────────
    private static readonly Dictionary<string, string[]> TierModules = new()
    {
        ["standard"] = new[]
        {
            "core", "auth", "users", "settings", "setup", "dashboard", "preferences", "logs", "system",
            "marmalade", "tmdb", "libraries", "watchlist", "watch-progress", "playlists", "filesystem",
            "quality-profiles", "indexers", "media-ops", "downloads", "next-up",
            "milk", "gelatin", "churro", "roux", "glaze",
            "sorbet", "brioche", "nectar", "ganache", "bisque"
        },
        ["pro"] = new[]
        {
            "compote", "fondue", "saffron", "sourdough", "bastion", "truffle", "tunnel",
            "sprout", "drizzle", "meringue", "nutmeg",
            "streaming-logins", "streaming-services", "iptv"
        },
        ["ultra"] = new[]
        {
            "security", "rind", "pepper", "crucible", "strudel", "crumbs", "taffy",
            "cinnamon", "waffle", "custard", "yeast", "brine", "ladle",
            "watch-party", "vpn", "qbittorrent", "subtitles", "pretzel", "parfait", "menu"
        }
    };

    private static readonly Dictionary<string, object> TierInfo = new()
    {
        ["standard"] = new { name = "Standard", color = "#6B7280", description = "Core media server with essential features", module_count = TierModules["standard"].Length },
        ["pro"] = new { name = "Pro", color = "#3B82F6", description = "Advanced automation, analytics, and network tools", module_count = TierModules["pro"].Length },
        ["ultra"] = new { name = "Ultra", color = "#8B5CF6", description = "Full suite: security, processing, integrations, and all gadgets", module_count = TierModules["ultra"].Length }
    };

    // ── Get Current License Status ──────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (setting?.Value == null)
            return Ok(new
            {
                tier = "standard",
                tier_name = "Standard",
                activated = false,
                serial = (string?)null,
                activated_at = (string?)null,
                modules_unlocked = TierModules["standard"],
                total_modules = TierModules["standard"].Length
            });

        try
        {
            var license = JsonDocument.Parse(setting.Value).RootElement;
            var tier = license.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
            var serial = license.TryGetProperty("serial", out var s) ? s.GetString() : null;
            var activatedAt = license.TryGetProperty("activated_at", out var a) ? a.GetString() : null;

            // Compute unlocked modules based on tier
            var unlockedModules = GetUnlockedModules(tier);

            return Ok(new
            {
                tier,
                tier_name = tier switch { "pro" => "Pro", "ultra" => "Ultra", _ => "Standard" },
                activated = tier != "standard",
                serial = MaskSerial(serial),
                activated_at = activatedAt,
                modules_unlocked = unlockedModules,
                total_modules = unlockedModules.Length
            });
        }
        catch
        {
            return Ok(new { tier = "standard", tier_name = "Standard", activated = false, serial = (string?)null, activated_at = (string?)null, modules_unlocked = TierModules["standard"], total_modules = TierModules["standard"].Length });
        }
    }

    // ── Activate Serial Number ──────────────────────────────────────
    [HttpPost("activate")]
    public async Task<IActionResult> Activate([FromBody] JsonElement body)
    {
        var serial = body.TryGetProperty("serial", out var s) ? s.GetString()?.Trim().ToUpperInvariant() : null;
        if (string.IsNullOrEmpty(serial))
            return BadRequest(new { success = false, message = "Serial number is required" });

        // Validate serial format: WNX-PRO-XXXX-XXXX-XXXX or WNX-ULT-XXXX-XXXX-XXXX
        var tier = ValidateSerial(serial);
        if (tier == null)
            return BadRequest(new { success = false, message = "Invalid serial number format. Expected: WNX-PRO-XXXX-XXXX-XXXX or WNX-ULT-XXXX-XXXX-XXXX" });

        // Store license
        var licenseData = JsonSerializer.Serialize(new
        {
            tier,
            serial,
            activated_at = DateTime.UtcNow.ToString("o"),
            activated_by = this.UserId(),
            machine_id = Environment.MachineName,
            hash = ComputeHash(serial)
        });

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (existing != null)
            existing.Value = licenseData;
        else
            _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseData });

        await _db.SaveChangesAsync();

        var unlockedModules = GetUnlockedModules(tier);
        return Ok(new
        {
            success = true,
            tier,
            tier_name = tier switch { "pro" => "Pro", "ultra" => "Ultra", _ => "Standard" },
            message = $"License activated! Welcome to WatchNexus {(tier == "pro" ? "Pro" : "Ultra")}.",
            modules_unlocked = unlockedModules,
            total_modules = unlockedModules.Length
        });
    }

    // ── Deactivate License ──────────────────────────────────────────
    [HttpPost("deactivate")]
    public async Task<IActionResult> Deactivate()
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (existing != null)
        {
            _db.Settings.Remove(existing);
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            success = true,
            tier = "standard",
            tier_name = "Standard",
            message = "License deactivated. Reverted to Standard tier.",
            modules_unlocked = TierModules["standard"],
            total_modules = TierModules["standard"].Length
        });
    }

    // ── Get Tier Manifest ───────────────────────────────────────────
    [HttpGet("tiers")]
    public IActionResult GetTiers()
    {
        return Ok(new
        {
            tiers = new
            {
                standard = new
                {
                    name = "Standard",
                    color = "#6B7280",
                    description = "Core media server with essential features",
                    modules = TierModules["standard"],
                    module_count = TierModules["standard"].Length
                },
                pro = new
                {
                    name = "Pro",
                    color = "#3B82F6",
                    description = "Advanced automation, analytics, and network tools",
                    includes_standard = true,
                    modules = TierModules["pro"],
                    module_count = TierModules["pro"].Length
                },
                ultra = new
                {
                    name = "Ultra",
                    color = "#8B5CF6",
                    description = "Full suite: security, processing, integrations, and all gadgets",
                    includes_standard = true,
                    includes_pro = true,
                    modules = TierModules["ultra"],
                    module_count = TierModules["ultra"].Length
                }
            },
            total_modules = TierModules["standard"].Length + TierModules["pro"].Length + TierModules["ultra"].Length
        });
    }

    // ── Check if a specific module is unlocked ──────────────────────
    [HttpGet("check/{moduleName}")]
    public async Task<IActionResult> CheckModule(string moduleName)
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        var tier = "standard";
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value).RootElement;
                tier = doc.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
            }
            catch { }
        }

        var unlocked = GetUnlockedModules(tier);
        var isUnlocked = unlocked.Contains(moduleName.ToLower());
        var requiredTier = "standard";
        if (TierModules["pro"].Contains(moduleName.ToLower())) requiredTier = "pro";
        else if (TierModules["ultra"].Contains(moduleName.ToLower())) requiredTier = "ultra";

        return Ok(new
        {
            module = moduleName,
            unlocked = isUnlocked,
            current_tier = tier,
            required_tier = requiredTier
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    private static string? ValidateSerial(string serial)
    {
        // Format: WNX-PRO-XXXX-XXXX-XXXX or WNX-ULT-XXXX-XXXX-XXXX
        if (serial.Length < 19) return null;
        var parts = serial.Split('-');
        if (parts.Length != 5) return null;
        if (parts[0] != "WNX") return null;
        if (parts[1] != "PRO" && parts[1] != "ULT") return null;
        // Validate segments are alphanumeric, 4 chars each
        for (int i = 2; i < 5; i++)
            if (parts[i].Length != 4 || !parts[i].All(c => char.IsLetterOrDigit(c)))
                return null;

        return parts[1] == "PRO" ? "pro" : "ultra";
    }

    private static string[] GetUnlockedModules(string tier)
    {
        var modules = new List<string>(TierModules["standard"]);
        if (tier == "pro" || tier == "ultra")
            modules.AddRange(TierModules["pro"]);
        if (tier == "ultra")
            modules.AddRange(TierModules["ultra"]);
        return modules.ToArray();
    }

    private static string? MaskSerial(string? serial)
    {
        if (string.IsNullOrEmpty(serial) || serial.Length < 12) return serial;
        // Show first 8 and last 4: WNX-PRO-****-****-XXXX
        return serial[..8] + "-****-****-" + serial[^4..];
    }

    private static string ComputeHash(string serial)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(serial + "WatchNexus-Cellar-Salt-2026");
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash)[..16].ToLower();
    }
}

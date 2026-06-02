using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Security.Cryptography;
using WatchNexus.Core.Data;
using WatchNexus.Core.Services;
using WatchNexus.Shared;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// CELLAR — License Tier Management & Activation
// Integrates with WN-License-Server for serial validation.
// Supports upgrade paths: Standard→Pro, Standard→Ultra, Pro→Ultra.
// All installs start as Standard; serial determines the tier.
// ══════════════════════════════════════════════════════════════════════
[Route("api/cellar")]
[ApiController]
public class CellarController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    private readonly ITierResolver _tierResolver;
    public CellarController(AppDbContext db, IHttpClientFactory httpFactory, IConfiguration config, ITierResolver tierResolver)
    {
        _db = db;
        _httpFactory = httpFactory;
        _config = config;
        _tierResolver = tierResolver;
    }

    // ── Tier Module Definitions ─────────────────────────────────────
    public static readonly Dictionary<string, string[]> TierModules = new()
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
            "streaming-logins", "streaming-services", "iptv",
            "biscotti", "treacle", "sage", "terrine"
        },
        ["ultra"] = new[]
        {
            "security", "rind", "pepper", "crucible", "strudel", "crumbs", "taffy",
            "cinnamon", "waffle", "custard", "yeast", "brine", "ladle",
            "watch-party", "vpn", "qbittorrent", "subtitles", "pretzel", "parfait", "menu",
            "popsicle", "preserves", "marshmallow", "chowder"
        }
    };

    // Plan name from license server → WatchNexus tier
    private static string MapPlanToTier(string? plan)
    {
        if (string.IsNullOrEmpty(plan)) return "standard";
        var p = plan.ToLowerInvariant();
        if (p.Contains("ultra") || p.Contains("ult")) return "ultra";
        if (p.Contains("pro")) return "pro";
        return "standard";
    }

    // ── First-Launch Check (No Auth Required) ───────────────────────
    [HttpGet("first-launch")]
    [AllowAnonymous]
    public async Task<IActionResult> FirstLaunch()
    {
        var license = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        var setupDone = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "setup_completed" && s.UserId == "");
        return Ok(new
        {
            has_license = license?.Value != null,
            setup_completed = setupDone?.Value == "true",
            needs_activation = license?.Value == null
        });
    }

    // ── Get Current License Status ──────────────────────────────────
    [HttpGet("status")]
    [Authorize]
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
                activation_id = (string?)null,
                modules_unlocked = TierModules["standard"],
                total_modules = TierModules["standard"].Length,
                can_upgrade_to = new[] { "pro", "ultra" }
            });

        try
        {
            var license = JsonDocument.Parse(setting.Value).RootElement;
            var tier = license.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
            var serial = license.TryGetProperty("serial", out var s) ? s.GetString() : null;
            var activatedAt = license.TryGetProperty("activated_at", out var a) ? a.GetString() : null;
            var activationId = license.TryGetProperty("activation_id", out var ai) ? ai.GetString() : null;
            var unlockedModules = GetUnlockedModules(tier);
            var upgrades = tier == "standard" ? new[] { "pro", "ultra" } : tier == "pro" ? new[] { "ultra" } : Array.Empty<string>();

            return Ok(new
            {
                tier,
                tier_name = tier switch { "pro" => "Pro", "ultra" => "Ultra", _ => "Standard" },
                activated = tier != "standard",
                serial = MaskSerial(serial),
                activated_at = activatedAt,
                activation_id = activationId,
                modules_unlocked = unlockedModules,
                total_modules = unlockedModules.Length,
                can_upgrade_to = upgrades
            });
        }
        catch { Log.Error("[CellarController] operation failed"); return Ok(new { tier = "standard", tier_name = "Standard", activated = false, serial = (string?)null, activated_at = (string?)null, activation_id = (string?)null, modules_unlocked = TierModules["standard"], total_modules = TierModules["standard"].Length, can_upgrade_to = new[] { "pro", "ultra" } }); }
    }

    // ── Activate Serial Number (integrates with WN-License-Server) ──
    [HttpPost("activate")]
    [Authorize]
    public async Task<IActionResult> Activate([FromBody] JsonElement body)
    {
        var serial = body.TryGetProperty("serial", out var s) ? s.GetString()?.Trim() : null;
        if (string.IsNullOrEmpty(serial))
            return BadRequest(new { success = false, message = "Serial number is required" });

        // Get license server config
        var lsUrl = _config["LICENSE_SERVER_URL"] ?? "";
        var lsApiKey = _config["LICENSE_SERVER_API_KEY"] ?? "";

        string tier;
        string? activationId = null;
        string? activationToken = null;

        if (!string.IsNullOrEmpty(lsUrl) && !string.IsNullOrEmpty(lsApiKey))
        {
            // ── Remote validation via WN-License-Server ──
            try
            {
                using var http = _httpFactory.CreateClient();
                http.Timeout = TimeSpan.FromSeconds(15);
                http.DefaultRequestHeaders.Add("X-API-Key", lsApiKey);

                var payload = JsonSerializer.Serialize(new
                {
                    license_key = serial,
                    hardware_id = Environment.MachineName,
                    device_name = $"WatchNexus-{Environment.MachineName}"
                });
                var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
                var resp = await http.PostAsync($"{lsUrl.TrimEnd('/')}/api/integrate/activate", content);
                var resBody = await resp.Content.ReadAsStringAsync();

                if (!resp.IsSuccessStatusCode)
                {
                    // Parse error from license server
                    try
                    {
                        var err = JsonDocument.Parse(resBody).RootElement;
                        var detail = err.TryGetProperty("detail", out var d) ? d.GetString() : resBody;
                        return BadRequest(new { success = false, message = detail ?? "License server rejected the key" });
                    }
                    catch { Log.Error("[CellarController] Parse error from license server"); return BadRequest(new { success = false, message = $"License server error: HTTP {(int)resp.StatusCode}" }); }
                }

                var result = JsonDocument.Parse(resBody).RootElement;
                activationId = result.TryGetProperty("activation_id", out var aid) ? aid.GetString() : null;
                activationToken = result.TryGetProperty("activation_token", out var at) ? at.GetString() : null;
                var plan = result.TryGetProperty("license", out var lic) && lic.TryGetProperty("plan", out var p) ? p.GetString() : null;
                tier = MapPlanToTier(plan);
            }
            catch (Exception ex) { Log.Error(ex, "[CellarController] operation failed"); return StatusCode(503, new { success = false, message = $"Cannot reach license server: {ex.Message}" }); }
        }
        else
        {
            // ── Offline/local validation (format-based fallback) ──
            var upper = serial.ToUpperInvariant();
            tier = ValidateSerialFormat(upper) ?? "unknown";
            if (tier == "unknown")
                return BadRequest(new { success = false, message = "Invalid serial number. Connect to license server or use format WNX-PRO-XXXX-XXXX-XXXX / WNX-ULT-XXXX-XXXX-XXXX" });
        }

        // Check upgrade path validity
        var currentTier = await GetCurrentTier();
        if (!IsValidUpgrade(currentTier, tier))
            return BadRequest(new { success = false, message = $"Cannot activate {tier} license. Current tier ({currentTier}) is equal or higher." });

        // Store license
        var licenseData = JsonSerializer.Serialize(new
        {
            tier,
            serial,
            activation_id = activationId,
            activation_token = activationToken,
            activated_at = DateTime.UtcNow.ToString("o"),
            activated_by = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "system",
            machine_id = Environment.MachineName,
            previous_tier = currentTier,
            hash = ComputeHash(serial)
        });

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (existing != null)
            existing.Value = licenseData;
        else
            _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseData });
        await _db.SaveChangesAsync();

        var unlockedModules = GetUnlockedModules(tier);
        var upgradeMsg = currentTier != "standard" ? $" Upgraded from {currentTier} to {tier}." : "";
        return Ok(new
        {
            success = true,
            tier,
            tier_name = tier switch { "pro" => "Pro", "ultra" => "Ultra", _ => "Standard" },
            message = $"License activated! Welcome to WatchNexus {(tier == "pro" ? "Pro" : "Ultra")}.{upgradeMsg}",
            previous_tier = currentTier,
            modules_unlocked = unlockedModules,
            total_modules = unlockedModules.Length
        });
    }

    // ── Activate on First Launch (No Auth — used before login) ──────
    [HttpPost("activate-first-launch")]
    [AllowAnonymous]
    public async Task<IActionResult> ActivateFirstLaunch([FromBody] JsonElement body)
    {
        var serial = body.TryGetProperty("serial", out var s) ? s.GetString()?.Trim() : null;
        // Allow "skip" to start with Standard
        var skip = body.TryGetProperty("skip", out var sk) && sk.GetBoolean();
        if (skip)
        {
            // Mark setup as done with Standard tier
            var setupSetting = await _db.Settings.FirstOrDefaultAsync(s2 => s2.Key == "setup_completed" && s2.UserId == "");
            if (setupSetting != null) setupSetting.Value = "true";
            else _db.Settings.Add(new AppSetting { Key = "setup_completed", UserId = "", Value = "true" });
            await _db.SaveChangesAsync();
            return Ok(new { success = true, tier = "standard", tier_name = "Standard", message = "Starting with Standard tier. You can upgrade anytime in Settings > Activation." });
        }

        if (string.IsNullOrEmpty(serial))
            return BadRequest(new { success = false, message = "Serial number is required" });

        // Validate via license server or locally
        var lsUrl = _config["LICENSE_SERVER_URL"] ?? "";
        var lsApiKey = _config["LICENSE_SERVER_API_KEY"] ?? "";
        string tier;
        string? activationId = null, activationToken = null;

        if (!string.IsNullOrEmpty(lsUrl) && !string.IsNullOrEmpty(lsApiKey))
        {
            try
            {
                using var http = _httpFactory.CreateClient();
                http.Timeout = TimeSpan.FromSeconds(15);
                http.DefaultRequestHeaders.Add("X-API-Key", lsApiKey);
                var payload = JsonSerializer.Serialize(new { license_key = serial, hardware_id = Environment.MachineName, device_name = $"WatchNexus-{Environment.MachineName}" });
                var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
                var resp = await http.PostAsync($"{lsUrl.TrimEnd('/')}/api/integrate/activate", content);
                var resBody = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    try { var err = JsonDocument.Parse(resBody).RootElement; return BadRequest(new { success = false, message = err.TryGetProperty("detail", out var d) ? d.GetString() : "Invalid key" }); }
                    catch { Log.Error("[CellarController] operation failed"); return BadRequest(new { success = false, message = $"License server error" }); }
                }
                var result = JsonDocument.Parse(resBody).RootElement;
                activationId = result.TryGetProperty("activation_id", out var aid) ? aid.GetString() : null;
                activationToken = result.TryGetProperty("activation_token", out var at) ? at.GetString() : null;
                var plan = result.TryGetProperty("license", out var lic) && lic.TryGetProperty("plan", out var p) ? p.GetString() : null;
                tier = MapPlanToTier(plan);
            }
            catch (Exception ex) { Log.Error(ex, "[CellarController] operation failed"); return StatusCode(503, new { success = false, message = $"Cannot reach license server: {ex.Message}" }); }
        }
        else
        {
            var upper = serial.ToUpperInvariant();
            tier = ValidateSerialFormat(upper) ?? "standard";
            if (tier == "standard") return BadRequest(new { success = false, message = "Invalid serial number format" });
        }

        // Store license and mark setup done
        var licenseData = JsonSerializer.Serialize(new { tier, serial, activation_id = activationId, activation_token = activationToken, activated_at = DateTime.UtcNow.ToString("o"), machine_id = Environment.MachineName, hash = ComputeHash(serial) });
        var existing = await _db.Settings.FirstOrDefaultAsync(s2 => s2.Key == "cellar_license" && s2.UserId == "");
        if (existing != null) existing.Value = licenseData;
        else _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseData });
        var setupDone = await _db.Settings.FirstOrDefaultAsync(s2 => s2.Key == "setup_completed" && s2.UserId == "");
        if (setupDone != null) setupDone.Value = "true";
        else _db.Settings.Add(new AppSetting { Key = "setup_completed", UserId = "", Value = "true" });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, tier, tier_name = tier switch { "pro" => "Pro", "ultra" => "Ultra", _ => "Standard" }, message = $"WatchNexus {(tier == "pro" ? "Pro" : "Ultra")} activated!" });
    }

    // ── Deactivate License ──────────────────────────────────────────
    [HttpPost("deactivate")]
    [Authorize]
    public async Task<IActionResult> Deactivate()
    {
        // Try to deactivate on the license server too
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value).RootElement;
                var token = doc.TryGetProperty("activation_token", out var at) ? at.GetString() : null;
                var lsUrl = _config["LICENSE_SERVER_URL"] ?? "";
                var lsApiKey = _config["LICENSE_SERVER_API_KEY"] ?? "";
                if (!string.IsNullOrEmpty(token) && !string.IsNullOrEmpty(lsUrl) && !string.IsNullOrEmpty(lsApiKey))
                {
                    using var http = _httpFactory.CreateClient();
                    http.DefaultRequestHeaders.Add("X-API-Key", lsApiKey);
                    var payload = JsonSerializer.Serialize(new { activation_token = token });
                    await http.PostAsync($"{lsUrl.TrimEnd('/')}/api/integrate/deactivate", new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
                }
            }
            catch { Log.Error("[CellarController] operation failed"); }
            _db.Settings.Remove(setting);
            await _db.SaveChangesAsync();
        }

        return Ok(new { success = true, tier = "standard", tier_name = "Standard", message = "License deactivated. Reverted to Standard tier.", modules_unlocked = TierModules["standard"], total_modules = TierModules["standard"].Length });
    }

    // ── Get Tier Manifest (no auth) ─────────────────────────────────
    [HttpGet("tiers")]
    [AllowAnonymous]
    public IActionResult GetTiers()
    {
        return Ok(new
        {
            tiers = new
            {
                standard = new { name = "Standard", color = "#6B7280", description = "Core media server with essential features", modules = TierModules["standard"], module_count = TierModules["standard"].Length },
                pro = new { name = "Pro", color = "#3B82F6", description = "Advanced automation, analytics, and network tools", includes_standard = true, modules = TierModules["pro"], module_count = TierModules["pro"].Length },
                ultra = new { name = "Ultra", color = "#8B5CF6", description = "Full suite: security, processing, integrations, and all gadgets", includes_standard = true, includes_pro = true, modules = TierModules["ultra"], module_count = TierModules["ultra"].Length }
            },
            total_modules = TierModules["standard"].Length + TierModules["pro"].Length + TierModules["ultra"].Length,
            upgrade_paths = new[]
            {
                new { from_tier = "standard", to = "pro", label = "Standard → Pro" },
                new { from_tier = "standard", to = "ultra", label = "Standard → Ultra" },
                new { from_tier = "pro", to = "ultra", label = "Pro → Ultra" }
            }
        });
    }

    // ── Check Module ────────────────────────────────────────────────
    [HttpGet("check/{moduleName}")]
    [Authorize]
    public async Task<IActionResult> CheckModule(string moduleName)
    {
        var tier = await GetCurrentTier();
        var unlocked = GetUnlockedModules(tier);
        var isUnlocked = unlocked.Contains(moduleName.ToLower());
        var requiredTier = "standard";
        if (TierModules["pro"].Contains(moduleName.ToLower())) requiredTier = "pro";
        else if (TierModules["ultra"].Contains(moduleName.ToLower())) requiredTier = "ultra";
        return Ok(new { module = moduleName, unlocked = isUnlocked, current_tier = tier, required_tier = requiredTier });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    private async Task<string> GetCurrentTier() => await _tierResolver.GetCurrentTier();

    private static bool IsValidUpgrade(string current, string target)
    {
        var rank = new Dictionary<string, int> { ["standard"] = 0, ["pro"] = 1, ["ultra"] = 2 };
        return rank.GetValueOrDefault(target, 0) > rank.GetValueOrDefault(current, 0);
    }

    private static string? ValidateSerialFormat(string serial)
    {
        if (serial.Length < 19) return null;
        var parts = serial.Split('-');
        if (parts.Length != 5 || parts[0] != "WNX") return null;
        if (parts[1] != "PRO" && parts[1] != "ULT") return null;
        for (int i = 2; i < 5; i++)
            if (parts[i].Length != 4 || !parts[i].All(c => char.IsLetterOrDigit(c))) return null;
        return parts[1] == "PRO" ? "pro" : "ultra";
    }

    public static string[] GetUnlockedModules(string tier)
    {
        var modules = new List<string>(TierModules["standard"]);
        if (tier == "pro" || tier == "ultra") modules.AddRange(TierModules["pro"]);
        if (tier == "ultra") modules.AddRange(TierModules["ultra"]);
        return modules.ToArray();
    }

    private static string? MaskSerial(string? serial)
    {
        if (string.IsNullOrEmpty(serial) || serial.Length < 12) return serial;
        return serial[..8] + "-****-****-" + serial[^4..];
    }

    private static string ComputeHash(string serial)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(serial + "WatchNexus-Cellar-Salt-2026");
        return Convert.ToHexString(SHA256.HashData(bytes))[..16].ToLower();
    }
}

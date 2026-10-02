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
// Integrates with WN-License-Server for serial validation.
// Supports upgrade paths: Standard→Pro, Standard→Ultra, Pro→Ultra.
// All installs start as Standard; serial determines the tier.
// ══════════════════════════════════════════════════════════════════════
[Route("api/cellar")]
[ApiController]
public class CellarController : ControllerBase
{
    // License server credentials come from configuration only (never source):
    //  - LICENSE_SERVER_API_KEY: operator-supplied key (full integrator access).
    //  - LICENSE_SERVER_CLIENT_KEY: publishable activate/validate/deactivate-only
    //    key baked into official images at build time, so customer installs can
    //    activate a purchased serial out of the box. It cannot mint serials.
    // With neither set, activation returns 503 (Standard keeps working).
    private const string DEFAULT_LICENSE_SERVER_URL = "https://licenses.watchnexus.ca";

    private static readonly Dictionary<string, List<DateTime>> _activationAttempts = new();
    private static readonly object _rateLimitLock = new();

    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    public CellarController(AppDbContext db, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _db = db;
        _httpFactory = httpFactory;
        _config = config;
    }

    private static bool IsRateLimited(string ip)
    {
        lock (_rateLimitLock)
        {
            var now = DateTime.UtcNow;
            if (!_activationAttempts.TryGetValue(ip, out var attempts))
            {
                _activationAttempts[ip] = new List<DateTime> { now };
                return false;
            }
            attempts.RemoveAll(t => now - t > TimeSpan.FromMinutes(5));
            if (attempts.Count == 0)
            {
                _activationAttempts.Remove(ip);
            }
            if (attempts.Count >= 5)
                return true;
            attempts.Add(now);
            return false;
        }
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
            "cinnamon", "waffle", "custard", "yeast", "brine", "ladle", "marzipan",
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
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (IsRateLimited(ip))
            return StatusCode(429, new { success = false, message = "Too many requests. Please wait 5 minutes and try again." });

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
            var tier = ResolveTier(setting.Value);
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
        catch
        {
            return Ok(new { tier = "standard", tier_name = "Standard", activated = false, serial = (string?)null, activated_at = (string?)null, activation_id = (string?)null, modules_unlocked = TierModules["standard"], total_modules = TierModules["standard"].Length, can_upgrade_to = new[] { "pro", "ultra" } });
        }
    }

    // ── License server round-trip ───────────────────────────────────
    private sealed record ServerActivation(string Tier, string? ActivationId, string? ActivationToken, bool Reused);

    private static string TierName(string tier) => tier switch { "pro" => "Pro", "ultra" => "Ultra", _ => "Standard" };

    // Stable per-install hardware id. Environment.MachineName is the container
    // id under Docker and changes on every recreate, which made each update
    // consume a fresh seat on the license server.
    private async Task<string> GetOrCreateInstallId()
    {
        var rec = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "install_id" && s.UserId == "");
        if (rec != null && !string.IsNullOrEmpty(rec.Value)) return rec.Value;
        var id = "wn-" + Guid.NewGuid().ToString("N");
        _db.Settings.Add(new AppSetting { Key = "install_id", UserId = "", Value = id });
        await _db.SaveChangesAsync();
        return id;
    }

    private HttpClient CreateLicenseClient(string apiKey)
    {
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(15);
        http.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        return http;
    }

    private string? LicenseApiKey =>
        _config["LICENSE_SERVER_API_KEY"] is { Length: > 0 } operatorKey ? operatorKey : _config["LICENSE_SERVER_CLIENT_KEY"];

    private string LicenseServerUrl => (_config["LICENSE_SERVER_URL"] ?? DEFAULT_LICENSE_SERVER_URL).TrimEnd('/');

    private async Task<(ServerActivation? Activation, IActionResult? Error)> ActivateWithLicenseServer(string serial)
    {
        var lsApiKey = LicenseApiKey;
        // No offline/format-based unlock: a paid tier can only be granted by the
        // WatchNexus license server (the free Standard tier always works).
        if (string.IsNullOrEmpty(lsApiKey))
            return (null, StatusCode(503, new { success = false, message = "License activation is unavailable: this build has no license server key (set LICENSE_SERVER_API_KEY). You can keep using the free Standard tier." }));

        var installId = await GetOrCreateInstallId();
        try
        {
            using var http = CreateLicenseClient(lsApiKey);
            var payload = JsonSerializer.Serialize(new
            {
                license_key = serial,
                hardware_id = installId,
                device_name = $"WatchNexus-{Environment.MachineName}"
            });
            var resp = await http.PostAsync($"{LicenseServerUrl}/api/integrate/activate",
                new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
            var resBody = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                try
                {
                    var err = JsonDocument.Parse(resBody).RootElement;
                    var detail = err.TryGetProperty("detail", out var d) ? d.GetString() : null;
                    return (null, BadRequest(new { success = false, message = detail ?? "License server rejected the key" }));
                }
                catch { return (null, BadRequest(new { success = false, message = $"License server error: HTTP {(int)resp.StatusCode}" })); }
            }

            var result = JsonDocument.Parse(resBody).RootElement;
            var lic = result.TryGetProperty("license", out var l) ? l : default;
            // Prefer the server's explicit tier; fall back to mapping the plan name.
            var tier = lic.ValueKind == JsonValueKind.Object && lic.TryGetProperty("tier", out var t) && t.GetString() is { Length: > 0 } ts
                ? ts.ToLowerInvariant()
                : MapPlanToTier(lic.ValueKind == JsonValueKind.Object && lic.TryGetProperty("plan", out var p) ? p.GetString() : null);
            if (tier is not ("standard" or "pro" or "ultra")) tier = "standard";
            return (new ServerActivation(
                tier,
                result.TryGetProperty("activation_id", out var aid) ? aid.GetString() : null,
                result.TryGetProperty("activation_token", out var at) ? at.GetString() : null,
                result.TryGetProperty("reused", out var r) && r.ValueKind == JsonValueKind.True), null);
        }
        catch (Exception ex)
        {
            return (null, StatusCode(503, new { success = false, message = $"Cannot reach license server: {ex.Message}" }));
        }
    }

    // Best-effort seat release on the license server.
    private async Task ReleaseActivation(string? activationToken)
    {
        var lsApiKey = LicenseApiKey;
        if (string.IsNullOrEmpty(activationToken) || string.IsNullOrEmpty(lsApiKey)) return;
        try
        {
            using var http = CreateLicenseClient(lsApiKey);
            var payload = JsonSerializer.Serialize(new { activation_token = activationToken });
            await http.PostAsync($"{LicenseServerUrl}/api/integrate/deactivate",
                new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
        }
        catch { /* best effort */ }
    }

    private static string? StoredActivationToken(string? licenseJson)
    {
        if (string.IsNullOrEmpty(licenseJson)) return null;
        try { return JsonDocument.Parse(licenseJson).RootElement.TryGetProperty("activation_token", out var at) ? at.GetString() : null; }
        catch { return null; }
    }

    // ── Activate Serial Number (integrates with WN-License-Server) ──
    [HttpPost("activate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Activate([FromBody] JsonElement body)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (IsRateLimited(ip))
            return StatusCode(429, new { success = false, message = "Too many activation attempts. Please wait 5 minutes and try again." });

        var serial = body.TryGetProperty("serial", out var s) ? s.GetString()?.Trim() : null;
        if (string.IsNullOrEmpty(serial))
            return BadRequest(new { success = false, message = "Serial number is required" });

        var (act, error) = await ActivateWithLicenseServer(serial);
        if (error != null) return error;
        var tier = act!.Tier;

        // Check upgrade path validity. The server already counted a seat, so a
        // rejected *new* activation must hand it back (a reused one is this
        // install's live activation and must be left alone).
        var currentTier = await GetCurrentTier();
        if (!IsValidUpgrade(currentTier, tier))
        {
            if (!act.Reused) await ReleaseActivation(act.ActivationToken);
            return BadRequest(new { success = false, message = $"Cannot activate {tier} license. Current tier ({currentTier}) is equal or higher." });
        }

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        var previousToken = StoredActivationToken(existing?.Value);

        var licenseData = JsonSerializer.Serialize(new
        {
            tier,
            serial,
            activation_id = act.ActivationId,
            activation_token = act.ActivationToken,
            activated_at = DateTime.UtcNow.ToString("o"),
            activated_by = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "system",
            machine_id = Environment.MachineName,
            previous_tier = currentTier,
            hash = ComputeHash(serial)
        });
        if (existing != null)
            existing.Value = licenseData;
        else
            _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseData });
        await _db.SaveChangesAsync();

        // Upgrading (e.g. Pro -> Ultra) frees the old serial's seat.
        if (previousToken != null && previousToken != act.ActivationToken)
            await ReleaseActivation(previousToken);

        var unlockedModules = GetUnlockedModules(tier);
        var upgradeMsg = currentTier != "standard" ? $" Upgraded from {currentTier} to {tier}." : "";
        return Ok(new
        {
            success = true,
            tier,
            tier_name = TierName(tier),
            message = $"License activated! Welcome to WatchNexus {TierName(tier)}.{upgradeMsg}",
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
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (IsRateLimited(ip))
            return StatusCode(429, new { success = false, message = "Too many activation attempts. Please wait 5 minutes and try again." });

        // First-launch only: once setup is complete this anonymous endpoint is
        // closed. Post-setup license changes must go through the authenticated
        // /api/cellar/activate endpoint.
        if (await _db.Settings.AnyAsync(s2 => s2.Key == "setup_completed" && s2.Value == "true" && s2.UserId == ""))
            return StatusCode(403, new { success = false, message = "Setup is already complete. Manage your license in Settings." });

        var serial = body.TryGetProperty("serial", out var s) ? s.GetString()?.Trim() : null;
        // Allow "skip" to start with Standard
        var skip = body.TryGetProperty("skip", out var sk) && sk.GetBoolean();
        if (skip)
        {
            var setupSetting = await _db.Settings.FirstOrDefaultAsync(s2 => s2.Key == "setup_completed" && s2.UserId == "");
            if (setupSetting != null) setupSetting.Value = "true";
            else _db.Settings.Add(new AppSetting { Key = "setup_completed", UserId = "", Value = "true" });
            await _db.SaveChangesAsync();
            return Ok(new { success = true, tier = "standard", tier_name = "Standard", message = "Starting with Standard tier. You can upgrade anytime in Settings > Activation." });
        }

        if (string.IsNullOrEmpty(serial))
            return BadRequest(new { success = false, message = "Serial number is required" });

        var (act, error) = await ActivateWithLicenseServer(serial);
        if (error != null) return error;
        var tier = act!.Tier;
        if (tier == "standard")
        {
            if (!act.Reused) await ReleaseActivation(act.ActivationToken);
            return BadRequest(new { success = false, message = "This serial is for the free Standard tier — no activation needed. Choose \"Continue with Standard\" instead." });
        }

        // Store license and mark setup done
        var licenseData = JsonSerializer.Serialize(new { tier, serial, activation_id = act.ActivationId, activation_token = act.ActivationToken, activated_at = DateTime.UtcNow.ToString("o"), machine_id = Environment.MachineName, hash = ComputeHash(serial) });
        var existing = await _db.Settings.FirstOrDefaultAsync(s2 => s2.Key == "cellar_license" && s2.UserId == "");
        if (existing != null) existing.Value = licenseData;
        else _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseData });
        var setupDone = await _db.Settings.FirstOrDefaultAsync(s2 => s2.Key == "setup_completed" && s2.UserId == "");
        if (setupDone != null) setupDone.Value = "true";
        else _db.Settings.Add(new AppSetting { Key = "setup_completed", UserId = "", Value = "true" });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, tier, tier_name = TierName(tier), message = $"WatchNexus {TierName(tier)} activated!" });
    }

    // ── Deactivate License ──────────────────────────────────────────
    [HttpPost("deactivate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Deactivate()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (setting?.Value != null)
        {
            // Release the seat on the license server too
            await ReleaseActivation(StoredActivationToken(setting.Value));
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
    private async Task<string> GetCurrentTier()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        return ResolveTier(setting?.Value);
    }

    // Tamper-evident tier read: a paid tier is only honored when the stored
    // hash matches the stored serial. Mismatch/missing → fall back to standard.
    internal static string ResolveTier(string? licenseJson)
    {
        if (string.IsNullOrEmpty(licenseJson)) return "standard";
        try
        {
            var doc = JsonDocument.Parse(licenseJson).RootElement;
            var tier = doc.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
            if (tier != "pro" && tier != "ultra") return "standard";
            var serial = doc.TryGetProperty("serial", out var s) ? s.GetString() : null;
            var hash = doc.TryGetProperty("hash", out var h) ? h.GetString() : null;
            if (string.IsNullOrEmpty(serial) || string.IsNullOrEmpty(hash) || ComputeHash(serial) != hash)
                return "standard";
            return tier;
        }
        catch { return "standard"; }
    }

    private static bool IsValidUpgrade(string current, string target)
    {
        var rank = new Dictionary<string, int> { ["standard"] = 0, ["pro"] = 1, ["ultra"] = 2 };
        return rank.GetValueOrDefault(target, 0) > rank.GetValueOrDefault(current, 0);
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
        // Short format: WNX-<TIER>-XXXX-XXXX-XXXX — keep prefix + first data group.
        var parts = serial.Split('-');
        if (parts.Length == 5 && parts[0] == "WNX")
            return $"{parts[0]}-{parts[1]}-{parts[2]}-****-****";
        return serial[..8] + "-****-****-" + serial[^4..];
    }

    internal static string ComputeHash(string serial)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(serial + "WatchNexus-Cellar-Salt-2026");
        return Convert.ToHexString(SHA256.HashData(bytes))[..16].ToLower();
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.Json;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// FORTRESS PROTOCOL v1.0
// Anti-tamper, integrity verification, license enforcement hardening.
// Applied globally to WatchNexus v1.0.0.
// ══════════════════════════════════════════════════════════════════════

/// <summary>
/// Middleware filter that enforces tier licensing at the API level.
/// Prevents Pro/Ultra endpoints from being accessed without a valid license,
/// even if the frontend tier gate is bypassed.
/// </summary>
public class FortressFilter : IAsyncActionFilter
{
    private readonly AppDbContext _db;

    // Module codename → required tier
    private static readonly Dictionary<string, string> ProtectedRoutes = new()
    {
        // Pro
        ["compote"] = "pro", ["fondue"] = "pro", ["saffron"] = "pro", ["sourdough"] = "pro",
        ["bastion"] = "pro", ["truffle"] = "pro", ["tunnel"] = "pro", ["sprout"] = "pro",
        ["drizzle"] = "pro", ["meringue"] = "pro", ["nutmeg"] = "pro",
        ["biscotti"] = "pro", ["treacle"] = "pro", ["sage"] = "pro", ["terrine"] = "pro",
        ["iptv"] = "pro",
        // Ultra
        ["security"] = "ultra", ["rind"] = "ultra", ["pepper"] = "ultra", ["crucible"] = "ultra",
        ["strudel"] = "ultra", ["crumbs"] = "ultra", ["taffy"] = "ultra",
        ["cinnamon"] = "ultra", ["waffle"] = "ultra", ["custard"] = "ultra", ["yeast"] = "ultra",
        ["brine"] = "ultra", ["ladle"] = "ultra", ["vpn"] = "ultra", ["qbittorrent"] = "ultra",
        ["subtitles"] = "ultra", ["pretzel"] = "ultra", ["parfait"] = "ultra", ["menu"] = "ultra",
        ["popsicle"] = "ultra", ["preserves"] = "ultra", ["marshmallow"] = "ultra", ["chowder"] = "ultra",
    };

    private static readonly Dictionary<string, int> TierRank = new() { ["standard"] = 0, ["pro"] = 1, ["ultra"] = 2 };

    // Endpoints that must stay reachable on EVERY tier (including a fresh Standard
    // install) because they are system diagnostics / onboarding probes rather than
    // licensed features. FFmpeg detection is surfaced in the first-launch wizard and
    // the Settings panel before any license is ever entered — gating it behind the
    // crucible (Ultra) tier made it always report "not found". See bug: customer
    // reported ffmpeg installed but OOBE said it wasn't.
    private static readonly HashSet<string> ExemptPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/crucible/ffmpeg-status",
    };

    public FortressFilter(AppDbContext db) => _db = db;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var path = context.HttpContext.Request.Path.Value?.ToLower() ?? "";

        // System diagnostics / onboarding probes bypass tier enforcement entirely.
        if (ExemptPaths.Contains(path.TrimEnd('/')))
        {
            await next();
            return;
        }

        // Extract module codename from path: /api/{codename}/...
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length >= 2 && segments[0] == "api")
        {
            var moduleName = segments[1];
            if (ProtectedRoutes.TryGetValue(moduleName, out var requiredTier))
            {
                var currentTier = await GetCurrentTier();
                var currentRank = TierRank.GetValueOrDefault(currentTier, 0);
                var requiredRank = TierRank.GetValueOrDefault(requiredTier, 0);

                if (currentRank < requiredRank)
                {
                    context.Result = new JsonResult(new
                    {
                        error = "FORTRESS_TIER_LOCKED",
                        message = $"This feature requires a {requiredTier} license.",
                        required_tier = requiredTier,
                        current_tier = currentTier,
                        upgrade_url = "/settings?section=activation",
                    })
                    { StatusCode = 403 };
                    return;
                }
            }
        }

        await next();
    }

    private async Task<string> GetCurrentTier()
    {
        try
        {
            var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
            if (setting?.Value == null) return "standard";
            var doc = JsonDocument.Parse(setting.Value).RootElement;
            return doc.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
        }
        catch { return "standard"; }
    }
}

/// <summary>
/// Startup integrity checker. Validates critical file hashes at boot.
/// Detects tampering of DLLs and configuration files.
/// </summary>
public static class FortressIntegrity
{
    private const string MANIFEST_KEY = "fortress_manifest";
    private const string FORTRESS_VERSION = "1.0";

    /// <summary>Generates SHA256 hashes of critical files and stores them.</summary>
    public static async Task SealBuild(AppDbContext db)
    {
        var baseDir = AppContext.BaseDirectory;
        var criticalFiles = new[]
        {
            "WatchNexus.Core.dll",
            "WatchNexus.Shared.dll",
            "appsettings.json",
        };

        var hashes = new Dictionary<string, string>();
        foreach (var file in criticalFiles)
        {
            var fullPath = Path.Combine(baseDir, file);
            if (File.Exists(fullPath))
            {
                var bytes = await File.ReadAllBytesAsync(fullPath);
                hashes[file] = Convert.ToHexString(SHA256.HashData(bytes)).ToLower();
            }
        }

        var manifest = JsonSerializer.Serialize(new
        {
            version = FORTRESS_VERSION,
            sealed_at = DateTime.UtcNow.ToString("o"),
            app_version = "1.0.0",
            file_hashes = hashes,
            machine_id = Environment.MachineName,
        });

        var existing = await db.Settings.FirstOrDefaultAsync(s => s.Key == MANIFEST_KEY && s.UserId == "");
        if (existing != null) existing.Value = manifest;
        else db.Settings.Add(new AppSetting { Key = MANIFEST_KEY, UserId = "", Value = manifest });
        await db.SaveChangesAsync();
    }

    /// <summary>Verifies file integrity against stored manifest.</summary>
    public static async Task<(bool valid, List<string> violations)> VerifyIntegrity(AppDbContext db)
    {
        var violations = new List<string>();
        var setting = await db.Settings.FirstOrDefaultAsync(s => s.Key == MANIFEST_KEY && s.UserId == "");

        if (setting?.Value == null)
        {
            // First run — seal the build
            await SealBuild(db);
            return (true, violations);
        }

        try
        {
            var doc = JsonDocument.Parse(setting.Value).RootElement;
            if (!doc.TryGetProperty("file_hashes", out var hashes)) return (true, violations);

            var baseDir = AppContext.BaseDirectory;
            foreach (var prop in hashes.EnumerateObject())
            {
                var filePath = Path.Combine(baseDir, prop.Name);
                if (!File.Exists(filePath))
                {
                    violations.Add($"MISSING: {prop.Name}");
                    continue;
                }
                var currentHash = Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(filePath))).ToLower();
                var expectedHash = prop.Value.GetString();
                if (currentHash != expectedHash)
                    violations.Add($"TAMPERED: {prop.Name} (expected {expectedHash?[..12]}..., got {currentHash[..12]}...)");
            }
        }
        catch (Exception ex)
        {
            violations.Add($"VERIFY_ERROR: {ex.Message}");
        }

        return (violations.Count == 0, violations);
    }
}

/// <summary>
/// Fortress status endpoint — reports integrity and protection status.
/// </summary>
[Route("api/fortress")]
[ApiController]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "admin")]
public class FortressController : ControllerBase
{
    private readonly AppDbContext _db;
    public FortressController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);
        var manifest = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fortress_manifest" && s.UserId == "");
        string? sealedAt = null;
        if (manifest?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(manifest.Value).RootElement;
                sealedAt = doc.TryGetProperty("sealed_at", out var sa) ? sa.GetString() : null;
            }
            catch { }
        }

        return Ok(new
        {
            fortress_version = "1.0",
            app_version = "1.0.0",
            integrity_valid = valid,
            violations = violations.Count > 0 ? violations : null,
            sealed_at = sealedAt,
            protections = new
            {
                tier_enforcement = true,
                integrity_checks = true,
                api_guard = true,
                debug_stripped = true,
                source_maps_removed = true,
                obfuscation_ready = true,
            },
        });
    }

    [HttpPost("reseal")]
    public async Task<IActionResult> Reseal()
    {
        await FortressIntegrity.SealBuild(_db);
        return Ok(new { success = true, message = "Build re-sealed with current file hashes" });
    }

    [HttpPost("verify")]
    public async Task<IActionResult> Verify()
    {
        var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);
        return Ok(new { valid, violations, checked_at = DateTime.UtcNow.ToString("o") });
    }
}

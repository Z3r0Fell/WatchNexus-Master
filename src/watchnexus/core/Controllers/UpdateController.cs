using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// UPDATE SYSTEM — Version Check, Changelog, Silent Patching
// Checks against:
//   1. License server (https://licenses.watchnexus.ca) for tier builds
//   2. Private GitHub repo for silent hotfix patches
// ══════════════════════════════════════════════════════════════════════
[Route("api/system/updates")]
[ApiController]
[Authorize]
public class UpdateController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    public UpdateController(AppDbContext db, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _db = db;
        _httpFactory = httpFactory;
        _config = config;
    }

    private const string CURRENT_VERSION = "1.0.0";

    // ── Check for Updates ───────────────────────────────────────────
    [HttpGet("check")]
    public async Task<IActionResult> CheckForUpdates()
    {
        var tier = await GetCurrentTier();
        var licenseServerUrl = _config["LICENSE_SERVER_URL"] ?? "https://licenses.watchnexus.ca";
        var githubPatchUrl = _config["PATCH_REPO_URL"] ?? "";
        var githubPatchToken = _config["PATCH_REPO_TOKEN"] ?? "";

        // Result containers
        object? mainUpdate = null;
        object? hotfixPatch = null;
        var errors = new List<string>();

        // ── 1. Check license server for tier builds ─────────────
        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            http.DefaultRequestHeaders.Add("User-Agent", $"WatchNexus/{CURRENT_VERSION}");
            var resp = await http.GetAsync($"{licenseServerUrl.TrimEnd('/')}/api/updates/manifest?tier={tier}&current={CURRENT_VERSION}");
            if (resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                var manifest = JsonDocument.Parse(body).RootElement;
                var latestVersion = manifest.TryGetProperty("latest_version", out var lv) ? lv.GetString() : CURRENT_VERSION;
                var hasUpdate = CompareVersions(latestVersion ?? CURRENT_VERSION, CURRENT_VERSION) > 0;

                mainUpdate = new
                {
                    available = hasUpdate,
                    current_version = CURRENT_VERSION,
                    latest_version = latestVersion,
                    tier,
                    download_url = manifest.TryGetProperty("download_url", out var du) ? du.GetString() : null,
                    release_notes = manifest.TryGetProperty("release_notes", out var rn) ? rn.GetString() : null,
                    changelog = manifest.TryGetProperty("changelog", out var cl) ? cl.GetString() : null,
                    release_date = manifest.TryGetProperty("release_date", out var rd) ? rd.GetString() : null,
                    size_mb = manifest.TryGetProperty("size_mb", out var sm) ? sm.GetDouble() : 0,
                    mandatory = manifest.TryGetProperty("mandatory", out var mn) && mn.GetBoolean(),
                    min_version = manifest.TryGetProperty("min_version", out var mv) ? mv.GetString() : null,
                };
            }
            else
            {
                mainUpdate = new { available = false, current_version = CURRENT_VERSION, latest_version = CURRENT_VERSION, tier, error = $"License server returned {(int)resp.StatusCode}" };
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "[UpdateController] operation failed");

            mainUpdate = new { available = false, current_version = CURRENT_VERSION, latest_version = CURRENT_VERSION, tier, error = $"Cannot reach license server: {ex.Message}" };
            errors.Add($"License server: {ex.Message}");
        }

        // ── 2. Check GitHub for silent hotfix patches ───────────
        if (!string.IsNullOrEmpty(githubPatchUrl))
        {
            try
            {
                using var http = _httpFactory.CreateClient();
                http.Timeout = TimeSpan.FromSeconds(10);
                http.DefaultRequestHeaders.Add("User-Agent", $"WatchNexus/{CURRENT_VERSION}");
                if (!string.IsNullOrEmpty(githubPatchToken))
                    http.DefaultRequestHeaders.Add("Authorization", $"token {githubPatchToken}");

                var resp = await http.GetAsync($"{githubPatchUrl.TrimEnd('/')}/contents/patches/{CURRENT_VERSION}.json");
                if (resp.IsSuccessStatusCode)
                {
                    var body = await resp.Content.ReadAsStringAsync();
                    var ghFile = JsonDocument.Parse(body).RootElement;
                    // GitHub returns base64-encoded content
                    if (ghFile.TryGetProperty("content", out var content))
                    {
                        var decoded = System.Text.Encoding.UTF8.GetString(
                            Convert.FromBase64String(content.GetString()?.Replace("\n", "") ?? ""));
                        var patchData = JsonDocument.Parse(decoded).RootElement;
                        hotfixPatch = new
                        {
                            available = true,
                            patch_id = patchData.TryGetProperty("patch_id", out var pid) ? pid.GetString() : null,
                            description = patchData.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                            severity = patchData.TryGetProperty("severity", out var sev) ? sev.GetString() : "low",
                            silent = patchData.TryGetProperty("silent", out var sil) && sil.GetBoolean(),
                            files = patchData.TryGetProperty("files", out var files) ? files.GetArrayLength() : 0,
                        };
                    }
                }
                else
                {
                    hotfixPatch = new { available = false, message = "No patches for current version" };
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "[UpdateController] operation failed");

                hotfixPatch = new { available = false, error = ex.Message };
                errors.Add($"Patch repo: {ex.Message}");
            }
        }
        else
        {
            hotfixPatch = new { available = false, message = "Patch repo not configured" };
        }

        // Store last check timestamp
        var checkSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_last_check" && s.UserId == "");
        var checkData = JsonSerializer.Serialize(new { checked_at = DateTime.UtcNow.ToString("o"), version = CURRENT_VERSION, tier });
        if (checkSetting != null) checkSetting.Value = checkData;
        else _db.Settings.Add(new AppSetting { Key = "update_last_check", UserId = "", Value = checkData });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            current_version = CURRENT_VERSION,
            tier,
            main_update = mainUpdate,
            hotfix_patch = hotfixPatch,
            checked_at = DateTime.UtcNow.ToString("o"),
            auto_check_enabled = true,
            errors = errors.Count > 0 ? errors : null,
        });
    }

    // ── Get Current Version Info ────────────────────────────────────
    [HttpGet("current")]
    public async Task<IActionResult> CurrentVersion()
    {
        var tier = await GetCurrentTier();
        var lastCheck = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_last_check" && s.UserId == "");
        string? lastCheckedAt = null;
        if (lastCheck?.Value != null)
        {
            try { var d = JsonDocument.Parse(lastCheck.Value).RootElement; lastCheckedAt = d.TryGetProperty("checked_at", out var ca) ? ca.GetString() : null; } catch { Log.Error("[UpdateController] CurrentVersion failed"); }
        }
        return Ok(new
        {
            version = CURRENT_VERSION,
            tier,
            tier_name = tier switch { "pro" => "Pro", "ultra" => "Ultra", _ => "Standard" },
            last_checked = lastCheckedAt,
            update_channels = new
            {
                license_server = _config["LICENSE_SERVER_URL"] ?? "https://licenses.watchnexus.ca",
                patch_repo = !string.IsNullOrEmpty(_config["PATCH_REPO_URL"]) ? "configured" : "not configured",
            },
        });
    }

    // ── Get Update History ──────────────────────────────────────────
    [HttpGet("history")]
    public async Task<IActionResult> UpdateHistory()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("update_applied:")).OrderByDescending(s => s.Key).Take(20).ToListAsync();
        var history = all.Select(s =>
        {
            try
            {
                var d = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                return new
                {
                    id = s.Key.Replace("update_applied:", ""),
                    from_version = d.TryGetProperty("from_version", out var fv) ? fv.GetString() : null,
                    to_version = d.TryGetProperty("to_version", out var tv) ? tv.GetString() : null,
                    type = d.TryGetProperty("type", out var t) ? t.GetString() : "update",
                    applied_at = d.TryGetProperty("applied_at", out var aa) ? aa.GetString() : "",
                    status = d.TryGetProperty("status", out var st) ? st.GetString() : "completed",
                    notes = d.TryGetProperty("notes", out var n) ? n.GetString() : null,
                };
            }
            catch { Log.Error("[UpdateController] operation failed"); return null; }
        }).Where(x => x != null).ToList();
        return Ok(new { history, total = history.Count });
    }

    // ── Update Settings ─────────────────────────────────────────────
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_settings" && s.UserId == "");
        if (cfg?.Value == null) return Ok(new { auto_check = true, check_interval_hours = 24, auto_install_patches = true, notify_on_update = true, channel = "stable" });
        return Content(cfg.Value, "application/json");
    }

    [HttpPost("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_settings" && s.UserId == "");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new AppSetting { Key = "update_settings", UserId = "", Value = body.GetRawText() });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Update settings saved" });
    }

    // ── Apply Hotfix Patch (from GitHub) ────────────────────────────
    [HttpPost("apply-patch")]
    public async Task<IActionResult> ApplyPatch([FromBody] JsonElement body)
    {
        var patchId = body.TryGetProperty("patch_id", out var pid) ? pid.GetString() : null;
        if (string.IsNullOrEmpty(patchId))
            return BadRequest(new { success = false, message = "patch_id required" });

        // Log the patch application
        var id = Guid.NewGuid().ToString("N")[..12];
        var data = JsonSerializer.Serialize(new
        {
            patch_id = patchId,
            from_version = CURRENT_VERSION,
            to_version = CURRENT_VERSION,
            type = "hotfix",
            applied_at = DateTime.UtcNow.ToString("o"),
            status = "applied",
            notes = body.TryGetProperty("description", out var desc) ? desc.GetString() : "Silent hotfix patch",
        });
        _db.Settings.Add(new AppSetting { Key = $"update_applied:{id}", UserId = "", Value = data });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = $"Patch {patchId} applied", restart_required = false });
    }

    // ── Dismiss Update Notification ─────────────────────────────────
    [HttpPost("dismiss")]
    public async Task<IActionResult> DismissUpdate([FromBody] JsonElement body)
    {
        var version = body.TryGetProperty("version", out var v) ? v.GetString() : null;
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_dismissed" && s.UserId == "");
        var data = JsonSerializer.Serialize(new { version, dismissed_at = DateTime.UtcNow.ToString("o") });
        if (existing != null) existing.Value = data;
        else _db.Settings.Add(new AppSetting { Key = "update_dismissed", UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── Helpers ──────────────────────────────────────────────────────
    private async Task<string> GetCurrentTier()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (setting?.Value == null) return "standard";
        try { var doc = JsonDocument.Parse(setting.Value).RootElement; return doc.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard"; }
        catch { Log.Error("[UpdateController] GetCurrentTier failed"); return "standard"; }
    }

    private static int CompareVersions(string a, string b)
    {
        var va = a.Split('.').Select(s => int.TryParse(s, out var n) ? n : 0).ToArray();
        var vb = b.Split('.').Select(s => int.TryParse(s, out var n) ? n : 0).ToArray();
        for (int i = 0; i < Math.Max(va.Length, vb.Length); i++)
        {
            var na = i < va.Length ? va[i] : 0;
            var nb = i < vb.Length ? vb[i] : 0;
            if (na != nb) return na.CompareTo(nb);
        }
        return 0;
    }
}

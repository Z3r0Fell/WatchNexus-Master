using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// UPDATE SYSTEM — Version Check, Changelog, Silent Patching
// Checks the WN-Admin/WatchNexus GitHub repo:
//   • Updates/latest.json  → full version updates (primary channel)
//   • Patches/{version}.json → silent hotfix patches for the running version
//   • Releases/            → downloadable installers/builds
// The license server (licenses.watchnexus.ca) remains the fallback for
// tier-specific builds when the GitHub Updates channel has no entry.
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

    private const string CURRENT_VERSION = "1.0.1";
    private const string RELEASES_PAGE = "https://github.com/WN-Admin/WatchNexus/tree/main/Releases";

    // Fetch + base64-decode a JSON file from the GitHub repo via the contents API.
    private async Task<JsonElement?> FetchRepoJson(string repoPath)
    {
        var repoUrl = (_config["PATCH_REPO_URL"] ?? "").TrimEnd('/');
        if (string.IsNullOrEmpty(repoUrl)) return null;
        using var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        http.DefaultRequestHeaders.Add("User-Agent", $"WatchNexus/{CURRENT_VERSION}");
        var token = _config["PATCH_REPO_TOKEN"] ?? "";
        if (!string.IsNullOrEmpty(token))
            http.DefaultRequestHeaders.Add("Authorization", $"token {token}");
        var resp = await http.GetAsync($"{repoUrl}/contents/{repoPath}");
        if (!resp.IsSuccessStatusCode) return null;
        var ghFile = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;
        if (!ghFile.TryGetProperty("content", out var content)) return null;
        var decoded = System.Text.Encoding.UTF8.GetString(
            Convert.FromBase64String(content.GetString()?.Replace("\n", "") ?? ""));
        return JsonDocument.Parse(decoded).RootElement;
    }

    // ── Check for Updates ───────────────────────────────────────────
    [HttpGet("check")]
    public async Task<IActionResult> CheckForUpdates()
    {
        var tier = await GetCurrentTier();
        var licenseServerUrl = _config["LICENSE_SERVER_URL"] ?? "https://licenses.watchnexus.ca";
        var githubPatchUrl = _config["PATCH_REPO_URL"] ?? "";

        // Result containers
        object? mainUpdate = null;
        object? hotfixPatch = null;
        var errors = new List<string>();

        // ── 1. Main version updates — GitHub Updates/ channel first ──
        try
        {
            var latest = await FetchRepoJson("Updates/latest.json");
            if (latest is JsonElement u)
            {
                var latestVersion = u.TryGetProperty("latest_version", out var lv) ? lv.GetString() : CURRENT_VERSION;
                var hasUpdate = CompareVersions(latestVersion ?? CURRENT_VERSION, CURRENT_VERSION) > 0;
                mainUpdate = new
                {
                    available = hasUpdate,
                    source = "github",
                    current_version = CURRENT_VERSION,
                    latest_version = latestVersion,
                    tier,
                    download_url = u.TryGetProperty("download_url", out var du) ? du.GetString() : RELEASES_PAGE,
                    releases_page = RELEASES_PAGE,
                    release_notes = u.TryGetProperty("release_notes", out var rn) ? rn.GetString() : null,
                    changelog = u.TryGetProperty("changelog", out var cl) ? cl.GetString() : null,
                    release_date = u.TryGetProperty("release_date", out var rd) ? rd.GetString() : null,
                    size_mb = u.TryGetProperty("size_mb", out var sm) && sm.TryGetDouble(out var smv) ? smv : 0,
                    mandatory = u.TryGetProperty("mandatory", out var mn) && mn.GetBoolean(),
                    min_version = u.TryGetProperty("min_version", out var mv) ? mv.GetString() : null,
                };
            }
        }
        catch (Exception ex)
        {
            errors.Add($"GitHub Updates channel: {ex.Message}");
        }

        // ── 1b. Fallback: license server for tier-specific builds ──
        if (mainUpdate == null)
        {
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
                        source = "license-server",
                        current_version = CURRENT_VERSION,
                        latest_version = latestVersion,
                        tier,
                        download_url = manifest.TryGetProperty("download_url", out var du) ? du.GetString() : null,
                        releases_page = RELEASES_PAGE,
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
                mainUpdate = new { available = false, current_version = CURRENT_VERSION, latest_version = CURRENT_VERSION, tier, error = $"Cannot reach license server: {ex.Message}" };
                errors.Add($"License server: {ex.Message}");
            }
        }

        // ── 2. Check GitHub Patches/ for silent hotfix patches ──────
        if (!string.IsNullOrEmpty(githubPatchUrl))
        {
            try
            {
                var patchData0 = await FetchRepoJson($"Patches/{CURRENT_VERSION}.json");
                if (patchData0 is JsonElement patchData)
                {
                    // Check Ed25519 signature if signing is configured
                    bool? sigValid = null;
                    string? sigError = null;
                    var patchService = new Services.PatchService(_httpFactory, _config);
                    if (patchService.IsSigningConfigured)
                    {
                        var (valid, error) = patchService.VerifyManifestSignature(patchData.GetRawText());
                        sigValid = valid;
                        sigError = error;
                    }

                    hotfixPatch = new
                    {
                        available = true,
                        patch_id = patchData.TryGetProperty("patch_id", out var pid) ? pid.GetString() : null,
                        description = patchData.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                        severity = patchData.TryGetProperty("severity", out var sev) ? sev.GetString() : "low",
                        silent = patchData.TryGetProperty("silent", out var sil) && sil.GetBoolean(),
                        files = patchData.TryGetProperty("files", out var files) ? files.GetArrayLength() : 0,
                        signature_valid = sigValid,
                        signature_error = sigError,
                    };
                }
                else
                {
                    hotfixPatch = new { available = false, message = "No patches for current version" };
                }
            }
            catch (Exception ex)
            {
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
            releases_page = RELEASES_PAGE,
            checked_at = DateTime.UtcNow.ToString("o"),
            auto_check_enabled = true,
            errors = errors.Count > 0 ? errors : null,
        });
    }

    // ── List downloadable builds from the GitHub Releases/ folder ────
    [HttpGet("releases")]
    public async Task<IActionResult> ListReleases()
    {
        var repoUrl = (_config["PATCH_REPO_URL"] ?? "").TrimEnd('/');
        if (string.IsNullOrEmpty(repoUrl))
            return Ok(new { releases = Array.Empty<object>(), releases_page = RELEASES_PAGE, message = "Update repo not configured" });
        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            http.DefaultRequestHeaders.Add("User-Agent", $"WatchNexus/{CURRENT_VERSION}");
            var token = _config["PATCH_REPO_TOKEN"] ?? "";
            if (!string.IsNullOrEmpty(token))
                http.DefaultRequestHeaders.Add("Authorization", $"token {token}");
            var resp = await http.GetAsync($"{repoUrl}/contents/Releases");
            if (!resp.IsSuccessStatusCode)
                return Ok(new { releases = Array.Empty<object>(), releases_page = RELEASES_PAGE, message = $"Releases folder returned {(int)resp.StatusCode}" });
            var items = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;
            var releases = new List<object>();
            foreach (var item in items.EnumerateArray())
            {
                var name = item.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                if (name.Equals("readme.md", StringComparison.OrdinalIgnoreCase)) continue;
                releases.Add(new
                {
                    name,
                    type = item.TryGetProperty("type", out var t) ? t.GetString() : "file",
                    size = item.TryGetProperty("size", out var sz) ? sz.GetInt64() : 0,
                    download_url = item.TryGetProperty("download_url", out var du) ? du.GetString() : null,
                    html_url = item.TryGetProperty("html_url", out var hu) ? hu.GetString() : null,
                });
            }
            return Ok(new { releases, releases_page = RELEASES_PAGE, total = releases.Count });
        }
        catch (Exception ex)
        {
            return Ok(new { releases = Array.Empty<object>(), releases_page = RELEASES_PAGE, error = ex.Message });
        }
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
            try { var d = JsonDocument.Parse(lastCheck.Value).RootElement; lastCheckedAt = d.TryGetProperty("checked_at", out var ca) ? ca.GetString() : null; } catch { }
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
            catch { return null; }
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
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_settings" && s.UserId == "");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new AppSetting { Key = "update_settings", UserId = "", Value = body.GetRawText() });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Update settings saved" });
    }

    // ── Apply Hotfix Patch (from GitHub) ────────────────────────────
    // Server re-fetches the trusted manifest from the patch repo and
    // verifies every file's sha256 — the client only names the patch.
    // Web/config files apply LIVE (no restart); binaries are staged and
    // restart_required=true is returned.
    [HttpPost("apply-patch")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ApplyPatch([FromBody] JsonElement body, [FromServices] Services.PatchService patchService)
    {
        var patchId = body.TryGetProperty("patch_id", out var pid) ? pid.GetString() : null;
        if (string.IsNullOrEmpty(patchId))
            return BadRequest(new { success = false, message = "patch_id required" });
        if (!patchService.IsConfigured)
            return StatusCode(503, new { success = false, message = "Patch repo not configured (PATCH_REPO_URL)" });

        var manifest = await patchService.FetchManifestAsync(CURRENT_VERSION);
        if (manifest == null)
            return NotFound(new { success = false, message = $"No patch manifest found for v{CURRENT_VERSION}" });
        if (!string.Equals(manifest.PatchId, patchId, StringComparison.Ordinal))
            return BadRequest(new { success = false, message = $"Patch '{patchId}' does not match the published manifest ('{manifest.PatchId}')" });

        // Verify Ed25519 signature if signing is configured.
        bool? signatureValid = null;
        if (patchService.IsSigningConfigured)
        {
            var rawJson = await patchService.FetchManifestRawAsync(CURRENT_VERSION);
            if (rawJson == null)
            {
                // Fail closed: signing is configured but the exact raw manifest
                // (the bytes the signature covers) can't be fetched. Applying
                // without verification would defeat the purpose of signing.
                return StatusCode(500, new { success = false, message = "Patch refused: signing is configured but the raw manifest could not be fetched for signature verification" });
            }
            var (valid, error) = patchService.VerifyManifestSignature(rawJson);
            signatureValid = valid;
            if (valid == false)
                return BadRequest(new { success = false, message = $"Patch signature invalid: {error}" });
        }

        var result = await patchService.ApplyAsync(manifest, signatureValid);
        await Services.UpdateBackgroundService.RecordAsync(_db, manifest, result, applier: "manual");

        if (!result.Success)
            return StatusCode(500, new { success = false, message = $"Patch failed: {result.Error}" });

        return Ok(new
        {
            success = true,
            message = result.RestartRequired
                ? $"Patch {patchId} applied — {result.AppliedLive.Count} file(s) live, {result.StagedForRestart.Count} binary file(s) staged. Restart to finish."
                : $"Patch {patchId} applied live — no restart needed.",
            applied_live = result.AppliedLive,
            staged_for_restart = result.StagedForRestart,
            restart_required = result.RestartRequired,
            signature_valid = result.SignatureValid,
        });
    }

    // ── Restart status + graceful restart (binary patches only) ─────
    [HttpGet("restart-pending")]
    public async Task<IActionResult> RestartPending()
    {
        var pending = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_restart_pending" && s.UserId == "");
        var stagedDir = Path.Combine(AppContext.BaseDirectory, Services.PatchService.PendingDirName);
        var hasStaged = Directory.Exists(stagedDir) && Directory.EnumerateFiles(stagedDir, "*", SearchOption.AllDirectories).Any();
        if (!hasStaged) return Ok(new { restart_pending = false });
        object? info = null;
        if (pending?.Value != null) { try { info = JsonSerializer.Deserialize<object>(pending.Value); } catch { } }
        return Ok(new { restart_pending = true, patch = info });
    }

    [HttpPost("restart")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Restart([FromServices] IHostApplicationLifetime lifetime)
    {
        var pending = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_restart_pending" && s.UserId == "");
        if (pending != null) { _db.Settings.Remove(pending); await _db.SaveChangesAsync(); }
        // Graceful stop after the response flushes; the service manager
        // (systemd Restart=always / Windows service recovery / supervisor)
        // brings the process back up, applying staged binaries at boot.
        _ = Task.Run(async () => { await Task.Delay(1500); lifetime.StopApplication(); });
        return Ok(new { success = true, message = "Restarting — staged updates will be applied at boot. Back in a few seconds." });
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
        // Tamper-evident read: a paid tier is only honored when the stored hash
        // matches the stored serial (same policy as CellarController.ResolveTier).
        return CellarController.ResolveTier(setting?.Value);
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

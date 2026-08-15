using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Services;

// ══════════════════════════════════════════════════════════════════════
// UPDATE BACKGROUND SERVICE — auto-check + auto-apply silent patches.
// Push a patch to the private repo → within the configured interval the
// server picks it up, verifies it, and applies it live. Binaries are
// staged and wait for an owner-initiated restart.
// ══════════════════════════════════════════════════════════════════════
public class UpdateBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<UpdateBackgroundService> _logger;
    public const string CurrentVersion = "1.0.1";

    public UpdateBackgroundService(IServiceScopeFactory scopeFactory, ILogger<UpdateBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give the host a moment to finish booting before the first check.
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); } catch { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            var intervalHours = 24;
            try
            {
                intervalHours = await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Updater] Auto-update check failed");
            }
            try { await Task.Delay(TimeSpan.FromHours(Math.Clamp(intervalHours, 1, 168)), stoppingToken); }
            catch { return; }
        }
    }

    // Returns the configured check interval (hours) so the loop honors it.
    private async Task<int> RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var patchService = scope.ServiceProvider.GetRequiredService<PatchService>();

        var (autoCheck, intervalHours, autoInstall) = await ReadSettingsAsync(db);
        if (!autoCheck || !patchService.IsConfigured) return intervalHours;

        var manifest = await patchService.FetchManifestAsync(CurrentVersion);
        if (manifest == null || string.IsNullOrEmpty(manifest.PatchId)) return intervalHours;

        var alreadyApplied = await db.Settings.AnyAsync(
            s => s.Key == $"update_patch_done:{manifest.PatchId}" && s.UserId == "", ct);
        if (alreadyApplied) return intervalHours;

        if (!manifest.Silent || !autoInstall)
        {
            _logger.LogInformation("[Updater] Patch {PatchId} available (manual apply required)", manifest.PatchId);
            return intervalHours;
        }

        // Verify Ed25519 manifest signature if signing is configured.
        bool? signatureValid = null;
        if (patchService.IsSigningConfigured)
        {
            var rawJson = await patchService.FetchManifestRawAsync(CurrentVersion);
            if (rawJson == null)
            {
                // Fail closed: signing is configured but we can't fetch the
                // exact raw manifest to verify — refuse to auto-apply rather
                // than install an unverified patch.
                _logger.LogWarning("[Updater] Patch {PatchId} NOT applied: signing is configured but the raw manifest could not be fetched for signature verification", manifest.PatchId);
                return intervalHours;
            }
            var (valid, error) = patchService.VerifyManifestSignature(rawJson);
            signatureValid = valid;
            if (valid == false)
            {
                _logger.LogWarning("[Updater] Patch {PatchId} REJECTED: {Error}", manifest.PatchId, error);
                return intervalHours;
            }
        }

        _logger.LogInformation("[Updater] Auto-applying silent patch {PatchId}...", manifest.PatchId);
        var result = await patchService.ApplyAsync(manifest, signatureValid);
        await RecordAsync(db, manifest, result, applier: "auto");

        if (result.Success)
            _logger.LogInformation("[Updater] Patch {PatchId} applied — {Live} live file(s), {Staged} staged (restart_required={Restart})",
                manifest.PatchId, result.AppliedLive.Count, result.StagedForRestart.Count, result.RestartRequired);
        else
            _logger.LogWarning("[Updater] Patch {PatchId} FAILED: {Error}", manifest.PatchId, result.Error);

        return intervalHours;
    }

    private static async Task<(bool autoCheck, int intervalHours, bool autoInstall)> ReadSettingsAsync(AppDbContext db)
    {
        var cfg = await db.Settings.FirstOrDefaultAsync(s => s.Key == "update_settings" && s.UserId == "");
        if (cfg?.Value == null) return (true, 24, true);
        try
        {
            var d = JsonDocument.Parse(cfg.Value).RootElement;
            return (
                !d.TryGetProperty("auto_check", out var ac) || ac.ValueKind != JsonValueKind.False,
                d.TryGetProperty("check_interval_hours", out var ci) && ci.TryGetInt32(out var h) ? h : 24,
                !d.TryGetProperty("auto_install_patches", out var ai) || ai.ValueKind != JsonValueKind.False);
        }
        catch { return (true, 24, true); }
    }

    public static async Task RecordAsync(AppDbContext db, PatchManifest manifest, PatchApplyResult result, string applier)
    {
        var id = Guid.NewGuid().ToString("N")[..12];
        db.Settings.Add(new AppSetting
        {
            Key = $"update_applied:{id}",
            UserId = "",
            Value = JsonSerializer.Serialize(new
            {
                patch_id = manifest.PatchId,
                from_version = CurrentVersion,
                to_version = CurrentVersion,
                type = "hotfix",
                applied_at = DateTime.UtcNow.ToString("o"),
                status = result.Success ? (result.RestartRequired ? "applied_pending_restart" : "applied") : "failed",
                notes = result.Success
                    ? $"{manifest.Description} — {result.AppliedLive.Count} file(s) live, {result.StagedForRestart.Count} staged ({applier})"
                    : $"{manifest.Description} — FAILED: {result.Error}",
            }),
        });
        if (result.Success)
            db.Settings.Add(new AppSetting { Key = $"update_patch_done:{manifest.PatchId}", UserId = "", Value = DateTime.UtcNow.ToString("o") });
        if (result.Success && result.RestartRequired)
        {
            var existing = await db.Settings.FirstOrDefaultAsync(s => s.Key == "update_restart_pending" && s.UserId == "");
            var val = JsonSerializer.Serialize(new { patch_id = manifest.PatchId, staged = result.StagedForRestart, at = DateTime.UtcNow.ToString("o") });
            if (existing != null) existing.Value = val;
            else db.Settings.Add(new AppSetting { Key = "update_restart_pending", UserId = "", Value = val });
        }
        await db.SaveChangesAsync();
    }
}

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Services;

/// <summary>
/// Background service that periodically checks for updates from the license server.
/// Runs every 24 hours by default (configurable via update_settings).
/// Auto-downloads patches when available and logs discoveries.
/// </summary>
public class UpdateCheckerService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<UpdateCheckerService> _logger;
    private readonly IConfiguration _config;

    public UpdateCheckerService(IServiceProvider services, ILogger<UpdateCheckerService> logger, IConfiguration config)
    {
        _services = services;
        _logger = logger;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[UpdateChecker] Background update checker started");

        // Delay initial check by 5 minutes to let the app stabilize
        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckForUpdates(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[UpdateChecker] Update check cycle failed");
            }

            // Default interval: 24 hours (read from settings)
            var intervalHours = 24;
            try
            {
                using var scope = _services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var cfg = await db.Settings.FirstOrDefaultAsync(s => s.Key == "update_settings" && s.UserId == "", stoppingToken);
                if (cfg?.Value != null)
                {
                    var doc = JsonDocument.Parse(cfg.Value).RootElement;
                    if (doc.TryGetProperty("check_interval_hours", out var ci))
                        intervalHours = ci.GetInt32();
                }
            }
            catch { /* use default */ }

            _logger.LogDebug("[UpdateChecker] Next check in {Hours}h", intervalHours);
            await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
        }
    }

    private async Task CheckForUpdates(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

        // Get current tier from license
        var setting = await db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "", ct);
        var tier = "standard";
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value).RootElement;
                tier = doc.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
            }
            catch { /* use default */ }
        }

        var lsUrl = _config["LICENSE_SERVER_URL"] ?? "";
        if (string.IsNullOrEmpty(lsUrl)) return;

        try
        {
            using var http = httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/1.0.0");

            var resp = await http.GetAsync($"{lsUrl.TrimEnd('/')}/api/updates/manifest?tier={tier}&current=1.0.0", ct);
            if (!resp.IsSuccessStatusCode) return;

            var body = await resp.Content.ReadAsStringAsync(ct);
            var manifest = JsonDocument.Parse(body).RootElement;

            var latestVersion = manifest.TryGetProperty("latest_version", out var lv) ? lv.GetString() : null;
            var mandatory = manifest.TryGetProperty("mandatory", out var mn) && mn.GetBoolean();

            if (!string.IsNullOrEmpty(latestVersion) && latestVersion != "1.0.0")
            {
                _logger.LogInformation("[UpdateChecker] Update available: {Version} (mandatory: {Mandatory})", latestVersion, mandatory);

                // Store notification in DB for the frontend to pick up
                var notification = JsonSerializer.Serialize(new
                {
                    version = latestVersion,
                    mandatory,
                    discovered_at = DateTime.UtcNow.ToString("o"),
                    tier
                });
                var existing = await db.Settings.FirstOrDefaultAsync(s => s.Key == "update_available" && s.UserId == "", ct);
                if (existing != null) existing.Value = notification;
                else db.Settings.Add(new AppSetting { Key = "update_available", UserId = "", Value = notification });
                await db.SaveChangesAsync(ct);
            }

            // Record last check timestamp
            var checkData = JsonSerializer.Serialize(new
            {
                checked_at = DateTime.UtcNow.ToString("o"),
                version = "1.0.0",
                tier
            });
            var checkSetting = await db.Settings.FirstOrDefaultAsync(s => s.Key == "update_last_check" && s.UserId == "", ct);
            if (checkSetting != null) checkSetting.Value = checkData;
            else db.Settings.Add(new AppSetting { Key = "update_last_check", UserId = "", Value = checkData });
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "[UpdateChecker] Update check failed (license server unreachable)");
        }
    }
}

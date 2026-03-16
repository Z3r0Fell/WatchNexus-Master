using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Services;

/// <summary>
/// Background service for Matrix bot automation and featured film rotation.
/// Handles: inactivity checks, token drip (registration tokens), featured film rotation.
/// Replaces Python asyncio event loop with .NET IHostedService / BackgroundService.
/// </summary>
public class BotBackgroundService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<BotBackgroundService> _logger;

    public BotBackgroundService(IServiceProvider services, ILogger<BotBackgroundService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[BotService] Background service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunInactivityCheck(stoppingToken);
                await RunTokenDrip(stoppingToken);
                await RunFeaturedFilmRotation(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "[BotService] Error in background loop");
            }

            // Run every 30 minutes
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }

    /// <summary>
    /// Inactivity check — identifies Matrix rooms with no activity.
    /// Ported from Python asyncio inactivity check loop.
    /// </summary>
    private async Task RunInactivityCheck(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

        // Check all configured Matrix instances for inactive rooms
        var matrixConfigs = await db.Settings
            .Where(s => s.Key == "matrix_config" && s.Value != null)
            .ToListAsync(ct);

        foreach (var cfg in matrixConfigs)
        {
            try
            {
                var doc = JsonDocument.Parse(cfg.Value!).RootElement;
                var homeserver = doc.TryGetProperty("homeserver", out var hs) ? hs.GetString() : null;
                var token = doc.TryGetProperty("access_token", out var at) ? at.GetString() : null;
                var inactivityDays = doc.TryGetProperty("inactivity_threshold_days", out var itd) ? itd.GetInt32() : 30;

                if (homeserver == null || token == null) continue;

                var http = httpFactory.CreateClient();
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
                http.Timeout = TimeSpan.FromSeconds(15);

                // Get joined rooms
                var resp = await http.GetStringAsync($"{homeserver}/_matrix/client/v3/joined_rooms", ct);
                var rooms = JsonDocument.Parse(resp).RootElement;

                if (rooms.TryGetProperty("joined_rooms", out var joined))
                {
                    var inactiveRooms = new List<string>();
                    foreach (var roomId in joined.EnumerateArray().Take(50))
                    {
                        var id = roomId.GetString()!;
                        try
                        {
                            var msgResp = await http.GetStringAsync(
                                $"{homeserver}/_matrix/client/v3/rooms/{Uri.EscapeDataString(id)}/messages?limit=1&dir=b", ct);
                            var msgDoc = JsonDocument.Parse(msgResp);
                            if (msgDoc.RootElement.TryGetProperty("chunk", out var chunk) && chunk.GetArrayLength() > 0)
                            {
                                var lastEvent = chunk[0];
                                if (lastEvent.TryGetProperty("origin_server_ts", out var ts))
                                {
                                    var lastActivity = DateTimeOffset.FromUnixTimeMilliseconds(ts.GetInt64());
                                    if (lastActivity < DateTimeOffset.UtcNow.AddDays(-inactivityDays))
                                        inactiveRooms.Add(id);
                                }
                            }
                        }
                        catch { }
                    }

                    if (inactiveRooms.Count > 0)
                    {
                        _logger.LogInformation("[BotService] Found {Count} inactive rooms (>{Days}d) for user {User}",
                            inactiveRooms.Count, inactivityDays, cfg.UserId);

                        // Store inactive rooms report
                        var reportKey = $"bot_inactive_rooms:{cfg.UserId}";
                        var existing = await db.Settings.FirstOrDefaultAsync(
                            s => s.Key == reportKey && s.UserId == cfg.UserId, ct);
                        var report = JsonSerializer.Serialize(new
                        {
                            checked_at = DateTime.UtcNow,
                            inactive_rooms = inactiveRooms,
                            threshold_days = inactivityDays
                        });
                        if (existing != null) existing.Value = report;
                        else db.Settings.Add(new WatchNexus.Shared.AppSetting
                        { Key = reportKey, Value = report, UserId = cfg.UserId });
                        await db.SaveChangesAsync(ct);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[BotService] Inactivity check failed for config");
            }
        }
    }

    /// <summary>
    /// Token drip — periodically generates Synapse registration tokens.
    /// Ported from Python asyncio token drip loop.
    /// </summary>
    private async Task RunTokenDrip(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

        var synapseConfigs = await db.Settings
            .Where(s => s.Key == "synapse_admin_config" && s.Value != null)
            .ToListAsync(ct);

        foreach (var cfg in synapseConfigs)
        {
            try
            {
                var doc = JsonDocument.Parse(cfg.Value!).RootElement;
                var homeserver = doc.TryGetProperty("homeserver", out var hs) ? hs.GetString()?.TrimEnd('/') : null;
                var adminToken = doc.TryGetProperty("admin_token", out var at) ? at.GetString() : null;
                var tokenDripEnabled = doc.TryGetProperty("token_drip_enabled", out var td) && td.GetBoolean();

                if (homeserver == null || adminToken == null || !tokenDripEnabled) continue;

                var http = httpFactory.CreateClient();
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
                http.Timeout = TimeSpan.FromSeconds(15);

                // Check current token count
                var tokensResp = await http.GetStringAsync($"{homeserver}/_synapse/admin/v1/registration_tokens", ct);
                var tokens = JsonDocument.Parse(tokensResp);

                int activeTokens = 0;
                if (tokens.RootElement.TryGetProperty("registration_tokens", out var tokenList))
                {
                    foreach (var tkn in tokenList.EnumerateArray())
                    {
                        if (tkn.TryGetProperty("completed", out var comp) && comp.GetInt32() < 
                            (tkn.TryGetProperty("uses_allowed", out var ua) ? ua.GetInt32() : 1))
                            activeTokens++;
                    }
                }

                // If fewer than 3 active tokens, create a new one
                if (activeTokens < 3)
                {
                    var newToken = Guid.NewGuid().ToString("N")[..12];
                    var expiry = DateTimeOffset.UtcNow.AddDays(7).ToUnixTimeMilliseconds();
                    var payload = JsonSerializer.Serialize(new
                    {
                        token = newToken,
                        uses_allowed = 1,
                        expiry_time = expiry,
                    });
                    var content = new StringContent(payload, Encoding.UTF8, "application/json");
                    await http.PostAsync($"{homeserver}/_synapse/admin/v1/registration_tokens", content, ct);
                    _logger.LogInformation("[BotService] Token drip: Created registration token for user {User}", cfg.UserId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[BotService] Token drip failed for config");
            }
        }
    }

    /// <summary>
    /// Featured film rotation — picks a random trending movie from TMDB for "featured" display.
    /// </summary>
    private async Task RunFeaturedFilmRotation(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

        // Get TMDB API key from settings
        var tmdbConfig = await db.Settings
            .FirstOrDefaultAsync(s => s.Key == "tmdb_config" && s.Value != null, ct);

        string? tmdbApiKey = null;
        if (tmdbConfig?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(tmdbConfig.Value).RootElement;
                tmdbApiKey = doc.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
            }
            catch { }
        }

        // Fallback: check crumbs for TMDB key
        if (string.IsNullOrEmpty(tmdbApiKey))
        {
            var crumbsCfg = await db.Settings
                .FirstOrDefaultAsync(s => s.Key == "crumbs_tmdb" && s.Value != null, ct);
            if (crumbsCfg?.Value != null)
            {
                try
                {
                    var doc = JsonDocument.Parse(crumbsCfg.Value).RootElement;
                    tmdbApiKey = doc.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
                }
                catch { }
            }
        }

        if (string.IsNullOrEmpty(tmdbApiKey))
        {
            _logger.LogDebug("[BotService] No TMDB API key configured, skipping featured film rotation");
            return;
        }

        try
        {
            var http = httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(15);

            var page = Random.Shared.Next(1, 5);
            var resp = await http.GetStringAsync(
                $"https://api.themoviedb.org/3/movie/popular?api_key={tmdbApiKey}&page={page}", ct);
            var data = JsonDocument.Parse(resp);

            if (data.RootElement.TryGetProperty("results", out var results) && results.GetArrayLength() > 0)
            {
                var idx = Random.Shared.Next(results.GetArrayLength());
                var movie = results[idx];
                var featured = new
                {
                    selected_at = DateTime.UtcNow,
                    id = movie.TryGetProperty("id", out var id) ? id.GetInt32().ToString() : null,
                    name = movie.TryGetProperty("title", out var t) ? t.GetString() : null,
                    overview = movie.TryGetProperty("overview", out var ov) ? ov.GetString() : null,
                    year = movie.TryGetProperty("release_date", out var rd) ? rd.GetString()?[..4] : null,
                    rating = movie.TryGetProperty("vote_average", out var va) ? va.GetDouble() : 0,
                    poster = movie.TryGetProperty("poster_path", out var pp) ? $"https://image.tmdb.org/t/p/w500{pp.GetString()}" : null,
                    source = "tmdb",
                };

                var reportKey = "bot_featured_film:global";
                var existing = await db.Settings.FirstOrDefaultAsync(
                    s => s.Key == reportKey, ct);
                var report = JsonSerializer.Serialize(featured);
                if (existing != null) existing.Value = report;
                else db.Settings.Add(new WatchNexus.Shared.AppSetting
                { Key = reportKey, Value = report });
                await db.SaveChangesAsync(ct);

                _logger.LogInformation("[BotService] Featured film: {Movie}", featured.name);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[BotService] Featured film rotation failed");
        }
    }
}

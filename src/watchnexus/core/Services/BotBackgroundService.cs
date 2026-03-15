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
/// Background service for Matrix/Jellyfin bot automation — C# port of asyncio background loops.
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
    /// Inactivity check — identifies Matrix rooms or Jellyfin sessions with no activity.
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
    /// Featured film rotation — picks a random movie from Jellyfin library for "featured" display.
    /// Ported from Python asyncio featured film loop.
    /// </summary>
    private async Task RunFeaturedFilmRotation(CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var httpFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

        var jellyfinConfigs = await db.Settings
            .Where(s => s.Key == "jellyfin_config" && s.Value != null)
            .ToListAsync(ct);

        foreach (var cfg in jellyfinConfigs)
        {
            try
            {
                var doc = JsonDocument.Parse(cfg.Value!).RootElement;
                var url = doc.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') : null;
                var apiKey = doc.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
                var userId = doc.TryGetProperty("user_id", out var ui) ? ui.GetString() : null;
                var featuredEnabled = doc.TryGetProperty("featured_film_enabled", out var ff) && ff.GetBoolean();

                if (url == null || apiKey == null || !featuredEnabled) continue;

                var http = httpFactory.CreateClient();
                http.DefaultRequestHeaders.Add("X-Emby-Token", apiKey);
                http.Timeout = TimeSpan.FromSeconds(15);

                // Get random movie
                var queryUrl = $"{url}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=100&SortBy=Random&Fields=Overview,Genres,CommunityRating";
                if (!string.IsNullOrEmpty(userId)) queryUrl += $"&UserId={userId}";

                var resp = await http.GetStringAsync(queryUrl, ct);
                var items = JsonDocument.Parse(resp);
                if (items.RootElement.TryGetProperty("Items", out var movieList) && movieList.GetArrayLength() > 0)
                {
                    var movie = movieList[0];
                    var featured = new
                    {
                        selected_at = DateTime.UtcNow,
                        id = movie.TryGetProperty("Id", out var id) ? id.GetString() : null,
                        name = movie.TryGetProperty("Name", out var n) ? n.GetString() : null,
                        overview = movie.TryGetProperty("Overview", out var ov) ? ov.GetString() : null,
                        year = movie.TryGetProperty("ProductionYear", out var py) ? py.GetInt32() : 0,
                        rating = movie.TryGetProperty("CommunityRating", out var cr) ? cr.GetDouble() : 0,
                        genres = movie.TryGetProperty("Genres", out var g) ? g.EnumerateArray().Select(x => x.GetString()).ToList() : new List<string?>(),
                        jellyfin_url = url,
                    };

                    var reportKey = $"bot_featured_film:{cfg.UserId}";
                    var existing = await db.Settings.FirstOrDefaultAsync(
                        s => s.Key == reportKey && s.UserId == cfg.UserId, ct);
                    var report = JsonSerializer.Serialize(featured);
                    if (existing != null) existing.Value = report;
                    else db.Settings.Add(new WatchNexus.Shared.AppSetting
                    { Key = reportKey, Value = report, UserId = cfg.UserId });
                    await db.SaveChangesAsync(ct);

                    _logger.LogInformation("[BotService] Featured film: {Movie} for user {User}",
                        featured.name, cfg.UserId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[BotService] Featured film rotation failed");
            }
        }
    }
}

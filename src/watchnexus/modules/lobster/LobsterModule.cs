using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WatchNexus.Shared;

namespace WatchNexus.Module.Lobster;

public class LobsterModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new ModuleManifest
    {
        Name = "Lobster",
        DisplayName = "Lobster Mesh",
        Version = "1.0.0",
        Description = "Tailscale-based mesh networking for secure P2P media streaming. Encrypted tunnels, NAT traversal, relay fallback, and device coordination.",
        Codename = "lobster",
        Author = "WatchNexus",
        Tier = "standard",
        Dependencies = new[] { "core" },
        ApiRoutePrefix = "lobster",
        ApiRoutes = new[]
        {
            "/api/lobster/status",
            "/api/lobster/start",
            "/api/lobster/stop",
            "/api/lobster/peers",
            "/api/lobster/pair"
        },
        FrontendPages = new[] { "LobsterPage" },
        Type = "controller"
    };

    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton(sp => new LobsterSettings(sp.GetService<IConfiguration>()));
        services.AddSingleton(sp => new LobsterClient(
            sp.GetRequiredService<LobsterSettings>(), sp.GetService<ILogger<LobsterClient>>()));
        services.AddSingleton<LobsterService>();
        services.AddHostedService(sp => sp.GetRequiredService<LobsterService>());
    }

    public void MapRoutes(IEndpointRouteBuilder routes)
    {
        // Read endpoints need any authenticated user; start/stop/pair change
        // server-wide mesh state and are admin-only.
        var group = routes.MapGroup($"/api/{Manifest.ApiRoutePrefix}").RequireAuthorization();
        var admin = new AuthorizeAttribute { Roles = "admin" };

        group.MapGet("/status", async (LobsterService svc, LobsterClient client, CancellationToken ct) =>
            svc.Availability == LobsterAvailability.Ready
                ? await Proxy(() => client.GetStatusAsync(ct))
                : Results.Json(UnavailableStatus(svc))).WithName("lobster-status");

        group.MapPost("/start", (LobsterService svc, LobsterClient client, CancellationToken ct) =>
            Guarded(svc, () => client.StartAsync(ct))).WithName("lobster-start").RequireAuthorization(admin);

        group.MapPost("/stop", (LobsterService svc, LobsterClient client, CancellationToken ct) =>
            Guarded(svc, () => client.StopAsync(ct))).WithName("lobster-stop").RequireAuthorization(admin);

        group.MapGet("/peers", async (LobsterService svc, LobsterClient client, CancellationToken ct) =>
            svc.Availability == LobsterAvailability.Ready
                ? await Proxy(() => client.GetPeersAsync(ct))
                : Results.Json(Array.Empty<object>())).WithName("lobster-peers");

        group.MapPost("/pair", (LobsterService svc, LobsterClient client, CancellationToken ct) =>
            Guarded(svc, () => client.PairAsync(ct))).WithName("lobster-pair").RequireAuthorization(admin);
    }

    internal static string AvailabilityStatus(LobsterAvailability a) => a switch
    {
        LobsterAvailability.NotConfigured => "not_configured",
        LobsterAvailability.NotInstalled => "not_installed",
        LobsterAvailability.Starting => "sidecar_starting",
        _ => "unavailable",
    };

    // Same shape as the sidecar's status so LobsterPage renders it directly
    // (200, not 503: "not configured" is a state, not a failure).
    internal static object UnavailableStatus(LobsterService svc) => new
    {
        status = AvailabilityStatus(svc.Availability),
        configured = svc.Availability != LobsterAvailability.NotConfigured,
        online = false,
        hostname = (string?)null,
        tailnet_ip = (string?)null,
        auth_url = (string?)null,
        connect_url = (string?)null,
        peers = Array.Empty<object>(),
        message = svc.Message,
    };

    internal static async Task<IResult> Guarded(LobsterService svc, Func<Task<SidecarResponse>> call)
    {
        if (svc.Availability != LobsterAvailability.Ready)
        {
            return Results.Json(
                new { error = AvailabilityStatus(svc.Availability), message = svc.Message ?? "Lobster is unavailable" },
                statusCode: svc.Availability == LobsterAvailability.NotConfigured
                    ? StatusCodes.Status409Conflict
                    : StatusCodes.Status503ServiceUnavailable);
        }
        return await Proxy(call);
    }

    // Pass the sidecar's 2xx/400/409 through (they carry a user-facing
    // `message`). Anything else (notably a 401 from a control-key mismatch)
    // becomes 502: forwarding a 401 would make the frontend log the user out.
    internal static async Task<IResult> Proxy(Func<Task<SidecarResponse>> call)
    {
        try
        {
            var resp = await call();
            if (resp.IsSuccess || resp.StatusCode is 400 or 409)
                return Results.Json(resp.Body, statusCode: resp.StatusCode);
            return Results.Json(
                new { error = "sidecar_error", message = $"Lobster sidecar returned HTTP {resp.StatusCode}" },
                statusCode: StatusCodes.Status502BadGateway);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return Results.Json(
                new { error = "sidecar_unreachable", message = "Lobster sidecar is not running or unreachable" },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}

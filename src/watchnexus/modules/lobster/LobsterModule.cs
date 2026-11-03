using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WatchNexus.Module.Lobster;
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
        services.AddHostedService<LobsterService>();
        services.AddSingleton<LobsterClient>();
    }

    public void MapRoutes(IEndpointRouteBuilder routes)
    {
        // The frontend (lobsterApi in nexusApi.js) calls /api/lobster/*. Routes
        // were previously mapped without the /api prefix and with no auth, so
        // the UI always got a 404 and the sidecar control surface was open to
        // anonymous callers. Read endpoints need any authenticated user;
        // start/stop/pair change server-wide mesh state and are admin-only.
        var group = routes.MapGroup($"/api/{Manifest.ApiRoutePrefix}").RequireAuthorization();
        var admin = new AuthorizeAttribute { Roles = "admin" };

        group.MapGet("/status", (LobsterClient client, CancellationToken ct) =>
            Proxy(() => client.GetStatusAsync(ct))).WithName("lobster-status");

        group.MapPost("/start", (LobsterClient client, CancellationToken ct) =>
            Proxy(() => client.StartAsync(ct))).WithName("lobster-start").RequireAuthorization(admin);

        group.MapPost("/stop", (LobsterClient client, CancellationToken ct) =>
            Proxy(() => client.StopAsync(ct))).WithName("lobster-stop").RequireAuthorization(admin);

        group.MapGet("/peers", (LobsterClient client, CancellationToken ct) =>
            Proxy(() => client.GetPeersAsync(ct))).WithName("lobster-peers");

        group.MapPost("/pair", (LobsterClient client, CancellationToken ct) =>
            Proxy(() => client.PairAsync(ct))).WithName("lobster-pair").RequireAuthorization(admin);
    }

    // The sidecar is optional (not shipped in every install). When it is not
    // running, return a 503 with a `message` the LobsterPage toast can show
    // instead of an unhandled HttpRequestException -> 500.
    internal static async Task<IResult> Proxy(Func<Task<System.Text.Json.JsonElement>> call)
    {
        try
        {
            return Results.Json(await call());
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return Results.Json(
                new { message = "Lobster sidecar is not running or unreachable", error = ex.GetType().Name },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}

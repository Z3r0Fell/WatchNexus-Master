using System.Diagnostics;
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
        var prefix = Manifest.ApiRoutePrefix;

        routes.MapGet($"{prefix}/status", async (LobsterClient client) =>
        {
            var status = await client.GetStatusAsync();
            return Results.Json(status);
        }).WithName("lobster-status");

        routes.MapPost($"{prefix}/start", async (LobsterClient client) =>
        {
            var result = await client.StartAsync();
            return Results.Json(result);
        }).WithName("lobster-start");

        routes.MapPost($"{prefix}/stop", async (LobsterClient client) =>
        {
            var result = await client.StopAsync();
            return Results.Json(result);
        }).WithName("lobster-stop");

        routes.MapGet($"{prefix}/peers", async (LobsterClient client) =>
        {
            var peers = await client.GetPeersAsync();
            return Results.Json(peers);
        }).WithName("lobster-peers");

        routes.MapPost($"{prefix}/pair", async (LobsterClient client) =>
        {
            var result = await client.PairAsync();
            return Results.Json(result);
        }).WithName("lobster-pair");
    }
}

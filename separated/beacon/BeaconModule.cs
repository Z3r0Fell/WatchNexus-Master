using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Beacon;

/// <summary>
/// Beacon is a desktop system tray application.
/// This module contains the server-side API for tray ↔ server communication.
/// The actual tray UI is built with Avalonia UI (separate project).
/// </summary>

// ── Controller ───────────────────────────────────────────────
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/beacon")]
[Authorize]
public class BeaconController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        server_running = true,
        version = "2.6.5",
        uptime = (DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalSeconds,
        pid = Environment.ProcessId,
    });

    [HttpPost("restart")]
    public IActionResult Restart() => Ok(new { status = "restart_requested" });

    [HttpPost("shutdown")]
    public IActionResult Shutdown() => Ok(new { status = "shutdown_requested" });

    [HttpGet("config")]
    public IActionResult GetConfig() => Ok(new
    {
        auto_start = true,
        minimize_to_tray = true,
        show_notifications = true,
        port = 8001,
    });
}

// ── Module Registration ──────────────────────────────────────
public class BeaconModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Beacon", Codename = "beacon",
        DisplayName = "System Tray Application", Version = "2.6.5",
        Description = "Desktop system tray controller for server management and quick access",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Drizzle;

// ── Models ───────────────────────────────────────────────────
public class Playlist
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string UserId { get; set; } = "";
    public int ItemCount { get; set; }
    public long TotalDuration { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class PlaylistItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PlaylistId { get; set; } = "";
    public string MediaItemId { get; set; } = "";
    public int Position { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

public class QueueItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string MediaItemId { get; set; } = "";
    public int Position { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api/drizzle")]
[Authorize]
public class DrizzleController : ControllerBase
{
    [HttpGet("playlists")]
    public IActionResult GetPlaylists() => Ok(Array.Empty<object>());

    [HttpPost("playlists")]
    public IActionResult CreatePlaylist([FromBody] object req) =>
        Ok(new { id = Guid.NewGuid().ToString(), status = "created" });

    [HttpGet("queue")]
    public IActionResult GetQueue() => Ok(new { items = Array.Empty<object>(), now_playing = (object?)null });

    [HttpPost("queue/add")]
    public IActionResult AddToQueue([FromBody] object req) =>
        Ok(new { status = "added" });

    [HttpPost("queue/clear")]
    public IActionResult ClearQueue() => Ok(new { status = "cleared" });
}

// ── Module Registration ──────────────────────────────────────
public class DrizzleModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Drizzle", Codename = "drizzle",
        DisplayName = "Playlist Engine", Version = "2.7.3-alpha",
        Description = "Continuous playback, queue management, and playlist creation",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

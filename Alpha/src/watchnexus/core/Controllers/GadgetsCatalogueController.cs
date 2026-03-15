using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WatchNexus.Core.Controllers;

[Route("api/gadgets")]
[ApiController]
[Authorize]
public class GadgetsCatalogueController : ControllerBase
{
    [HttpGet("plugins")]
    public IActionResult Plugins() => Ok(new[]
    {
        new { id = "weather", name = "Weather", version = "1.0.0", author = "WatchNexus", status = "active", description = "Weather dashboard using Open-Meteo", plugin_type = "weather", category = "weather" },
        new { id = "podcasts", name = "Podcasts", version = "1.0.0", author = "WatchNexus", status = "active", description = "Podcast player with iTunes search and RSS feeds", plugin_type = "audio", category = "audio" },
        new { id = "radio", name = "Internet Radio", version = "1.0.0", author = "WatchNexus", status = "active", description = "Live radio streams via Radio Browser API", plugin_type = "audio", category = "audio" },
        new { id = "photos", name = "Photo Gallery", version = "1.0.0", author = "WatchNexus", status = "active", description = "Browse and view photos from local libraries", plugin_type = "image", category = "image" },
        new { id = "webvideo", name = "Web Video", version = "1.0.0", author = "WatchNexus", status = "active", description = "Web video bookmarks, history, and YouTube info", plugin_type = "video", category = "video" },
        new { id = "matrix", name = "Matrix Chat", version = "1.0.0", author = "WatchNexus", status = "active", description = "Matrix messaging, room management, and event sync", plugin_type = "notification", category = "notification" },
        new { id = "jellyfin", name = "Jellyfin Bridge", version = "1.0.0", author = "WatchNexus", status = "active", description = "Browse and manage your Jellyfin media server library", plugin_type = "metadata", category = "metadata" },
        new { id = "synapse-admin", name = "Synapse Admin", version = "1.0.0", author = "WatchNexus", status = "active", description = "Synapse homeserver user, room, and media management", plugin_type = "system", category = "system" },
        new { id = "gamebot", name = "Movie Quiz", version = "1.0.0", author = "WatchNexus", status = "active", description = "Guess-the-poster games with blur and reveal effects", plugin_type = "game", category = "game" },
        new { id = "bot", name = "Background Automation", version = "1.0.0", author = "WatchNexus", status = "active", description = "Inactivity checks, token drip, and featured film rotation", plugin_type = "service", category = "service" },
    });

    [HttpGet("plugins/{id}")]
    public IActionResult Plugin(string id) => Ok(new { id, name = id, status = "active" });

    [HttpGet("catalogue/search")]
    public IActionResult CatalogueSearch([FromQuery] string q = "") => Ok(Array.Empty<object>());

    [HttpGet("catalogue/categories")]
    public IActionResult Categories() => Ok(new[] { "media", "utilities", "social", "productivity", "customization" });

    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());

    [HttpPost("import-url")]
    public IActionResult ImportUrl() => Ok(new { status = "imported" });

    [HttpPost("import-file")]
    public IActionResult ImportFile() => Ok(new { status = "imported" });
}

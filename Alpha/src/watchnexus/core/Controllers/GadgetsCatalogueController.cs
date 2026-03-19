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
        new { id = "weather", codename = "sorbet", name = "Weather", version = "1.0.0", author = "WatchNexus", status = "active", description = "Weather dashboard using Open-Meteo", plugin_type = "weather", category = "weather" },
        new { id = "podcasts", codename = "brioche", name = "Podcasts", version = "1.0.0", author = "WatchNexus", status = "active", description = "Podcast player with iTunes search and RSS feeds", plugin_type = "audio", category = "audio" },
        new { id = "radio", codename = "nectar", name = "Internet Radio", version = "1.0.0", author = "WatchNexus", status = "active", description = "Live radio streams via Radio Browser API", plugin_type = "audio", category = "audio" },
        new { id = "photos", codename = "ganache", name = "Photo Gallery", version = "1.0.0", author = "WatchNexus", status = "active", description = "Browse and view photos from local libraries", plugin_type = "image", category = "image" },
        new { id = "webvideo", codename = "bisque", name = "Web Video", version = "1.0.0", author = "WatchNexus", status = "active", description = "Web video bookmarks, history, and YouTube info", plugin_type = "video", category = "video" },
        new { id = "matrix", codename = "marzipan", name = "Matrix Chat", version = "1.0.0", author = "WatchNexus", status = "active", description = "Matrix messaging, room management, and event sync", plugin_type = "notification", category = "notification" },
        new { id = "synapse-admin", codename = "cinnamon", name = "Synapse Admin", version = "1.0.0", author = "WatchNexus", status = "active", description = "Synapse homeserver user, room, and media management", plugin_type = "system", category = "system" },
        new { id = "gamebot", codename = "waffle", name = "Movie Quiz", version = "1.0.0", author = "WatchNexus", status = "active", description = "Guess-the-poster games with blur and reveal effects", plugin_type = "game", category = "game" },
        new { id = "media-bridge", codename = "custard", name = "Media Bridge", version = "1.0.0", author = "WatchNexus", status = "active", description = "Browse and manage your external Emby-compatible media server library", plugin_type = "metadata", category = "metadata" },
        new { id = "bot", codename = "yeast", name = "Background Automation", version = "1.0.0", author = "WatchNexus", status = "active", description = "Inactivity checks, token drip, and featured film rotation", plugin_type = "service", category = "service" },
        new { id = "truffle", codename = "truffle", name = "Watch Analytics", version = "1.0.0", author = "WatchNexus", status = "active", description = "Play tracking, viewing stats, trends, and Year Wrapped", plugin_type = "analytics", category = "analytics" },
        new { id = "pepper", codename = "pepper", name = "Notification Hub", version = "1.0.0", author = "WatchNexus", status = "active", description = "Discord, Telegram, Slack, and Pushover alerts for media events", plugin_type = "notification", category = "notification" },
        new { id = "meringue", codename = "meringue", name = "User Requests", version = "1.0.0", author = "WatchNexus", status = "active", description = "Users request movies/TV shows, admins approve or reject", plugin_type = "social", category = "social" },
        new { id = "rind", codename = "rind", name = "Parental Controls", version = "1.0.0", author = "WatchNexus", status = "active", description = "Content rating filters, PIN locks, and per-user restrictions", plugin_type = "security", category = "security" },
        new { id = "crucible", codename = "crucible", name = "Media Processing", version = "1.0.0", author = "WatchNexus", status = "active", description = "FFmpeg transcoding, H.265 conversion, subtitle extraction, and file analysis", plugin_type = "processing", category = "processing" },
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

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
        new { id = "weather", codename = "sorbet", name = "Weather", version = "1.0.1", author = "WatchNexus", status = "active", description = "Weather dashboard using Open-Meteo", plugin_type = "weather", category = "weather" },
        new { id = "podcasts", codename = "brioche", name = "Podcasts", version = "1.0.1", author = "WatchNexus", status = "active", description = "Podcast player with iTunes search and RSS feeds", plugin_type = "audio", category = "audio" },
        new { id = "radio", codename = "nectar", name = "Internet Radio", version = "1.0.1", author = "WatchNexus", status = "active", description = "Live radio streams via Radio Browser API", plugin_type = "audio", category = "audio" },
        new { id = "photos", codename = "ganache", name = "Photo Gallery", version = "1.0.1", author = "WatchNexus", status = "active", description = "Browse and view photos from local libraries", plugin_type = "image", category = "image" },
        new { id = "webvideo", codename = "bisque", name = "Web Video", version = "1.0.1", author = "WatchNexus", status = "active", description = "Web video bookmarks, history, and YouTube info", plugin_type = "video", category = "video" },
        new { id = "matrix", codename = "marzipan", name = "Matrix Chat", version = "1.0.1", author = "WatchNexus", status = "active", description = "Matrix messaging, room management, and event sync", plugin_type = "notification", category = "notification" },
        new { id = "synapse-admin", codename = "cinnamon", name = "Synapse Admin", version = "1.0.1", author = "WatchNexus", status = "active", description = "Synapse homeserver user, room, and media management", plugin_type = "system", category = "system" },
        new { id = "gamebot", codename = "waffle", name = "Movie Quiz", version = "1.0.1", author = "WatchNexus", status = "active", description = "Guess-the-poster games with blur and reveal effects", plugin_type = "game", category = "game" },
        new { id = "media-bridge", codename = "custard", name = "Media Bridge", version = "1.0.1", author = "WatchNexus", status = "active", description = "Browse and manage your external Emby-compatible media server library", plugin_type = "metadata", category = "metadata" },
        new { id = "bot", codename = "yeast", name = "Background Automation", version = "1.0.1", author = "WatchNexus", status = "active", description = "Inactivity checks, token drip, and featured film rotation", plugin_type = "service", category = "service" },
        new { id = "truffle", codename = "truffle", name = "Watch Analytics", version = "1.0.1", author = "WatchNexus", status = "active", description = "Play tracking, viewing stats, trends, and Year Wrapped", plugin_type = "analytics", category = "analytics" },
        new { id = "pepper", codename = "pepper", name = "Notification Hub", version = "1.0.1", author = "WatchNexus", status = "active", description = "Discord, Telegram, Slack, and Pushover alerts for media events", plugin_type = "notification", category = "notification" },
        new { id = "meringue", codename = "meringue", name = "User Requests", version = "1.0.1", author = "WatchNexus", status = "active", description = "Users request movies/TV shows, admins approve or reject", plugin_type = "social", category = "social" },
        new { id = "rind", codename = "rind", name = "Parental Controls", version = "1.0.1", author = "WatchNexus", status = "active", description = "Content rating filters, PIN locks, and per-user restrictions", plugin_type = "security", category = "security" },
        new { id = "crucible", codename = "crucible", name = "Media Processing", version = "1.0.1", author = "WatchNexus", status = "active", description = "FFmpeg transcoding, H.265 conversion, subtitle extraction, and file analysis", plugin_type = "processing", category = "processing" },
        new { id = "brine", codename = "brine", name = "Usenet Indexer", version = "1.0.1", author = "WatchNexus", status = "active", description = "Search NZBs via Prowlarr or Newznab-compatible indexers", plugin_type = "usenet", category = "usenet" },
        new { id = "ladle", codename = "ladle", name = "Usenet Downloader", version = "1.0.1", author = "WatchNexus", status = "active", description = "SABnzbd queue management, downloads, history, and speed control", plugin_type = "usenet", category = "usenet" },
        new { id = "glaze", codename = "glaze", name = "Scrobbling", version = "1.0.1", author = "WatchNexus", status = "active", description = "Trakt.tv and Last.fm scrobbling, watch history sync", plugin_type = "social", category = "social" },
        new { id = "fondue", codename = "fondue", name = "Movie Automation", version = "1.0.1", author = "WatchNexus", status = "active", description = "Auto-grab, monitor, and upgrade movies (Radarr-like)", plugin_type = "automation", category = "automation" },
        new { id = "bastion", codename = "bastion", name = "Advanced Auth", version = "1.0.1", author = "WatchNexus", status = "active", description = "LDAP, SSO, 2FA, and session management", plugin_type = "security", category = "security" },
        new { id = "tunnel", codename = "tunnel", name = "Network Config", version = "1.0.1", author = "WatchNexus", status = "active", description = "Reverse proxy, UPnP, SSL certificates, and dynamic DNS", plugin_type = "system", category = "system" },
        new { id = "sourdough", codename = "sourdough", name = "Backup & Restore", version = "1.0.1", author = "WatchNexus", status = "active", description = "Full backups, scheduled snapshots, config export/import", plugin_type = "system", category = "system" },
        new { id = "taffy", codename = "taffy", name = "Metadata Agents", version = "1.0.1", author = "WatchNexus", status = "active", description = "TMDB, TVDB, IMDb, MusicBrainz provider management", plugin_type = "metadata", category = "metadata" },
        new { id = "churro", codename = "churro", name = "Download Clients", version = "1.0.1", author = "WatchNexus", status = "active", description = "qBittorrent, SABnzbd, Transmission, Deluge client management", plugin_type = "downloads", category = "downloads" },
        new { id = "saffron", codename = "saffron", name = "Scheduled Tasks", version = "1.0.1", author = "WatchNexus", status = "active", description = "Library scans, metadata refresh, cleanup, and custom schedules", plugin_type = "system", category = "system" },
        new { id = "pantry", codename = "pantry", name = "Storage Manager", version = "1.0.1", author = "WatchNexus", status = "active", description = "Disk monitoring, file cleanup, path mappings, storage analytics", plugin_type = "system", category = "system" },
        new { id = "nutmeg", codename = "nutmeg", name = "Recommendations", version = "1.0.1", author = "WatchNexus", status = "active", description = "AI-powered recommendations based on watch history", plugin_type = "discovery", category = "discovery" },
        new { id = "roux", codename = "roux", name = "Collections", version = "1.0.1", author = "WatchNexus", status = "active", description = "Smart & manual collections, auto-curated media groups", plugin_type = "library", category = "library" },
        new { id = "sprout", codename = "sprout", name = "RSS Feeds", version = "1.0.1", author = "WatchNexus", status = "active", description = "RSS/Atom feed generator for library content", plugin_type = "social", category = "social" },
        new { id = "setup", codename = "setup", name = "Setup Wizard", version = "1.0.1", author = "WatchNexus", status = "active", description = "First-run setup wizard for initial configuration", plugin_type = "system", category = "system" },
    });

    [HttpGet("plugins/{id}")]
    public IActionResult Plugin(string id) => Ok(new { id, name = id, status = "active" });

    [HttpGet("catalogue/search")]
    public IActionResult CatalogueSearch([FromQuery] string? q = "", [FromQuery] string? category = "")
    {
        // Build full catalogue from plugins list
        var allPlugins = new[]
        {
            new { id = "weather", codename = "sorbet", name = "Weather Dashboard", version = "1.0.1", category = "weather", description = "Weather dashboard using Open-Meteo", supported = true, compatibility_note = "", tags = new[] { "weather", "dashboard", "forecast" } },
            new { id = "podcasts", codename = "brioche", name = "Podcasts", version = "1.0.1", category = "audio", description = "Podcast player with iTunes search and RSS feeds", supported = true, compatibility_note = "", tags = new[] { "podcasts", "audio", "rss" } },
            new { id = "radio", codename = "nectar", name = "Internet Radio", version = "1.0.1", category = "audio", description = "Live radio streams via Radio Browser API", supported = true, compatibility_note = "", tags = new[] { "radio", "streaming", "music" } },
            new { id = "photos", codename = "ganache", name = "Photo Gallery", version = "1.0.1", category = "image", description = "Browse and view photos from local libraries", supported = true, compatibility_note = "", tags = new[] { "photos", "gallery", "images" } },
            new { id = "webvideo", codename = "bisque", name = "Web Video", version = "1.0.1", category = "video", description = "Web video bookmarks, history, and YouTube info", supported = true, compatibility_note = "", tags = new[] { "youtube", "video", "bookmarks" } },
            new { id = "matrix", codename = "marzipan", name = "Matrix Chat", version = "1.0.1", category = "notification", description = "Matrix messaging, room management, and event sync", supported = true, compatibility_note = "", tags = new[] { "chat", "matrix", "messaging" } },
            new { id = "synapse-admin", codename = "cinnamon", name = "Synapse Admin", version = "1.0.1", category = "system", description = "Synapse homeserver user, room, and media management", supported = true, compatibility_note = "", tags = new[] { "synapse", "admin", "matrix" } },
            new { id = "gamebot", codename = "waffle", name = "Movie Quiz", version = "1.0.1", category = "game", description = "Guess-the-poster games with blur and reveal effects", supported = true, compatibility_note = "", tags = new[] { "quiz", "game", "fun" } },
            new { id = "media-bridge", codename = "custard", name = "Media Bridge", version = "1.0.1", category = "metadata", description = "Browse and manage your external Emby-compatible media server library", supported = true, compatibility_note = "", tags = new[] { "emby", "jellyfin", "bridge" } },
            new { id = "bot", codename = "yeast", name = "Background Automation", version = "1.0.1", category = "service", description = "Inactivity checks, token drip, and featured film rotation", supported = true, compatibility_note = "", tags = new[] { "automation", "background", "bot" } },
            new { id = "truffle", codename = "truffle", name = "Watch Analytics", version = "1.0.1", category = "system", description = "Play tracking, viewing stats, trends, and Year Wrapped", supported = true, compatibility_note = "", tags = new[] { "analytics", "stats", "tracking" } },
            new { id = "pepper", codename = "pepper", name = "Notification Hub", version = "1.0.1", category = "notification", description = "Discord, Telegram, Slack, and Pushover alerts", supported = true, compatibility_note = "", tags = new[] { "notifications", "discord", "telegram" } },
            new { id = "meringue", codename = "meringue", name = "User Requests", version = "1.0.1", category = "social", description = "Users request movies/TV shows, admins approve", supported = true, compatibility_note = "", tags = new[] { "requests", "overseerr", "jellyseerr" } },
            new { id = "rind", codename = "rind", name = "Parental Controls", version = "1.0.1", category = "security", description = "Content rating filters, PIN locks, per-user restrictions", supported = true, compatibility_note = "", tags = new[] { "parental", "controls", "safety" } },
            new { id = "crucible", codename = "crucible", name = "Media Processing", version = "1.0.1", category = "system", description = "FFmpeg transcoding, H.265 conversion, subtitle extraction", supported = true, compatibility_note = "", tags = new[] { "transcoding", "ffmpeg", "processing" } },
            new { id = "brine", codename = "brine", name = "Usenet Indexer", version = "1.0.1", category = "usenet", description = "Search NZBs via Newznab-compatible indexers", supported = true, compatibility_note = "", tags = new[] { "usenet", "nzb", "indexer" } },
            new { id = "ladle", codename = "ladle", name = "Usenet Downloader", version = "1.0.1", category = "usenet", description = "SABnzbd queue management, downloads, history", supported = true, compatibility_note = "", tags = new[] { "usenet", "sabnzbd", "download" } },
            new { id = "glaze", codename = "glaze", name = "Scrobbling", version = "1.0.1", category = "social", description = "Trakt.tv and Last.fm scrobbling, watch history sync", supported = true, compatibility_note = "", tags = new[] { "trakt", "lastfm", "scrobble" } },
            new { id = "fondue", codename = "fondue", name = "Movie Automation", version = "1.0.1", category = "automation", description = "Auto-grab, monitor, and upgrade movies (Radarr-like)", supported = true, compatibility_note = "", tags = new[] { "radarr", "automation", "movies" } },
            new { id = "bastion", codename = "bastion", name = "Advanced Auth", version = "1.0.1", category = "security", description = "LDAP, SSO, 2FA, and session management", supported = true, compatibility_note = "", tags = new[] { "ldap", "sso", "2fa" } },
            new { id = "tunnel", codename = "tunnel", name = "Network Config", version = "1.0.1", category = "system", description = "Reverse proxy, UPnP, SSL certificates, dynamic DNS", supported = true, compatibility_note = "", tags = new[] { "network", "proxy", "ssl" } },
            new { id = "sourdough", codename = "sourdough", name = "Backup & Restore", version = "1.0.1", category = "system", description = "Full backups, scheduled snapshots, config export/import", supported = true, compatibility_note = "", tags = new[] { "backup", "restore", "snapshot" } },
            new { id = "taffy", codename = "taffy", name = "Metadata Agents", version = "1.0.1", category = "metadata", description = "TMDB, TVDB, IMDb, MusicBrainz provider management", supported = true, compatibility_note = "", tags = new[] { "tmdb", "tvdb", "metadata" } },
            new { id = "churro", codename = "churro", name = "Download Clients", version = "1.0.1", category = "system", description = "qBittorrent, SABnzbd, Transmission, Deluge management", supported = true, compatibility_note = "", tags = new[] { "qbittorrent", "downloads", "torrent" } },
            new { id = "saffron", codename = "saffron", name = "Scheduled Tasks", version = "1.0.1", category = "system", description = "Library scans, metadata refresh, cleanup schedules", supported = true, compatibility_note = "", tags = new[] { "scheduler", "tasks", "cron" } },
            new { id = "pantry", codename = "pantry", name = "Storage Manager", version = "1.0.1", category = "system", description = "Disk monitoring, file cleanup, path mappings", supported = true, compatibility_note = "", tags = new[] { "storage", "disk", "cleanup" } },
            new { id = "nutmeg", codename = "nutmeg", name = "Recommendations", version = "1.0.1", category = "system", description = "AI-powered recommendations based on watch history", supported = true, compatibility_note = "", tags = new[] { "recommendations", "ai", "discover" } },
        };

        var filtered = allPlugins.AsEnumerable();
        if (!string.IsNullOrEmpty(category)) filtered = filtered.Where(p => p.category == category);
        if (!string.IsNullOrEmpty(q)) filtered = filtered.Where(p => p.name.Contains(q, StringComparison.OrdinalIgnoreCase) || p.description.Contains(q, StringComparison.OrdinalIgnoreCase) || p.tags.Any(t => t.Contains(q, StringComparison.OrdinalIgnoreCase)));

        return Ok(new { items = filtered.ToList() });
    }

    [HttpGet("catalogue/categories")]
    public IActionResult Categories() => Ok(new Dictionary<string, object>
    {
        ["audio"] = new { label = "Audio", count = 2 },
        ["weather"] = new { label = "Weather", count = 1 },
        ["image"] = new { label = "Photos & Images", count = 1 },
        ["video"] = new { label = "Video", count = 1 },
        ["notification"] = new { label = "Messaging", count = 2 },
        ["system"] = new { label = "System & Tools", count = 8 },
        ["game"] = new { label = "Games & Fun", count = 1 },
        ["metadata"] = new { label = "Metadata", count = 2 },
        ["service"] = new { label = "Services", count = 1 },
        ["social"] = new { label = "Social & Sharing", count = 2 },
        ["security"] = new { label = "Security", count = 2 },
        ["usenet"] = new { label = "Usenet", count = 2 },
        ["automation"] = new { label = "Automation", count = 1 },
    });

    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());

    [HttpPost("import-url")]
    public IActionResult ImportUrl() => Ok(new { status = "imported" });

    [HttpPost("import-file")]
    public IActionResult ImportFile() => Ok(new { status = "imported" });
}

using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

[Route("api/gadgets")]
[ApiController]
[Authorize]
public class GadgetsCatalogueController : ControllerBase
{
    // Same per-user setting as RipenController (/api/ripen/activate|deactivate),
    // so both UIs see one source of truth for enabled/disabled gadgets.
    private const string DisabledKey = "ripen_disabled_gadgets";
    private readonly AppDbContext _db;
    public GadgetsCatalogueController(AppDbContext db) => _db = db;

    private async Task<(WatchNexus.Shared.AppSetting? row, HashSet<string> set)> LoadDisabled()
    {
        var uid = this.UserId();
        var row = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == DisabledKey);
        var set = new HashSet<string>();
        if (row?.Value != null)
            try { set = JsonSerializer.Deserialize<HashSet<string>>(row.Value) ?? set; } catch (JsonException) { }
        return (row, set);
    }

    [HttpGet("plugins")]
    public async Task<IActionResult> Plugins()
    {
        var (_, disabled) = await LoadDisabled();
        return Ok(PluginList.Select(p => new
        {
            p.id, p.codename, p.name, p.version, p.author,
            status = disabled.Contains(p.id) ? "inactive" : p.status,
            p.description, p.plugin_type, p.category
        }));
    }

    // PluginMarketplacePage toggles via these; they share Ripen's per-user setting.
    [HttpPost("plugins/{id}/enable")]
    public Task<IActionResult> Enable(string id) => SetEnabled(id, true);

    [HttpPost("plugins/{id}/disable")]
    public Task<IActionResult> Disable(string id) => SetEnabled(id, false);

    private async Task<IActionResult> SetEnabled(string id, bool enabled)
    {
        if (!PluginList.Any(p => p.id == id)) return NotFound(new { detail = "Unknown plugin" });
        var (row, disabled) = await LoadDisabled();
        if (enabled) disabled.Remove(id); else disabled.Add(id);
        var json = JsonSerializer.Serialize(disabled);
        if (row != null) row.Value = json;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = DisabledKey, Value = json, UserId = this.UserId() });
        await _db.SaveChangesAsync();
        return Ok(new { id, status = enabled ? "active" : "inactive" });
    }

    private static readonly (string id, string codename, string name, string version, string author, string status, string description, string plugin_type, string category)[] PluginList =
    {
        ("weather", "sorbet", "Weather", "1.0.1", "WatchNexus", "active", "Weather dashboard using Open-Meteo", "weather", "weather"),
        ("podcasts", "brioche", "Podcasts", "1.0.1", "WatchNexus", "active", "Podcast player with iTunes search and RSS feeds", "audio", "audio"),
        ("radio", "nectar", "Internet Radio", "1.0.1", "WatchNexus", "active", "Live radio streams via Radio Browser API", "audio", "audio"),
        ("photos", "ganache", "Photo Gallery", "1.0.1", "WatchNexus", "active", "Browse and view photos from local libraries", "image", "image"),
        ("webvideo", "bisque", "Web Video", "1.0.1", "WatchNexus", "active", "Web video bookmarks, history, and YouTube info", "video", "video"),
        ("matrix", "marzipan", "Matrix Chat", "1.0.1", "WatchNexus", "active", "Matrix messaging, room management, and event sync", "notification", "notification"),
        ("synapse-admin", "cinnamon", "Synapse Admin", "1.0.1", "WatchNexus", "active", "Synapse homeserver user, room, and media management", "system", "system"),
        ("gamebot", "waffle", "Movie Quiz", "1.0.1", "WatchNexus", "active", "Guess-the-poster games with blur and reveal effects", "game", "game"),
        ("media-bridge", "custard", "Media Bridge", "1.0.1", "WatchNexus", "active", "Browse and manage your external Emby-compatible media server library", "metadata", "metadata"),
        ("bot", "yeast", "Background Automation", "1.0.1", "WatchNexus", "active", "Inactivity checks, token drip, and featured film rotation", "service", "service"),
        ("truffle", "truffle", "Watch Analytics", "1.0.1", "WatchNexus", "active", "Play tracking, viewing stats, trends, and Year Wrapped", "analytics", "analytics"),
        ("pepper", "pepper", "Notification Hub", "1.0.1", "WatchNexus", "active", "Discord, Telegram, Slack, and Pushover alerts for media events", "notification", "notification"),
        ("meringue", "meringue", "User Requests", "1.0.1", "WatchNexus", "active", "Users request movies/TV shows, admins approve or reject", "social", "social"),
        ("rind", "rind", "Parental Controls", "1.0.1", "WatchNexus", "active", "Content rating filters, PIN locks, and per-user restrictions", "security", "security"),
        ("crucible", "crucible", "Media Processing", "1.0.1", "WatchNexus", "active", "FFmpeg transcoding, H.265 conversion, subtitle extraction, and file analysis", "processing", "processing"),
        ("brine", "brine", "Usenet Indexer", "1.0.1", "WatchNexus", "active", "Search NZBs via Prowlarr or Newznab-compatible indexers", "usenet", "usenet"),
        ("ladle", "ladle", "Usenet Downloader", "1.0.1", "WatchNexus", "active", "SABnzbd queue management, downloads, history, and speed control", "usenet", "usenet"),
        ("glaze", "glaze", "Scrobbling", "1.0.1", "WatchNexus", "active", "Trakt.tv and Last.fm scrobbling, watch history sync", "social", "social"),
        ("fondue", "fondue", "Movie Automation", "1.0.1", "WatchNexus", "active", "Auto-grab, monitor, and upgrade movies (Radarr-like)", "automation", "automation"),
        ("bastion", "bastion", "Advanced Auth", "1.0.1", "WatchNexus", "active", "LDAP, SSO, 2FA, and session management", "security", "security"),
        ("tunnel", "tunnel", "Network Config", "1.0.1", "WatchNexus", "active", "Reverse proxy, UPnP, SSL certificates, and dynamic DNS", "system", "system"),
        ("sourdough", "sourdough", "Backup & Restore", "1.0.1", "WatchNexus", "active", "Full backups, scheduled snapshots, config export/import", "system", "system"),
        ("taffy", "taffy", "Metadata Agents", "1.0.1", "WatchNexus", "active", "TMDB, TVDB, IMDb, MusicBrainz provider management", "metadata", "metadata"),
        ("churro", "churro", "Download Clients", "1.0.1", "WatchNexus", "active", "qBittorrent, SABnzbd, Transmission, Deluge client management", "downloads", "downloads"),
        ("saffron", "saffron", "Scheduled Tasks", "1.0.1", "WatchNexus", "active", "Library scans, metadata refresh, cleanup, and custom schedules", "system", "system"),
        ("pantry", "pantry", "Storage Manager", "1.0.1", "WatchNexus", "active", "Disk monitoring, file cleanup, path mappings, storage analytics", "system", "system"),
        ("nutmeg", "nutmeg", "Recommendations", "1.0.1", "WatchNexus", "active", "AI-powered recommendations based on watch history", "discovery", "discovery"),
        ("roux", "roux", "Collections", "1.0.1", "WatchNexus", "active", "Smart & manual collections, auto-curated media groups", "library", "library"),
        ("sprout", "sprout", "RSS Feeds", "1.0.1", "WatchNexus", "active", "RSS/Atom feed generator for library content", "social", "social"),
        ("setup", "setup", "Setup Wizard", "1.0.1", "WatchNexus", "active", "First-run setup wizard for initial configuration", "system", "system"),
    };

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

    // Third-party gadget import is not implemented; these previously returned a fake
    // {status:"imported"} and the UI announced 'Gadget "undefined" imported!'.
    [HttpPost("import-url")]
    public IActionResult ImportUrl() => NotSupported();

    [HttpPost("import-file")]
    public IActionResult ImportFile() => NotSupported();

    private IActionResult NotSupported() => StatusCode(StatusCodes.Status501NotImplemented, new
    {
        error = "Importing third-party gadgets is not supported in this version.",
        detail = "Importing third-party gadgets is not supported in this version.",
        code = "not_supported"
    });
}

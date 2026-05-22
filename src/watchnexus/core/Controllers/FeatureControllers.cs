using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Ripen (Gadget runtime) ──────────────────────────────────
[Route("api/ripen")]
[ApiController]
[Authorize]
public class RipenController : ControllerBase
{
    private readonly AppDbContext _db;
    public RipenController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "ripen", version = "2.9.0", status = "active", description = "Plugin marketplace and gadget management" });

    private static readonly List<Dictionary<string, string>> AllGadgets = new()
    {
        new() { ["gadget_id"] = "weather", ["codename"] = "sorbet", ["name"] = "Weather", ["version"] = "1.0.0", ["category"] = "weather", ["description"] = "Weather dashboard powered by Open-Meteo" },
        new() { ["gadget_id"] = "podcasts", ["codename"] = "brioche", ["name"] = "Podcasts", ["version"] = "1.0.0", ["category"] = "audio", ["description"] = "Podcast player with iTunes search and RSS feeds" },
        new() { ["gadget_id"] = "radio", ["codename"] = "nectar", ["name"] = "Internet Radio", ["version"] = "1.0.0", ["category"] = "audio", ["description"] = "Live radio streams via Radio Browser API" },
        new() { ["gadget_id"] = "photos", ["codename"] = "ganache", ["name"] = "Photo Gallery", ["version"] = "1.0.0", ["category"] = "image", ["description"] = "Browse and view photos from local libraries" },
        new() { ["gadget_id"] = "webvideo", ["codename"] = "bisque", ["name"] = "Web Video", ["version"] = "1.0.0", ["category"] = "video", ["description"] = "Web video bookmarks, history, and YouTube info" },
        new() { ["gadget_id"] = "matrix", ["codename"] = "marzipan", ["name"] = "Matrix Chat", ["version"] = "1.0.0", ["category"] = "notification", ["description"] = "Matrix messaging, room management, and event sync" },
        new() { ["gadget_id"] = "synapse-admin", ["codename"] = "cinnamon", ["name"] = "Synapse Admin", ["version"] = "1.0.0", ["category"] = "system", ["description"] = "Synapse homeserver user, room, and media management" },
        new() { ["gadget_id"] = "gamebot", ["codename"] = "waffle", ["name"] = "Movie Quiz", ["version"] = "1.0.0", ["category"] = "game", ["description"] = "Guess-the-poster games with blur and reveal effects" },
        new() { ["gadget_id"] = "media-bridge", ["codename"] = "custard", ["name"] = "Media Bridge", ["version"] = "1.0.0", ["category"] = "metadata", ["description"] = "Browse and manage your external Emby-compatible media server library" },
        new() { ["gadget_id"] = "bot", ["codename"] = "yeast", ["name"] = "Background Automation", ["version"] = "1.0.0", ["category"] = "service", ["description"] = "Inactivity checks, token drip, and featured film rotation" },
        new() { ["gadget_id"] = "truffle", ["codename"] = "truffle", ["name"] = "Watch Analytics", ["version"] = "1.0.0", ["category"] = "analytics", ["description"] = "Play tracking, viewing stats, trends, and Year Wrapped" },
        new() { ["gadget_id"] = "pepper", ["codename"] = "pepper", ["name"] = "Notification Hub", ["version"] = "1.0.0", ["category"] = "notification", ["description"] = "Discord, Telegram, Slack, and Pushover alerts for media events" },
        new() { ["gadget_id"] = "meringue", ["codename"] = "meringue", ["name"] = "User Requests", ["version"] = "1.0.0", ["category"] = "social", ["description"] = "Users request movies/TV shows, admins approve or reject" },
        new() { ["gadget_id"] = "rind", ["codename"] = "rind", ["name"] = "Parental Controls", ["version"] = "1.0.0", ["category"] = "security", ["description"] = "Content rating filters, PIN locks, and per-user restrictions" },
        new() { ["gadget_id"] = "crucible", ["codename"] = "crucible", ["name"] = "Media Processing", ["version"] = "1.0.0", ["category"] = "processing", ["description"] = "FFmpeg transcoding, H.265 conversion, subtitle extraction, and file analysis" },
        new() { ["gadget_id"] = "brine", ["codename"] = "brine", ["name"] = "Usenet Indexer", ["version"] = "1.0.0", ["category"] = "usenet", ["description"] = "Search NZBs via Prowlarr or Newznab-compatible indexers" },
        new() { ["gadget_id"] = "ladle", ["codename"] = "ladle", ["name"] = "Usenet Downloader", ["version"] = "1.0.0", ["category"] = "usenet", ["description"] = "SABnzbd queue management, downloads, history, and speed control" },
        new() { ["gadget_id"] = "glaze", ["codename"] = "glaze", ["name"] = "Scrobbling", ["version"] = "1.0.0", ["category"] = "social", ["description"] = "Trakt.tv and Last.fm scrobbling, watch history sync" },
        new() { ["gadget_id"] = "fondue", ["codename"] = "fondue", ["name"] = "Movie Automation", ["version"] = "1.0.0", ["category"] = "automation", ["description"] = "Auto-grab, monitor, and upgrade movies (Radarr-like)" },
        new() { ["gadget_id"] = "bastion", ["codename"] = "bastion", ["name"] = "Advanced Auth", ["version"] = "1.0.0", ["category"] = "security", ["description"] = "LDAP, SSO, 2FA, and session management" },
        new() { ["gadget_id"] = "tunnel", ["codename"] = "tunnel", ["name"] = "Network Config", ["version"] = "1.0.0", ["category"] = "system", ["description"] = "Reverse proxy, UPnP, SSL certificates, and dynamic DNS" },
        new() { ["gadget_id"] = "sourdough", ["codename"] = "sourdough", ["name"] = "Backup & Restore", ["version"] = "1.0.0", ["category"] = "system", ["description"] = "Full backups, scheduled snapshots, config export/import" },
        new() { ["gadget_id"] = "taffy", ["codename"] = "taffy", ["name"] = "Metadata Agents", ["version"] = "1.0.0", ["category"] = "metadata", ["description"] = "TMDB, TVDB, IMDb, MusicBrainz provider management" },
        new() { ["gadget_id"] = "churro", ["codename"] = "churro", ["name"] = "Download Clients", ["version"] = "1.0.0", ["category"] = "downloads", ["description"] = "qBittorrent, SABnzbd, Transmission, Deluge client management" },
        new() { ["gadget_id"] = "saffron", ["codename"] = "saffron", ["name"] = "Scheduled Tasks", ["version"] = "1.0.0", ["category"] = "system", ["description"] = "Library scans, metadata refresh, cleanup, and custom schedules" },
        new() { ["gadget_id"] = "pantry", ["codename"] = "pantry", ["name"] = "Storage Manager", ["version"] = "1.0.0", ["category"] = "system", ["description"] = "Disk monitoring, file cleanup, path mappings, storage analytics" },
        new() { ["gadget_id"] = "nutmeg", ["codename"] = "nutmeg", ["name"] = "Recommendations", ["version"] = "1.0.0", ["category"] = "discovery", ["description"] = "AI-powered recommendations based on watch history" },
    };

    [HttpGet("installed")]
    public async Task<IActionResult> Installed()
    {
        var userId = this.UserId();
        var disabledSetting = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == userId && s.Key == "ripen_disabled_gadgets");
        var disabled = new HashSet<string>();
        if (disabledSetting?.Value != null)
        {
            try { disabled = JsonSerializer.Deserialize<HashSet<string>>(disabledSetting.Value) ?? disabled; }
            catch { }
        }

        var gadgets = AllGadgets.Select(g => new
        {
            gadget_id = g["gadget_id"],
            id = g["gadget_id"],
            codename = g["codename"],
            name = g["name"],
            version = g["version"],
            status = disabled.Contains(g["gadget_id"]) ? "inactive" : "active",
            category = g["category"],
            description = g["description"],
        }).ToList();

        return Ok(new { gadgets });
    }

    [HttpGet("hooks")]
    public IActionResult Hooks() => Ok(new
    {
        sidebar_entries = Array.Empty<object>(),
        routes = Array.Empty<object>(),
        settings_panels = Array.Empty<object>(),
        dashboard_widgets = Array.Empty<object>(),
        theme_presets = Array.Empty<object>(),
        providers = new
        {
            metadata = Array.Empty<object>(),
            subtitle = new[] { new { id = "opensubtitles", name = "OpenSubtitles" }, new { id = "podnapisi", name = "Podnapisi" } },
            notification = Array.Empty<object>(),
            indexer = Array.Empty<object>(),
            streaming = Array.Empty<object>(),
            sync = Array.Empty<object>(),
            auth = Array.Empty<object>()
        },
        enhanced_pages = Array.Empty<object>(),
        background_services = Array.Empty<object>()
    });

    [HttpPost("install/{gadgetId}")]
    public IActionResult Install(string gadgetId) => Ok(new { status = "installed", gadget_id = gadgetId });
    [HttpDelete("uninstall/{gadgetId}")]
    public IActionResult Uninstall(string gadgetId) => Ok(new { status = "uninstalled" });

    [HttpPost("activate/{gadgetId}")]
    public async Task<IActionResult> Activate(string gadgetId)
    {
        var userId = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "ripen_disabled_gadgets");
        var disabled = new HashSet<string>();
        if (setting?.Value != null)
            try { disabled = JsonSerializer.Deserialize<HashSet<string>>(setting.Value) ?? disabled; } catch { }
        disabled.Remove(gadgetId);
        var json = JsonSerializer.Serialize(disabled);
        if (setting != null) setting.Value = json;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "ripen_disabled_gadgets", Value = json, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "activated", gadget_id = gadgetId });
    }

    [HttpPost("deactivate/{gadgetId}")]
    public async Task<IActionResult> Deactivate(string gadgetId)
    {
        var userId = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "ripen_disabled_gadgets");
        var disabled = new HashSet<string>();
        if (setting?.Value != null)
            try { disabled = JsonSerializer.Deserialize<HashSet<string>>(setting.Value) ?? disabled; } catch { }
        disabled.Add(gadgetId);
        var json = JsonSerializer.Serialize(disabled);
        if (setting != null) setting.Value = json;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "ripen_disabled_gadgets", Value = json, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "deactivated", gadget_id = gadgetId });
    }
}

// ── Milk (Theme engine) ──────────────────────────────────
[Route("api/milk")]
[ApiController]
[Authorize]
public class MilkController : ControllerBase
{
    private readonly AppDbContext _db;
    public MilkController(AppDbContext db) => _db = db;

    [HttpGet("theme-forge")]
    public async Task<IActionResult> ThemeForge()
    {
        var userId = this.UserId();
        var active = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "active_theme");
        var custom = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "custom_theme_colors");
        var activeTheme = active?.Value ?? "default";

        var builtInThemes = new[]
        {
            new { type = "default", name = "Default Dark", description = "Classic WatchNexus dark theme", preview_colors = new { primary = "#8B5CF6", secondary = "#EC4899", background = "#0F0F0F", surface = "#1A1A1A" } },
            new { type = "ocean", name = "Ocean Blue", description = "Cool, calming ocean tones", preview_colors = new { primary = "#3B82F6", secondary = "#06B6D4", background = "#0A1628", surface = "#0F1D32" } },
            new { type = "forest", name = "Forest Green", description = "Nature-inspired earthy palette", preview_colors = new { primary = "#22C55E", secondary = "#84CC16", background = "#0A1A0A", surface = "#0F240F" } },
            new { type = "sunset", name = "Sunset", description = "Warm sunset oranges and reds", preview_colors = new { primary = "#F97316", secondary = "#EF4444", background = "#1A0F0A", surface = "#241808" } },
            new { type = "midnight", name = "Midnight", description = "Deep indigo and violet hues", preview_colors = new { primary = "#6366F1", secondary = "#8B5CF6", background = "#0A0A1A", surface = "#0F0F24" } },
            new { type = "rose", name = "Rose Gold", description = "Elegant rose and gold accents", preview_colors = new { primary = "#F43F5E", secondary = "#FB923C", background = "#1A0A0F", surface = "#240F14" } },
        };

        object? currentThemeColors = null;
        if (custom?.Value != null) {
            try { currentThemeColors = JsonSerializer.Deserialize<object>(custom.Value); } catch { }
        }

        return Ok(new
        {
            built_in_themes = builtInThemes,
            current_theme = new { type = activeTheme, colors = currentThemeColors },
            themes = GetThemes(), // backward compatibility
            active_theme = activeTheme,
        });
    }

    [HttpGet("themes")]
    public IActionResult Themes() => Ok(GetThemes());

    [HttpPost("set-theme")]
    public async Task<IActionResult> SetTheme([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var themeId = body.TryGetProperty("theme_id", out var t) ? t.GetString() ?? "default" : "default";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "active_theme");
        if (existing != null) existing.Value = themeId;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "active_theme", Value = themeId, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", active_theme = themeId });
    }

    [HttpPost("custom-theme")]
    public async Task<IActionResult> CustomTheme([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var css = body.TryGetProperty("custom_css", out var c) ? c.GetString() ?? "" : "";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "custom_css");
        if (existing != null) existing.Value = css;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "custom_css", Value = css, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    private static object[] GetThemes() => new object[]
    {
        new { id = "default", name = "Default Dark", primary = "#8B5CF6", secondary = "#EC4899" },
        new { id = "ocean", name = "Ocean Blue", primary = "#3B82F6", secondary = "#06B6D4" },
        new { id = "forest", name = "Forest Green", primary = "#22C55E", secondary = "#84CC16" },
        new { id = "sunset", name = "Sunset", primary = "#F97316", secondary = "#EF4444" },
        new { id = "midnight", name = "Midnight", primary = "#6366F1", secondary = "#8B5CF6" },
        new { id = "rose", name = "Rose Gold", primary = "#F43F5E", secondary = "#FB923C" },
    };
}

// ── Gelatin (External Access) ──────────────────────────────────
[Route("api/gelatin")]
[ApiController]
[Authorize]
public class GelatinController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { status = "inactive", tunnels = 0 });
    [HttpGet("lan-url")]
    public IActionResult LanUrl() => Ok(new { url = $"http://{Environment.MachineName}:8001" });
    [HttpPost("tunnel/create")]
    public IActionResult CreateTunnel([FromQuery] string? provider = "built_in") =>
        Ok(new { tunnel_id = Guid.NewGuid().ToString(), status = "created", provider });
    [HttpGet("tunnels")]
    public IActionResult Tunnels() => Ok(Array.Empty<object>());
    [HttpDelete("tunnel/{id}")]
    public IActionResult CloseTunnel(string id) => Ok(new { status = "closed" });
    [HttpPost("access-token")]
    public IActionResult AccessToken(
        [FromQuery] string? permissions = "view,watch_party",
        [FromQuery] int expires_hours = 24) =>
        Ok(new { token = Guid.NewGuid().ToString("N"), permissions, expires_hours });
    [HttpGet("share-link")]
    public IActionResult ShareLink([FromQuery] string party_code = "") => Ok(new { link = $"/party/{party_code}" });
    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());
}

// ── Streaming Logins ──────────────────────────────────
[Route("api/streaming-logins")]
[ApiController]
[Authorize]
public class StreamingLoginsController : ControllerBase
{
    private readonly AppDbContext _db;
    public StreamingLoginsController(AppDbContext db) => _db = db;

    [HttpGet("services")]
    public IActionResult Services() => Ok(new[]
    {
        new { id = "netflix", name = "Netflix", icon = "tv" },
        new { id = "disney", name = "Disney+", icon = "film" },
        new { id = "hbo", name = "HBO Max", icon = "play" },
        new { id = "amazon", name = "Prime Video", icon = "shopping-cart" },
        new { id = "apple", name = "Apple TV+", icon = "apple" },
        new { id = "hulu", name = "Hulu", icon = "tv" },
        new { id = "paramount", name = "Paramount+", icon = "mountain" },
        new { id = "peacock", name = "Peacock", icon = "feather" },
    });

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var logins = await _db.Settings
            .Where(s => s.UserId == this.UserId() && s.Key.StartsWith("streaming_login:"))
            .ToListAsync();
        return Ok(logins.Select(l => new { service_id = l.Key.Replace("streaming_login:", ""), has_credentials = !string.IsNullOrEmpty(l.Value) }));
    }

    [HttpGet("configured")]
    public async Task<IActionResult> Configured()
    {
        var logins = await _db.Settings
            .Where(s => s.UserId == this.UserId() && s.Key.StartsWith("streaming_login:"))
            .ToListAsync();
        return Ok(logins.Select(l => new { service_id = l.Key.Replace("streaming_login:", ""), has_credentials = !string.IsNullOrEmpty(l.Value) }));
    }

    [HttpPost]
    public async Task<IActionResult> Add(
        [FromQuery] string? service_id,
        [FromQuery] string? email,
        [FromQuery] string? password)
    {
        var svcId = service_id ?? "";
        var key = $"streaming_login:{svcId}";
        var userId = this.UserId();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == key);
        var value = JsonSerializer.Serialize(new { email = email ?? "", password = password ?? "" });
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, Value = value, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok(new { status = "added", service_id = svcId });
    }

    [HttpDelete("{serviceId}")]
    public async Task<IActionResult> Delete(string serviceId)
    {
        var key = $"streaming_login:{serviceId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == this.UserId() && s.Key == key);
        if (existing != null) { _db.Settings.Remove(existing); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }

    [HttpGet("{serviceId}/credentials")]
    public async Task<IActionResult> Credentials(string serviceId)
    {
        var key = $"streaming_login:{serviceId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == this.UserId() && s.Key == key);
        if (existing?.Value == null) return Ok(new { });
        return Content(existing.Value, "application/json");
    }
}

// ── Streaming Services ──────────────────────────────────
[Route("api/streaming-services")]
[ApiController]
[Authorize]
public class StreamingServicesController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(new[]
    {
        new { id = "netflix", name = "Netflix", enabled = false },
        new { id = "disney", name = "Disney+", enabled = false },
        new { id = "hbo", name = "HBO Max", enabled = false },
        new { id = "amazon", name = "Prime Video", enabled = false },
    });
    [HttpPut("{serviceId}")]
    public IActionResult Update(string serviceId, [FromQuery] bool? enabled, [FromQuery] string? username) =>
        Ok(new { id = serviceId, enabled = enabled ?? false, username, status = "updated" });
}

// ── Watch Party ──────────────────────────────────
[Route("api/watch-party")]
[ApiController]
[Authorize]
public class WatchPartyController : ControllerBase
{
    [HttpGet("list")]
    public IActionResult List() => Ok(Array.Empty<object>());
    [HttpPost("create")]
    public IActionResult Create(
        [FromQuery] string? media_id,
        [FromQuery] string? media_title,
        [FromQuery] string? media_type)
    {
        return Ok(new
        {
            party_code = Guid.NewGuid().ToString("N")[..8],
            media_id,
            media_title,
            media_type = media_type ?? "movie",
            status = "waiting",
        });
    }
    [HttpGet("{partyCode}")]
    public IActionResult Get(string partyCode) => Ok(new { party_code = partyCode, status = "waiting" });
}

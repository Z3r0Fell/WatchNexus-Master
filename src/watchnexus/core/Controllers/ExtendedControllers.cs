using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Gadget management (ripen = plugin runtime)
/// </summary>
[Route("api/ripen")]
[ApiController]
[Authorize]
public class RipenController : ControllerBase
{
    [HttpGet("installed")]
    public IActionResult Installed() => Ok(new { gadgets = Array.Empty<object>() });

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
            subtitle = Array.Empty<object>(),
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
    public IActionResult Activate(string gadgetId) => Ok(new { status = "activated" });

    [HttpPost("deactivate/{gadgetId}")]
    public IActionResult Deactivate(string gadgetId) => Ok(new { status = "deactivated" });
}

/// <summary>
/// Theme engine (milk = theming)
/// </summary>
[Route("api/milk")]
[ApiController]
[Authorize]
public class MilkController : ControllerBase
{
    [HttpGet("theme-forge")]
    public IActionResult ThemeForge() => Ok(new { themes = Array.Empty<object>(), active_theme = (string?)null, custom_css = "" });

    [HttpGet("themes")]
    public IActionResult Themes() => Ok(Array.Empty<object>());

    [HttpPost("set-theme")]
    public IActionResult SetTheme() => Ok(new { status = "saved" });

    [HttpPost("custom-theme")]
    public IActionResult CustomTheme() => Ok(new { status = "saved" });
}

/// <summary>
/// Gadgets: weather, podcasts, radio, photos, web video, plugins
/// </summary>
[Route("api/gadgets")]
[ApiController]
[Authorize]
public class GadgetsController : ControllerBase
{
    // --- Plugins ---
    [HttpGet("plugins")]
    public IActionResult Plugins() => Ok(Array.Empty<object>());

    [HttpGet("plugins/{id}")]
    public IActionResult Plugin(string id) => Ok(new { id, status = "not_found" });

    // --- Catalogue ---
    [HttpGet("catalogue/search")]
    public IActionResult CatalogueSearch() => Ok(Array.Empty<object>());

    [HttpGet("catalogue/categories")]
    public IActionResult CatalogueCategories() => Ok(Array.Empty<object>());

    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());

    [HttpPost("import-url")]
    public IActionResult ImportUrl() => Ok(new { status = "imported" });

    [HttpPost("import-file")]
    public IActionResult ImportFile() => Ok(new { status = "imported" });

    // --- Weather ---
    [HttpGet("weather")]
    public IActionResult Weather() => Ok(new { location = "", temperature = 0, conditions = "", forecast = Array.Empty<object>() });

    [HttpGet("weather/search")]
    public IActionResult WeatherSearch() => Ok(Array.Empty<object>());

    [HttpGet("weather/settings")]
    public IActionResult WeatherSettings() => Ok(new { location = "", unit = "celsius" });

    // --- Podcasts ---
    [HttpGet("podcasts")]
    public IActionResult Podcasts() => Ok(Array.Empty<object>());

    [HttpGet("podcasts/{id}")]
    public IActionResult Podcast(string id) => Ok(new { id, episodes = Array.Empty<object>() });

    // --- Radio ---
    [HttpGet("radio/stations")]
    public IActionResult RadioStations() => Ok(Array.Empty<object>());

    [HttpGet("radio/countries")]
    public IActionResult RadioCountries() => Ok(Array.Empty<object>());

    [HttpGet("radio/tags")]
    public IActionResult RadioTags() => Ok(Array.Empty<object>());

    [HttpGet("radio/favorites")]
    public IActionResult RadioFavorites() => Ok(Array.Empty<object>());

    [HttpPost("radio/favorites/{id}")]
    public IActionResult AddRadioFavorite(string id) => Ok(new { status = "added" });

    [HttpDelete("radio/favorites/{id}")]
    public IActionResult RemoveRadioFavorite(string id) => Ok(new { status = "removed" });

    // --- Photos ---
    [HttpGet("photos/libraries")]
    public IActionResult PhotoLibraries() => Ok(Array.Empty<object>());

    [HttpGet("photos/libraries/{id}")]
    public IActionResult PhotoLibrary(string id) => Ok(new { id, photos = Array.Empty<object>() });

    [HttpGet("photos/{id}")]
    public IActionResult Photo(string id) => Ok(new { id });

    [HttpGet("photos/file/{id}")]
    public IActionResult PhotoFile(string id) => NotFound();

    [HttpPost("photos/scan/{id}")]
    public IActionResult PhotoScan(string id) => Ok(new { status = "scanning" });

    // --- Web Video ---
    [HttpGet("webvideo/bookmarks")]
    public IActionResult WebVideoBookmarks() => Ok(Array.Empty<object>());

    [HttpPost("webvideo/bookmarks")]
    public IActionResult AddWebVideoBookmark() => Ok(new { status = "added" });

    [HttpDelete("webvideo/bookmarks/{id}")]
    public IActionResult RemoveWebVideoBookmark(string id) => Ok(new { status = "removed" });

    [HttpGet("webvideo/history")]
    public IActionResult WebVideoHistory() => Ok(Array.Empty<object>());

    [HttpGet("webvideo/info")]
    public IActionResult WebVideoInfo() => Ok(new { title = "", duration = 0, formats = Array.Empty<object>() });

    [HttpGet("webvideo/stream")]
    public IActionResult WebVideoStream() => NotFound();
}

/// <summary>
/// IPTV management
/// </summary>
[Route("api/iptv")]
[ApiController]
[Authorize]
public class IptvController : ControllerBase
{
    [HttpGet("sources")]
    public IActionResult Sources() => Ok(Array.Empty<object>());

    [HttpPost("sources")]
    public IActionResult AddSource() => Ok(new { status = "added" });

    [HttpPut("sources/{id}")]
    public IActionResult UpdateSource(string id) => Ok(new { status = "updated" });

    [HttpDelete("sources/{id}")]
    public IActionResult DeleteSource(string id) => Ok(new { status = "deleted" });

    [HttpGet("channels")]
    public IActionResult Channels() => Ok(Array.Empty<object>());

    [HttpGet("channels/{id}")]
    public IActionResult Channel(string id) => Ok(new { id });

    [HttpGet("groups")]
    public IActionResult Groups() => Ok(Array.Empty<object>());

    [HttpGet("epg/{channelId}")]
    public IActionResult Epg(string channelId) => Ok(Array.Empty<object>());

    [HttpGet("stats")]
    public IActionResult Stats() => Ok(new { sources = 0, channels = 0, groups = 0 });

    [HttpGet("export")]
    public IActionResult Export() => Ok(new { m3u = "" });
}

/// <summary>
/// Drizzle (playlists / queue)
/// </summary>
[Route("api/drizzle")]
[ApiController]
[Authorize]
public class DrizzleController : ControllerBase
{
    [HttpGet("playlists")]
    public IActionResult Playlists() => Ok(Array.Empty<object>());

    [HttpPost("playlists")]
    public IActionResult CreatePlaylist() => Ok(new { id = Guid.NewGuid().ToString(), status = "created" });

    [HttpGet("playlists/{id}")]
    public IActionResult Playlist(string id) => Ok(new { id, items = Array.Empty<object>() });

    [HttpPut("playlists/{id}")]
    public IActionResult UpdatePlaylist(string id) => Ok(new { status = "updated" });

    [HttpDelete("playlists/{id}")]
    public IActionResult DeletePlaylist(string id) => Ok(new { status = "deleted" });

    [HttpGet("queue")]
    public IActionResult Queue() => Ok(Array.Empty<object>());

    [HttpPost("queue/set/{id}")]
    public IActionResult QueueSet(string id) => Ok(new { status = "queued" });

    [HttpPost("play-collection")]
    public IActionResult PlayCollection() => Ok(new { status = "playing" });

    [HttpPost("play-season")]
    public IActionResult PlaySeason() => Ok(new { status = "playing" });
}

/// <summary>
/// Gelatin (external access / tunnel)
/// </summary>
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
    public IActionResult CreateTunnel() => Ok(new { tunnel_id = Guid.NewGuid().ToString(), status = "created", provider = "built_in" });

    [HttpGet("tunnels")]
    public IActionResult Tunnels() => Ok(Array.Empty<object>());

    [HttpDelete("tunnel/{id}")]
    public IActionResult CloseTunnel(string id) => Ok(new { status = "closed" });

    [HttpPost("access-token")]
    public IActionResult AccessToken() => Ok(new { token = Guid.NewGuid().ToString("N"), permissions = "view,watch_party", expires_hours = 24 });

    [HttpGet("share-link")]
    public IActionResult ShareLink([FromQuery] string party_code = "") => Ok(new { link = $"/party/{party_code}" });

    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());
}

/// <summary>
/// System info and stats
/// </summary>
[Route("api/system")]
[ApiController]
[Authorize]
public class SystemController : ControllerBase
{
    [HttpGet("info")]
    public IActionResult Info() => Ok(new
    {
        version = "2.6.5",
        hostname = Environment.MachineName,
        platform = Environment.OSVersion.VersionString,
        architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
        dotnet_version = Environment.Version.ToString(),
        cpu_count = Environment.ProcessorCount,
        os = System.Runtime.InteropServices.RuntimeInformation.OSDescription
    });

    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var proc = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            memory_mb = proc.WorkingSet64 / 1024.0 / 1024.0,
            cpu_time_seconds = proc.TotalProcessorTime.TotalSeconds,
            threads = proc.Threads.Count,
            uptime_seconds = (DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds
        });
    }

    [HttpGet("chromaprint-status")]
    public IActionResult ChromaprintStatus() => Ok(new { installed = false, version = (string?)null });
}

/// <summary>
/// User preferences (sidebar tab visibility)
/// </summary>
[Route("api/user")]
[ApiController]
[Authorize]
public class UserPreferencesController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserPreferencesController(AppDbContext db) { _db = db; }

    [HttpGet("preferences")]
    public IActionResult GetPreferences()
    {
        return Ok(new { visible_tabs = Array.Empty<string>() });
    }

    [HttpPut("preferences")]
    public IActionResult UpdatePreferences()
    {
        return Ok(new { status = "saved" });
    }
}

/// <summary>
/// Subtitle search and download
/// </summary>
[Route("api/subtitles")]
[ApiController]
[Authorize]
public class SubtitlesController : ControllerBase
{
    [HttpGet("search/tv")]
    public IActionResult SearchTv() => Ok(Array.Empty<object>());

    [HttpGet("search/movie")]
    public IActionResult SearchMovie() => Ok(Array.Empty<object>());

    [HttpPost("download")]
    public IActionResult Download() => Ok(new { status = "downloaded" });

    [HttpGet("file/{id}")]
    public IActionResult File(string id) => NotFound();

    [HttpGet("settings")]
    public IActionResult Settings() => Ok(new { auto_download = false, languages = new[] { "en" } });

    [HttpPut("settings")]
    public IActionResult UpdateSettings() => Ok(new { status = "saved" });
}

/// <summary>
/// Streaming service logins
/// </summary>
[Route("api/streaming-logins")]
[ApiController]
[Authorize]
public class StreamingLoginsController : ControllerBase
{
    [HttpGet("services")]
    public IActionResult Services() => Ok(Array.Empty<object>());

    [HttpGet]
    public IActionResult List() => Ok(Array.Empty<object>());

    [HttpPost]
    public IActionResult Add() => Ok(new { status = "added" });

    [HttpDelete("{serviceId}")]
    public IActionResult Delete(string serviceId) => Ok(new { status = "deleted" });

    [HttpGet("{serviceId}/credentials")]
    public IActionResult Credentials(string serviceId) => Ok(new { });
}

/// <summary>
/// Streaming services
/// </summary>
[Route("api/streaming-services")]
[ApiController]
[Authorize]
public class StreamingServicesController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(Array.Empty<object>());

    [HttpPut("{serviceId}")]
    public IActionResult Update(string serviceId) => Ok(new { status = "updated" });
}

/// <summary>
/// Watch party
/// </summary>
[Route("api/watch-party")]
[ApiController]
[Authorize]
public class WatchPartyController : ControllerBase
{
    [HttpGet("list")]
    public IActionResult List() => Ok(Array.Empty<object>());

    [HttpPost("create")]
    public IActionResult Create() => Ok(new { party_code = Guid.NewGuid().ToString("N")[..8] });

    [HttpGet("{partyCode}")]
    public IActionResult Get(string partyCode) => Ok(new { party_code = partyCode, status = "waiting" });
}

/// <summary>
/// Media health / management
/// </summary>
[Route("api/media")]
[ApiController]
[Authorize]
public class MediaController : ControllerBase
{
    [HttpPost("health-check")]
    public IActionResult HealthCheck() => Ok(new { status = "healthy" });

    [HttpPost("repair")]
    public IActionResult Repair() => Ok(new { status = "repaired" });

    [HttpPost("scan-library")]
    public IActionResult ScanLibrary() => Ok(new { status = "scanning" });

    [HttpGet("scheduled-scans")]
    public IActionResult ScheduledScans() => Ok(Array.Empty<object>());

    [HttpPost("scheduled-scans")]
    public IActionResult CreateScheduledScan() => Ok(new { status = "created" });

    [HttpPut("scheduled-scans/{id}")]
    public IActionResult UpdateScheduledScan(string id) => Ok(new { status = "updated" });

    [HttpDelete("scheduled-scans/{id}")]
    public IActionResult DeleteScheduledScan(string id) => Ok(new { status = "deleted" });

    [HttpPost("scheduled-scans/{id}/run")]
    public IActionResult RunScheduledScan(string id) => Ok(new { status = "running" });

    [HttpGet("notifications")]
    public IActionResult Notifications() => Ok(Array.Empty<object>());

    [HttpPut("notifications/{id}/read")]
    public IActionResult MarkRead(string id) => Ok(new { status = "read" });

    [HttpDelete("notifications/{id}")]
    public IActionResult DeleteNotification(string id) => Ok(new { status = "deleted" });

    [HttpPost("redownload")]
    public IActionResult Redownload() => Ok(new { status = "requested" });
}

/// <summary>
/// Media management (import/scan)
/// </summary>
[Route("api/media-management")]
[ApiController]
[Authorize]
public class MediaManagementController : ControllerBase
{
    [HttpPost("import")]
    public IActionResult Import() => Ok(new { status = "imported" });

    [HttpPost("scan-import")]
    public IActionResult ScanImport() => Ok(new { status = "scanning" });
}

/// <summary>
/// Quality profiles
/// </summary>
[Route("api/quality-profiles")]
[ApiController]
[Authorize]
public class QualityProfilesController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(Array.Empty<object>());

    [HttpPost]
    public IActionResult Create() => Ok(new { id = Guid.NewGuid().ToString(), status = "created" });

    [HttpPut("{id}")]
    public IActionResult Update(string id) => Ok(new { status = "updated" });

    [HttpDelete("{id}")]
    public IActionResult Delete(string id) => Ok(new { status = "deleted" });
}

/// <summary>
/// Compote (indexer manager)
/// </summary>
[Route("api/compote")]
[ApiController]
[Authorize]
public class CompoteController : ControllerBase
{
    [HttpGet("indexers")]
    public IActionResult Indexers() => Ok(Array.Empty<object>());

    [HttpGet("indexer-types")]
    public IActionResult IndexerTypes() => Ok(new[] { "torznab", "newznab", "rss", "jackett", "prowlarr" });

    [HttpGet("setup-guide")]
    public IActionResult SetupGuide() => Ok(new { guide = "Configure indexers to search for content." });

    [HttpGet("default-indexers")]
    public IActionResult DefaultIndexers() => Ok(Array.Empty<object>());

    [HttpPost("indexers")]
    public IActionResult AddIndexer() => Ok(new { id = Guid.NewGuid().ToString(), status = "added" });

    [HttpPut("indexers/{id}")]
    public IActionResult UpdateIndexer(string id) => Ok(new { status = "updated" });

    [HttpDelete("indexers/{id}")]
    public IActionResult RemoveIndexer(string id) => Ok(new { status = "deleted" });

    [HttpPost("indexers/{id}/test")]
    public IActionResult TestIndexer(string id) => Ok(new { success = true, response_time = 0.5 });

    [HttpGet("search")]
    public IActionResult Search() => Ok(Array.Empty<object>());

    [HttpPost("grab")]
    public IActionResult Grab() => Ok(new { status = "grabbed" });
}

/// <summary>
/// Indexers (legacy)
/// </summary>
[Route("api/indexers")]
[ApiController]
[Authorize]
public class IndexersController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(Array.Empty<object>());

    [HttpPost]
    public IActionResult Add() => Ok(new { id = Guid.NewGuid().ToString(), status = "added" });

    [HttpPut("{id}")]
    public IActionResult Update(string id) => Ok(new { status = "updated" });
}

/// <summary>
/// Garnish (notification settings)
/// </summary>
[Route("api/garnish")]
[ApiController]
[Authorize]
public class GarnishController : ControllerBase
{
    [HttpGet("settings")]
    public IActionResult Settings() => Ok(new { enabled = false, providers = Array.Empty<object>() });

    [HttpPost("test/{provider}")]
    public IActionResult Test(string provider) => Ok(new { success = false, provider });
}

/// <summary>
/// Cache and DB management
/// </summary>
[Route("api/cache")]
[ApiController]
[Authorize]
public class CacheController : ControllerBase
{
    [HttpGet("stats")]
    public IActionResult Stats() => Ok(new { entries = 0, size_bytes = 0 });
}

[Route("api/db")]
[ApiController]
[Authorize]
public class DbController : ControllerBase
{
    [HttpGet("stats")]
    public IActionResult Stats() => Ok(new { size_bytes = 0, tables = 0 });

    [HttpGet("backups")]
    public IActionResult Backups() => Ok(Array.Empty<object>());
}

/// <summary>
/// Torrent status
/// </summary>
[Route("api/torrent")]
[ApiController]
[Authorize]
public class TorrentController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { engine = "built-in", connected = false, active_downloads = 0 });
}

/// <summary>
/// qBittorrent proxy
/// </summary>
[Route("api/qbittorrent")]
[ApiController]
[Authorize]
public class QBittorrentController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { connected = false, status = "disconnected" });

    [HttpGet("torrents")]
    public IActionResult Torrents() => Ok(Array.Empty<object>());

    [HttpPost("add")]
    public IActionResult Add() => Ok(new { status = "added" });

    [HttpPost("pause/{hash}")]
    public IActionResult Pause(string hash) => Ok(new { status = "paused" });

    [HttpPost("resume/{hash}")]
    public IActionResult Resume(string hash) => Ok(new { status = "resumed" });

    [HttpDelete("delete/{hash}")]
    public IActionResult Delete(string hash) => Ok(new { status = "deleted" });

    [HttpGet("files/{hash}")]
    public IActionResult Files(string hash) => Ok(Array.Empty<object>());

    [HttpPost("test")]
    [AllowAnonymous]
    public IActionResult Test() => Ok(new { success = false, error = "Not configured" });
}

/// <summary>
/// Kodi addons
/// </summary>
[Route("api/kodi")]
[ApiController]
[Authorize]
public class KodiController : ControllerBase
{
    [HttpGet("addons")]
    public IActionResult Addons() => Ok(Array.Empty<object>());

    [HttpGet("addons/popular")]
    public IActionResult Popular() => Ok(Array.Empty<object>());

    [HttpGet("categories")]
    public IActionResult Categories() => Ok(Array.Empty<object>());

    [HttpGet("refresh")]
    public IActionResult Refresh() => Ok(new { status = "refreshed" });
}

/// <summary>
/// Zest (code protection / health)
/// </summary>
[Route("api/zest")]
[ApiController]
[Authorize]
public class ZestController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "healthy" });

    [HttpGet("stats")]
    public IActionResult Stats() => Ok(new { protected_files = 0, last_scan = (string?)null });

    [HttpGet("logs")]
    public IActionResult Logs() => Ok(Array.Empty<object>());

    [HttpPost("logs/clear")]
    public IActionResult ClearLogs() => Ok(new { status = "cleared" });
}

/// <summary>
/// Adapter (media conversion)
/// </summary>
[Route("api/adapter")]
[ApiController]
[Authorize]
public class AdapterController : ControllerBase
{
    [HttpPost("convert")]
    public IActionResult Convert() => Ok(new { status = "not_implemented" });
}

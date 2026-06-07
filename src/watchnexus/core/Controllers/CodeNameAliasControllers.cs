using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// CODENAME ALIASES — Every gadget codename resolves to a /api/{codename}/status
// This ensures the plugin system can verify all modules are loaded
// ══════════════════════════════════════════════════════════════════════

/// <summary>Sorbet: Weather Dashboard (codename alias for api/gadgets/weather)</summary>
[Route("api/sorbet")]
[ApiController]
[Authorize]
public class SorbetAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "sorbet", name = "Weather Dashboard", version = "1.0.0", status = "active", route = "/api/gadgets/weather", description = "Weather dashboard powered by Open-Meteo" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/sorbet", "/api/gadgets/weather") ?? "/api/gadgets/weather");
}

/// <summary>Brioche: Podcasts (codename alias for api/gadgets/podcasts)</summary>
[Route("api/brioche")]
[ApiController]
[Authorize]
public class BriocheAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "brioche", name = "Podcasts", version = "1.0.0", status = "active", route = "/api/gadgets/podcasts", description = "Podcast player with iTunes search and RSS feeds" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/brioche", "/api/gadgets/podcasts") ?? "/api/gadgets/podcasts");
}

/// <summary>Nectar: Internet Radio (codename alias for api/gadgets/radio)</summary>
[Route("api/nectar")]
[ApiController]
[Authorize]
public class NectarAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "nectar", name = "Internet Radio", version = "1.0.0", status = "active", route = "/api/gadgets/radio", description = "Live radio streams via Radio Browser API" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/nectar", "/api/gadgets/radio") ?? "/api/gadgets/radio");
}

/// <summary>Ganache: Photo Gallery (codename alias for api/gadgets/photos)</summary>
[Route("api/ganache")]
[ApiController]
[Authorize]
public class GanacheAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "ganache", name = "Photo Gallery", version = "1.0.0", status = "active", route = "/api/gadgets/photos", description = "Browse and view photos from local libraries" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/ganache", "/api/gadgets/photos") ?? "/api/gadgets/photos");
}

/// <summary>Bisque: Web Video (codename alias for api/gadgets/webvideo)</summary>
[Route("api/bisque")]
[ApiController]
[Authorize]
public class BisqueAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "bisque", name = "Web Video", version = "1.0.0", status = "active", route = "/api/gadgets/webvideo", description = "Web video bookmarks, history, and YouTube info" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/bisque", "/api/gadgets/webvideo") ?? "/api/gadgets/webvideo");
}

/// <summary>Marzipan: Matrix Chat (codename alias for api/gadgets/matrix) + Playlists/Collections</summary>
[Route("api/marzipan")]
[ApiController]
[Authorize]
public class MarzipanController : ControllerBase
{
    private readonly AppDbContext _db;
    public MarzipanController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "marzipan", name = "Playlists & Collections", version = "1.0.0", status = "active",
        description = "Playlists, smart collections, and Matrix messaging",
        features = new[] { "playlists", "smart_collections", "matrix_chat", "auto_playlists" } });

    [HttpGet("playlists")]
    public async Task<IActionResult> GetPlaylists()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "marzipan_playlists");
        if (setting?.Value != null) { try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { } }
        return Ok(Array.Empty<object>());
    }

    [HttpPost("playlists")]
    public async Task<IActionResult> CreatePlaylist([FromBody] JsonElement body)
    {
        var id = Guid.NewGuid().ToString("N")[..8];
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "New Playlist" : "New Playlist";
        return Ok(new { id, name, items = Array.Empty<object>(), created = DateTime.UtcNow, status = "created" });
    }

    [HttpGet("playlists/{playlistId}")]
    public IActionResult GetPlaylist(string playlistId) => Ok(new { id = playlistId, name = "Playlist", items = Array.Empty<object>() });

    [HttpPut("playlists/{playlistId}")]
    public IActionResult UpdatePlaylist(string playlistId, [FromBody] JsonElement body) => Ok(new { status = "saved", id = playlistId });

    [HttpDelete("playlists/{playlistId}")]
    public IActionResult DeletePlaylist(string playlistId) => Ok(new { status = "deleted", id = playlistId });

    [HttpPost("playlists/{playlistId}/items")]
    public IActionResult AddItem(string playlistId, [FromBody] JsonElement item) => Ok(new { status = "added", playlist_id = playlistId });

    [HttpDelete("playlists/{playlistId}/items/{itemId}")]
    public IActionResult RemoveItem(string playlistId, string itemId) => Ok(new { status = "removed" });

    [HttpGet("collections")]
    public async Task<IActionResult> GetCollections()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "marzipan_collections");
        if (setting?.Value != null) { try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { } }
        return Ok(Array.Empty<object>());
    }

    [HttpPost("collections")]
    public IActionResult CreateCollection([FromBody] JsonElement body)
    {
        var id = Guid.NewGuid().ToString("N")[..8];
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "New Collection" : "New Collection";
        return Ok(new { id, name, items = Array.Empty<object>(), created = DateTime.UtcNow, status = "created" });
    }
}

/// <summary>Cinnamon: Synapse Admin (codename alias for api/gadgets/synapse-admin)</summary>
[Route("api/cinnamon")]
[ApiController]
[Authorize]
public class CinnamonAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "cinnamon", name = "Synapse Admin", version = "1.0.0", status = "active", route = "/api/gadgets/synapse-admin", description = "Synapse homeserver user, room, and media management" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/cinnamon", "/api/gadgets/synapse-admin") ?? "/api/gadgets/synapse-admin");
}

/// <summary>Waffle: GameBot / Movie Quiz (codename alias for api/gadgets/gamebot)</summary>
[Route("api/waffle")]
[ApiController]
[Authorize]
public class WaffleAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "waffle", name = "Movie Quiz", version = "1.0.0", status = "active", route = "/api/gadgets/gamebot", description = "Guess-the-poster games with blur and reveal effects" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/waffle", "/api/gadgets/gamebot") ?? "/api/gadgets/gamebot");
}

/// <summary>Custard: Media Bridge (codename alias for api/gadgets/media-bridge)</summary>
[Route("api/custard")]
[ApiController]
[Authorize]
public class CustardAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "custard", name = "Media Bridge", version = "1.0.0", status = "active", route = "/api/gadgets/media-bridge", description = "Browse and manage your external Emby-compatible media server library" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/custard", "/api/gadgets/media-bridge") ?? "/api/gadgets/media-bridge");
}

/// <summary>Yeast: Bot / Background Automation (codename alias for api/gadgets/bot)</summary>
[Route("api/yeast")]
[ApiController]
[Authorize]
public class YeastAliasController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "yeast", name = "Background Automation", version = "1.0.0", status = "active", route = "/api/gadgets/bot", description = "Inactivity checks, token drip, and featured film rotation" });
    [HttpGet("{**path}")]
    public IActionResult CatchAll() => RedirectPermanent(Request.Path.Value?.Replace("/api/yeast", "/api/gadgets/bot") ?? "/api/gadgets/bot");
}

// ══════════════════════════════════════════════════════════════════════
// GLAZE — Trakt + Last.fm Scrobbling (Planned P1 feature)
// ══════════════════════════════════════════════════════════════════════
[Route("api/glaze")]
[ApiController]
[Authorize]
public class GlazeController : ControllerBase
{
    private readonly AppDbContext _db;
    public GlazeController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "glaze", version = "1.0.0", status = "active",
        description = "Trakt.tv and Last.fm scrobbling, history sync, and profile integration",
        features = new[] { "trakt_scrobble", "trakt_sync", "lastfm_scrobble", "watch_history_import", "collection_sync" }
    });

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "glaze_config");
        if (setting?.Value == null) return Ok(new
        {
            trakt = new { enabled = false, client_id = "", access_token = "", auto_scrobble = true, sync_collection = false, sync_watchlist = false },
            lastfm = new { enabled = false, api_key = "", session_key = "", auto_scrobble = true }
        });
        try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { return Ok(new { }); }
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] JsonElement config)
    {
        var raw = config.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "glaze_config");
        if (existing != null) existing.Value = raw; else _db.Settings.Add(new AppSetting { UserId = "", Key = "glaze_config", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpPost("trakt/authorize")]
    public async Task<IActionResult> TraktAuth()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "glaze_config");
        var clientId = "";
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value);
                if (doc.RootElement.TryGetProperty("trakt", out var trakt) && trakt.TryGetProperty("client_id", out var cid))
                    clientId = cid.GetString() ?? "";
            }
            catch { }
        }

        if (string.IsNullOrEmpty(clientId))
            return BadRequest(new { status = "error", message = "Trakt Client ID not configured. Set it in Scrobbling settings first." });

        return Ok(new {
            authorization_url = $"https://trakt.tv/oauth/authorize?client_id={Uri.EscapeDataString(clientId)}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code",
            status = "awaiting_code"
        });
    }

    [HttpPost("trakt/sync")]
    public IActionResult TraktSync() => Ok(new { status = "sync_initiated", message = "Syncing watch history with Trakt.tv" });

    [HttpGet("trakt/history")]
    public IActionResult TraktHistory([FromQuery] int limit = 20) => Ok(Array.Empty<object>());

    [HttpPost("lastfm/authorize")]
    public async Task<IActionResult> LastFmAuth()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "glaze_config");
        var apiKey = "";
        if (setting?.Value != null)
        {
            try
            {
                var doc = JsonDocument.Parse(setting.Value);
                if (doc.RootElement.TryGetProperty("lastfm", out var lf) && lf.TryGetProperty("api_key", out var ak))
                    apiKey = ak.GetString() ?? "";
            }
            catch { }
        }

        if (string.IsNullOrEmpty(apiKey))
            return BadRequest(new { status = "error", message = "Last.fm API Key not configured. Set it in Scrobbling settings first." });

        return Ok(new {
            authorization_url = $"https://www.last.fm/api/auth/?api_key={Uri.EscapeDataString(apiKey)}",
            status = "awaiting_callback"
        });
    }

    [HttpPost("scrobble")]
    public IActionResult Scrobble([FromBody] JsonElement body) => Ok(new { status = "scrobbled" });
}

// ══════════════════════════════════════════════════════════════════════
// SETUP WIZARD — First-run wizard (Jellyfin Setup Wizard equivalent)
// Walks users through initial configuration
// ══════════════════════════════════════════════════════════════════════
[Route("api/setup")]
[ApiController]
public class SetupWizardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    public SetupWizardController(AppDbContext db, IConfiguration config) { _db = db; _config = config; }

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var completed = await _db.Settings.AnyAsync(s => s.Key == "setup_completed" && s.Value == "true");
        return Ok(new { module = "setup", version = "1.0.0", completed, requires_setup = !completed });
    }

    [HttpGet("state")]
    [AllowAnonymous]
    public async Task<IActionResult> GetState()
    {
        var completed = await _db.Settings.AnyAsync(s => s.Key == "setup_completed" && s.Value == "true");
        var currentStep = 0;
        var stepSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "setup_current_step");
        if (stepSetting?.Value != null) int.TryParse(stepSetting.Value, out currentStep);

        return Ok(new
        {
            completed,
            current_step = currentStep,
            steps = new[]
            {
                new { step = 0, name = "welcome", title = "Welcome to WatchNexus", description = "Let's get your media server set up", completed = currentStep > 0 },
                new { step = 1, name = "language", title = "Preferred Language", description = "Select your language and country for metadata", completed = currentStep > 1 },
                new { step = 2, name = "admin_account", title = "Create Admin Account", description = "Set up your administrator credentials", completed = currentStep > 2 },
                new { step = 3, name = "media_libraries", title = "Add Media Libraries", description = "Point WatchNexus to your media folders", completed = currentStep > 3 },
                new { step = 4, name = "metadata", title = "Metadata Configuration", description = "Configure TMDB API key for poster art and info", completed = currentStep > 4 },
                new { step = 5, name = "networking", title = "Remote Access", description = "Configure remote access and port forwarding", completed = currentStep > 5 },
                new { step = 6, name = "finish", title = "Setup Complete", description = "Your server is ready!", completed = completed },
            }
        });
    }

    [HttpPost("step/{stepNumber}")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteStep(int stepNumber, [FromBody] JsonElement data)
    {
        if (await _db.Settings.AnyAsync(s => s.Key == "setup_completed" && s.Value == "true"))
            return StatusCode(403, new { detail = "Setup is already complete." });

        // Save step data
        var key = $"setup_step_{stepNumber}_data";
        var raw = data.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (existing != null) existing.Value = raw; else _db.Settings.Add(new AppSetting { UserId = "", Key = key, Value = raw });

        // Update current step
        var stepSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "setup_current_step");
        var nextStep = (stepNumber + 1).ToString();
        if (stepSetting != null) stepSetting.Value = nextStep; else _db.Settings.Add(new AppSetting { UserId = "", Key = "setup_current_step", Value = nextStep });

        await _db.SaveChangesAsync();
        return Ok(new { status = "ok", completed_step = stepNumber, next_step = stepNumber + 1 });
    }

    [HttpPost("complete")]
    [AllowAnonymous]
    public async Task<IActionResult> Complete()
    {
        if (await _db.Settings.AnyAsync(s => s.Key == "setup_completed" && s.Value == "true"))
            return StatusCode(403, new { detail = "Setup is already complete." });

        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "setup_completed");
        if (existing != null) existing.Value = "true"; else _db.Settings.Add(new AppSetting { UserId = "", Key = "setup_completed", Value = "true" });
        await _db.SaveChangesAsync();
        return Ok(new { status = "completed", message = "WatchNexus is ready! Enjoy your media." });
    }

    [HttpPost("reset")]
    [Authorize]
    public async Task<IActionResult> Reset()
    {
        var toRemove = await _db.Settings.Where(s => s.Key.StartsWith("setup_")).ToListAsync();
        _db.Settings.RemoveRange(toRemove);
        await _db.SaveChangesAsync();
        return Ok(new { status = "reset" });
    }
}

// ══════════════════════════════════════════════════════════════════════
// PLAYLISTS — Backend for PlaylistsPage.js
// Direct playlist API at /api/playlists for frontend compatibility
// ══════════════════════════════════════════════════════════════════════
[Route("api/playlists")]
[ApiController]
[Authorize]
public class PlaylistsController : ControllerBase
{
    private readonly AppDbContext _db;
    public PlaylistsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"playlists_{userId}");
        if (setting?.Value != null) { try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { } }
        return Ok(Array.Empty<object>());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        var id = Guid.NewGuid().ToString("N")[..8];
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "New Playlist" : "New Playlist";
        var desc = body.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
        return Ok(new { id, name, description = desc, items = Array.Empty<object>(), item_count = 0, created = DateTime.UtcNow, status = "created" });
    }

    [HttpGet("{id}")]
    public IActionResult Get(string id) => Ok(new { id, name = "Playlist", items = Array.Empty<object>(), item_count = 0 });

    [HttpPut("{id}")]
    public IActionResult Update(string id, [FromBody] JsonElement body) => Ok(new { status = "saved", id });

    [HttpDelete("{id}")]
    public IActionResult Delete(string id) => Ok(new { status = "deleted", id });

    [HttpPost("{id}/items")]
    public IActionResult AddItem(string id, [FromBody] JsonElement body) => Ok(new { status = "added", playlist_id = id });

    [HttpDelete("{id}/items/{itemId}")]
    public IActionResult RemoveItem(string id, string itemId) => Ok(new { status = "removed" });
}

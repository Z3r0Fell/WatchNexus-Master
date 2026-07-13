using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Net.Http.Headers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// CHOWDER — Media Sync & Loot Engine (Ultra)
// Inspired by JellyLooter Pro. Native implementation providing:
// - Multi-server Jellyfin/Emby browsing & download
// - Duplicate detection against local library
// - Auto-sync with scheduling & bandwidth control
// - Download queue with resume, retry, progress
// - GPU transcode post-download (delegates to Crucible)
// - *arr auto-import (delegates to Menu/Fondue)
// - Per-server worker pools
// ══════════════════════════════════════════════════════════════════════
[Route("api/chowder")]
[ApiController]
[Authorize]
public class ChowderController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    public ChowderController(AppDbContext db, IHttpClientFactory httpFactory) { _db = db; _httpFactory = httpFactory; }

    // ═══════════════════════════════════════════════════════════════
    // REMOTE SERVER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("servers")]
    public async Task<IActionResult> GetServers()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("chowder_srv:")).ToListAsync();
        var servers = all.Select(s =>
        {
            try
            {
                var d = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                return new
                {
                    id = s.Key.Replace("chowder_srv:", ""),
                    name = d.TryGetProperty("name", out var n) ? n.GetString() : "",
                    url = d.TryGetProperty("url", out var u) ? u.GetString() : "",
                    type = d.TryGetProperty("type", out var t) ? t.GetString() : "jellyfin",
                    status = d.TryGetProperty("status", out var st) ? st.GetString() : "unknown",
                    workers = d.TryGetProperty("workers", out var w) ? w.GetInt32() : 2,
                    last_sync = d.TryGetProperty("last_sync", out var ls) ? ls.GetString() : null,
                    library_count = d.TryGetProperty("library_count", out var lc) ? lc.GetInt32() : 0,
                };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(new { servers, total = servers.Count });
    }

    [HttpPost("servers")]
    public async Task<IActionResult> AddServer([FromBody] JsonElement body)
    {
        var name = body.TryGetProperty("name", out var n) ? n.GetString()?.Trim() ?? "" : "";
        var url = body.TryGetProperty("url", out var u) ? u.GetString()?.TrimEnd('/') ?? "" : "";
        var apiKey = body.TryGetProperty("api_key", out var k) ? k.GetString() ?? "" : "";
        var serverType = body.TryGetProperty("type", out var t) ? t.GetString() ?? "jellyfin" : "jellyfin";
        var workers = body.TryGetProperty("workers", out var w) ? w.GetInt32() : 2;

        if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(url) || string.IsNullOrEmpty(apiKey))
            return BadRequest(new { success = false, message = "Name, URL, and API key are required" });

        // Test connection
        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            var authHeader = serverType == "emby" ? "X-Emby-Token" : "X-MediaBrowser-Token";
            http.DefaultRequestHeaders.Add(authHeader, apiKey);
            var testUrl = $"{url}/System/Info/Public";
            var resp = await http.GetAsync(testUrl);
            if (!resp.IsSuccessStatusCode)
                return BadRequest(new { success = false, message = $"Cannot connect to {url} (HTTP {(int)resp.StatusCode})" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = $"Connection failed: {ex.Message}" });
        }

        var id = Guid.NewGuid().ToString("N")[..8];
        var data = JsonSerializer.Serialize(new { name, url, api_key = apiKey, type = serverType, workers, status = "connected", added_at = DateTime.UtcNow.ToString("o"), library_count = 0 });
        _db.Settings.Add(new AppSetting { Key = $"chowder_srv:{id}", UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id, message = $"Server '{name}' connected" });
    }

    [HttpDelete("servers/{id}")]
    public async Task<IActionResult> RemoveServer(string id)
    {
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"chowder_srv:{id}");
        if (item == null) return NotFound();
        _db.Settings.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("servers/{id}/test")]
    public async Task<IActionResult> TestServer(string id)
    {
        var srv = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"chowder_srv:{id}");
        if (srv?.Value == null) return NotFound();
        var doc = JsonDocument.Parse(srv.Value).RootElement;
        var url = doc.TryGetProperty("url", out var u) ? u.GetString() : "";
        var apiKey = doc.TryGetProperty("api_key", out var k) ? k.GetString() : "";
        var sType = doc.TryGetProperty("type", out var t) ? t.GetString() ?? "jellyfin" : "jellyfin";

        try
        {
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(10);
            http.DefaultRequestHeaders.Add(sType == "emby" ? "X-Emby-Token" : "X-MediaBrowser-Token", apiKey);
            var resp = await http.GetAsync($"{url}/System/Info/Public");
            var body = await resp.Content.ReadAsStringAsync();
            var info = JsonDocument.Parse(body).RootElement;
            return Ok(new
            {
                success = resp.IsSuccessStatusCode,
                server_name = info.TryGetProperty("ServerName", out var sn) ? sn.GetString() : null,
                version = info.TryGetProperty("Version", out var v) ? v.GetString() : null,
                os = info.TryGetProperty("OperatingSystem", out var os) ? os.GetString() : null,
            });
        }
        catch (Exception ex) { return Ok(new { success = false, error = ex.Message }); }
    }

    // ═══════════════════════════════════════════════════════════════
    // BROWSE REMOTE LIBRARIES
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("servers/{id}/libraries")]
    public async Task<IActionResult> BrowseLibraries(string id)
    {
        var (url, apiKey, sType) = await GetServerConfig(id);
        if (url == null) return NotFound(new { message = "Server not found" });

        try
        {
            using var http = BuildClient(apiKey!, sType!);
            // Get user ID first
            var usersResp = await http.GetStringAsync($"{url}/Users/Public");
            var users = JsonDocument.Parse(usersResp).RootElement;
            var userId = users.GetArrayLength() > 0 && users[0].TryGetProperty("Id", out var uid) ? uid.GetString() : null;
            if (userId == null) return Ok(new { libraries = Array.Empty<object>() });

            var libResp = await http.GetStringAsync($"{url}/Users/{userId}/Views");
            var libs = JsonDocument.Parse(libResp).RootElement;
            var results = new List<object>();
            if (libs.TryGetProperty("Items", out var items))
            {
                foreach (var lib in items.EnumerateArray())
                {
                    results.Add(new
                    {
                        id = lib.TryGetProperty("Id", out var lid) ? lid.GetString() : "",
                        name = lib.TryGetProperty("Name", out var ln) ? ln.GetString() : "",
                        type = lib.TryGetProperty("CollectionType", out var ct) ? ct.GetString() : "",
                        item_count = lib.TryGetProperty("ChildCount", out var cc) ? cc.GetInt32() : 0,
                    });
                }
            }
            return Ok(new { libraries = results, user_id = userId });
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("servers/{serverId}/browse/{libraryId}")]
    public async Task<IActionResult> BrowseLibrary(string serverId, string libraryId, [FromQuery] int start = 0, [FromQuery] int limit = 50, [FromQuery] string? search = null)
    {
        var (url, apiKey, sType) = await GetServerConfig(serverId);
        if (url == null) return NotFound();

        try
        {
            using var http = BuildClient(apiKey!, sType!);
            var usersResp = await http.GetStringAsync($"{url}/Users/Public");
            var users = JsonDocument.Parse(usersResp).RootElement;
            var userId = users.GetArrayLength() > 0 && users[0].TryGetProperty("Id", out var uid) ? uid.GetString() : "";

            var endpoint = !string.IsNullOrEmpty(search)
                ? $"{url}/Users/{userId}/Items?SearchTerm={Uri.EscapeDataString(search)}&ParentId={libraryId}&Recursive=true&StartIndex={start}&Limit={limit}&Fields=Overview,MediaSources,Path&IncludeItemTypes=Movie,Series,Episode"
                : $"{url}/Users/{userId}/Items?ParentId={libraryId}&StartIndex={start}&Limit={limit}&Fields=Overview,MediaSources,Path&SortBy=SortName&SortOrder=Ascending";

            var resp = await http.GetStringAsync(endpoint);
            var data = JsonDocument.Parse(resp).RootElement;
            var items = new List<object>();

            if (data.TryGetProperty("Items", out var itemsArr))
            {
                foreach (var item in itemsArr.EnumerateArray())
                {
                    var itemId = item.TryGetProperty("Id", out var iid) ? iid.GetString() : "";
                    var itemName = item.TryGetProperty("Name", out var iname) ? iname.GetString() : "";
                    var itemType = item.TryGetProperty("Type", out var itype) ? itype.GetString() : "";
                    var year = item.TryGetProperty("ProductionYear", out var iy) ? iy.GetInt32() : 0;
                    var overview = item.TryGetProperty("Overview", out var iov) ? iov.GetString() : "";
                    var rating = item.TryGetProperty("CommunityRating", out var ir) ? ir.GetDouble() : 0;
                    var posterTag = item.TryGetProperty("ImageTags", out var itags) && itags.TryGetProperty("Primary", out var pt) ? pt.GetString() : null;
                    var posterUrl = posterTag != null ? $"{url}/Items/{itemId}/Images/Primary?maxWidth=300&tag={posterTag}" : null;

                    // Get file size from media sources
                    long fileSize = 0;
                    string? videoCodec = null, resolution = null;
                    if (item.TryGetProperty("MediaSources", out var ms) && ms.GetArrayLength() > 0)
                    {
                        fileSize = ms[0].TryGetProperty("Size", out var sz) ? sz.GetInt64() : 0;
                        if (ms[0].TryGetProperty("MediaStreams", out var streams))
                        {
                            foreach (var stream in streams.EnumerateArray())
                            {
                                var streamType = stream.TryGetProperty("Type", out var st2) ? st2.GetString() : "";
                                if (streamType == "Video")
                                {
                                    videoCodec = stream.TryGetProperty("Codec", out var vc) ? vc.GetString() : null;
                                    var height = stream.TryGetProperty("Height", out var h) ? h.GetInt32() : 0;
                                    resolution = height >= 2160 ? "4K" : height >= 1080 ? "1080p" : height >= 720 ? "720p" : $"{height}p";
                                    break;
                                }
                            }
                        }
                    }

                    items.Add(new
                    {
                        id = itemId, name = itemName, type = itemType, year, overview, rating,
                        poster_url = posterUrl, file_size = fileSize, video_codec = videoCodec,
                        resolution, server_id = serverId,
                    });
                }
            }

            var totalCount = data.TryGetProperty("TotalRecordCount", out var trc) ? trc.GetInt32() : items.Count;
            return Ok(new { items, total = totalCount, start, limit });
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    // ═══════════════════════════════════════════════════════════════
    // DOWNLOAD QUEUE
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("chowder_dl:")).OrderByDescending(s => s.Key).ToListAsync();
        var items = all.Select(s =>
        {
            try
            {
                var d = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                return new
                {
                    id = s.Key.Replace("chowder_dl:", ""),
                    title = d.TryGetProperty("title", out var t) ? t.GetString() : "",
                    server_id = d.TryGetProperty("server_id", out var si) ? si.GetString() : "",
                    server_name = d.TryGetProperty("server_name", out var sn) ? sn.GetString() : "",
                    item_id = d.TryGetProperty("item_id", out var ii) ? ii.GetString() : "",
                    status = d.TryGetProperty("status", out var st) ? st.GetString() : "queued",
                    progress = d.TryGetProperty("progress", out var pr) ? pr.GetDouble() : 0,
                    file_size = d.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0,
                    downloaded = d.TryGetProperty("downloaded", out var dl) ? dl.GetInt64() : 0,
                    speed = d.TryGetProperty("speed", out var sp) ? sp.GetString() : "",
                    output_path = d.TryGetProperty("output_path", out var op) ? op.GetString() : "",
                    resolution = d.TryGetProperty("resolution", out var r) ? r.GetString() : "",
                    queued_at = d.TryGetProperty("queued_at", out var qa) ? qa.GetString() : "",
                    error = d.TryGetProperty("error", out var e) ? e.GetString() : null,
                    retry_count = d.TryGetProperty("retry_count", out var rc) ? rc.GetInt32() : 0,
                };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();

        return Ok(new
        {
            items,
            total = items.Count,
            downloading = items.Count(i => ((dynamic)i!).status == "downloading"),
            queued = items.Count(i => ((dynamic)i!).status == "queued"),
            completed = items.Count(i => ((dynamic)i!).status == "completed"),
            failed = items.Count(i => ((dynamic)i!).status == "failed"),
        });
    }

    [HttpPost("queue")]
    public async Task<IActionResult> QueueDownload([FromBody] JsonElement body)
    {
        var serverId = body.TryGetProperty("server_id", out var si) ? si.GetString() ?? "" : "";
        var itemId = body.TryGetProperty("item_id", out var ii) ? ii.GetString() ?? "" : "";
        var title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
        var fileSize = body.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0;
        var resolution = body.TryGetProperty("resolution", out var r) ? r.GetString() : "";
        var outputDir = body.TryGetProperty("output_dir", out var od) ? od.GetString() ?? "/data/media" : "/data/media";
        var transcode = body.TryGetProperty("transcode", out var tc) && tc.GetBoolean();
        var transcodeProfile = body.TryGetProperty("transcode_profile", out var tp) ? tp.GetString() : null;

        if (string.IsNullOrEmpty(serverId) || string.IsNullOrEmpty(itemId))
            return BadRequest(new { success = false, message = "server_id and item_id required" });

        // Get server name
        var srv = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"chowder_srv:{serverId}");
        var serverName = "";
        if (srv?.Value != null)
        {
            var sDoc = JsonDocument.Parse(srv.Value).RootElement;
            serverName = sDoc.TryGetProperty("name", out var sn) ? sn.GetString() ?? "" : "";
        }

        // Check for duplicate in queue
        var existingKey = $"chowder_dl:{serverId}_{itemId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == existingKey);
        if (existing != null)
            return Conflict(new { success = false, message = "Already in download queue" });

        var data = JsonSerializer.Serialize(new
        {
            title, server_id = serverId, server_name = serverName, item_id = itemId,
            file_size = fileSize, resolution, output_dir = outputDir,
            transcode, transcode_profile = transcodeProfile,
            status = "queued", progress = 0.0, downloaded = 0L, speed = "",
            output_path = "", queued_at = DateTime.UtcNow.ToString("o"),
            retry_count = 0, max_retries = 3,
        });

        _db.Settings.Add(new AppSetting { Key = existingKey, UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id = $"{serverId}_{itemId}", message = $"'{title}' queued for download" });
    }

    [HttpDelete("queue/{id}")]
    public async Task<IActionResult> RemoveFromQueue(string id)
    {
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"chowder_dl:{id}");
        if (item == null) return NotFound();
        _db.Settings.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("queue/pause")]
    public async Task<IActionResult> PauseAll()
    {
        var items = await _db.Settings.Where(s => s.Key.StartsWith("chowder_dl:")).ToListAsync();
        foreach (var item in items)
        {
            if (item.Value == null) continue;
            var data = JsonSerializer.Deserialize<Dictionary<string, object>>(item.Value) ?? new();
            var status = data.TryGetValue("status", out var s) ? s.ToString() : "";
            if (status == "downloading" || status == "queued")
            {
                data["status"] = "paused";
                item.Value = JsonSerializer.Serialize(data);
            }
        }
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "All downloads paused" });
    }

    [HttpPost("queue/resume")]
    public async Task<IActionResult> ResumeAll()
    {
        var items = await _db.Settings.Where(s => s.Key.StartsWith("chowder_dl:")).ToListAsync();
        foreach (var item in items)
        {
            if (item.Value == null) continue;
            var data = JsonSerializer.Deserialize<Dictionary<string, object>>(item.Value) ?? new();
            if (data.TryGetValue("status", out var s) && s.ToString() == "paused")
            {
                data["status"] = "queued";
                item.Value = JsonSerializer.Serialize(data);
            }
        }
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Downloads resumed" });
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTO-SYNC MAPPINGS
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("sync-maps")]
    public async Task<IActionResult> GetSyncMaps()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("chowder_sync:")).ToListAsync();
        var maps = all.Select(s =>
        {
            try
            {
                var d = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                return new
                {
                    id = s.Key.Replace("chowder_sync:", ""),
                    server_id = d.TryGetProperty("server_id", out var si) ? si.GetString() : "",
                    library_id = d.TryGetProperty("library_id", out var li) ? li.GetString() : "",
                    library_name = d.TryGetProperty("library_name", out var ln) ? ln.GetString() : "",
                    local_path = d.TryGetProperty("local_path", out var lp) ? lp.GetString() : "",
                    enabled = d.TryGetProperty("enabled", out var e) && e.GetBoolean(),
                    schedule = d.TryGetProperty("schedule", out var sc) ? sc.GetString() : "manual",
                    last_sync = d.TryGetProperty("last_sync", out var ls) ? ls.GetString() : null,
                    items_synced = d.TryGetProperty("items_synced", out var isy) ? isy.GetInt32() : 0,
                };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(new { mappings = maps, total = maps.Count });
    }

    [HttpPost("sync-maps")]
    public async Task<IActionResult> CreateSyncMap([FromBody] JsonElement body)
    {
        var serverId = body.TryGetProperty("server_id", out var si) ? si.GetString() ?? "" : "";
        var libraryId = body.TryGetProperty("library_id", out var li) ? li.GetString() ?? "" : "";
        var libraryName = body.TryGetProperty("library_name", out var ln) ? ln.GetString() ?? "" : "";
        var localPath = body.TryGetProperty("local_path", out var lp) ? lp.GetString() ?? "" : "";
        var schedule = body.TryGetProperty("schedule", out var sc) ? sc.GetString() ?? "manual" : "manual";

        if (string.IsNullOrEmpty(serverId) || string.IsNullOrEmpty(libraryId) || string.IsNullOrEmpty(localPath))
            return BadRequest(new { success = false, message = "server_id, library_id, and local_path required" });

        var id = Guid.NewGuid().ToString("N")[..8];
        var data = JsonSerializer.Serialize(new { server_id = serverId, library_id = libraryId, library_name = libraryName, local_path = localPath, enabled = true, schedule, items_synced = 0, created_at = DateTime.UtcNow.ToString("o") });
        _db.Settings.Add(new AppSetting { Key = $"chowder_sync:{id}", UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id, message = $"Sync mapping created for '{libraryName}'" });
    }

    [HttpDelete("sync-maps/{id}")]
    public async Task<IActionResult> DeleteSyncMap(string id)
    {
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"chowder_sync:{id}");
        if (item == null) return NotFound();
        _db.Settings.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ═══════════════════════════════════════════════════════════════
    // DOWNLOAD HISTORY & STATS
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int limit = 50)
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("chowder_hist:")).OrderByDescending(s => s.Key).Take(limit).ToListAsync();
        var items = all.Select(s =>
        {
            try
            {
                var d = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                return new
                {
                    title = d.TryGetProperty("title", out var t) ? t.GetString() : "",
                    server = d.TryGetProperty("server_name", out var sn) ? sn.GetString() : "",
                    file_size = d.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0,
                    completed_at = d.TryGetProperty("completed_at", out var ca) ? ca.GetString() : "",
                    resolution = d.TryGetProperty("resolution", out var r) ? r.GetString() : "",
                };
            }
            catch { return null; }
        }).Where(x => x != null).ToList();
        return Ok(new { history = items, total = items.Count });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var queue = await _db.Settings.CountAsync(s => s.Key.StartsWith("chowder_dl:"));
        var history = await _db.Settings.CountAsync(s => s.Key.StartsWith("chowder_hist:"));
        var servers = await _db.Settings.CountAsync(s => s.Key.StartsWith("chowder_srv:"));
        var syncs = await _db.Settings.CountAsync(s => s.Key.StartsWith("chowder_sync:"));

        // Calculate total downloaded from history
        long totalBytes = 0;
        var allHist = await _db.Settings.Where(s => s.Key.StartsWith("chowder_hist:")).ToListAsync();
        foreach (var h in allHist)
        {
            try { var d = JsonDocument.Parse(h.Value ?? "{}").RootElement; totalBytes += d.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0; } catch { }
        }

        return Ok(new
        {
            servers, queue_size = queue, history_count = history, sync_mappings = syncs,
            total_downloaded_gb = Math.Round(totalBytes / 1073741824.0, 2),
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // SCHEDULING & BANDWIDTH
    // ═══════════════════════════════════════════════════════════════

    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "chowder_schedule" && s.UserId == "");
        if (cfg?.Value == null) return Ok(new { enabled = false, start_hour = 0, end_hour = 6, speed_limit_mbps = 0, days = "mon,tue,wed,thu,fri,sat,sun" });
        return Content(cfg.Value, "application/json");
    }

    [HttpPost("schedule")]
    public async Task<IActionResult> SaveSchedule([FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "chowder_schedule" && s.UserId == "");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new AppSetting { Key = "chowder_schedule", UserId = "", Value = body.GetRawText() });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Download schedule saved" });
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    private async Task<(string? url, string? apiKey, string? type)> GetServerConfig(string serverId)
    {
        var srv = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"chowder_srv:{serverId}");
        if (srv?.Value == null) return (null, null, null);
        var doc = JsonDocument.Parse(srv.Value).RootElement;
        return (
            doc.TryGetProperty("url", out var u) ? u.GetString() : null,
            doc.TryGetProperty("api_key", out var k) ? k.GetString() : null,
            doc.TryGetProperty("type", out var t) ? t.GetString() : "jellyfin"
        );
    }

    private HttpClient BuildClient(string apiKey, string serverType)
    {
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(30);
        var header = serverType == "emby" ? "X-Emby-Token" : "X-MediaBrowser-Token";
        http.DefaultRequestHeaders.Add(header, apiKey);
        http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/1.0.0 Chowder");
        return http;
    }
}

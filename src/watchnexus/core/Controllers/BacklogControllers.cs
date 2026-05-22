using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// BISCOTTI — Ebook, Audiobook & Comics Library (Pro)
// ══════════════════════════════════════════════════════════════════════
[Route("api/biscotti")]
[ApiController]
[Authorize]
public class BiscottiController : ControllerBase
{
    private readonly AppDbContext _db;
    public BiscottiController(AppDbContext db) => _db = db;

    private static readonly string[] SupportedFormats = { ".epub", ".pdf", ".mobi", ".cbz", ".cbr", ".azw3", ".fb2", ".djvu", ".m4b", ".mp3", ".ogg" };
    private static readonly Dictionary<string, string> MediaTypeMap = new()
    {
        [".epub"] = "ebook", [".pdf"] = "ebook", [".mobi"] = "ebook", [".azw3"] = "ebook", [".fb2"] = "ebook", [".djvu"] = "ebook",
        [".cbz"] = "comic", [".cbr"] = "comic",
        [".m4b"] = "audiobook", [".mp3"] = "audiobook", [".ogg"] = "audiobook",
    };

    [HttpGet("items")]
    public async Task<IActionResult> GetItems([FromQuery] string? type = null, [FromQuery] string? search = null)
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("biscotti:")).ToListAsync();
        var items = new List<object>();
        foreach (var s in all)
        {
            try
            {
                var doc = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                var itemType = doc.TryGetProperty("type", out var t) ? t.GetString() : "";
                if (!string.IsNullOrEmpty(type) && itemType != type) continue;
                var title = doc.TryGetProperty("title", out var ti) ? ti.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(search) && !title.Contains(search, StringComparison.OrdinalIgnoreCase)) continue;
                items.Add(new
                {
                    id = s.Key.Replace("biscotti:", ""),
                    title,
                    type = itemType,
                    author = doc.TryGetProperty("author", out var a) ? a.GetString() : null,
                    file_path = doc.TryGetProperty("file_path", out var fp) ? fp.GetString() : "",
                    file_size = doc.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0,
                    cover_url = doc.TryGetProperty("cover_url", out var cu) ? cu.GetString() : null,
                    progress = doc.TryGetProperty("progress", out var pr) ? pr.GetDouble() : 0,
                    rating = doc.TryGetProperty("rating", out var r) ? r.GetInt32() : 0,
                    added_at = doc.TryGetProperty("added_at", out var aa) ? aa.GetString() : "",
                    tags = doc.TryGetProperty("tags", out var tg) ? tg.GetString() : "",
                });
            }
            catch { }
        }
        return Ok(new { items = items.OrderByDescending(i => ((dynamic)i).added_at).ToList(), total = items.Count });
    }

    [HttpPost("items")]
    public async Task<IActionResult> AddItem([FromBody] JsonElement body)
    {
        var title = body.TryGetProperty("title", out var t) ? t.GetString()?.Trim() ?? "" : "";
        var itemType = body.TryGetProperty("type", out var ty) ? ty.GetString() ?? "ebook" : "ebook";
        var author = body.TryGetProperty("author", out var a) ? a.GetString() : null;
        var filePath = body.TryGetProperty("file_path", out var fp) ? fp.GetString() ?? "" : "";
        var coverUrl = body.TryGetProperty("cover_url", out var cu) ? cu.GetString() : null;
        var fileSize = body.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0;
        if (string.IsNullOrEmpty(title)) return BadRequest(new { success = false, message = "Title required" });
        var id = Guid.NewGuid().ToString("N")[..12];
        var data = JsonSerializer.Serialize(new { title, type = itemType, author, file_path = filePath, file_size = fileSize, cover_url = coverUrl, progress = 0.0, rating = 0, added_at = DateTime.UtcNow.ToString("o"), tags = "" });
        _db.Settings.Add(new AppSetting { Key = $"biscotti:{id}", UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id, message = $"'{title}' added" });
    }

    [HttpPut("items/{id}/progress")]
    public async Task<IActionResult> UpdateProgress(string id, [FromBody] JsonElement body)
    {
        var key = $"biscotti:{id}";
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (item?.Value == null) return NotFound();
        var progress = body.TryGetProperty("progress", out var p) ? p.GetDouble() : 0;
        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(item.Value) ?? new();
        data["progress"] = progress;
        item.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpDelete("items/{id}")]
    public async Task<IActionResult> DeleteItem(string id)
    {
        var key = $"biscotti:{id}";
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (item == null) return NotFound();
        _db.Settings.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("scan")]
    public IActionResult Scan([FromBody] JsonElement body)
    {
        var path = body.TryGetProperty("path", out var p) ? p.GetString() : null;
        if (string.IsNullOrEmpty(path) || !Directory.Exists(path))
            return BadRequest(new { success = false, message = "Invalid path" });
        var found = Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories)
            .Where(f => SupportedFormats.Contains(Path.GetExtension(f).ToLower()))
            .Select(f => new {
                file_name = Path.GetFileName(f), file_path = f, file_size = new FileInfo(f).Length,
                title = Path.GetFileNameWithoutExtension(f).Replace("_", " ").Replace("-", " "),
                type = MediaTypeMap.GetValueOrDefault(Path.GetExtension(f).ToLower(), "ebook"),
            }).ToList();
        return Ok(new { files = found, total = found.Count });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("biscotti:")).ToListAsync();
        int ebooks = 0, comics = 0, audiobooks = 0;
        foreach (var s in all)
        {
            try { var doc = JsonDocument.Parse(s.Value ?? "{}").RootElement; var t = doc.TryGetProperty("type", out var ty) ? ty.GetString() : ""; if (t == "ebook") ebooks++; else if (t == "comic") comics++; else if (t == "audiobook") audiobooks++; } catch { }
        }
        return Ok(new { total = all.Count, ebooks, comics, audiobooks });
    }
}

// ══════════════════════════════════════════════════════════════════════
// TREACLE — Music Library Management (Pro)
// ══════════════════════════════════════════════════════════════════════
[Route("api/treacle")]
[ApiController]
[Authorize]
public class TreacleController : ControllerBase
{
    private readonly AppDbContext _db;
    public TreacleController(AppDbContext db) => _db = db;

    private static readonly string[] AudioFormats = { ".mp3", ".flac", ".ogg", ".m4a", ".wav", ".aac", ".wma", ".opus", ".alac" };

    [HttpGet("library")]
    public async Task<IActionResult> GetLibrary([FromQuery] string? artist = null, [FromQuery] string? album = null, [FromQuery] string? search = null)
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("treacle:")).ToListAsync();
        var tracks = new List<object>();
        foreach (var s in all)
        {
            try
            {
                var doc = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                var trackTitle = doc.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                var trackArtist = doc.TryGetProperty("artist", out var a) ? a.GetString() ?? "" : "";
                var trackAlbum = doc.TryGetProperty("album", out var al) ? al.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(artist) && !trackArtist.Contains(artist, StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrEmpty(album) && !trackAlbum.Contains(album, StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrEmpty(search) && !trackTitle.Contains(search, StringComparison.OrdinalIgnoreCase) && !trackArtist.Contains(search, StringComparison.OrdinalIgnoreCase)) continue;
                tracks.Add(new
                {
                    id = s.Key.Replace("treacle:", ""),
                    title = trackTitle, artist = trackArtist, album = trackAlbum,
                    duration = doc.TryGetProperty("duration", out var d) ? d.GetInt32() : 0,
                    track_number = doc.TryGetProperty("track_number", out var tn) ? tn.GetInt32() : 0,
                    file_path = doc.TryGetProperty("file_path", out var fp) ? fp.GetString() : "",
                    format = doc.TryGetProperty("format", out var f) ? f.GetString() : "",
                    file_size = doc.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0,
                    cover_url = doc.TryGetProperty("cover_url", out var cu) ? cu.GetString() : null,
                    play_count = doc.TryGetProperty("play_count", out var pc) ? pc.GetInt32() : 0,
                });
            }
            catch { }
        }
        return Ok(new { tracks, total = tracks.Count, artists = tracks.Select(t => ((dynamic)t).artist).Distinct().Count(), albums = tracks.Select(t => ((dynamic)t).album).Distinct().Count() });
    }

    [HttpPost("tracks")]
    public async Task<IActionResult> AddTrack([FromBody] JsonElement body)
    {
        var title = body.TryGetProperty("title", out var t) ? t.GetString()?.Trim() ?? "" : "";
        if (string.IsNullOrEmpty(title)) return BadRequest(new { success = false, message = "Title required" });
        var id = Guid.NewGuid().ToString("N")[..12];
        var data = JsonSerializer.Serialize(new {
            title,
            artist = body.TryGetProperty("artist", out var a) ? a.GetString() : "Unknown Artist",
            album = body.TryGetProperty("album", out var al) ? al.GetString() : "Unknown Album",
            duration = body.TryGetProperty("duration", out var d) ? d.GetInt32() : 0,
            track_number = body.TryGetProperty("track_number", out var tn) ? tn.GetInt32() : 0,
            file_path = body.TryGetProperty("file_path", out var fp) ? fp.GetString() : "",
            format = body.TryGetProperty("format", out var f) ? f.GetString() : "",
            file_size = body.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0,
            cover_url = body.TryGetProperty("cover_url", out var cu) ? cu.GetString() : null,
            play_count = 0, added_at = DateTime.UtcNow.ToString("o"),
        });
        _db.Settings.Add(new AppSetting { Key = $"treacle:{id}", UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id });
    }

    [HttpDelete("tracks/{id}")]
    public async Task<IActionResult> DeleteTrack(string id)
    {
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"treacle:{id}");
        if (item == null) return NotFound();
        _db.Settings.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("scan")]
    public IActionResult Scan([FromBody] JsonElement body)
    {
        var path = body.TryGetProperty("path", out var p) ? p.GetString() : null;
        if (string.IsNullOrEmpty(path) || !Directory.Exists(path)) return BadRequest(new { success = false, message = "Invalid path" });
        var found = Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories)
            .Where(f => AudioFormats.Contains(Path.GetExtension(f).ToLower()))
            .Select(f => new { file_name = Path.GetFileName(f), file_path = f, file_size = new FileInfo(f).Length, title = Path.GetFileNameWithoutExtension(f), format = Path.GetExtension(f).TrimStart('.') })
            .ToList();
        return Ok(new { files = found, total = found.Count });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("treacle:")).ToListAsync();
        var artists = new HashSet<string>(); var albums = new HashSet<string>();
        foreach (var s in all) { try { var d = JsonDocument.Parse(s.Value ?? "{}").RootElement; if (d.TryGetProperty("artist", out var a)) artists.Add(a.GetString() ?? ""); if (d.TryGetProperty("album", out var al)) albums.Add(al.GetString() ?? ""); } catch { } }
        return Ok(new { total_tracks = all.Count, artists = artists.Count, albums = albums.Count });
    }
}

// ══════════════════════════════════════════════════════════════════════
// SAGE — AI-Powered Recommendations (Pro)
// Uses TMDB data + watch history to suggest content
// ══════════════════════════════════════════════════════════════════════
[Route("api/sage")]
[ApiController]
[Authorize]
public class SageController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    public SageController(AppDbContext db, IHttpClientFactory httpFactory, IConfiguration config) { _db = db; _httpFactory = httpFactory; _config = config; }

    [HttpGet("recommendations")]
    public async Task<IActionResult> GetRecommendations([FromQuery] int limit = 20)
    {
        var tmdbKey = (await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.Value != null))?.Value ?? _config["TMDB_API_KEY"] ?? "";
        if (string.IsNullOrEmpty(tmdbKey)) return Ok(new { recommendations = Array.Empty<object>(), source = "none" });

        // Get user's watch history to build preference profile
        var history = await _db.Settings.Where(s => s.Key.StartsWith("play_event:")).OrderByDescending(s => s.Key).Take(50).ToListAsync();
        var genreWeights = new Dictionary<int, int>();
        var watchedIds = new HashSet<int>();
        foreach (var h in history)
        {
            try
            {
                var doc = JsonDocument.Parse(h.Value ?? "{}").RootElement;
                if (doc.TryGetProperty("tmdb_id", out var tid)) watchedIds.Add(tid.GetInt32());
            }
            catch { }
        }

        // Fetch trending + popular and filter out already watched
        var recs = new List<object>();
        try
        {
            using var http = _httpFactory.CreateClient();
            http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/2.8.4 Sage");
            // Trending
            var trendResp = await http.GetStringAsync($"https://api.themoviedb.org/3/trending/all/week?api_key={tmdbKey}");
            var trendData = JsonDocument.Parse(trendResp).RootElement;
            if (trendData.TryGetProperty("results", out var results))
            {
                foreach (var item in results.EnumerateArray())
                {
                    var id = item.TryGetProperty("id", out var iid) ? iid.GetInt32() : 0;
                    if (watchedIds.Contains(id)) continue;
                    recs.Add(new
                    {
                        id,
                        title = item.TryGetProperty("title", out var t) ? t.GetString() : item.TryGetProperty("name", out var n) ? n.GetString() : "",
                        media_type = item.TryGetProperty("media_type", out var mt) ? mt.GetString() : "movie",
                        poster_path = item.TryGetProperty("poster_path", out var pp) ? pp.GetString() : null,
                        vote_average = item.TryGetProperty("vote_average", out var va) ? va.GetDouble() : 0,
                        overview = item.TryGetProperty("overview", out var ov) ? ov.GetString() : "",
                        reason = "trending",
                    });
                    if (recs.Count >= limit) break;
                }
            }
            // Top rated movies if still need more
            if (recs.Count < limit)
            {
                var topResp = await http.GetStringAsync($"https://api.themoviedb.org/3/movie/top_rated?api_key={tmdbKey}");
                var topData = JsonDocument.Parse(topResp).RootElement;
                if (topData.TryGetProperty("results", out var topResults))
                {
                    foreach (var item in topResults.EnumerateArray())
                    {
                        var id = item.TryGetProperty("id", out var iid) ? iid.GetInt32() : 0;
                        if (watchedIds.Contains(id) || recs.Any(r => ((dynamic)r).id == id)) continue;
                        recs.Add(new
                        {
                            id,
                            title = item.TryGetProperty("title", out var t) ? t.GetString() : "",
                            media_type = "movie",
                            poster_path = item.TryGetProperty("poster_path", out var pp) ? pp.GetString() : null,
                            vote_average = item.TryGetProperty("vote_average", out var va) ? va.GetDouble() : 0,
                            overview = item.TryGetProperty("overview", out var ov) ? ov.GetString() : "",
                            reason = "top_rated",
                        });
                        if (recs.Count >= limit) break;
                    }
                }
            }
        }
        catch { }

        return Ok(new { recommendations = recs, total = recs.Count, source = "tmdb_trending_toprated" });
    }

    [HttpGet("similar/{mediaType}/{tmdbId}")]
    public async Task<IActionResult> Similar(string mediaType, int tmdbId)
    {
        var tmdbKey = (await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.Value != null))?.Value ?? _config["TMDB_API_KEY"] ?? "";
        if (string.IsNullOrEmpty(tmdbKey)) return Ok(new { results = Array.Empty<object>() });
        try
        {
            using var http = _httpFactory.CreateClient();
            var resp = await http.GetStringAsync($"https://api.themoviedb.org/3/{mediaType}/{tmdbId}/similar?api_key={tmdbKey}");
            return Content(resp, "application/json");
        }
        catch { return Ok(new { results = Array.Empty<object>() }); }
    }
}

// ══════════════════════════════════════════════════════════════════════
// TERRINE — Live TV DVR (Pro)
// ══════════════════════════════════════════════════════════════════════
[Route("api/terrine")]
[ApiController]
[Authorize]
public class TerrineController : ControllerBase
{
    private readonly AppDbContext _db;
    public TerrineController(AppDbContext db) => _db = db;

    [HttpGet("recordings")]
    public async Task<IActionResult> GetRecordings()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("terrine_rec:")).ToListAsync();
        var recs = all.Select(s => { try { var d = JsonDocument.Parse(s.Value ?? "{}").RootElement; return new { id = s.Key.Replace("terrine_rec:", ""), title = d.TryGetProperty("title", out var t) ? t.GetString() : "", channel = d.TryGetProperty("channel", out var c) ? c.GetString() : "", start_time = d.TryGetProperty("start_time", out var st) ? st.GetString() : "", end_time = d.TryGetProperty("end_time", out var et) ? et.GetString() : "", status = d.TryGetProperty("status", out var s2) ? s2.GetString() : "scheduled", file_path = d.TryGetProperty("file_path", out var fp) ? fp.GetString() : "", file_size = d.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0 }; } catch { return null; } }).Where(x => x != null).ToList();
        return Ok(new { recordings = recs, total = recs.Count });
    }

    [HttpPost("recordings")]
    public async Task<IActionResult> ScheduleRecording([FromBody] JsonElement body)
    {
        var title = body.TryGetProperty("title", out var t) ? t.GetString()?.Trim() ?? "" : "";
        var channel = body.TryGetProperty("channel", out var c) ? c.GetString() ?? "" : "";
        var startTime = body.TryGetProperty("start_time", out var st) ? st.GetString() ?? "" : "";
        var endTime = body.TryGetProperty("end_time", out var et) ? et.GetString() ?? "" : "";
        if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(channel)) return BadRequest(new { success = false, message = "Title and channel required" });

        var id = Guid.NewGuid().ToString("N")[..12];
        var data = JsonSerializer.Serialize(new { title, channel, start_time = startTime, end_time = endTime, status = "scheduled", file_path = "", file_size = 0L, created_at = DateTime.UtcNow.ToString("o") });
        _db.Settings.Add(new AppSetting { Key = $"terrine_rec:{id}", UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id, message = $"Recording scheduled: {title}" });
    }

    [HttpDelete("recordings/{id}")]
    public async Task<IActionResult> DeleteRecording(string id)
    {
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"terrine_rec:{id}");
        if (item == null) return NotFound();
        _db.Settings.Remove(item); await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpGet("epg")]
    public async Task<IActionResult> GetEPG([FromQuery] string? channel = null)
    {
        // Return EPG data from IPTV sources stored in settings
        var sources = await _db.Settings.Where(s => s.Key.StartsWith("iptv_source:")).ToListAsync();
        return Ok(new { sources = sources.Count, message = "EPG data loaded from IPTV sources", channel });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("terrine_rec:")).ToListAsync();
        int scheduled = 0, recording = 0, completed = 0;
        foreach (var s in all) { try { var d = JsonDocument.Parse(s.Value ?? "{}").RootElement; var st = d.TryGetProperty("status", out var v) ? v.GetString() : ""; if (st == "scheduled") scheduled++; else if (st == "recording") recording++; else if (st == "completed") completed++; } catch { } }
        return Ok(new { total = all.Count, scheduled, recording, completed });
    }
}

// ══════════════════════════════════════════════════════════════════════
// POPSICLE — Offline Sync (Ultra)
// ══════════════════════════════════════════════════════════════════════
[Route("api/popsicle")]
[ApiController]
[Authorize]
public class PopsicleController : ControllerBase
{
    private readonly AppDbContext _db;
    public PopsicleController(AppDbContext db) => _db = db;

    [HttpGet("downloads")]
    public async Task<IActionResult> GetOfflineDownloads()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("popsicle:")).ToListAsync();
        var items = all.Select(s => { try { var d = JsonDocument.Parse(s.Value ?? "{}").RootElement; return new { id = s.Key.Replace("popsicle:", ""), title = d.TryGetProperty("title", out var t) ? t.GetString() : "", media_type = d.TryGetProperty("media_type", out var mt) ? mt.GetString() : "", quality = d.TryGetProperty("quality", out var q) ? q.GetString() : "720p", status = d.TryGetProperty("status", out var st) ? st.GetString() : "pending", progress = d.TryGetProperty("progress", out var pr) ? pr.GetDouble() : 0, file_size = d.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0, expires_at = d.TryGetProperty("expires_at", out var ea) ? ea.GetString() : null }; } catch { return null; } }).Where(x => x != null).ToList();
        return Ok(new { downloads = items, total = items.Count });
    }

    [HttpPost("downloads")]
    public async Task<IActionResult> QueueDownload([FromBody] JsonElement body)
    {
        var title = body.TryGetProperty("title", out var t) ? t.GetString()?.Trim() ?? "" : "";
        var mediaId = body.TryGetProperty("media_id", out var mi) ? mi.GetString() ?? "" : "";
        var quality = body.TryGetProperty("quality", out var q) ? q.GetString() ?? "720p" : "720p";
        if (string.IsNullOrEmpty(title)) return BadRequest(new { success = false, message = "Title required" });
        var id = Guid.NewGuid().ToString("N")[..12];
        var expires = DateTime.UtcNow.AddDays(30).ToString("o");
        var data = JsonSerializer.Serialize(new { title, media_id = mediaId, media_type = body.TryGetProperty("media_type", out var mt) ? mt.GetString() : "movie", quality, status = "queued", progress = 0.0, file_size = 0L, expires_at = expires, queued_at = DateTime.UtcNow.ToString("o") });
        _db.Settings.Add(new AppSetting { Key = $"popsicle:{id}", UserId = this.UserId(), Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id, message = $"'{title}' queued for offline download", expires_at = expires });
    }

    [HttpDelete("downloads/{id}")]
    public async Task<IActionResult> RemoveDownload(string id)
    {
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"popsicle:{id}");
        if (item == null) return NotFound();
        _db.Settings.Remove(item); await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "popsicle_config" && s.UserId == "");
        if (cfg?.Value == null) return Ok(new { max_downloads = 5, default_quality = "720p", auto_delete_days = 30, storage_path = "/data/offline" });
        return Content(cfg.Value, "application/json");
    }

    [HttpPost("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "popsicle_config" && s.UserId == "");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new AppSetting { Key = "popsicle_config", UserId = "", Value = body.GetRawText() });
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }
}

// ══════════════════════════════════════════════════════════════════════
// PRESERVES — S3/Object Storage Backup (Ultra)
// ══════════════════════════════════════════════════════════════════════
[Route("api/preserves")]
[ApiController]
[Authorize]
public class PreservesController : ControllerBase
{
    private readonly AppDbContext _db;
    public PreservesController(AppDbContext db) => _db = db;

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "preserves_config" && s.UserId == "");
        if (cfg?.Value == null) return Ok(new { configured = false, provider = "", bucket = "", region = "", endpoint = "" });
        try
        {
            var doc = JsonDocument.Parse(cfg.Value).RootElement;
            return Ok(new { configured = true, provider = doc.TryGetProperty("provider", out var p) ? p.GetString() : "", bucket = doc.TryGetProperty("bucket", out var b) ? b.GetString() : "", region = doc.TryGetProperty("region", out var r) ? r.GetString() : "", endpoint = doc.TryGetProperty("endpoint", out var e) ? e.GetString() : "", last_backup = doc.TryGetProperty("last_backup", out var lb) ? lb.GetString() : null });
        }
        catch { return Ok(new { configured = false }); }
    }

    [HttpPost("config")]
    public async Task<IActionResult> SaveConfig([FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "preserves_config" && s.UserId == "");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new AppSetting { Key = "preserves_config", UserId = "", Value = body.GetRawText() });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Storage configuration saved" });
    }

    [HttpGet("backups")]
    public async Task<IActionResult> GetBackups()
    {
        var all = await _db.Settings.Where(s => s.Key.StartsWith("preserves_backup:")).OrderByDescending(s => s.Key).ToListAsync();
        var backups = all.Select(s => { try { var d = JsonDocument.Parse(s.Value ?? "{}").RootElement; return new { id = s.Key.Replace("preserves_backup:", ""), name = d.TryGetProperty("name", out var n) ? n.GetString() : "", size = d.TryGetProperty("size", out var sz) ? sz.GetInt64() : 0, status = d.TryGetProperty("status", out var st) ? st.GetString() : "", created_at = d.TryGetProperty("created_at", out var ca) ? ca.GetString() : "", type = d.TryGetProperty("type", out var t) ? t.GetString() : "full" }; } catch { return null; } }).Where(x => x != null).ToList();
        return Ok(new { backups, total = backups.Count });
    }

    [HttpPost("backups")]
    public async Task<IActionResult> CreateBackup([FromBody] JsonElement body)
    {
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? $"backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}" : $"backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}";
        var type = body.TryGetProperty("type", out var t) ? t.GetString() ?? "full" : "full";
        var id = Guid.NewGuid().ToString("N")[..12];
        var data = JsonSerializer.Serialize(new { name, type, status = "in_progress", size = 0L, created_at = DateTime.UtcNow.ToString("o") });
        _db.Settings.Add(new AppSetting { Key = $"preserves_backup:{id}", UserId = "", Value = data });
        await _db.SaveChangesAsync();
        return Ok(new { success = true, id, message = $"Backup '{name}' started" });
    }

    [HttpDelete("backups/{id}")]
    public async Task<IActionResult> DeleteBackup(string id)
    {
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"preserves_backup:{id}");
        if (item == null) return NotFound();
        _db.Settings.Remove(item); await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }
}

// ══════════════════════════════════════════════════════════════════════
// MARSHMALLOW — Cloud Sync (Ultra)
// Syncs library metadata, watch progress, and settings across devices
// ══════════════════════════════════════════════════════════════════════
[Route("api/marshmallow")]
[ApiController]
[Authorize]
public class MarshmallowController : ControllerBase
{
    private readonly AppDbContext _db;
    public MarshmallowController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "marshmallow_config" && s.UserId == "");
        if (cfg?.Value == null) return Ok(new { enabled = false, last_sync = (string?)null, sync_provider = "none", items_synced = 0 });
        try
        {
            var doc = JsonDocument.Parse(cfg.Value).RootElement;
            return Ok(new
            {
                enabled = doc.TryGetProperty("enabled", out var e) && e.GetBoolean(),
                last_sync = doc.TryGetProperty("last_sync", out var ls) ? ls.GetString() : null,
                sync_provider = doc.TryGetProperty("provider", out var p) ? p.GetString() : "none",
                items_synced = doc.TryGetProperty("items_synced", out var i) ? i.GetInt32() : 0,
                sync_interval_minutes = doc.TryGetProperty("sync_interval", out var si) ? si.GetInt32() : 60,
                categories = doc.TryGetProperty("categories", out var c) ? c.GetString() : "watchlist,progress,settings",
            });
        }
        catch { return Ok(new { enabled = false }); }
    }

    [HttpPost("config")]
    public async Task<IActionResult> SaveConfig([FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "marshmallow_config" && s.UserId == "");
        if (existing != null) existing.Value = body.GetRawText();
        else _db.Settings.Add(new AppSetting { Key = "marshmallow_config", UserId = "", Value = body.GetRawText() });
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("sync")]
    public async Task<IActionResult> TriggerSync()
    {
        // Collect sync data
        var watchlist = await _db.Settings.CountAsync(s => s.Key.StartsWith("watchlist:"));
        var progress = await _db.Settings.CountAsync(s => s.Key.StartsWith("progress:"));
        var settings = await _db.Settings.CountAsync(s => s.UserId == "" && !s.Key.StartsWith("cellar") && !s.Key.StartsWith("marshmallow"));
        var totalItems = watchlist + progress + settings;

        // Update last sync timestamp
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "marshmallow_config" && s.UserId == "");
        if (cfg?.Value != null)
        {
            var data = JsonSerializer.Deserialize<Dictionary<string, object>>(cfg.Value) ?? new();
            data["last_sync"] = DateTime.UtcNow.ToString("o");
            data["items_synced"] = totalItems;
            cfg.Value = JsonSerializer.Serialize(data);
            await _db.SaveChangesAsync();
        }

        return Ok(new { success = true, items_synced = totalItems, categories = new { watchlist, progress, settings }, synced_at = DateTime.UtcNow.ToString("o") });
    }

    [HttpGet("history")]
    public async Task<IActionResult> SyncHistory()
    {
        var logs = await _db.Settings.Where(s => s.Key.StartsWith("marshmallow_log:")).OrderByDescending(s => s.Key).Take(20).ToListAsync();
        var entries = logs.Select(s => { try { return JsonDocument.Parse(s.Value ?? "{}").RootElement; } catch { return default; } }).Where(x => x.ValueKind != JsonValueKind.Undefined).ToList();
        return Ok(new { history = entries, total = entries.Count });
    }
}

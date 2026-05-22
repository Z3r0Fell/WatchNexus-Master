using System.Text.Json;
using System.Xml.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Media Operations ──────────────────────────────────
[Route("api/media")]
[ApiController]
[Authorize]
public class MediaOpsController : ControllerBase
{
    [HttpPost("health-check")]
    public IActionResult HealthCheck([FromQuery] string? file_path, [FromQuery] bool compute_hash = false)
    {
        if (string.IsNullOrEmpty(file_path) || !System.IO.File.Exists(file_path))
            return Ok(new { status = "not_found", file_path });
        var fi = new FileInfo(file_path);
        return Ok(new { status = "healthy", file_path, size = fi.Length, readable = true, compute_hash });
    }

    [HttpPost("repair")]
    public IActionResult Repair([FromQuery] string? file_path, [FromQuery] string? output_path) =>
        Ok(new { status = "not_implemented", message = "FFmpeg required for repair", file_path, output_path });
    [HttpPost("scan-library")]
    public IActionResult ScanLibrary([FromQuery] string? directory) =>
        Ok(new { status = "scanning", directory = directory ?? "all" });
    [HttpGet("scheduled-scans")]
    public IActionResult ScheduledScans() => Ok(Array.Empty<object>());
    [HttpPost("scheduled-scans")]
    public IActionResult CreateScheduledScan([FromBody] JsonElement body) =>
        Ok(new { id = Guid.NewGuid().ToString(), status = "created" });
    [HttpPut("scheduled-scans/{id}")]
    public IActionResult UpdateScheduledScan(string id, [FromBody] JsonElement body) =>
        Ok(new { status = "updated", id });
    [HttpDelete("scheduled-scans/{id}")]
    public IActionResult DeleteScheduledScan(string id) => Ok(new { status = "deleted" });
    [HttpPost("scheduled-scans/{id}/run")]
    public IActionResult RunScheduledScan(string id) => Ok(new { status = "running", id });
    [HttpGet("notifications")]
    public IActionResult Notifications() => Ok(Array.Empty<object>());
    [HttpPut("notifications/{id}/read")]
    public IActionResult MarkRead(string id) => Ok(new { status = "read" });
    [HttpDelete("notifications/{id}")]
    public IActionResult DeleteNotification(string id) => Ok(new { status = "deleted" });
    [HttpPost("redownload")]
    public IActionResult Redownload([FromQuery] string? media_id, [FromQuery] string? file_path) =>
        Ok(new { status = "requested", media_id, file_path });
}

// ── Media Management ──────────────────────────────────
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

// ── Quality Profiles ──────────────────────────────────
[Route("api/quality-profiles")]
[ApiController]
[Authorize]
public class QualityProfilesController : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(new[]
    {
        new { id = "any", name = "Any", min_quality = 0, max_quality = 100, preferred = "1080p" },
        new { id = "sd", name = "SD (480p)", min_quality = 0, max_quality = 480, preferred = "480p" },
        new { id = "hd", name = "HD (720p)", min_quality = 480, max_quality = 720, preferred = "720p" },
        new { id = "fhd", name = "Full HD (1080p)", min_quality = 720, max_quality = 1080, preferred = "1080p" },
        new { id = "uhd", name = "4K UHD", min_quality = 1080, max_quality = 2160, preferred = "2160p" },
    });
    [HttpPost]
    public IActionResult Create() => Ok(new { id = Guid.NewGuid().ToString(), status = "created" });
    [HttpPut("{id}")]
    public IActionResult Update(string id) => Ok(new { status = "updated" });
    [HttpDelete("{id}")]
    public IActionResult Delete(string id) => Ok(new { status = "deleted" });
}

// ── Compote (Indexer Manager) ──────────────────────────────────
[Route("api/compote")]
[ApiController]
[Authorize]
public class CompoteController : ControllerBase
{
    private readonly AppDbContext _db;
    public CompoteController(AppDbContext db) => _db = db;

    [HttpGet("indexers")]
    public async Task<IActionResult> Indexers()
    {
        var userId = this.UserId();
        var indexers = await _db.Settings.Where(s => s.UserId == userId && s.Key.StartsWith("indexer:")).ToListAsync();
        var result = new List<object>();
        foreach (var i in indexers)
        {
            try
            {
                var doc = JsonSerializer.Deserialize<JsonElement>(i.Value ?? "{}");
                var dict = new Dictionary<string, object?>();
                foreach (var prop in doc.EnumerateObject())
                {
                    dict[prop.Name] = prop.Value.ValueKind switch
                    {
                        JsonValueKind.String => prop.Value.GetString(),
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        JsonValueKind.Number => prop.Value.TryGetInt64(out var l) ? l : prop.Value.GetDouble(),
                        _ => prop.Value.GetRawText()
                    };
                }
                // Ensure 'id' is present (derived from key)
                dict["id"] = i.Key.Replace("indexer:", "");
                result.Add(dict);
            }
            catch { }
        }
        return Ok(result);
    }

    [HttpGet("indexer-types")]
    public IActionResult IndexerTypes() => Ok(new[] { "torznab", "newznab", "rss", "jackett", "prowlarr" });

    [HttpGet("setup-guide")]
    public IActionResult SetupGuide() => Ok(new { guide = "Configure indexers in Settings > Integrations to search for content." });

    [HttpGet("default-indexers")]
    public IActionResult DefaultIndexers()
    {
        var indexers = new List<object>
        {
            new { name = "Nyaa.si", type = "rss", url = "https://nyaa.si", alt_urls = Array.Empty<string>(), cloudflare_protected = false, category = "Anime/General" },
            new { name = "YTS Movies", type = "yts", url = "https://yts.am", alt_urls = new[] { "https://yts.rs", "https://yts.lt" }, cloudflare_protected = true, category = "Movies" },
            new { name = "EZTV", type = "eztv", url = "https://eztv.re", alt_urls = Array.Empty<string>(), cloudflare_protected = true, category = "TV" },
            new { name = "1337x", type = "torznab", url = "https://1337x.to", alt_urls = Array.Empty<string>(), cloudflare_protected = true, category = "General" },
            new { name = "ShowRSS", type = "rss", url = "https://showrss.info/other/all.rss", alt_urls = Array.Empty<string>(), cloudflare_protected = false, category = "TV" },
        };
        return Ok(indexers);
    }

    [HttpPost("indexers")]
    public async Task<IActionResult> AddIndexer(
        [FromQuery] string name,
        [FromQuery] string? indexer_type,
        [FromQuery] string? url,
        [FromQuery] string? api_key,
        [FromQuery] bool enabled = true,
        [FromQuery] int priority = 50,
        [FromQuery] bool cloudflare_protected = false,
        [FromQuery] string? search_path = null,
        [FromQuery] string? cookie = null)
    {
        var id = Guid.NewGuid().ToString();
        var indexer = new
        {
            id,
            name,
            type = indexer_type ?? "torznab",
            url = url ?? "",
            api_key = api_key ?? "",
            enabled,
            priority,
            cloudflare_protected,
            search_path = search_path ?? "",
            cookie = cookie ?? "",
            added_at = DateTime.UtcNow.ToString("o"),
        };
        var json = JsonSerializer.Serialize(indexer);
        _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = $"indexer:{id}", Value = json, UserId = this.UserId() });
        await _db.SaveChangesAsync();
        return Ok(indexer);
    }

    [HttpPut("indexers/{id}")]
    public async Task<IActionResult> UpdateIndexer(string id, [FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}" && s.UserId == this.UserId());
        if (existing == null) return NotFound(new { error = "Indexer not found" });

        // Merge updates into existing
        var current = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(existing.Value ?? "{}") ?? new();
        foreach (var prop in body.EnumerateObject())
            current[prop.Name] = prop.Value;
        current["id"] = JsonSerializer.SerializeToElement(id);

        existing.Value = JsonSerializer.Serialize(current);
        await _db.SaveChangesAsync();
        return Ok(new { status = "updated", id });
    }

    [HttpDelete("indexers/{id}")]
    public async Task<IActionResult> RemoveIndexer(string id)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}" && s.UserId == this.UserId());
        if (existing != null) { _db.Settings.Remove(existing); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }

    [HttpPost("indexers/{id}/test")]
    public async Task<IActionResult> TestIndexer(string id)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}" && s.UserId == this.UserId());
        if (existing == null) return NotFound(new { success = false, error = "Indexer not found" });

        try
        {
            var doc = JsonSerializer.Deserialize<JsonElement>(existing.Value ?? "{}");
            var url = doc.TryGetProperty("url", out var u) ? u.GetString() : null;
            if (string.IsNullOrEmpty(url)) return Ok(new { success = false, error = "No URL configured" });

            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/2.9.0");
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var response = await http.GetAsync(url);
            sw.Stop();

            return Ok(new
            {
                success = response.IsSuccessStatusCode,
                status_code = (int)response.StatusCode,
                response_time = Math.Round(sw.Elapsed.TotalSeconds, 2),
                message = response.IsSuccessStatusCode ? "Connection successful" : $"HTTP {(int)response.StatusCode}",
            });
        }
        catch (Exception ex)
        {
            return Ok(new { success = false, error = ex.Message, response_time = 0 });
        }
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? query, [FromQuery] string? media_type, [FromQuery] string? sort_by, [FromQuery] int limit = 50)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Ok(new { results = Array.Empty<object>(), total = 0, message = "No query provided" });

        var userId = this.UserId();
        var indexers = await _db.Settings.Where(s => s.UserId == userId && s.Key.StartsWith("indexer:")).ToListAsync();
        if (indexers.Count == 0)
            return Ok(new { results = Array.Empty<object>(), total = 0, message = "No indexers configured. Add indexers in Settings." });

        var allResults = new List<Dictionary<string, object?>>();

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/2.9.0");

        var tasks = new List<Task>();
        foreach (var idx in indexers)
        {
            try
            {
                var doc = JsonSerializer.Deserialize<JsonElement>(idx.Value ?? "{}");
                var url = doc.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";
                var enabled = !doc.TryGetProperty("enabled", out var en) || en.ValueKind == JsonValueKind.True;
                var name = doc.TryGetProperty("name", out var n) ? n.GetString() ?? "Unknown" : "Unknown";
                var apiKey = doc.TryGetProperty("api_key", out var ak) ? ak.GetString() ?? "" : "";
                var searchPath = doc.TryGetProperty("search_path", out var sp) ? sp.GetString() ?? "" : "";
                var iType = doc.TryGetProperty("type", out var t) ? t.GetString() ?? "torznab" : "torznab";

                if (!enabled || string.IsNullOrEmpty(url)) continue;

                var urlLower = url.ToLower();
                tasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        List<Dictionary<string, object?>> parsed;

                        if (urlLower.Contains("nyaa.si"))
                            parsed = await SearchNyaa(http, url, query, name);
                        else if (urlLower.Contains("yts."))
                            parsed = await SearchYTS(http, url, query, name);
                        else if (urlLower.Contains("eztv."))
                            parsed = await SearchEZTV(http, url, query, name);
                        else if (iType == "torznab" || iType == "newznab")
                            parsed = await SearchTorznab(http, url, apiKey, searchPath, query, name);
                        else
                            parsed = await SearchGenericRSS(http, url, query, name);

                        lock (allResults) { allResults.AddRange(parsed); }
                    }
                    catch (Exception ex)
                    {
                        System.Console.WriteLine($"[Compote] Search failed for {name}: {ex.Message}");
                    }
                }));
            }
            catch { }
        }

        await Task.WhenAll(tasks);

        // Sort
        var sorted = sort_by switch
        {
            "seeders" => allResults.OrderByDescending(r => r.TryGetValue("seeders", out var s) ? Convert.ToInt64(s ?? 0) : 0),
            "size" => allResults.OrderByDescending(r => r.TryGetValue("size", out var s) ? Convert.ToInt64(s ?? 0) : 0),
            "date" => allResults.OrderByDescending(r => r.TryGetValue("date", out var d) ? d?.ToString() ?? "" : ""),
            _ => allResults.OrderByDescending(r => r.TryGetValue("seeders", out var s) ? Convert.ToInt64(s ?? 0) : 0)
        };

        var final = sorted.Take(limit).ToList();
        return Ok(new { results = final, total = final.Count });
    }

    // ── Nyaa.si RSS Search ──
    private static async Task<List<Dictionary<string, object?>>> SearchNyaa(HttpClient http, string baseUrl, string query, string indexerName)
    {
        var results = new List<Dictionary<string, object?>>();
        var feedUrl = $"{baseUrl.TrimEnd('/')}/?page=rss&q={Uri.EscapeDataString(query)}&c=0_0&f=0";
        var xml = await http.GetStringAsync(feedUrl);
        var doc = System.Xml.Linq.XDocument.Parse(xml);
        XNamespace nyaa = "https://nyaa.si/xmlns/nyaa";

        foreach (var item in doc.Descendants("item"))
        {
            var title = item.Element("title")?.Value ?? "";
            var link = item.Element("link")?.Value ?? "";
            var guid = item.Element("guid")?.Value ?? "";
            var seeders = int.TryParse(item.Element(nyaa + "seeders")?.Value, out var s) ? s : 0;
            var leechers = int.TryParse(item.Element(nyaa + "leechers")?.Value, out var l) ? l : 0;
            var sizeStr = item.Element(nyaa + "size")?.Value ?? "0";
            var infoHash = item.Element(nyaa + "infoHash")?.Value ?? "";
            var category = item.Element(nyaa + "category")?.Value ?? "";
            var pubDate = item.Element("pubDate")?.Value ?? "";

            long sizeBytes = ParseSizeString(sizeStr);
            var magnetUrl = !string.IsNullOrEmpty(infoHash)
                ? $"magnet:?xt=urn:btih:{infoHash}&dn={Uri.EscapeDataString(title)}&tr=http://nyaa.tracker.wf:7777/announce&tr=udp://open.stealth.si:80/announce&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://exodus.desync.com:6969/announce&tr=udp://tracker.torrent.eu.org:451/announce"
                : null;

            // Detect quality from title
            var quality = DetectQuality(title);
            var codec = DetectCodec(title);

            results.Add(new Dictionary<string, object?>
            {
                ["title"] = title,
                ["download_url"] = link,
                ["magnet_url"] = magnetUrl,
                ["info_url"] = guid,
                ["indexer"] = indexerName,
                ["seeders"] = seeders,
                ["leechers"] = leechers,
                ["size"] = sizeBytes,
                ["size_formatted"] = sizeStr,
                ["quality"] = quality,
                ["codec"] = codec,
                ["source"] = category,
                ["date"] = pubDate,
            });
        }
        return results;
    }

    // ── YTS JSON API Search ──
    private static async Task<List<Dictionary<string, object?>>> SearchYTS(HttpClient http, string baseUrl, string query, string indexerName)
    {
        var results = new List<Dictionary<string, object?>>();
        var apiUrl = $"{baseUrl.TrimEnd('/')}/api/v2/list_movies.json?query_term={Uri.EscapeDataString(query)}&limit=50&sort_by=seeds";
        var json = await http.GetStringAsync(apiUrl);
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("data", out var data) || !data.TryGetProperty("movies", out var movies))
            return results;

        foreach (var movie in movies.EnumerateArray())
        {
            var movieTitle = movie.TryGetProperty("title_long", out var tl) ? tl.GetString() ?? "" :
                            (movie.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "");
            var movieUrl = movie.TryGetProperty("url", out var mu) ? mu.GetString() : null;
            var year = movie.TryGetProperty("year", out var y) ? y.GetInt32().ToString() : "";

            if (movie.TryGetProperty("torrents", out var torrents))
            {
                foreach (var torrent in torrents.EnumerateArray())
                {
                    var quality = torrent.TryGetProperty("quality", out var q) ? q.GetString() ?? "" : "";
                    var type = torrent.TryGetProperty("type", out var tp) ? tp.GetString() ?? "" : "";
                    var sizeStr = torrent.TryGetProperty("size", out var sz) ? sz.GetString() ?? "0" : "0";
                    var sizeBytes = torrent.TryGetProperty("size_bytes", out var sb) ? sb.GetInt64() : ParseSizeString(sizeStr);
                    var seeds = torrent.TryGetProperty("seeds", out var sd) ? sd.GetInt32() : 0;
                    var peers = torrent.TryGetProperty("peers", out var pr) ? pr.GetInt32() : 0;
                    var hash = torrent.TryGetProperty("hash", out var h) ? h.GetString() ?? "" : "";
                    var torrentUrl = torrent.TryGetProperty("url", out var tu) ? tu.GetString() : null;

                    var magnetUrl = !string.IsNullOrEmpty(hash)
                        ? $"magnet:?xt=urn:btih:{hash}&dn={Uri.EscapeDataString(movieTitle)}&tr=udp://open.demonii.si:1337/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.opentrackr.org:1337/announce"
                        : null;

                    results.Add(new Dictionary<string, object?>
                    {
                        ["title"] = $"{movieTitle} [{quality}] [{type}]",
                        ["download_url"] = torrentUrl,
                        ["magnet_url"] = magnetUrl,
                        ["info_url"] = movieUrl,
                        ["indexer"] = indexerName,
                        ["seeders"] = seeds,
                        ["leechers"] = peers,
                        ["size"] = sizeBytes,
                        ["size_formatted"] = sizeStr,
                        ["quality"] = quality,
                        ["codec"] = type,
                        ["source"] = $"YTS ({year})",
                        ["date"] = "",
                    });
                }
            }
        }
        return results;
    }

    // ── EZTV JSON API Search ──
    private static async Task<List<Dictionary<string, object?>>> SearchEZTV(HttpClient http, string baseUrl, string query, string indexerName)
    {
        var results = new List<Dictionary<string, object?>>();
        // EZTV doesn't support text search well, but we can try
        var apiUrl = $"{baseUrl.TrimEnd('/')}/api/get-torrents?limit=100&page=1";
        var json = await http.GetStringAsync(apiUrl);
        using var doc = JsonDocument.Parse(json);

        if (!doc.RootElement.TryGetProperty("torrents", out var torrents)) return results;

        var queryLower = query.ToLower();
        foreach (var torrent in torrents.EnumerateArray())
        {
            var title = torrent.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            if (!title.ToLower().Contains(queryLower)) continue;

            var magnetUrl = torrent.TryGetProperty("magnet_url", out var m) ? m.GetString() : null;
            var torrentUrl = torrent.TryGetProperty("torrent_url", out var tu) ? tu.GetString() : null;
            var seeds = torrent.TryGetProperty("seeds", out var s) ? s.GetInt32() : 0;
            var peers = torrent.TryGetProperty("peers", out var p) ? p.GetInt32() : 0;
            var sizeBytes = torrent.TryGetProperty("size_bytes", out var sb) ? sb.GetInt64() : 0L;

            results.Add(new Dictionary<string, object?>
            {
                ["title"] = title,
                ["download_url"] = torrentUrl,
                ["magnet_url"] = magnetUrl,
                ["info_url"] = null,
                ["indexer"] = indexerName,
                ["seeders"] = seeds,
                ["leechers"] = peers,
                ["size"] = sizeBytes,
                ["size_formatted"] = FormatBytes(sizeBytes),
                ["quality"] = DetectQuality(title),
                ["codec"] = DetectCodec(title),
                ["source"] = "EZTV",
                ["date"] = "",
            });
        }
        return results;
    }

    // ── Generic Torznab/Newznab API Search ──
    private static async Task<List<Dictionary<string, object?>>> SearchTorznab(HttpClient http, string baseUrl, string apiKey, string searchPath, string query, string indexerName)
    {
        var results = new List<Dictionary<string, object?>>();
        var path = string.IsNullOrEmpty(searchPath) ? "/api" : searchPath;
        var keyParam = !string.IsNullOrEmpty(apiKey) ? $"&apikey={Uri.EscapeDataString(apiKey)}" : "";
        var feedUrl = $"{baseUrl.TrimEnd('/')}{path}?t=search&q={Uri.EscapeDataString(query)}{keyParam}";

        var xml = await http.GetStringAsync(feedUrl);
        var doc = System.Xml.Linq.XDocument.Parse(xml);
        XNamespace torznab = "http://torznab.com/schemas/2015/feed";
        XNamespace newznab = "http://www.newznab.com/DTD/2010/feeds/attributes/";

        foreach (var item in doc.Descendants("item"))
        {
            var title = item.Element("title")?.Value ?? "";
            var link = item.Element("link")?.Value ?? "";
            var size = 0L;
            var seeders = 0;
            var leechers = 0;

            foreach (var attr in item.Elements(torznab + "attr").Concat(item.Elements(newznab + "attr")))
            {
                var attrName = attr.Attribute("name")?.Value;
                var attrValue = attr.Attribute("value")?.Value ?? "";
                if (attrName == "size" && long.TryParse(attrValue, out var sz)) size = sz;
                if (attrName == "seeders" && int.TryParse(attrValue, out var sd)) seeders = sd;
                if (attrName == "peers" && int.TryParse(attrValue, out var pr)) leechers = pr - seeders;
            }

            results.Add(new Dictionary<string, object?>
            {
                ["title"] = title,
                ["download_url"] = link,
                ["magnet_url"] = null,
                ["info_url"] = item.Element("guid")?.Value,
                ["indexer"] = indexerName,
                ["seeders"] = seeders,
                ["leechers"] = leechers,
                ["size"] = size,
                ["size_formatted"] = FormatBytes(size),
                ["quality"] = DetectQuality(title),
                ["codec"] = DetectCodec(title),
                ["source"] = indexerName,
                ["date"] = item.Element("pubDate")?.Value ?? "",
            });
        }
        return results;
    }

    // ── Generic RSS fallback ──
    private static async Task<List<Dictionary<string, object?>>> SearchGenericRSS(HttpClient http, string baseUrl, string query, string indexerName)
    {
        var results = new List<Dictionary<string, object?>>();
        try
        {
            // Try RSS with query param
            var feedUrl = $"{baseUrl.TrimEnd('/')}/?q={Uri.EscapeDataString(query)}";
            var xml = await http.GetStringAsync(feedUrl);
            var doc = System.Xml.Linq.XDocument.Parse(xml);
            var queryLower = query.ToLower();

            foreach (var item in doc.Descendants("item"))
            {
                var title = item.Element("title")?.Value ?? "";
                if (!title.ToLower().Contains(queryLower)) continue;

                results.Add(new Dictionary<string, object?>
                {
                    ["title"] = title,
                    ["download_url"] = item.Element("link")?.Value,
                    ["magnet_url"] = null,
                    ["info_url"] = item.Element("guid")?.Value,
                    ["indexer"] = indexerName,
                    ["seeders"] = 0, ["leechers"] = 0, ["size"] = 0L,
                    ["size_formatted"] = "N/A",
                    ["quality"] = DetectQuality(title),
                    ["codec"] = DetectCodec(title),
                    ["source"] = indexerName,
                    ["date"] = item.Element("pubDate")?.Value ?? "",
                });
            }
        }
        catch { }
        return results;
    }

    // ── Helpers ──
    private static string? DetectQuality(string title)
    {
        var t = title.ToUpper();
        if (t.Contains("2160P") || t.Contains("4K") || t.Contains("UHD")) return "2160p";
        if (t.Contains("1080P") || t.Contains("FHD")) return "1080p";
        if (t.Contains("720P") || t.Contains("HD")) return "720p";
        if (t.Contains("480P") || t.Contains("SD")) return "480p";
        return null;
    }

    private static string? DetectCodec(string title)
    {
        var t = title.ToUpper();
        if (t.Contains("HEVC") || t.Contains("X265") || t.Contains("H.265") || t.Contains("H265")) return "HEVC";
        if (t.Contains("AVC") || t.Contains("X264") || t.Contains("H.264") || t.Contains("H264")) return "x264";
        if (t.Contains("AV1")) return "AV1";
        if (t.Contains("VP9")) return "VP9";
        return null;
    }

    private static long ParseSizeString(string sizeStr)
    {
        if (string.IsNullOrEmpty(sizeStr)) return 0;
        var s = sizeStr.Trim().ToUpper().Replace(",", "");
        try
        {
            if (s.Contains("TIB") || s.Contains("TB")) { var n = double.Parse(System.Text.RegularExpressions.Regex.Match(s, @"[\d.]+").Value); return (long)(n * 1024L * 1024 * 1024 * 1024); }
            if (s.Contains("GIB") || s.Contains("GB")) { var n = double.Parse(System.Text.RegularExpressions.Regex.Match(s, @"[\d.]+").Value); return (long)(n * 1024L * 1024 * 1024); }
            if (s.Contains("MIB") || s.Contains("MB")) { var n = double.Parse(System.Text.RegularExpressions.Regex.Match(s, @"[\d.]+").Value); return (long)(n * 1024L * 1024); }
            if (s.Contains("KIB") || s.Contains("KB")) { var n = double.Parse(System.Text.RegularExpressions.Regex.Match(s, @"[\d.]+").Value); return (long)(n * 1024); }
            if (long.TryParse(s, out var bytes)) return bytes;
        }
        catch { }
        return 0;
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes <= 0) return "N/A";
        var gb = bytes / (1024.0 * 1024 * 1024);
        if (gb >= 1) return $"{gb:F1} GiB";
        var mb = bytes / (1024.0 * 1024);
        if (mb >= 1) return $"{mb:F1} MiB";
        return $"{bytes / 1024.0:F1} KiB";
    }

    [HttpPost("grab")]
    public async Task<IActionResult> Grab(
        [FromQuery] string? title,
        [FromQuery] string? download_url,
        [FromQuery] string? magnet_url,
        [FromQuery] long size = 0,
        [FromQuery] bool use_builtin = true)
    {
        if (string.IsNullOrEmpty(download_url) && string.IsNullOrEmpty(magnet_url))
            return BadRequest(new { success = false, message = "No download URL or magnet link provided" });

        var userId = this.UserId();

        // Store in downloads queue
        var download = new Dictionary<string, object?>
        {
            ["id"] = Guid.NewGuid().ToString("N")[..12],
            ["title"] = title ?? "Unknown",
            ["download_url"] = download_url,
            ["magnet_url"] = magnet_url,
            ["size"] = size,
            ["status"] = "queued",
            ["added_at"] = DateTime.UtcNow.ToString("o"),
            ["use_builtin"] = use_builtin,
        };
        var json = JsonSerializer.Serialize(download);
        _db.Settings.Add(new WatchNexus.Shared.AppSetting
        {
            Key = $"download:{download["id"]}",
            Value = json,
            UserId = userId
        });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Added \"{title}\" to download queue",
            download_id = download["id"],
            magnet = magnet_url != null,
            torrent = download_url != null,
        });
    }
}

// ── Indexers (delegates to Compote indexer store) ─────────────
[Route("api/indexers")]
[ApiController]
[Authorize]
public class IndexersController : ControllerBase
{
    private readonly AppDbContext _db;
    public IndexersController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = this.UserId();
        var indexers = await _db.Settings.Where(s => s.UserId == userId && s.Key.StartsWith("indexer:")).ToListAsync();
        var result = new List<object>();
        foreach (var i in indexers)
        {
            try
            {
                var doc = JsonSerializer.Deserialize<Dictionary<string, object>>(i.Value ?? "{}");
                if (doc != null)
                {
                    doc["id"] = i.Key.Replace("indexer:", "");
                    result.Add(doc);
                }
            }
            catch { }
        }
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] JsonElement body)
    {
        var id = Guid.NewGuid().ToString();
        var dict = new Dictionary<string, object?> { ["id"] = id };
        foreach (var prop in body.EnumerateObject())
        {
            dict[prop.Name] = prop.Value.ValueKind switch
            {
                JsonValueKind.String => prop.Value.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number => prop.Value.TryGetInt64(out var l) ? (object)l : prop.Value.GetDouble(),
                _ => prop.Value.GetRawText()
            };
        }
        dict["added_at"] = DateTime.UtcNow.ToString("o");
        var json = JsonSerializer.Serialize(dict);
        _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = $"indexer:{id}", Value = json, UserId = this.UserId() });
        await _db.SaveChangesAsync();
        return Ok(dict);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}" && s.UserId == this.UserId());
        if (existing == null) return NotFound(new { error = "Indexer not found" });
        var current = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(existing.Value ?? "{}") ?? new();
        foreach (var prop in body.EnumerateObject())
            current[prop.Name] = prop.Value;
        current["id"] = JsonSerializer.SerializeToElement(id);
        existing.Value = JsonSerializer.Serialize(current);
        await _db.SaveChangesAsync();
        return Ok(new { status = "updated", id });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}" && s.UserId == this.UserId());
        if (existing != null) { _db.Settings.Remove(existing); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }
}

// ── Garnish — Subtitle Provider Status (real: checks configured providers) ──────────────────────────────────
[Route("api/garnish")]
[ApiController]
[Authorize]
public class GarnishController : ControllerBase
{
    private readonly AppDbContext _db;
    public GarnishController(AppDbContext db) => _db = db;

    [HttpGet("settings")]
    public async Task<IActionResult> Settings()
    {
        var uid = this.UserId();
        var providers = new[] { "opensubtitles", "addic7ed", "podnapisi", "yifysubtitles", "subscene" };
        var configured = new List<object>();
        foreach (var p in providers)
        {
            var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == $"subtitle_{p}");
            var hasCfg = cfg?.Value != null;
            configured.Add(new { id = p, name = p, enabled = hasCfg, configured = hasCfg });
        }
        return Ok(new { enabled = configured.Any(c => ((dynamic)c).enabled), providers = configured });
    }

    [HttpPost("test/{provider}")]
    public async Task<IActionResult> Test(string provider)
    {
        var urls = new Dictionary<string, string>
        {
            ["opensubtitles"] = "https://api.opensubtitles.com",
            ["addic7ed"] = "https://www.addic7ed.com",
            ["podnapisi"] = "https://www.podnapisi.net",
            ["yifysubtitles"] = "https://yifysubtitles.org",
            ["subscene"] = "https://subscene.com",
        };
        if (!urls.ContainsKey(provider)) return BadRequest(new { success = false, error = "Unknown provider" });
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/2.9.0");
            var resp = await http.GetAsync(urls[provider]);
            return Ok(new { success = resp.IsSuccessStatusCode, provider, status_code = (int)resp.StatusCode });
        }
        catch (Exception ex) { return Ok(new { success = false, provider, error = ex.Message }); }
    }
}

// ── Torrent — Built-in Download Engine Status (real: queries download DB) ──────────────────────────────────
[Route("api/torrent")]
[ApiController]
[Authorize]
public class TorrentController : ControllerBase
{
    private readonly AppDbContext _db;
    public TorrentController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var active = await _db.Downloads.CountAsync(d => d.Status == "downloading" || d.Status == "queued");
        var completed = await _db.Downloads.CountAsync(d => d.Status == "completed");
        var total = await _db.Downloads.CountAsync();
        return Ok(new { engine = "built-in", connected = true, active_downloads = active, completed, total });
    }
}

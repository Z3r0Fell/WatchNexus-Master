using System.Text.Json;
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
    public IActionResult DefaultIndexers() => Ok(new[]
    {
        new { name = "1337x", type = "torznab", url = "https://1337x.to", cloudflare_protected = true },
        new { name = "YTS Movies", type = "torznab", url = "https://yts.mx", cloudflare_protected = false },
        new { name = "EZTV", type = "torznab", url = "https://eztv.re", cloudflare_protected = false },
        new { name = "Nyaa", type = "torznab", url = "https://nyaa.si", cloudflare_protected = false },
        new { name = "ShowRSS", type = "rss", url = "https://showrss.info/other/all.rss", cloudflare_protected = false },
    });

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
            http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus/2.8.3");
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
    public IActionResult Search([FromQuery] string? query, [FromQuery] string? media_type, [FromQuery] string? sort_by, [FromQuery] int limit = 50)
    {
        // Placeholder - real search would query indexer APIs
        return Ok(Array.Empty<object>());
    }

    [HttpPost("grab")]
    public IActionResult Grab([FromQuery] string? indexer_id, [FromQuery] string? download_url, [FromQuery] string? title)
    {
        return Ok(new { status = "grabbed", title, indexer_id });
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

// ── Garnish ──────────────────────────────────
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

// ── Torrent ──────────────────────────────────
[Route("api/torrent")]
[ApiController]
[Authorize]
public class TorrentController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new { engine = "built-in", connected = true, active_downloads = 0 });
}

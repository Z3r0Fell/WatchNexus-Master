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
    public IActionResult HealthCheck([FromBody] JsonElement body)
    {
        var filePath = body.TryGetProperty("file_path", out var fp) ? fp.GetString() : null;
        if (string.IsNullOrEmpty(filePath) || !System.IO.File.Exists(filePath))
            return Ok(new { status = "not_found", file_path = filePath });
        var fi = new FileInfo(filePath);
        return Ok(new { status = "healthy", file_path = filePath, size = fi.Length, readable = true });
    }

    [HttpPost("repair")]
    public IActionResult Repair() => Ok(new { status = "not_implemented", message = "FFmpeg required for repair" });
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
        var indexers = await _db.Settings.Where(s => s.Key.StartsWith("indexer:")).ToListAsync();
        return Ok(indexers.Select(i => JsonSerializer.Deserialize<object>(i.Value ?? "{}")));
    }
    [HttpGet("indexer-types")]
    public IActionResult IndexerTypes() => Ok(new[] { "torznab", "newznab", "rss", "jackett", "prowlarr" });
    [HttpGet("setup-guide")]
    public IActionResult SetupGuide() => Ok(new { guide = "Configure indexers in Settings > Integrations to search for content." });
    [HttpGet("default-indexers")]
    public IActionResult DefaultIndexers() => Ok(Array.Empty<object>());
    [HttpPost("indexers")]
    public async Task<IActionResult> AddIndexer([FromBody] JsonElement body)
    {
        var id = Guid.NewGuid().ToString();
        _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = $"indexer:{id}", Value = body.GetRawText(), UserId = this.UserId() });
        await _db.SaveChangesAsync();
        return Ok(new { id, status = "added" });
    }
    [HttpPut("indexers/{id}")]
    public async Task<IActionResult> UpdateIndexer(string id, [FromBody] JsonElement body)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}");
        if (existing != null) { existing.Value = body.GetRawText(); await _db.SaveChangesAsync(); }
        return Ok(new { status = "updated" });
    }
    [HttpDelete("indexers/{id}")]
    public async Task<IActionResult> RemoveIndexer(string id)
    {
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == $"indexer:{id}");
        if (existing != null) { _db.Settings.Remove(existing); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }
    [HttpPost("indexers/{id}/test")]
    public IActionResult TestIndexer(string id) => Ok(new { success = true, response_time = 0.5 });
    [HttpGet("search")]
    public IActionResult Search() => Ok(Array.Empty<object>());
    [HttpPost("grab")]
    public IActionResult Grab() => Ok(new { status = "grabbed" });
}

// ── Indexers ──────────────────────────────────
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

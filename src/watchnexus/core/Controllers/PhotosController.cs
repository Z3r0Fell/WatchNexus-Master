using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

[Route("api/gadgets/photos")]
[ApiController]
[Authorize]
public class PhotosController : ControllerBase
{
    private readonly AppDbContext _db;
    private static readonly HashSet<string> ImageExts = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif", ".heic", ".heif", ".avif", ".svg" };

    public PhotosController(AppDbContext db) => _db = db;

    [HttpGet("libraries")]
    public async Task<IActionResult> Libraries()
    {
        var libs = await _db.PhotoLibraries
            .Where(l => l.UserId == this.UserId())
            .OrderByDescending(l => l.CreatedAt).ToListAsync();
        return Ok(libs.Select(l => new
        {
            l.Id, l.Name, l.Path, photo_count = l.PhotoCount,
            last_scanned = l.LastScanned, created_at = l.CreatedAt
        }));
    }

    [HttpPost("libraries")]
    public async Task<IActionResult> AddLibrary([FromBody] JsonElement body)
    {
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
        var path = body.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
        if (!Directory.Exists(path)) return BadRequest(new { detail = $"Path does not exist: {path}" });
        var lib = new PhotoLibrary { UserId = this.UserId(), Name = name, Path = path };
        _db.PhotoLibraries.Add(lib);
        await _db.SaveChangesAsync();
        return Ok(new { lib.Id, lib.Name, lib.Path, status = "added" });
    }

    [HttpDelete("libraries/{id}")]
    public async Task<IActionResult> RemoveLibrary(string id)
    {
        var lib = await _db.PhotoLibraries.FindAsync(id);
        if (lib != null && lib.UserId == this.UserId())
        {
            _db.PhotoLibraries.Remove(lib);
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }

    [HttpGet("libraries/{id}")]
    public async Task<IActionResult> GetLibrary(string id, [FromQuery] int limit = 100, [FromQuery] int offset = 0)
    {
        var lib = await _db.PhotoLibraries.FindAsync(id);
        if (lib == null || lib.UserId != this.UserId()) return NotFound();
        var photos = new List<object>();
        try
        {
            var files = Directory.GetFiles(lib.Path, "*.*", SearchOption.AllDirectories)
                .Where(f => ImageExts.Contains(Path.GetExtension(f)))
                .OrderByDescending(f => new FileInfo(f).LastWriteTimeUtc)
                .Skip(offset).Take(limit);
            foreach (var f in files)
            {
                var fi = new FileInfo(f);
                photos.Add(new { path = f, name = fi.Name, size = fi.Length, modified = fi.LastWriteTimeUtc });
            }
        }
        catch (Exception ex)
        {
            return Ok(new { lib.Id, lib.Name, lib.Path, photos = Array.Empty<object>(), error = ex.Message });
        }
        return Ok(new { lib.Id, lib.Name, lib.Path, photos, total = photos.Count });
    }

    [HttpPost("scan/{id}")]
    public async Task<IActionResult> ScanLibrary(string id)
    {
        var lib = await _db.PhotoLibraries.FindAsync(id);
        if (lib == null || lib.UserId != this.UserId()) return NotFound();
        try
        {
            var count = Directory.GetFiles(lib.Path, "*.*", SearchOption.AllDirectories)
                .Count(f => ImageExts.Contains(Path.GetExtension(f)));
            lib.PhotoCount = count;
            lib.LastScanned = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { lib.Id, photo_count = count, status = "scanned" });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("file/{*filePath}")]
    public IActionResult ServePhoto(string filePath)
    {
        var fullPath = "/" + filePath;
        if (!System.IO.File.Exists(fullPath)) return NotFound();
        var ext = Path.GetExtension(fullPath).ToLower();
        var mime = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png",
            ".gif" => "image/gif", ".webp" => "image/webp",
            ".bmp" => "image/bmp", ".svg" => "image/svg+xml",
            _ => "application/octet-stream"
        };
        return PhysicalFile(fullPath, mime);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Fondue;

// ── Models ───────────────────────────────────────────────────
public class DownloadItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string Status { get; set; } = "queued";
    public double Progress { get; set; }
    public long Size { get; set; }
    public long Downloaded { get; set; }
    public string? SavePath { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// ── DbContext ────────────────────────────────────────────────
public class FondueDbContext : DbContext
{
    public FondueDbContext(DbContextOptions<FondueDbContext> options) : base(options) { }
    public DbSet<DownloadItem> Downloads => Set<DownloadItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<DownloadItem>().HasKey(d => d.Id);
    }
}

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api/downloads")]
[Authorize]
public class DownloadsController : ControllerBase
{
    private readonly FondueDbContext _db;
    public DownloadsController(FondueDbContext db) { _db = db; }

    public record DownloadRequest(string Name, string Url, string? SavePath = null);

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _db.Downloads.OrderByDescending(d => d.CreatedAt).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] DownloadRequest req)
    {
        var item = new DownloadItem { Name = req.Name, Url = req.Url, SavePath = req.SavePath };
        _db.Downloads.Add(item);
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remove(string id)
    {
        var item = await _db.Downloads.FindAsync(id);
        if (item == null) return NotFound();
        _db.Downloads.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("{id}/pause")]
    public async Task<IActionResult> Pause(string id)
    {
        var item = await _db.Downloads.FindAsync(id);
        if (item == null) return NotFound();
        item.Status = "paused";
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPost("{id}/resume")]
    public async Task<IActionResult> Resume(string id)
    {
        var item = await _db.Downloads.FindAsync(id);
        if (item == null) return NotFound();
        item.Status = "downloading";
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats() => Ok(new
    {
        total = await _db.Downloads.CountAsync(),
        active = await _db.Downloads.CountAsync(d => d.Status == "downloading"),
        completed = await _db.Downloads.CountAsync(d => d.Status == "completed"),
        queued = await _db.Downloads.CountAsync(d => d.Status == "queued"),
    });
}

// ── Module Registration ──────────────────────────────────────
public class FondueModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Fondue", Codename = "fondue",
        DisplayName = "Download Manager", Version = "2.6.5",
        Description = "Built-in download engine and qBittorrent integration",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Zest;

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api")]
[Authorize]
public class LogController : ControllerBase
{
    [HttpGet("zest/logs")]
    public IActionResult GetLogs(int limit = 100, int offset = 0)
    {
        var logDir = Path.Combine(AppContext.BaseDirectory, "logs");
        if (!Directory.Exists(logDir))
            return Ok(new { logs = Array.Empty<object>(), total = 0 });

        var files = Directory.GetFiles(logDir, "*.log")
            .OrderByDescending(f => System.IO.File.GetLastWriteTimeUtc(f))
            .Skip(offset).Take(limit)
            .Select(f => new
            {
                name = Path.GetFileName(f),
                size = new FileInfo(f).Length,
                modified = System.IO.File.GetLastWriteTimeUtc(f),
            }).ToList();

        return Ok(new { logs = files, total = files.Count });
    }

    [HttpGet("zest/logs/{filename}")]
    public IActionResult GetLogContent(string filename, int tail = 200)
    {
        var logPath = Path.Combine(AppContext.BaseDirectory, "logs", filename);
        if (!System.IO.File.Exists(logPath))
            return NotFound(new { detail = "Log file not found" });

        var lines = System.IO.File.ReadLines(logPath).TakeLast(tail).ToList();
        return Ok(new { filename, lines, total = lines.Count });
    }

    [HttpGet("logs")]
    public IActionResult LatestLogs() => Ok(new { entries = Array.Empty<object>(), total = 0 });

    [HttpGet("logs/latest")]
    public IActionResult Latest() => Ok(new { entries = Array.Empty<object>(), total = 0 });

    [HttpGet("logs/system")]
    public IActionResult SystemLogs() => Ok(new
    {
        cpu_percent = 0.0,
        memory_percent = 0.0,
        disk_usage = new { total = 0, used = 0, free = 0, percent = 0.0 },
        uptime = (DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalSeconds,
    });
}

// ── Module Registration ──────────────────────────────────────
public class ZestModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Zest", Codename = "zest",
        DisplayName = "Log Viewer", Version = "2.7.3",
        Description = "Application log browser, system diagnostics, and health monitoring",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

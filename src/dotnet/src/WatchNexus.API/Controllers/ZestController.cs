using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WatchNexus.API.Controllers;

/// <summary>
/// Zest — Log Viewer & Diagnostics
/// </summary>
[ApiController]
[Route("api/logs")]
[Authorize]
public class ZestController : ControllerBase
{
    private readonly ILogger<ZestController> _logger;
    private static readonly string LogDir = Path.Combine(AppContext.BaseDirectory, "logs");

    public ZestController(ILogger<ZestController> logger) => _logger = logger;

    [HttpGet]
    public IActionResult GetLogFiles()
    {
        if (!Directory.Exists(LogDir))
            return Ok(Array.Empty<object>());

        var files = Directory.GetFiles(LogDir, "*.log")
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .Select(f => new
            {
                name = f.Name,
                size = f.Length,
                modified = f.LastWriteTimeUtc,
            });

        return Ok(files);
    }

    [HttpGet("latest")]
    public IActionResult GetLatestLogs(
        [FromQuery] int lines = 100,
        [FromQuery] string? level = null)
    {
        if (!Directory.Exists(LogDir))
            return Ok(new { lines = Array.Empty<object>(), total = 0 });

        var latestFile = Directory.GetFiles(LogDir, "*.log")
            .OrderByDescending(f => new FileInfo(f).LastWriteTimeUtc)
            .FirstOrDefault();

        if (latestFile == null)
            return Ok(new { lines = Array.Empty<object>(), total = 0 });

        var allLines = System.IO.File.ReadAllLines(latestFile);
        IEnumerable<string> filtered = allLines;

        if (!string.IsNullOrEmpty(level))
            filtered = filtered.Where(l => l.Contains($"[{level.ToUpper().Substring(0, Math.Min(3, level.Length))}]", StringComparison.OrdinalIgnoreCase) ||
                                           l.Contains($" {level} ", StringComparison.OrdinalIgnoreCase));

        var result = filtered.TakeLast(lines).Select((line, i) => ParseLogLine(line, allLines.Length - lines + i));

        return Ok(new { lines = result, total = allLines.Length, file = Path.GetFileName(latestFile) });
    }

    [HttpGet("file/{filename}")]
    public IActionResult GetLogFile(string filename, [FromQuery] int offset = 0, [FromQuery] int limit = 200)
    {
        var filePath = Path.Combine(LogDir, filename);
        if (!System.IO.File.Exists(filePath))
            return NotFound(new { message = "Log file not found" });

        var allLines = System.IO.File.ReadAllLines(filePath);
        var page = allLines.Skip(offset).Take(limit)
            .Select((line, i) => ParseLogLine(line, offset + i));

        return Ok(new { lines = page, total = allLines.Length, offset, limit });
    }

    [HttpGet("system")]
    public IActionResult GetSystemDiagnostics()
    {
        var process = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            uptime_seconds = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds,
            memory_mb = process.WorkingSet64 / (1024.0 * 1024.0),
            threads = process.Threads.Count,
            cpu_time_seconds = process.TotalProcessorTime.TotalSeconds,
            gc_gen0 = GC.CollectionCount(0),
            gc_gen1 = GC.CollectionCount(1),
            gc_gen2 = GC.CollectionCount(2),
            gc_memory_mb = GC.GetTotalMemory(false) / (1024.0 * 1024.0),
            environment = new
            {
                dotnet_version = Environment.Version.ToString(),
                os = Environment.OSVersion.ToString(),
                processor_count = Environment.ProcessorCount,
                machine_name = Environment.MachineName,
            }
        });
    }

    [HttpDelete("file/{filename}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public IActionResult DeleteLogFile(string filename)
    {
        var filePath = Path.Combine(LogDir, filename);
        if (!System.IO.File.Exists(filePath))
            return NotFound();

        System.IO.File.Delete(filePath);
        return NoContent();
    }

    private static object ParseLogLine(string line, int lineNumber)
    {
        var level = "INFO";
        if (line.Contains("[INF]") || line.Contains(" INF ")) level = "INFO";
        else if (line.Contains("[WRN]") || line.Contains(" WRN ")) level = "WARNING";
        else if (line.Contains("[ERR]") || line.Contains(" ERR ")) level = "ERROR";
        else if (line.Contains("[FTL]") || line.Contains(" FTL ")) level = "FATAL";
        else if (line.Contains("[DBG]") || line.Contains(" DBG ")) level = "DEBUG";

        return new { line_number = lineNumber, text = line, level };
    }
}

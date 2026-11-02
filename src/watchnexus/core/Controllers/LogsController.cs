using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WatchNexus.Core.Services;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Zest log viewer API (consumed by LogViewerPage) + frontend crash reports.
/// All file access is restricted to plain file names that exist in the log dir.
/// </summary>
[ApiController]
[Route("api/logs")]
[Authorize]
public class LogsController : ControllerBase
{
    public const int MaxClientFieldChars = 8 * 1024;
    private const int MaxLines = 5000;

    private readonly FileLogSink _sink;
    private readonly ILogger _frontendLogger;

    public LogsController(FileLogSink sink, ILoggerFactory loggerFactory)
    {
        _sink = sink;
        _frontendLogger = loggerFactory.CreateLogger("Frontend");
    }

    private string LogDir => _sink.Directory;

    private IEnumerable<FileInfo> LogFiles() =>
        Directory.Exists(LogDir)
            ? new DirectoryInfo(LogDir).EnumerateFiles("*.log*")
            : Enumerable.Empty<FileInfo>();

    /// <summary>
    /// Resolve a user-supplied file name to a file in the log dir, or null.
    /// Rejects anything that is not a bare file name, then requires an exact
    /// (ordinal) match against the directory listing.
    /// </summary>
    private FileInfo? ResolveFile(string? filename)
    {
        if (IsUnsafeName(filename)) return null;
        return LogFiles().FirstOrDefault(f => string.Equals(f.Name, filename, StringComparison.Ordinal));
    }

    private static bool IsUnsafeName(string? filename) =>
        string.IsNullOrWhiteSpace(filename) || filename.Contains("..") || filename.Contains('/')
        || filename.Contains('\\') || filename.Contains(':')
        || filename.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0;

    private FileInfo? ActiveFile()
    {
        var current = _sink.CurrentFilePath;
        if (current != null && System.IO.File.Exists(current)) return new FileInfo(current);
        return LogFiles().OrderByDescending(f => f.LastWriteTimeUtc).FirstOrDefault();
    }

    private List<object> FileListing() => LogFiles()
        .OrderByDescending(f => f.LastWriteTimeUtc)
        .Select(f => (object)new
        {
            name = f.Name,
            filename = f.Name,
            size = f.Length,
            size_kb = Math.Round(f.Length / 1024.0, 1),
            modified = f.LastWriteTimeUtc,
        })
        .ToList();

    // GET /api/logs → [{ name, size, modified }]  (LogViewerPage)
    [HttpGet]
    public IActionResult GetFiles() => Ok(FileListing());

    // GET /api/logs/list → { logs: [{ filename, size_kb, ... }] }  (MaintenanceSettings)
    [HttpGet("list")]
    public IActionResult ListFiles() => Ok(new { logs = FileListing() });

    // GET /api/logs/view?filename=&lines=N → { lines: [string], file, total }  (MaintenanceSettings)
    // An unknown/legacy filename (the UI defaults to "watchnexus.log") falls back
    // to the active log file instead of showing nothing.
    [HttpGet("view")]
    public IActionResult View([FromQuery] string? filename = null, [FromQuery] int lines = 100)
    {
        var take = Math.Clamp(lines, 1, MaxLines);
        FileInfo? file = null;
        if (!string.IsNullOrWhiteSpace(filename))
        {
            if (IsUnsafeName(filename)) return BadRequest(new { detail = "Invalid file name" });
            file = ResolveFile(filename);
        }
        file ??= ActiveFile();
        if (file == null) return Ok(new { lines = Array.Empty<string>(), file = "", total = 0 });

        var ring = new Queue<string>(take);
        var total = 0;
        foreach (var (num, text, _) in ReadParsed(file.FullName))
        {
            total = num;
            if (ring.Count == take) ring.Dequeue();
            ring.Enqueue(text);
        }
        return Ok(new { lines = ring.ToArray(), file = file.Name, total });
    }

    // GET /api/logs/download/{filename} — raw file download.
    [HttpGet("download/{filename}")]
    public IActionResult Download(string filename)
    {
        if (IsUnsafeName(filename)) return BadRequest(new { detail = "Invalid file name" });
        var file = ResolveFile(filename) ?? (filename == "watchnexus.log" ? ActiveFile() : null);
        if (file == null) return NotFound(new { detail = "Log file not found" });
        var stream = new FileStream(file.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        return File(stream, "text/plain", file.Name);
    }

    // POST /api/logs/clear — delete every log file except the one being written.
    [HttpPost("clear")]
    [Authorize(Roles = "admin")]
    public IActionResult ClearOld()
    {
        var active = _sink.CurrentFilePath;
        var deleted = 0;
        foreach (var f in LogFiles().ToList())
        {
            if (string.Equals(f.FullName, active, StringComparison.Ordinal)) continue;
            try { _sink.Delete(f.FullName); deleted++; } catch { /* in use / permissions */ }
        }
        return Ok(new { status = "cleared", deleted });
    }

    // GET /api/logs/latest?lines=N&level=LEVEL → { lines:[{line_number,text,level}], total, matched, file }
    [HttpGet("latest")]
    public IActionResult GetLatest([FromQuery] int lines = 100, [FromQuery] string? level = null)
    {
        var take = Math.Clamp(lines, 1, MaxLines);
        var filter = FileLogSink.NormalizeLevelFilter(level);

        var file = ActiveFile();

        if (file == null)
            return Ok(new { lines = Array.Empty<object>(), total = 0, matched = 0, file = "", level = filter ?? "ALL" });

        var ring = new Queue<object>(take);
        int total = 0, matched = 0;
        foreach (var (num, text, lvl) in ReadParsed(file.FullName))
        {
            total = num;
            if (filter != null && lvl != filter) continue;
            matched++;
            if (ring.Count == take) ring.Dequeue();
            ring.Enqueue(new { line_number = num, text, level = lvl });
        }

        return Ok(new { lines = ring.ToArray(), total, matched, file = file.Name, level = filter ?? "ALL" });
    }

    // GET /api/logs/file/{filename}?offset&limit → { file, lines, total, offset, limit }
    [HttpGet("file/{filename}")]
    public IActionResult GetFile(string filename, [FromQuery] int offset = 0, [FromQuery] int limit = 500, [FromQuery] string? level = null)
    {
        if (IsUnsafeName(filename)) return BadRequest(new { detail = "Invalid file name" });
        var file = ResolveFile(filename);
        if (file == null) return NotFound(new { detail = "Log file not found" });

        offset = Math.Max(0, offset);
        limit = Math.Clamp(limit, 1, MaxLines);
        var filter = FileLogSink.NormalizeLevelFilter(level);

        var result = new List<object>(Math.Min(limit, 1024));
        int total = 0, matchedIndex = 0;
        foreach (var (num, text, lvl) in ReadParsed(file.FullName))
        {
            total = num;
            if (filter != null && lvl != filter) continue;
            if (matchedIndex++ < offset) continue;
            if (result.Count < limit) result.Add(new { line_number = num, text, level = lvl });
        }

        return Ok(new { file = file.Name, lines = result, total, offset, limit });
    }

    // DELETE /api/logs/file/{filename}
    [HttpDelete("file/{filename}")]
    [Authorize(Roles = "admin")]
    public IActionResult DeleteFile(string filename)
    {
        if (IsUnsafeName(filename)) return BadRequest(new { detail = "Invalid file name" });
        var file = ResolveFile(filename);
        if (file == null) return NotFound(new { detail = "Log file not found" });
        _sink.Delete(file.FullName);
        return Ok(new { status = "deleted", file = file.Name });
    }

    // GET /api/logs/system → { uptime_seconds, memory_mb, cpu_time_seconds, threads, ... }
    [HttpGet("system")]
    public IActionResult SystemHealth()
    {
        using var process = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            uptime_seconds = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds,
            memory_mb = process.WorkingSet64 / 1024.0 / 1024.0,
            cpu_time_seconds = process.TotalProcessorTime.TotalSeconds,
            threads = process.Threads.Count,
            gc_heap_mb = GC.GetTotalMemory(false) / 1024.0 / 1024.0,
            processor_count = Environment.ProcessorCount,
            log_dir = LogDir,
        });
    }

    // POST /api/logs/client — frontend crash/error reports.
    // Body: { level, message, stack, componentStack, correlationId, url, userAgent }.
    // Tolerant: malformed/oversized fields are truncated, never rejected.
    [HttpPost("client")]
    [EnableRateLimiting("client-log")]
    [RequestSizeLimit(128 * 1024)]
    public async Task<IActionResult> ClientReport()
    {
        JsonElement root = default;
        var parsed = false;
        try
        {
            using var doc = await JsonDocument.ParseAsync(Request.Body, cancellationToken: HttpContext.RequestAborted);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                root = doc.RootElement.Clone();
                parsed = true;
            }
        }
        catch (JsonException) { /* tolerate garbage — still record that a report arrived */ }

        string Field(string name, bool singleLine)
        {
            if (!parsed) return "";
            JsonElement v = default;
            var found = false;
            foreach (var p in root.EnumerateObject())
                if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) { v = p.Value; found = true; break; }
            if (!found) return "";
            var s = v.ValueKind switch
            {
                JsonValueKind.String => v.GetString() ?? "",
                JsonValueKind.Null or JsonValueKind.Undefined => "",
                _ => v.GetRawText(),
            };
            return Sanitize(s, singleLine);
        }

        var levelRaw = Field("level", true).Trim().ToLowerInvariant();
        var level = levelRaw is "warn" or "warning" ? LogLevel.Warning : LogLevel.Error;
        var message = Field("message", false);
        if (message.Length == 0) message = parsed ? "(no message)" : "(unparseable client report)";
        var stack = Field("stack", false);
        var componentStack = Field("componentStack", false);
        var correlationId = Field("correlationId", true);
        var url = Field("url", true);
        var userAgent = Field("userAgent", true);
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";

        _frontendLogger.Log(level,
            "Client {ClientLevel} [{CorrelationId}] {ClientMessage} | url={ClientUrl} | user={UserId} | ua={UserAgent}{StackSection}{ComponentStackSection}",
            level == LogLevel.Warning ? "warning" : "error",
            correlationId.Length > 0 ? correlationId : "-",
            message,
            url,
            userId,
            userAgent,
            stack.Length > 0 ? "\nStack: " + stack : "",
            componentStack.Length > 0 ? "\nComponent stack: " + componentStack : "");

        return Accepted(new { status = "logged" });
    }

    internal static string Sanitize(string s, bool singleLine)
    {
        if (s.Length > MaxClientFieldChars) s = s[..MaxClientFieldChars] + "…[truncated]";
        if (singleLine) s = s.Replace('\r', ' ').Replace('\n', ' ');
        // Strip other control chars (keep newline/tab for multi-line fields).
        if (s.Any(c => char.IsControl(c) && c != '\n' && c != '\t'))
            s = new string(s.Where(c => !char.IsControl(c) || c == '\n' || c == '\t').ToArray());
        return s;
    }

    /// <summary>Stream a log file as (1-based line number, text, parsed level).</summary>
    private static IEnumerable<(int num, string text, string level)> ReadParsed(string path)
    {
        using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(fs);
        string? line;
        string? prev = null;
        var n = 0;
        while ((line = reader.ReadLine()) != null)
        {
            n++;
            prev = FileLogSink.ParseLevel(line, prev);
            yield return (n, line, prev);
        }
    }
}

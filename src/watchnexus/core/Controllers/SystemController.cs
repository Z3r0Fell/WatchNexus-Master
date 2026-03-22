using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Nutmeg (System Stats) ───────────────────────────────────
[Route("api/system")]
[ApiController]
[Authorize]
public class SystemController : ControllerBase
{
    private readonly AppDbContext _db;
    public SystemController(AppDbContext db) => _db = db;

    [HttpGet("info")]
    public IActionResult Info()
    {
        var proc = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            version = "2.8.2",
            hostname = Environment.MachineName,
            platform = Environment.OSVersion.VersionString,
            architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
            dotnet_version = Environment.Version.ToString(),
            cpu_count = Environment.ProcessorCount,
            os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            memory_mb = proc.WorkingSet64 / 1024.0 / 1024.0,
            uptime_seconds = (DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds,
        });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var proc = System.Diagnostics.Process.GetCurrentProcess();
        return Ok(new
        {
            memory_mb = proc.WorkingSet64 / 1024.0 / 1024.0,
            cpu_time_seconds = proc.TotalProcessorTime.TotalSeconds,
            threads = proc.Threads.Count,
            uptime_seconds = (DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds,
            libraries = await _db.Libraries.CountAsync(),
            media_items = await _db.MediaItems.CountAsync(),
            users = await _db.Users.CountAsync(),
            playlists = await _db.Playlists.CountAsync(),
            downloads = await _db.Downloads.CountAsync(),
        });
    }

    [HttpGet("chromaprint-status")]
    public IActionResult ChromaprintStatus()
    {
        var installed = false;
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo("fpcalc", "--version")
            { RedirectStandardOutput = true, UseShellExecute = false };
            var p = System.Diagnostics.Process.Start(psi);
            if (p != null) { p.WaitForExit(2000); installed = p.ExitCode == 0; }
        }
        catch { }
        return Ok(new { installed, version = installed ? "detected" : (string?)null });
    }
}

[Route("api/cache")]
[ApiController]
[Authorize]
public class CacheControllerReal : ControllerBase
{
    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var cacheDir = Path.Combine(AppContext.BaseDirectory, "cache");
        long size = 0; int count = 0;
        if (Directory.Exists(cacheDir))
        {
            var files = Directory.GetFiles(cacheDir, "*", SearchOption.AllDirectories);
            count = files.Length;
            size = files.Sum(f => new FileInfo(f).Length);
        }
        return Ok(new { entries = count, size_bytes = size });
    }

    [HttpPost("clear")]
    public IActionResult Clear()
    {
        var cacheDir = Path.Combine(AppContext.BaseDirectory, "cache");
        if (Directory.Exists(cacheDir))
        {
            foreach (var f in Directory.GetFiles(cacheDir, "*", SearchOption.AllDirectories))
                System.IO.File.Delete(f);
        }
        return Ok(new { status = "cleared" });
    }
}

[Route("api/db")]
[ApiController]
[Authorize]
public class DbControllerReal : ControllerBase
{
    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var dbPath = Path.Combine(AppContext.BaseDirectory, "data", "watchnexus.db");
        long size = 0;
        if (System.IO.File.Exists(dbPath)) size = new FileInfo(dbPath).Length;
        return Ok(new { size_bytes = size, path = dbPath, tables = 20 });
    }

    [HttpGet("backups")]
    public IActionResult Backups()
    {
        var backupDir = Path.Combine(AppContext.BaseDirectory, "data", "backups");
        if (!Directory.Exists(backupDir)) return Ok(Array.Empty<object>());
        var files = Directory.GetFiles(backupDir, "*.db")
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.CreationTime.ToUniversalTime())
            .Select(f => new { name = f.Name, size = f.Length, created = f.CreationTime.ToUniversalTime() });
        return Ok(files);
    }

    [HttpPost("backup")]
    public IActionResult CreateBackup()
    {
        var dbPath = Path.Combine(AppContext.BaseDirectory, "data", "watchnexus.db");
        var backupDir = Path.Combine(AppContext.BaseDirectory, "data", "backups");
        Directory.CreateDirectory(backupDir);
        var backupPath = Path.Combine(backupDir, $"watchnexus_{DateTime.UtcNow:yyyyMMdd_HHmmss}.db");
        if (System.IO.File.Exists(dbPath)) System.IO.File.Copy(dbPath, backupPath);
        return Ok(new { status = "created", path = backupPath });
    }
}

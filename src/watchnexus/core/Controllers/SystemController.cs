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
        var modules = new[]
        {
            new { name = "Marmalade", codename = "marmalade", version = "1.0.1", status = "active" },
            new { name = "Bastion", codename = "bastion", version = "1.0.1", status = "active" },
            new { name = "Tunnel", codename = "tunnel", version = "1.0.1", status = "active" },
            new { name = "Zest", codename = "zest", version = "1.0.1", status = "active" },
            new { name = "Fondue", codename = "fondue", version = "1.0.1", status = "active" },
            new { name = "Sorbet", codename = "sorbet", version = "1.0.1", status = "active" },
            new { name = "Brioche", codename = "brioche", version = "1.0.1", status = "active" },
            new { name = "Nectar", codename = "nectar", version = "1.0.1", status = "active" },
            new { name = "Ganache", codename = "ganache", version = "1.0.1", status = "active" },
            new { name = "Bisque", codename = "bisque", version = "1.0.1", status = "active" },
            new { name = "Marzipan", codename = "marzipan", version = "1.0.1", status = "active" },
            new { name = "Cinnamon", codename = "cinnamon", version = "1.0.1", status = "active" },
            new { name = "Waffle", codename = "waffle", version = "1.0.1", status = "active" },
            new { name = "Yeast", codename = "yeast", version = "1.0.1", status = "active" },
            new { name = "Sourdough", codename = "sourdough", version = "1.0.1", status = "active" },
            new { name = "Taffy", codename = "taffy", version = "1.0.1", status = "active" },
            new { name = "Churro", codename = "churro", version = "1.0.1", status = "active" },
            new { name = "Saffron", codename = "saffron", version = "1.0.1", status = "active" },
            new { name = "Pantry", codename = "pantry", version = "1.0.1", status = "active" },
            new { name = "Nutmeg", codename = "nutmeg", version = "1.0.1", status = "active" },
            new { name = "Crumbs", codename = "crumbs", version = "1.0.1", status = "active" },
            new { name = "Fortress", codename = "fortress", version = "1.0.1", status = "active" },
            new { name = "Custard", codename = "custard", version = "1.0.1", status = "active" },
            new { name = "Truffle", codename = "truffle", version = "1.0.1", status = "active" },
            new { name = "Pepper", codename = "pepper", version = "1.0.1", status = "active" },
            new { name = "Meringue", codename = "meringue", version = "1.0.1", status = "active" },
            new { name = "Rind", codename = "rind", version = "1.0.1", status = "active" },
            new { name = "Crucible", codename = "crucible", version = "1.0.1", status = "active" },
            new { name = "Brine", codename = "brine", version = "1.0.1", status = "active" },
            new { name = "Ladle", codename = "ladle", version = "1.0.1", status = "active" },
            new { name = "Ripen", codename = "ripen", version = "1.0.1", status = "active" },
            new { name = "Glaze", codename = "glaze", version = "1.0.1", status = "active" },
            new { name = "Roux", codename = "roux", version = "1.0.1", status = "active" },
            new { name = "Sprout", codename = "sprout", version = "1.0.1", status = "active" },
            new { name = "Setup Wizard", codename = "setup", version = "1.0.1", status = "active" },
        };
        return Ok(new
        {
            version = Services.UpdateBackgroundService.CurrentVersion,
            // Host identity only for admins (non-admins get an empty string).
            hostname = User.IsInRole("admin") ? Environment.MachineName : "",
            platform = Environment.OSVersion.VersionString,
            architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
            dotnet_version = Environment.Version.ToString(),
            cpu_count = Environment.ProcessorCount,
            os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            memory_mb = proc.WorkingSet64 / 1024.0 / 1024.0,
            uptime_seconds = (DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds,
            modules,
            module_count = modules.Length,
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
            using var p = System.Diagnostics.Process.Start(psi);
            if (p != null)
            {
                if (p.WaitForExit(2000)) installed = p.ExitCode == 0;
                else { try { p.Kill(true); } catch { } }
            }
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
        // tmdb_cache_entries: key read by MaintenanceSettings.jsx
        return Ok(new { entries = count, size_bytes = size, tmdb_cache_entries = count });
    }

    [HttpPost("clear")]
    [Authorize(Roles = "admin")]
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
    private readonly AppDbContext _db;
    public DbControllerReal(AppDbContext db) => _db = db;

    // The live database file (honors the configured data dir, e.g.
    // /var/lib/watchnexus in Docker) rather than a guessed BaseDirectory path.
    private string DbPath()
    {
        try
        {
            if (_db.Database.IsRelational())
            {
                var ds = _db.Database.GetDbConnection().DataSource;
                if (!string.IsNullOrEmpty(ds)) return Path.GetFullPath(ds);
            }
        }
        catch { }
        return Path.Combine(AppContext.BaseDirectory, "data", "watchnexus.db");
    }

    private string BackupDir() => Path.Combine(Path.GetDirectoryName(DbPath())!, "backups");

    [HttpGet("stats")]
    public IActionResult Stats()
    {
        var dbPath = DbPath();
        long size = 0;
        if (System.IO.File.Exists(dbPath)) size = new FileInfo(dbPath).Length;
        var backupDir = BackupDir();
        var backups = Directory.Exists(backupDir) ? Directory.GetFiles(backupDir, "*.db").Length : 0;
        return Ok(new
        {
            size_bytes = size, path = dbPath, tables = 20,
            // Keys read by MaintenanceSettings.jsx
            size_mb = Math.Round(size / 1048576.0, 2), backups, engine = "SQLite",
            status = System.IO.File.Exists(dbPath) ? "healthy" : "warning",
        });
    }

    [HttpGet("backups")]
    public IActionResult Backups()
    {
        var backupDir = BackupDir();
        if (!Directory.Exists(backupDir)) return Ok(new { backups = Array.Empty<object>(), total = 0 });
        var files = Directory.GetFiles(backupDir, "*.db")
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.CreationTime.ToUniversalTime())
            .Select(f => new
            {
                name = f.Name, size = f.Length, created = f.CreationTime.ToUniversalTime(),
                filename = f.Name, size_mb = Math.Round(f.Length / 1048576.0, 2), created_at = f.CreationTime.ToUniversalTime(),
            }).ToList();
        return Ok(new { backups = files, total = files.Count });
    }

    [HttpPost("backup")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateBackup()
    {
        var dbPath = DbPath();
        var backupDir = BackupDir();
        Directory.CreateDirectory(backupDir);
        var backupPath = Path.Combine(backupDir, $"watchnexus_{DateTime.UtcNow:yyyyMMdd_HHmmss}.db");
        if (_db.Database.IsRelational())
        {
            // VACUUM INTO produces a consistent snapshot of a live (WAL) database;
            // a raw File.Copy can capture a torn/incomplete file.
            await _db.Database.ExecuteSqlRawAsync("VACUUM INTO {0}", backupPath);
        }
        else if (System.IO.File.Exists(dbPath)) System.IO.File.Copy(dbPath, backupPath);
        return Ok(new { status = "created", path = backupPath });
    }

    [HttpGet("roadmap")]
    public IActionResult Roadmap()
    {
        var items = new[]
        {
            new { endpoint = "GET /api/security/sessions", method = "GET", path = "/api/security/sessions", message = "Session management is not yet implemented.", tier = "pro" },
            new { endpoint = "POST /api/security/sessions/{id}/revoke", method = "POST", path = "/api/security/sessions/{id}/revoke", message = "Session revocation is not yet implemented.", tier = "pro" },
            new { endpoint = "POST /api/vpn/server/wg-up", method = "POST", path = "/api/vpn/server/wg-up", message = "WireGuard interface activation requires server-side wg-quick integration.", tier = "ultra" },
            new { endpoint = "POST /api/vpn/server/wg-down", method = "POST", path = "/api/vpn/server/wg-down", message = "WireGuard interface deactivation requires server-side wg-quick integration.", tier = "ultra" },
            new { endpoint = "GET /api/vpn/logs", method = "GET", path = "/api/vpn/logs", message = "VPN log streaming is not yet implemented.", tier = "ultra" },
            new { endpoint = "POST /api/watch-party/{code}/chat", method = "POST", path = "/api/watch-party/{code}/chat", message = "Chat persistence is not yet implemented. Use the WebSocket for real-time messages.", tier = "ultra" },
        };
        return Ok(new { version = Services.UpdateBackgroundService.CurrentVersion, endpoints = items, total = items.Length });
    }

    [HttpGet("changelog")]
    public IActionResult Changelog()
    {
        var changelogPath = Path.Combine(AppContext.BaseDirectory, "CHANGELOG.md");
        if (!System.IO.File.Exists(changelogPath))
            return Ok(new { version = Services.UpdateBackgroundService.CurrentVersion, content = "# WatchNexus Changelog\n\nNo changelog available." });
        var content = System.IO.File.ReadAllText(changelogPath);
        return Ok(new { version = Services.UpdateBackgroundService.CurrentVersion, content = content });
    }
}

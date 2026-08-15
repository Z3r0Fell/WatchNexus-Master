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
            version = "1.0.1",
            hostname = Environment.MachineName,
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
        return Ok(new { version = "1.0.1", endpoints = items, total = items.Length });
    }
}

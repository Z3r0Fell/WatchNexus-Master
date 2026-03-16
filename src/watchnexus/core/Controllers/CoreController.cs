using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

[ApiController]
[Route("api")]
public class CoreController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() => Ok(new
    {
        status = "healthy",
        timestamp = DateTime.UtcNow,
        version = "2.7.3"
    });

    [Authorize]
    [HttpGet("info")]
    public IActionResult Info()
    {
        var process = System.Diagnostics.Process.GetCurrentProcess();
        var modules = ModuleLoader.LoadedModules.Select(m => new
        {
            name = m.Manifest.DisplayName,
            codename = m.Manifest.Codename,
            version = m.Manifest.Version,
            status = "active"
        }).ToList();

        // Add built-in modules
        var builtIn = new[]
        {
            new { name = "Marmalade", codename = "marmalade", version = "2.7.3", status = "active" },
            new { name = "Bastion", codename = "bastion", version = "2.7.3", status = "active" },
            new { name = "Tunnel", codename = "tunnel", version = "2.7.3", status = "active" },
            new { name = "Zest", codename = "zest", version = "2.7.3", status = "active" },
            new { name = "Fondue", codename = "fondue", version = "2.7.3", status = "active" },
            new { name = "Sorbet", codename = "sorbet", version = "2.7.3", status = "active" },
            new { name = "Brioche", codename = "brioche", version = "2.7.3", status = "active" },
            new { name = "Nectar", codename = "nectar", version = "2.7.3", status = "active" },
            new { name = "Ganache", codename = "ganache", version = "2.7.3", status = "active" },
            new { name = "Bisque", codename = "bisque", version = "2.7.3", status = "active" },
            new { name = "Marzipan", codename = "marzipan", version = "2.7.3", status = "active" },
            new { name = "Cinnamon", codename = "cinnamon", version = "2.7.3", status = "active" },
            new { name = "Waffle", codename = "waffle", version = "2.7.3", status = "active" },
            new { name = "Yeast", codename = "yeast", version = "2.7.3", status = "active" },
            new { name = "Sourdough", codename = "sourdough", version = "2.7.3", status = "active" },
            new { name = "Taffy", codename = "taffy", version = "2.7.3", status = "active" },
            new { name = "Churro", codename = "churro", version = "2.7.3", status = "active" },
            new { name = "Saffron", codename = "saffron", version = "2.7.3", status = "active" },
            new { name = "Pantry", codename = "pantry", version = "2.7.3", status = "active" },
            new { name = "Nutmeg", codename = "nutmeg", version = "2.7.3", status = "active" },
            new { name = "Crumbs", codename = "crumbs", version = "2.7.3", status = "active" },
            new { name = "Fortress", codename = "fortress", version = "2.7.3", status = "active" },
            new { name = "Custard", codename = "custard", version = "2.7.3", status = "active" },
            new { name = "Ripen", codename = "ripen", version = "2.7.3", status = "active" },
        };

        return Ok(new
        {
            version = "2.7.3",
            hostname = Environment.MachineName,
            platform = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
            dotnet_version = Environment.Version.ToString(),
            cpu_count = Environment.ProcessorCount,
            memory_used = process.WorkingSet64,
            uptime = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds,
            modules = builtIn.Concat(modules)
        });
    }
}

// ── Sourdough (Auth) ────────────────────────────────────────
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    private readonly AppDbContext _db;

    public AuthController(AuthService auth, AppDbContext db)
    {
        _auth = auth;
        _db = db;
    }

    public record RegisterRequest(string Email, string Username, string Password);
    public record LoginRequest(string Email, string Password);

    [HttpPost("register")]
    public IActionResult Register([FromBody] RegisterRequest req)
    {
        var user = _auth.Register(req.Email, req.Username, req.Password);
        if (user == null) return Conflict(new { detail = "Email already registered" });
        var token = _auth.GenerateToken(user);
        return Ok(new
        {
            access_token = token,
            user = new { user.Id, user.Email, user.Username, user.Avatar, user.Role, user.CreatedAt }
        });
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        var (user, token) = _auth.Login(req.Email, req.Password);
        if (user == null || token == null) return Unauthorized(new { detail = "Invalid credentials" });
        return Ok(new
        {
            access_token = token,
            user = new { user.Id, user.Email, user.Username, user.Avatar, user.Role, user.CreatedAt }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();
        return Ok(new { user.Id, user.Email, user.Username, user.Avatar, user.Role, user.CreatedAt });
    }
}

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;

    public UsersController(AppDbContext db) { _db = db; }

    [Authorize]
    [HttpGet("me")]
    public IActionResult GetMe()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();
        return Ok(new { user.Id, user.Email, user.Username, user.Avatar, user.Role, user.CreatedAt });
    }

    [Authorize]
    [HttpGet("profiles")]
    public IActionResult GetProfiles()
    {
        var users = _db.Users.Select(u => new { u.Id, u.Email, u.Username, u.Avatar, u.Role }).ToList();
        return Ok(users);
    }
}

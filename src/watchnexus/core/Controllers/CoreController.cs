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
        version = "1.0.0",
        runtime = $".NET {Environment.Version}",
        os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
        architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
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
            new { name = "Marmalade", codename = "marmalade", version = "1.0.0", status = "active" },
            new { name = "Bastion", codename = "bastion", version = "1.0.0", status = "active" },
            new { name = "Tunnel", codename = "tunnel", version = "1.0.0", status = "active" },
            new { name = "Zest", codename = "zest", version = "1.0.0", status = "active" },
            new { name = "Fondue", codename = "fondue", version = "1.0.0", status = "active" },
            new { name = "Sorbet", codename = "sorbet", version = "1.0.0", status = "active" },
            new { name = "Brioche", codename = "brioche", version = "1.0.0", status = "active" },
            new { name = "Nectar", codename = "nectar", version = "1.0.0", status = "active" },
            new { name = "Ganache", codename = "ganache", version = "1.0.0", status = "active" },
            new { name = "Bisque", codename = "bisque", version = "1.0.0", status = "active" },
            new { name = "Marzipan", codename = "marzipan", version = "1.0.0", status = "active" },
            new { name = "Cinnamon", codename = "cinnamon", version = "1.0.0", status = "active" },
            new { name = "Waffle", codename = "waffle", version = "1.0.0", status = "active" },
            new { name = "Yeast", codename = "yeast", version = "1.0.0", status = "active" },
            new { name = "Sourdough", codename = "sourdough", version = "1.0.0", status = "active" },
            new { name = "Taffy", codename = "taffy", version = "1.0.0", status = "active" },
            new { name = "Churro", codename = "churro", version = "1.0.0", status = "active" },
            new { name = "Saffron", codename = "saffron", version = "1.0.0", status = "active" },
            new { name = "Pantry", codename = "pantry", version = "1.0.0", status = "active" },
            new { name = "Nutmeg", codename = "nutmeg", version = "1.0.0", status = "active" },
            new { name = "Crumbs", codename = "crumbs", version = "1.0.0", status = "active" },
            new { name = "Fortress", codename = "fortress", version = "1.0.0", status = "active" },
            new { name = "Custard", codename = "custard", version = "1.0.0", status = "active" },
            new { name = "Truffle", codename = "truffle", version = "1.0.0", status = "active" },
            new { name = "Pepper", codename = "pepper", version = "1.0.0", status = "active" },
            new { name = "Meringue", codename = "meringue", version = "1.0.0", status = "active" },
            new { name = "Rind", codename = "rind", version = "1.0.0", status = "active" },
            new { name = "Crucible", codename = "crucible", version = "1.0.0", status = "active" },
            new { name = "Brine", codename = "brine", version = "1.0.0", status = "active" },
            new { name = "Ladle", codename = "ladle", version = "1.0.0", status = "active" },
            new { name = "Ripen", codename = "ripen", version = "1.0.0", status = "active" },
            new { name = "Glaze", codename = "glaze", version = "1.0.0", status = "active" },
            new { name = "Roux", codename = "roux", version = "1.0.0", status = "active" },
            new { name = "Sprout", codename = "sprout", version = "1.0.0", status = "active" },
            new { name = "Setup Wizard", codename = "setup", version = "1.0.0", status = "active" },
        };

        return Ok(new
        {
            version = "1.0.0",
            codename = "WatchNexus",
            framework = $".NET {Environment.Version}",
            hostname = Environment.MachineName,
            platform = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
            dotnet_version = Environment.Version.ToString(),
            cpu_count = Environment.ProcessorCount,
            memory_used = process.WorkingSet64,
            uptime = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds,
            security = new
            {
                jwt_auth = true,
                password_hashing = true,
                rate_limiting = true,
                cors_policy = true,
                two_factor = true,
                session_management = true,
                ip_filtering = true,
                api_key_auth = true,
            },
            modules = builtIn.Concat(modules).ToList()
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
    public record SetupRequest(string Email, string Username, string Password);

    // ══════════════════════════════════════════════════════════════
    //  OOBE — First-launch admin creation
    //  ----------------------------------------------------------------
    //  Jellyfin-style: a fresh install has zero users; the frontend
    //  wizard polls /setup-status, sees `needs_setup: true`, and posts
    //  to /setup to create the first admin. After that the endpoint
    //  becomes a no-op (returns 409) so it can't be used to silently
    //  inject admins on a running server.
    // ══════════════════════════════════════════════════════════════
    [HttpGet("setup-status")]
    [AllowAnonymous]
    public IActionResult SetupStatus()
    {
        var hasUsers = _db.Users.Any();
        return Ok(new
        {
            needs_setup = !hasUsers,
            user_count = _db.Users.Count(),
            version = "1.0.0"
        });
    }

    [HttpPost("setup")]
    [AllowAnonymous]
    public IActionResult Setup([FromBody] SetupRequest req)
    {
        // Hard guard: only the *first* user can be created through this
        // endpoint. Anyone calling it after setup is bounced.
        if (_db.Users.Any())
            return Conflict(new { detail = "Setup already completed. Use POST /api/auth/login." });

        if (string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Username) ||
            string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { detail = "Email, username and password are required." });

        if (req.Password.Length < 8)
            return BadRequest(new { detail = "Password must be at least 8 characters." });

        var admin = new WatchNexus.Shared.AppUser
        {
            Email = req.Email.Trim(),
            Username = req.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "admin"
        };
        _db.Users.Add(admin);
        _db.SaveChanges();

        var token = _auth.GenerateToken(admin);
        return Ok(new
        {
            access_token = token,
            user = new { admin.Id, admin.Email, admin.Username, admin.Avatar, admin.Role, admin.CreatedAt }
        });
    }

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

    [Authorize]
    [HttpPost("logout")]
    public IActionResult Logout() => Ok(new { status = "logged_out" });

    // Google OAuth was removed in v1.0.0 RTP — WatchNexus is a self-hosted
    // media server with local-account auth only. The endpoint is kept as
    // a hard 410 Gone so any stale clients fail fast with a clear message
    // instead of silently retrying.
    [HttpPost("google/session")]
    public IActionResult GoogleSession() => StatusCode(410, new
    {
        detail = "Google OAuth was removed in WatchNexus v1.0.0. Use local username/password login."
    });

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

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

[ApiController]
[Route("api")]
public class CoreController : ControllerBase
{
    // Public, unauthenticated liveness probe — intentionally minimal so it does
    // not leak host/OS/runtime details to anonymous callers. Detailed diagnostics
    // live behind the authenticated /api/info endpoint.
    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health() => Ok(new
    {
        status = "healthy",
        timestamp = DateTime.UtcNow,
        version = "1.0.0",
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

    // ── httpOnly cookie auth (S-02) ───────────────────────────────
    // The JWT is delivered as an httpOnly, SameSite cookie so it is NOT
    // reachable from JavaScript (XSS can't exfiltrate it). Secure is keyed off
    // the request scheme (honours X-Forwarded-Proto behind a TLS proxy) so the
    // cookie still works on a plain-http LAN install. The access_token is also
    // returned in the body for non-browser / Electron clients (Bearer header path).
    private const string AuthCookie = "wn_token";

    private void SetAuthCookie(string token) =>
        Response.Cookies.Append(AuthCookie, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            MaxAge = TimeSpan.FromDays(7),
            IsEssential = true,
        });

    private void ClearAuthCookie() =>
        Response.Cookies.Append(AuthCookie, "", new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = DateTimeOffset.UnixEpoch,
            IsEssential = true,
        });

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
    [EnableRateLimiting("auth")]
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

        if (!EmailValidator.IsValid(req.Email))
            return BadRequest(new { detail = "Please enter a valid email address." });

        var (pwOk, pwErr) = PasswordPolicy.Validate(req.Password);
        if (!pwOk) return BadRequest(new { detail = pwErr });

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
        SetAuthCookie(token);
        return Ok(new
        {
            access_token = token,
            user = new { admin.Id, admin.Email, admin.Username, admin.Avatar, admin.Role, admin.CreatedAt }
        });
    }

    // Public self-registration is DISABLED in v1.0.0. A self-hosted media server
    // is single-tenant: the owner creates accounts for household members from
    // Settings → Users (admin only). Kept as an explicit 403 so stale clients get
    // a clear message instead of a confusing 404.
    [HttpPost("register")]
    [AllowAnonymous]
    public IActionResult Register() => StatusCode(403, new
    {
        detail = "Public registration is disabled. Ask your server administrator to create an account for you."
    });

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        var (user, token) = _auth.Login(req.Email, req.Password);
        if (user == null || token == null) return Unauthorized(new { detail = "Invalid credentials" });
        SetAuthCookie(token);
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
    public async Task<IActionResult> Logout()
    {
        // Server-side invalidation: bump the user's token version so every JWT
        // previously issued to them (including this one) stops validating.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
            await TokenVersionStore.IncrementAsync(_db, userId);
        ClearAuthCookie();
        return Ok(new { status = "logged_out" });
    }

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
    private readonly AuthService _auth;

    public UsersController(AppDbContext db, AuthService auth) { _db = db; _auth = auth; }

    [Authorize]
    [HttpGet("me")]
    public IActionResult GetMe()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();
        return Ok(new { user.Id, user.Email, user.Username, user.Avatar, user.Role, user.CreatedAt });
    }

    // Public, minimal profile list for the "Who's watching?" login picker
    // (Jellyfin/Plex-style). Returns ONLY display fields — never email or role —
    // so an unauthenticated caller can render avatars without leaking account data.
    [AllowAnonymous]
    [HttpGet("profiles")]
    public IActionResult GetProfiles()
    {
        var users = _db.Users
            .OrderBy(u => u.Username)
            .Select(u => new { u.Id, u.Username, u.Avatar })
            .ToList();
        return Ok(users);
    }

    // ── Admin user management (Settings → Users) ──────────────────
    public record CreateUserRequest(string Email, string Username, string Password, string? Role);
    public record PasswordRequest(string Password);
    public record ChangePasswordRequest(string Current_password, string New_password);

    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    [Authorize(Roles = "admin")]
    [HttpGet]
    public IActionResult ListUsers()
    {
        var users = _db.Users
            .OrderBy(u => u.CreatedAt)
            .Select(u => new { u.Id, u.Email, u.Username, u.Avatar, u.Role, u.CreatedAt })
            .ToList();
        return Ok(users);
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public IActionResult CreateUser([FromBody] CreateUserRequest req)
    {
        if (!EmailValidator.IsValid(req.Email))
            return BadRequest(new { detail = "Please enter a valid email address." });
        if (string.IsNullOrWhiteSpace(req.Username))
            return BadRequest(new { detail = "Username is required." });
        var (ok, err) = PasswordPolicy.Validate(req.Password);
        if (!ok) return BadRequest(new { detail = err });

        var user = _auth.CreateUser(req.Email, req.Username, req.Password, req.Role ?? "user");
        if (user == null) return Conflict(new { detail = "A user with that email already exists." });
        return Ok(new { user.Id, user.Email, user.Username, user.Avatar, user.Role, user.CreatedAt });
    }

    // General update used by the Settings → Users panel. Only `role` is a
    // server-enforced field; any other properties (e.g. UI permission flags) are
    // accepted but not persisted — permissions enforcement is not yet implemented,
    // so we don't pretend to store it.
    [Authorize(Roles = "admin")]
    [HttpPut("{id}")]
    public IActionResult UpdateUser(string id, [FromBody] JsonElement body)
    {
        var user = _db.Users.Find(id);
        if (user == null) return NotFound(new { detail = "User not found." });
        if (body.TryGetProperty("role", out var r) && r.ValueKind == JsonValueKind.String)
        {
            var role = r.GetString();
            if (role != "admin" && role != "user")
                return BadRequest(new { detail = "Role must be 'admin' or 'user'." });
            if (user.Role == "admin" && role == "user" && _db.Users.Count(u => u.Role == "admin") <= 1)
                return BadRequest(new { detail = "Cannot demote the last administrator." });
            user.Role = role!;
            _db.SaveChanges();
        }
        return Ok(new { user.Id, user.Email, user.Username, user.Avatar, user.Role, user.CreatedAt });
    }

    [Authorize(Roles = "admin")]
    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, [FromBody] PasswordRequest req)
    {
        var (ok, err) = PasswordPolicy.Validate(req.Password);
        if (!ok) return BadRequest(new { detail = err });
        var user = _db.Users.Find(id);
        if (user == null) return NotFound(new { detail = "User not found." });
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        _db.SaveChanges();
        await TokenVersionStore.IncrementAsync(_db, id); // sign the user out everywhere
        return Ok(new { status = "password_reset" });
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public IActionResult DeleteUser(string id)
    {
        var user = _db.Users.Find(id);
        if (user == null) return NotFound(new { detail = "User not found." });
        if (user.Id == CurrentUserId)
            return BadRequest(new { detail = "You cannot delete your own account." });
        if (user.Role == "admin" && _db.Users.Count(u => u.Role == "admin") <= 1)
            return BadRequest(new { detail = "Cannot delete the last administrator." });
        _db.Users.Remove(user);
        _db.SaveChanges();
        return Ok(new { status = "deleted" });
    }

    [Authorize]
    [HttpPost("me/password")]
    public async Task<IActionResult> ChangeOwnPassword([FromBody] ChangePasswordRequest req)
    {
        var (ok, err) = PasswordPolicy.Validate(req.New_password);
        if (!ok) return BadRequest(new { detail = err });
        var user = _db.Users.Find(CurrentUserId);
        if (user == null) return NotFound();
        if (!BCrypt.Net.BCrypt.Verify(req.Current_password, user.PasswordHash))
            return BadRequest(new { detail = "Your current password is incorrect." });
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.New_password);
        _db.SaveChanges();
        await TokenVersionStore.IncrementAsync(_db, user.Id);
        return Ok(new { status = "password_changed" });
    }
}

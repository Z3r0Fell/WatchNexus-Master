using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Auth;

public class AuthService
{
    private readonly AppDbContext _db;
    private readonly string _jwtSecret;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        // Fail fast: never fall back to a shared/hardcoded signing key. Program.cs
        // resolves (or generates+persists) a strong per-install secret and writes
        // it back into configuration before the host starts, so this is always set.
        _jwtSecret = config["Jwt:Secret"]
            ?? throw new InvalidOperationException("JWT signing secret is not configured.");
    }

    public string GenerateToken(AppUser user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            // Token version — lets us invalidate this token on logout / password change.
            new Claim("tv", TokenVersionStore.Get(_db, user.Id).ToString()),
        };
        var token = new JwtSecurityToken(
            issuer: "WatchNexus",
            audience: "WatchNexus",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Creates a user. Public self-registration is disabled in v1.0.0 — this is
    /// only invoked by the admin-only user-management endpoints. Validation
    /// (email format, password policy) is performed by the caller.
    /// </summary>
    public AppUser? CreateUser(string email, string username, string password, string role = "user")
    {
        email = email.Trim();
        if (_db.Users.Any(u => u.Email == email)) return null;
        var user = new AppUser
        {
            Email = email,
            Username = username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = role == "admin" ? "admin" : "user",
        };
        _db.Users.Add(user);
        _db.SaveChanges();
        return user;
    }

    public (AppUser? user, string? token) Login(string email, string password)
    {
        var user = _db.Users.FirstOrDefault(u => u.Email == email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return (null, null);
        return (user, GenerateToken(user));
    }
}

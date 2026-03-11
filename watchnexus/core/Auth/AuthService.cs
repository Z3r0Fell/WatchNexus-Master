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
        _jwtSecret = config["Jwt:Secret"] ?? "WatchNexus_DefaultSecret_ChangeInProduction_32chars!";
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
        };
        var token = new JwtSecurityToken(
            issuer: "WatchNexus",
            audience: "WatchNexus",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public AppUser? Register(string email, string username, string password)
    {
        if (_db.Users.Any(u => u.Email == email)) return null;
        var user = new AppUser
        {
            Email = email,
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
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

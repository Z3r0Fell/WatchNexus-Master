using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.Infrastructure.Services;

/// <summary>
/// JWT token service implementation
/// </summary>
public class JwtService : IJwtService
{
    private readonly IConfiguration _config;
    private readonly string _secret;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _accessTokenExpiryMinutes;

    public JwtService(IConfiguration config)
    {
        _config = config;
        _secret = _config["Jwt:Secret"] ?? "WatchNexus-Default-Secret-Key-Change-In-Production-32chars";
        _issuer = _config["Jwt:Issuer"] ?? "WatchNexus";
        _audience = _config["Jwt:Audience"] ?? "WatchNexus";
        _accessTokenExpiryMinutes = int.Parse(_config["Jwt:AccessTokenExpiryMinutes"] ?? "60");
    }

    public string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_accessTokenExpiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    public Guid? ValidateAccessToken(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_secret);
            
            tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out SecurityToken validatedToken);

            var jwtToken = (JwtSecurityToken)validatedToken;
            var userId = jwtToken.Claims.First(x => x.Type == JwtRegisteredClaimNames.Sub).Value;
            
            return Guid.Parse(userId);
        }
        catch
        {
            return null;
        }
    }
}

/// <summary>
/// Authentication service implementation
/// </summary>
public class AuthService : IAuthService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IJwtService _jwtService;
    private readonly IConfiguration _config;
    private readonly int _refreshTokenExpiryDays;

    public AuthService(IUnitOfWork unitOfWork, IJwtService jwtService, IConfiguration config)
    {
        _unitOfWork = unitOfWork;
        _jwtService = jwtService;
        _config = config;
        _refreshTokenExpiryDays = int.Parse(_config["Jwt:RefreshTokenExpiryDays"] ?? "7");
    }

    public async Task<(User User, string AccessToken, string RefreshToken)> LoginAsync(
        string email, string password, CancellationToken ct = default)
    {
        var user = await _unitOfWork.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        
        if (user == null || !VerifyPassword(password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid email or password");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Account is disabled");

        user.LastLoginAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = await CreateRefreshTokenAsync(user.Id, ct);

        return (user, accessToken, refreshToken);
    }

    public async Task<(User User, string AccessToken, string RefreshToken)> RegisterAsync(
        string email, string username, string password, CancellationToken ct = default)
    {
        if (await _unitOfWork.Users.ExistsAsync(u => u.Email == email, ct))
            throw new InvalidOperationException("Email already registered");

        if (await _unitOfWork.Users.ExistsAsync(u => u.Username == username, ct))
            throw new InvalidOperationException("Username already taken");

        var user = new User
        {
            Email = email,
            Username = username,
            PasswordHash = HashPassword(password),
            Role = Domain.Enums.UserRole.User,
            IsActive = true
        };

        // First user becomes admin
        if (await _unitOfWork.Users.CountAsync(ct: ct) == 0)
            user.Role = Domain.Enums.UserRole.Admin;

        await _unitOfWork.Users.AddAsync(user, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshToken = await CreateRefreshTokenAsync(user.Id, ct);

        return (user, accessToken, refreshToken);
    }

    public async Task<(string AccessToken, string RefreshToken)> RefreshTokenAsync(
        string refreshToken, CancellationToken ct = default)
    {
        var token = await _unitOfWork.RefreshTokens.FirstOrDefaultAsync(
            t => t.Token == refreshToken && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow, ct);

        if (token == null)
            throw new UnauthorizedAccessException("Invalid or expired refresh token");

        var user = await _unitOfWork.Users.GetByIdAsync(token.UserId, ct);
        if (user == null || !user.IsActive)
            throw new UnauthorizedAccessException("User not found or disabled");

        // Revoke old token
        token.IsRevoked = true;

        // Create new tokens
        var newAccessToken = _jwtService.GenerateAccessToken(user);
        var newRefreshToken = await CreateRefreshTokenAsync(user.Id, ct);

        token.ReplacedByToken = newRefreshToken;
        await _unitOfWork.SaveChangesAsync(ct);

        return (newAccessToken, newRefreshToken);
    }

    public async Task RevokeTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        var token = await _unitOfWork.RefreshTokens.FirstOrDefaultAsync(
            t => t.Token == refreshToken, ct);

        if (token != null)
        {
            token.IsRevoked = true;
            await _unitOfWork.SaveChangesAsync(ct);
        }
    }

    public Task<bool> ValidateTokenAsync(string token, CancellationToken ct = default)
    {
        var userId = _jwtService.ValidateAccessToken(token);
        return Task.FromResult(userId.HasValue);
    }

    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, BCrypt.Net.BCrypt.GenerateSalt(12));
    }

    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId, CancellationToken ct)
    {
        var token = new RefreshToken
        {
            UserId = userId,
            Token = _jwtService.GenerateRefreshToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(_refreshTokenExpiryDays),
            IsRevoked = false
        };

        await _unitOfWork.RefreshTokens.AddAsync(token, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return token.Token;
    }
}

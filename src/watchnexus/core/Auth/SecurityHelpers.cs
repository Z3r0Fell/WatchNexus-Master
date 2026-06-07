using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Auth;

/// <summary>Password complexity policy applied to every credential-setting path.</summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;

    public static (bool ok, string? error) Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinLength)
            return (false, $"Password must be at least {MinLength} characters long.");
        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            return (false, "Password must contain at least one letter and one number.");
        return (true, null);
    }
}

/// <summary>Email format validation (via System.Net.Mail.MailAddress).</summary>
public static class EmailValidator
{
    public static bool IsValid(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        email = email.Trim();
        try
        {
            var addr = new MailAddress(email);
            return addr.Address == email
                   && email.Contains('@')
                   && email.Split('@')[1].Contains('.');
        }
        catch { return false; }
    }
}

/// <summary>
/// Per-user token version stored in the AppSetting table (no schema migration
/// required). Bumping the version invalidates every JWT previously issued to the
/// user — used on logout and on any password change/reset.
/// </summary>
public static class TokenVersionStore
{
    private static string Key(string userId) => $"sec_tokenver:{userId}";

    public static int Get(AppDbContext db, string userId)
    {
        var s = db.Settings.AsNoTracking().FirstOrDefault(x => x.Key == Key(userId) && x.UserId == "");
        return s != null && int.TryParse(s.Value, out var v) ? v : 0;
    }

    public static async Task<int> GetAsync(AppDbContext db, string userId)
    {
        var s = await db.Settings.AsNoTracking().FirstOrDefaultAsync(x => x.Key == Key(userId) && x.UserId == "");
        return s != null && int.TryParse(s.Value, out var v) ? v : 0;
    }

    public static async Task IncrementAsync(AppDbContext db, string userId)
    {
        var s = await db.Settings.FirstOrDefaultAsync(x => x.Key == Key(userId) && x.UserId == "");
        if (s == null)
            db.Settings.Add(new AppSetting { Key = Key(userId), UserId = "", Value = "1" });
        else
            s.Value = (int.TryParse(s.Value, out var v) ? v + 1 : 1).ToString();
        await db.SaveChangesAsync();
    }
}

/// <summary>
/// Short-lived signed media-stream tokens. HTML5 &lt;video&gt;/&lt;audio&gt; elements
/// cannot send an Authorization header, so the player first calls an authenticated
/// endpoint to mint a token and then passes it in the stream URL. The token is an
/// HMAC-SHA256 over "{mediaId}.{expiry}" keyed with the server's JWT secret.
/// </summary>
public static class StreamToken
{
    public static string Issue(string mediaId, string secret, TimeSpan ttl)
    {
        var exp = DateTimeOffset.UtcNow.Add(ttl).ToUnixTimeSeconds();
        return $"{exp}.{Sign(mediaId, exp, secret)}";
    }

    public static bool Validate(string mediaId, string? token, string secret)
    {
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(secret)) return false;
        var parts = token.Split('.', 2);
        if (parts.Length != 2 || !long.TryParse(parts[0], out var exp)) return false;
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp) return false;
        var expected = Sign(mediaId, exp, secret);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(parts[1]));
    }

    private static string Sign(string mediaId, long exp, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{mediaId}.{exp}"));
        return Convert.ToBase64String(hash).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}

/// <summary>Helpers for restricting endpoints to local/loopback callers.</summary>
public static class LocalRequest
{
    public static bool IsLoopback(HttpContext ctx)
    {
        var ip = ctx.Connection.RemoteIpAddress;
        return ip != null && IPAddress.IsLoopback(ip);
    }
}

/// <summary>
/// SSRF guard for user-supplied outbound hosts (e.g. the qBittorrent connection
/// test). We deliberately ALLOW private/loopback addresses because download
/// clients normally run on localhost or the LAN — that is the legitimate use
/// case. We only block cloud metadata endpoints, which have no business being
/// targeted from a torrent-client connection test.
/// </summary>
public static class SsrfGuard
{
    public static bool IsBlocked(string? host)
    {
        if (string.IsNullOrWhiteSpace(host)) return true;
        var h = host.Trim().ToLowerInvariant();
        if (h is "metadata" or "metadata.google.internal") return true;
        if (h.StartsWith("169.254.")) return true; // link-local incl. AWS/Azure/GCP metadata (169.254.169.254)
        if (h == "[fd00:ec2::254]" || h == "fd00:ec2::254") return true; // AWS IMDS IPv6
        return false;
    }
}

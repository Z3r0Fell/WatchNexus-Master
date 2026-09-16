using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace WatchNexus.Core.Auth;

// ── CSRF defense-in-depth (double-submit cookie) ──────────────────────
// Layered on top of the SameSite=Strict auth cookie. On login/setup the
// server issues a readable XSRF-TOKEN cookie; the SPA mirrors it into the
// X-XSRF-TOKEN header on mutating requests; this middleware verifies they
// match. Pure Bearer-header (programmatic) clients are exempt.
public static class CsrfTokens
{
    public const string CookieName = "XSRF-TOKEN";
    public const string HeaderName = "X-XSRF-TOKEN";
    public static string Generate() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
}

public class CsrfProtectionMiddleware
{
    private readonly RequestDelegate _next;
    public CsrfProtectionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx)
    {
        var req = ctx.Request;
        var method = req.Method;

        // Only guard mutating /api requests.
        if (!req.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase)
            || HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method))
        {
            await _next(ctx);
            return;
        }

        // login + setup establish the session and the CSRF token itself.
        if (req.Path.StartsWithSegments("/api/auth/login", StringComparison.OrdinalIgnoreCase)
            || req.Path.StartsWithSegments("/api/auth/setup", StringComparison.OrdinalIgnoreCase))
        {
            await _next(ctx);
            return;
        }

        // Pure programmatic client (no auth cookie) → not CSRF-exposed.
        // CSRF only matters for browser-session requests authenticated by the
        // wn_token cookie (SameSite=Strict). Requests that carry no auth cookie
        // cannot be a state-changing cookie-session forgery — whether they
        // authenticate via a Bearer/token header or are anonymous.
        var hasAuthCookie = req.Cookies.ContainsKey("wn_token");
        if (!hasAuthCookie)
        {
            await _next(ctx);
            return;
        }

        var cookie = req.Cookies[CsrfTokens.CookieName];
        var header = req.Headers[CsrfTokens.HeaderName].ToString();
        if (string.IsNullOrEmpty(cookie) || string.IsNullOrEmpty(header) || !FixedEquals(cookie, header))
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            await ctx.Response.WriteAsJsonAsync(new { detail = "CSRF token missing or invalid" });
            return;
        }

        await _next(ctx);
    }

    private static bool FixedEquals(string a, string b)
    {
        var ab = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return ab.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ab, bb);
    }
}

public static class CsrfMiddlewareExtensions
{
    public static IApplicationBuilder UseCsrfProtection(this IApplicationBuilder builder)
        => builder.UseMiddleware<CsrfProtectionMiddleware>();
}

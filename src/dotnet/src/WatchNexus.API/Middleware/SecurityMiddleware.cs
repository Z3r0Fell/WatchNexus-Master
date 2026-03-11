using System.Collections.Concurrent;
using System.Net;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Middleware;

/// <summary>
/// Security headers middleware - adds OWASP-recommended headers
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["X-XSS-Protection"] = "1; mode=block";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["X-Powered-By"] = "WatchNexus";
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        await _next(context);
    }
}

/// <summary>
/// Rate limiting middleware - sliding window per IP
/// </summary>
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private static readonly ConcurrentDictionary<string, RateLimitEntry> _clients = new();
    private const int MaxRequests = 100; // per window
    private const int WindowSeconds = 60;

    public RateLimitingMiddleware(RequestDelegate next, ILogger<RateLimitingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var key = $"{ip}:{context.Request.Path}";

        var entry = _clients.GetOrAdd(key, _ => new RateLimitEntry());

        lock (entry)
        {
            entry.PruneOldEntries(WindowSeconds);
            entry.Timestamps.Add(DateTime.UtcNow);

            if (entry.Timestamps.Count > MaxRequests)
            {
                _logger.LogWarning("Rate limit exceeded for {IP} on {Path}", ip, context.Request.Path);
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                context.Response.Headers["Retry-After"] = WindowSeconds.ToString();
                return;
            }
        }

        // Add rate limit headers
        context.Response.Headers["X-RateLimit-Limit"] = MaxRequests.ToString();
        context.Response.Headers["X-RateLimit-Remaining"] = Math.Max(0, MaxRequests - entry.Timestamps.Count).ToString();

        await _next(context);
    }

    private class RateLimitEntry
    {
        public List<DateTime> Timestamps { get; } = new();

        public void PruneOldEntries(int windowSeconds)
        {
            var cutoff = DateTime.UtcNow.AddSeconds(-windowSeconds);
            Timestamps.RemoveAll(t => t < cutoff);
        }
    }
}

/// <summary>
/// Audit logging middleware - logs all API requests
/// </summary>
public class AuditLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditLoggingMiddleware> _logger;

    public AuditLoggingMiddleware(RequestDelegate next, ILogger<AuditLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
    {
        // Only audit API calls, skip health checks and swagger
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (!path.StartsWith("/api/") || path.Contains("health") || path.Contains("swagger"))
        {
            await _next(context);
            return;
        }

        var startTime = DateTime.UtcNow;
        await _next(context);
        var elapsed = DateTime.UtcNow - startTime;

        // Log auth-related events to the database
        if (path.Contains("/auth/login") || path.Contains("/auth/register") ||
            path.Contains("/security/") || path.Contains("/vpn/"))
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

                var userId = context.User?.FindFirst("sub")?.Value;
                var action = DetermineAction(context.Request.Method, path);

                var log = new AuditLog
                {
                    UserId = Guid.TryParse(userId, out var uid) ? uid : null,
                    Action = action,
                    EntityType = path.Split('/').Skip(2).FirstOrDefault(),
                    IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = context.Request.Headers.UserAgent.ToString(),
                    Details = $"{context.Request.Method} {path} -> {context.Response.StatusCode} ({elapsed.TotalMilliseconds:F0}ms)",
                    Success = context.Response.StatusCode < 400
                };

                await unitOfWork.AuditLogs.AddAsync(log);
                await unitOfWork.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write audit log");
            }
        }
    }

    private static string DetermineAction(string method, string path)
    {
        if (path.Contains("login")) return path.Contains("login") ? "login_attempt" : "auth";
        if (path.Contains("register")) return "register";
        if (path.Contains("vpn")) return $"vpn_{method.ToLower()}";
        if (path.Contains("security")) return $"security_{method.ToLower()}";
        return $"{method.ToLower()}_{path.Split('/').LastOrDefault()}";
    }
}

/// <summary>
/// IP filtering middleware - checks against IP access rules
/// </summary>
public class IpFilteringMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<IpFilteringMiddleware> _logger;

    public IpFilteringMiddleware(RequestDelegate next, ILogger<IpFilteringMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
    {
        var ip = context.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ip))
        {
            await _next(context);
            return;
        }

        try
        {
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var rule = await unitOfWork.IpAccessRules.FirstOrDefaultAsync(
                r => r.IpAddress == ip && (r.ExpiresAt == null || r.ExpiresAt > DateTime.UtcNow));

            if (rule != null && !rule.IsAllowed)
            {
                _logger.LogWarning("Blocked request from blacklisted IP: {IP}", ip);
                context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "Access denied" });
                return;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking IP rules");
            // Don't block on rule check failure
        }

        await _next(context);
    }
}

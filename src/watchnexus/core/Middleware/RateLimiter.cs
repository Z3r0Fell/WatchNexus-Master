using System.Collections.Concurrent;

namespace WatchNexus.Core.Middleware;

public class RateLimiterMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ConcurrentDictionary<string, RateLimitEntry> _clients = new();
    private readonly int _maxRequests;
    private readonly TimeSpan _window;

    public RateLimiterMiddleware(RequestDelegate next, int maxRequests = 20, int windowSeconds = 60)
    {
        _next = next;
        _maxRequests = maxRequests;
        _window = TimeSpan.FromSeconds(windowSeconds);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        if (!path.StartsWith("/api/auth/"))
        {
            await _next(context);
            return;
        }

        var key = $"{context.Connection.RemoteIpAddress}:{path}";
        var now = DateTime.UtcNow;

        var entry = _clients.GetOrAdd(key, _ => new RateLimitEntry { Count = 0, WindowStart = now });

        lock (entry)
        {
            if (now - entry.WindowStart > _window)
            {
                entry.Count = 0;
                entry.WindowStart = now;
            }

            entry.Count++;

            if (entry.Count > _maxRequests)
            {
                context.Response.StatusCode = 429;
                context.Response.ContentType = "application/json";
                context.Response.WriteAsync("{\"detail\":\"Too many requests. Please try again later.\"}");
                return;
            }
        }

        await _next(context);
    }

    private class RateLimitEntry
    {
        public int Count;
        public DateTime WindowStart;
    }
}

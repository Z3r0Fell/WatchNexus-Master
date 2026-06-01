namespace WatchNexus.Core.Middleware;

public class CsrfMiddleware
{
    private readonly RequestDelegate _next;

    public CsrfMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";

        // Only validate state-changing methods on API routes
        if (path.StartsWith("/api/") &&
            !path.StartsWith("/api/auth/login") &&
            !path.StartsWith("/api/auth/register") &&
            context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE")
        {
            var origin = context.Request.Headers["Origin"].FirstOrDefault();
            var referer = context.Request.Headers["Referer"].FirstOrDefault();

            // If neither Origin nor Referer is present, allow (browser always sends one)
            if (origin != null || referer != null)
            {
                var allowedHosts = new[] { "localhost:8001", "127.0.0.1:8001", "localhost:3000" };
                var source = origin ?? referer;
                if (source != null && Uri.TryCreate(source, UriKind.Absolute, out var uri))
                {
                    var host = uri.Authority;
                    if (!allowedHosts.Any(h => host.EndsWith(h, StringComparison.OrdinalIgnoreCase)))
                    {
                        context.Response.StatusCode = 403;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsync("{\"detail\":\"CSRF check failed: unrecognized origin\"}");
                        return;
                    }
                }
            }
        }

        await _next(context);
    }
}

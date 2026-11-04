using Microsoft.AspNetCore.Http;

namespace WatchNexus.Core.Services;

/// <summary>
/// Cache policy for the bundled React SPA.
/// The HTML shell is always revalidated so upgrades take effect immediately;
/// fingerprinted assets under /static/ are immutable.
/// </summary>
public static class SpaCacheHeaders
{
    public static void Apply(HttpContext context)
    {
        var path = context.Request.Path;
        if (path.StartsWithSegments("/static"))
        {
            context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            return;
        }
        var value = path.Value ?? "/";
        if (value == "/" || value.EndsWith(".html", StringComparison.OrdinalIgnoreCase)
            || value.EndsWith("manifest.json", StringComparison.OrdinalIgnoreCase)
            || value.EndsWith("asset-manifest.json", StringComparison.OrdinalIgnoreCase))
        {
            ApplyNoCache(context);
        }
    }

    public static void ApplyNoCache(HttpContext context)
    {
        context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        context.Response.Headers.Pragma = "no-cache";
        context.Response.Headers.Expires = "0";
    }

    /// <summary>
    /// True for paths that look like build assets rather than client-side routes.
    /// Client routes (/movies, /watch/abc-123) have no file extension in the last segment.
    /// </summary>
    public static bool IsAssetRequest(PathString path)
    {
        if (path.StartsWithSegments("/static")) return true;
        var value = path.Value;
        if (string.IsNullOrEmpty(value)) return false;
        var last = value[(value.LastIndexOf('/') + 1)..];
        var dot = last.LastIndexOf('.');
        if (dot <= 0 || dot == last.Length - 1) return false;
        var ext = last[(dot + 1)..].ToLowerInvariant();
        return ext is "js" or "mjs" or "css" or "map" or "json" or "png" or "jpg" or "jpeg"
            or "gif" or "svg" or "ico" or "webp" or "woff" or "woff2" or "ttf" or "txt" or "wasm";
    }
}

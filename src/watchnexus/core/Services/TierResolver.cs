using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Services;

public interface ITierResolver
{
    Task<string> GetCurrentTier();
}

public class TierResolver : ITierResolver
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private const string CacheKey = "current_tier";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public TierResolver(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<string> GetCurrentTier()
    {
        if (_cache.TryGetValue(CacheKey, out string? cached) && cached != null)
            return cached;

        var envTier = Environment.GetEnvironmentVariable("WATCHNEXUS_TIER")?.ToLower();
        if (envTier == "pro" || envTier == "ultra")
        {
            _cache.Set(CacheKey, envTier, CacheTtl);
            return envTier;
        }

        try
        {
            var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
            if (setting?.Value != null)
            {
                var doc = JsonDocument.Parse(setting.Value).RootElement;
                var tier = doc.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
                _cache.Set(CacheKey, tier, CacheTtl);
                return tier;
            }
        }
        catch (Exception ex)
        {
            Error(ex, "[TierResolver] DB query failed, falling back to standard");
        }

        _cache.Set(CacheKey, "standard", CacheTtl);
        return "standard";
    }
}

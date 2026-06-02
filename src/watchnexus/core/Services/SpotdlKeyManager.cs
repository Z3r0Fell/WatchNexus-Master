using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Services;

/// <summary>
/// Manages Spotify API key rotation for spotdl downloads.
/// Keys come from two sources:
///   1. Environment variables SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (always preferred)
///   2. Database SpotdlKeys table (user-added keys)
/// Round-robins through active keys, handles failure tracking and auto-deactivation.
/// </summary>
public class SpotdlKeyManager
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly object _lock = new();

    // Ephemeral env-var based key
    private string? _envClientId;
    private string? _envClientSecret;

    public SpotdlKeyManager(IServiceProvider services, IConfiguration config)
    {
        _services = services;
        _config = config;
        _envClientId = Environment.GetEnvironmentVariable("SPOTIFY_CLIENT_ID");
        _envClientSecret = Environment.GetEnvironmentVariable("SPOTIFY_CLIENT_SECRET");
    }

    /// <summary>
    /// Returns the next active key for the given service in round-robin fashion.
    /// Returns null if no active keys are available.
    /// </summary>
    public async Task<SpotdlKeyResult?> GetNextActiveKey(string service = "spotify")
    {
        // First check env vars — these are always preferred and never fail-rotated
        if (!string.IsNullOrEmpty(_envClientId) && !string.IsNullOrEmpty(_envClientSecret))
        {
            return new SpotdlKeyResult
            {
                Id = "__env__",
                ClientId = _envClientId,
                ClientSecret = _envClientSecret,
                Service = "spotify",
                IsEnvKey = true
            };
        }

        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var keys = await db.SpotdlKeys
            .Where(k => k.Service == service && k.IsActive)
            .OrderBy(k => k.LastUsedAt)
            .ToListAsync();

        if (keys.Count == 0) return null;

        // Round-robin: pick the least recently used key
        var key = keys[0];
        key.LastUsedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return new SpotdlKeyResult
        {
            Id = key.Id,
            RawValue = key.KeyValue,
            Service = key.Service,
            IsEnvKey = false
        };
    }

    /// <summary>
    /// Mark a key as failed. Increments failure count and deactivates if over threshold.
    /// </summary>
    public async Task MarkKeyFailed(string keyId)
    {
        if (keyId == "__env__")
        {
            // Environment key failed — clear it so we fall through to DB keys
            _envClientId = null;
            _envClientSecret = null;
            Warn("[SpotdlKeyManager] Env var SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET failed — falling back to DB keys");
            return;
        }

        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var key = await db.SpotdlKeys.FindAsync(keyId);
        if (key == null) return;

        key.FailureCount++;
        key.LastUsedAt = DateTime.UtcNow;
        if (key.FailureCount >= key.MaxFailures)
        {
            key.IsActive = false;
            Warn($"[SpotdlKeyManager] Key {key.Id} deactivated after {key.FailureCount} failures");
        }

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Reset failure count for a key (called when a download succeeds with this key).
    /// </summary>
    public async Task ResetKeyFailure(string keyId)
    {
        if (keyId == "__env__") return;

        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var key = await db.SpotdlKeys.FindAsync(keyId);
        if (key == null) return;

        key.FailureCount = 0;
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Add a new API key to the database.
    /// </summary>
    public async Task<SpotdlKey> AddKey(string keyValue, string service)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var key = new SpotdlKey
        {
            KeyValue = keyValue,
            Service = service,
            IsActive = true,
            MaxFailures = 5
        };
        db.SpotdlKeys.Add(key);
        await db.SaveChangesAsync();
        return key;
    }

    /// <summary>
    /// Remove a key from the database.
    /// </summary>
    public async Task<bool> RemoveKey(string keyId)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var key = await db.SpotdlKeys.FindAsync(keyId);
        if (key == null) return false;
        db.SpotdlKeys.Remove(key);
        await db.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Get all keys with masked values (first 4 chars only).
    /// </summary>
    public async Task<List<SpotdlKeyInfo>> GetKeys(string service = "spotify")
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var keys = await db.SpotdlKeys
            .Where(k => k.Service == service)
            .OrderByDescending(k => k.CreatedAt)
            .ToListAsync();

        var result = keys.Select(k => new SpotdlKeyInfo
        {
            Id = k.Id,
            Preview = k.KeyValue.Length > 4 ? k.KeyValue[..4] + "****" : "****",
            Service = k.Service,
            IsActive = k.IsActive,
            FailureCount = k.FailureCount,
            MaxFailures = k.MaxFailures,
            LastUsedAt = k.LastUsedAt,
            CreatedAt = k.CreatedAt
        }).ToList();

        // Add env var key info if present
        if (!string.IsNullOrEmpty(_envClientId))
        {
            result.Insert(0, new SpotdlKeyInfo
            {
                Id = "__env__",
                Preview = _envClientId[..4] + "****",
                Service = "spotify",
                IsActive = true,
                IsEnvKey = true,
                CreatedAt = DateTime.MinValue
            });
        }

        return result;
    }
}

public class SpotdlKeyResult
{
    public string Id { get; set; } = "";
    public string? RawValue { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string Service { get; set; } = "spotify";
    public bool IsEnvKey { get; set; }
}

public class SpotdlKeyInfo
{
    public string Id { get; set; } = "";
    public string Preview { get; set; } = "";
    public string Service { get; set; } = "spotify";
    public bool IsActive { get; set; }
    public bool IsEnvKey { get; set; }
    public int FailureCount { get; set; }
    public int MaxFailures { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

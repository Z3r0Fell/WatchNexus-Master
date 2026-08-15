using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;

namespace WatchNexus.Core;

/// <summary>
/// Fortress — WatchNexus code protection and integrity system.
/// Provides assembly hash verification, runtime anti-tampering checks,
/// and license/activation validation.
/// </summary>
public static class Fortress
{
    private static readonly Dictionary<string, string> _assemblyHashes = new();
    private static readonly List<AuditEntry> _auditLog = new();
    private static readonly object _auditLock = new();
    private static bool _initialized;
    private static string _fortressDataPath = "";
    private static FortressConfig _config = new();
    public static Action<string>? Logger { get; set; }

    private static void Log(string msg) => Logger?.Invoke(msg);

    public static bool IsIntact { get; private set; } = true;
    public static string Status => _initialized ? (IsIntact ? "secure" : "tampered") : "uninitialized";

    /// <summary>Initialize Fortress at startup — computes baseline hashes and validates license</summary>
    public static void Initialize(WebApplication app)
    {
        Log("[Fortress] Initializing code protection...");

        // Set up data directory
        _fortressDataPath = Path.Combine(AppContext.BaseDirectory, "data", "fortress");
        Directory.CreateDirectory(_fortressDataPath);

        // Load persisted audit log from disk
        LoadAuditLog();

        // Load or create config
        LoadConfig();

        // 1. Assembly integrity: compute and store baseline SHA-256 hashes
        ComputeAssemblyBaselines();

        // 2. License/activation validation
        ValidateActivation();

        // 3. Register middleware for runtime integrity checks
        app.Use(async (context, next) =>
        {
            // Periodic runtime check on API requests (every 100th request to minimize overhead)
            if (context.Request.Path.StartsWithSegments("/api") && Interlocked.Increment(ref _requestCounter) % 10 == 0)
            {
                PerformRuntimeCheck();
            }

            if (!IsIntact && context.Request.Path.StartsWithSegments("/api")
                && !context.Request.Path.StartsWithSegments("/api/auth")
                && !context.Request.Path.StartsWithSegments("/api/fortress"))
            {
                context.Response.StatusCode = 503;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    error = "integrity_violation",
                    message = "Fortress has detected a code integrity issue. Service is locked."
                }));
                return;
            }

            await next();
        });

        // NOTE: /api/fortress/status and /api/fortress/verify are served by the
        // richer DB-backed FortressController (Controllers/FortressController.cs).
        // They were previously ALSO mapped here as Minimal API endpoints, which
        // caused an AmbiguousMatchException (HTTP 500) on every call. Removed.
        // The runtime anti-tamper middleware registered above still runs.

        // Map Fortress audit log endpoint (no controller equivalent)
        app.MapGet("/api/fortress/audit", (int? limit, int? offset) =>
        {
            var take = Math.Clamp(limit ?? 50, 1, 500);
            var skip = Math.Max(offset ?? 0, 0);

            List<AuditEntry> entries;
            int total;
            lock (_auditLock)
            {
                total = _auditLog.Count;
                entries = _auditLog
                    .OrderByDescending(e => e.Timestamp)
                    .Skip(skip).Take(take).ToList();
            }

            return Results.Ok(new
            {
                total,
                offset = skip,
                limit = take,
                entries = entries.Select(e => new
                {
                    timestamp = e.Timestamp.ToString("o"),
                    action = e.Action,
                    result = e.Result,
                    detail = e.Detail,
                    instanceId = e.InstanceId
                })
            });
        }).RequireAuthorization(policy => policy.RequireRole("admin"));

        // 7. Map Fortress audit export (full log as JSON download) — admin only
        app.MapGet("/api/fortress/audit/export", () =>
        {
            List<AuditEntry> entries;
            lock (_auditLock) { entries = _auditLog.ToList(); }
            var json = JsonSerializer.Serialize(entries, new JsonSerializerOptions { WriteIndented = true });
            return Results.Text(json, "application/json");
        }).RequireAuthorization(policy => policy.RequireRole("admin"));

        // Record startup in audit log
        RecordAudit("startup", "pass", $"Fortress initialized — tracking {_assemblyHashes.Count} assemblies, instance {_config.InstanceId}");

        _initialized = true;
        Log($"[Fortress] Protection active — tracking {_assemblyHashes.Count} assemblies, instance {_config.InstanceId}");
    }

    // ── Assembly Integrity ──────────────────────────────────────

    private static void ComputeAssemblyBaselines()
    {
        _assemblyHashes.Clear();

        // Track the main application assembly
        var entryAssembly = Assembly.GetEntryAssembly();
        if (entryAssembly?.Location != null && File.Exists(entryAssembly.Location))
        {
            var hash = ComputeFileHash(entryAssembly.Location);
            _assemblyHashes[entryAssembly.GetName().Name ?? "entry"] = hash;
        }

        // Track all loaded WatchNexus assemblies
        foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
        {
            var name = assembly.GetName().Name;
            if (name == null || !name.StartsWith("WatchNexus")) continue;
            if (assembly.IsDynamic || string.IsNullOrEmpty(assembly.Location)) continue;
            if (!File.Exists(assembly.Location)) continue;

            var hash = ComputeFileHash(assembly.Location);
            _assemblyHashes[name] = hash;
        }

        // Save baseline hashes for comparison
        SaveBaseline();
    }

    private static string ComputeFileHash(string filePath)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(filePath);
        var hashBytes = sha256.ComputeHash(stream);
        return Convert.ToHexStringLower(hashBytes);
    }

    private static List<object> VerifyAllAssemblies()
    {
        var results = new List<object>();
        var allIntact = true;

        foreach (var (name, expectedHash) in _assemblyHashes)
        {
            var assembly = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => a.GetName().Name == name);

            if (assembly == null || assembly.IsDynamic || string.IsNullOrEmpty(assembly.Location))
            {
                results.Add(new { name, status = "unloaded", intact = true });
                continue;
            }

            if (!File.Exists(assembly.Location))
            {
                results.Add(new { name, status = "missing", intact = false });
                allIntact = false;
                continue;
            }

            var currentHash = ComputeFileHash(assembly.Location);
            var intact = currentHash == expectedHash;
            if (!intact) allIntact = false;

            results.Add(new
            {
                name,
                status = intact ? "verified" : "modified",
                intact,
                expectedHash = expectedHash[..12] + "...",
                currentHash = currentHash[..12] + "..."
            });
        }

        IsIntact = allIntact;
        _lastCheckTime = DateTime.UtcNow;

        return results;
    }

    // ── Runtime Anti-Tampering ───────────────────────────────────

    private static int _requestCounter;
    private static DateTime? _lastCheckTime;

    private static void PerformRuntimeCheck()
    {
        try
        {
            var entryAssembly = Assembly.GetEntryAssembly();
            if (entryAssembly?.Location != null && File.Exists(entryAssembly.Location))
            {
                var name = entryAssembly.GetName().Name ?? "entry";
                if (_assemblyHashes.TryGetValue(name, out var expectedHash))
                {
                    var currentHash = ComputeFileHash(entryAssembly.Location);
                    if (currentHash != expectedHash)
                    {
                        Log("[Fortress] ALERT: Entry assembly tampering detected!");
                        IsIntact = false;
                        RecordAudit("runtime_check", "fail", $"Assembly {name} hash mismatch");
                    }
                }
            }

            var fortressType = typeof(Fortress);
            var isIntactField = fortressType.GetProperty(nameof(IsIntact));
            if (isIntactField == null)
            {
                Log("[Fortress] ALERT: Fortress type structure has been modified!");
                IsIntact = false;
                RecordAudit("runtime_check", "fail", "Fortress type structure modified");
            }

            RecordAudit("runtime_check", "pass", $"Request #{_requestCounter}");
            _lastCheckTime = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            Log($"[Fortress] Runtime check error: {ex.Message}");
            RecordAudit("runtime_check", "error", ex.Message);
        }
    }

    // ── License / Activation ────────────────────────────────────

    private static void ValidateActivation()
    {
        if (string.IsNullOrEmpty(_config.InstanceId))
        {
            _config.InstanceId = GenerateInstanceId();
            _config.IsActivated = true;
            _config.ActivatedAt = DateTime.UtcNow.ToString("o");
            _config.LicenseType = "self-hosted";
            SaveConfig();
            Log($"[Fortress] New instance activated: {_config.InstanceId}");
            RecordAudit("activation", "new", $"Instance {_config.InstanceId} activated");
        }
        else
        {
            var expectedId = GenerateInstanceId();
            if (_config.InstanceId != expectedId)
            {
                Log("[Fortress] WARNING: Instance ID mismatch — hardware/environment changed");
                Log("[Fortress] Re-activating for current environment...");
                RecordAudit("activation", "reactivated", $"Environment changed: {_config.InstanceId} -> {expectedId}");
                _config.InstanceId = expectedId;
                _config.ActivatedAt = DateTime.UtcNow.ToString("o");
                SaveConfig();
            }
            else
            {
                RecordAudit("activation", "verified", $"Instance {_config.InstanceId} valid");
            }
            Log($"[Fortress] Instance verified: {_config.InstanceId}");
        }
    }

    private static string GenerateInstanceId()
    {
        // Derive a stable instance ID from machine-specific properties
        var components = new StringBuilder();
        components.Append(Environment.MachineName);
        components.Append('|');
        components.Append(Environment.OSVersion.Platform);
        components.Append('|');
        components.Append(Environment.ProcessorCount);
        components.Append('|');
        components.Append(AppContext.BaseDirectory);

        using var sha = SHA256.Create();
        var hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(components.ToString()));
        return $"WN-{Convert.ToHexStringLower(hashBytes)[..16]}";
    }

    // ── Persistence ─────────────────────────────────────────────

    private static void LoadConfig()
    {
        var configPath = Path.Combine(_fortressDataPath, "fortress.json");
        if (File.Exists(configPath))
        {
            try
            {
                var json = File.ReadAllText(configPath);
                _config = JsonSerializer.Deserialize<FortressConfig>(json) ?? new FortressConfig();
            }
            catch
            {
                _config = new FortressConfig();
            }
        }
    }

    private static void SaveConfig()
    {
        try
        {
            var configPath = Path.Combine(_fortressDataPath, "fortress.json");
            var json = JsonSerializer.Serialize(_config, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(configPath, json);
        }
        catch (Exception ex)
        {
            Log($"[Fortress] Failed to save config: {ex.Message}");
        }
    }

    private static void SaveBaseline()
    {
        try
        {
            var baselinePath = Path.Combine(_fortressDataPath, "baseline.json");
            var json = JsonSerializer.Serialize(_assemblyHashes, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(baselinePath, json);
        }
        catch (Exception ex)
        {
            Log($"[Fortress] Failed to save baseline: {ex.Message}");
        }
    }

    // ── Audit Log ───────────────────────────────────────────────

    private static void LoadAuditLog()
    {
        try
        {
            var auditPath = Path.Combine(_fortressDataPath, "audit.jsonl");
            if (!File.Exists(auditPath)) return;

            var lines = File.ReadAllLines(auditPath);
            var loaded = 0;
            foreach (var line in lines)
            {
                try
                {
                    var entry = JsonSerializer.Deserialize<AuditEntry>(line);
                    if (entry != null)
                    {
                        lock (_auditLock)
                        {
                            _auditLog.Add(entry);
                        }
                        loaded++;
                    }
                }
                catch { /* skip corrupt lines */ }
            }
            Log($"[Fortress] Loaded {loaded} audit entries from disk");
        }
        catch (Exception ex)
        {
            Log($"[Fortress] Failed to load audit log: {ex.Message}");
        }
    }

    private static void RecordAudit(string action, string result, string detail)
    {
        var entry = new AuditEntry
        {
            Timestamp = DateTime.UtcNow,
            Action = action,
            Result = result,
            Detail = detail,
            InstanceId = _config.InstanceId
        };

        lock (_auditLock)
        {
            _auditLog.Add(entry);
            // Cap in-memory log at 10,000 entries
            if (_auditLog.Count > 10_000)
                _auditLog.RemoveRange(0, _auditLog.Count - 10_000);
        }

        // Persist to disk (append to JSONL file)
        try
        {
            var auditPath = Path.Combine(_fortressDataPath, "audit.jsonl");
            var line = JsonSerializer.Serialize(entry) + "\n";
            File.AppendAllText(auditPath, line);
        }
        catch { /* non-critical */ }
    }
}

internal class AuditEntry
{
    public DateTime Timestamp { get; set; }
    public string Action { get; set; } = "";
    public string Result { get; set; } = "";
    public string Detail { get; set; } = "";
    public string InstanceId { get; set; } = "";
}

internal class FortressConfig
{
    public string InstanceId { get; set; } = "";
    public bool IsActivated { get; set; }
    public string ActivatedAt { get; set; } = "";
    public string LicenseType { get; set; } = "";
}

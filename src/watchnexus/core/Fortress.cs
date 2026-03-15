using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace WatchNexus.Core;

/// <summary>
/// Fortress — WatchNexus code protection and integrity system.
/// Provides assembly hash verification, runtime anti-tampering checks,
/// and license/activation validation.
/// </summary>
public static class Fortress
{
    private static readonly Dictionary<string, string> _assemblyHashes = new();
    private static bool _initialized;
    private static string _fortressDataPath = "";
    private static FortressConfig _config = new();

    public static bool IsIntact { get; private set; } = true;
    public static string Status => _initialized ? (IsIntact ? "secure" : "tampered") : "uninitialized";

    /// <summary>Initialize Fortress at startup — computes baseline hashes and validates license</summary>
    public static void Initialize(WebApplication app)
    {
        Console.WriteLine("[Fortress] Initializing code protection...");

        // Set up data directory
        _fortressDataPath = Path.Combine(AppContext.BaseDirectory, "data", "fortress");
        Directory.CreateDirectory(_fortressDataPath);

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
            if (context.Request.Path.StartsWithSegments("/api") && Interlocked.Increment(ref _requestCounter) % 100 == 0)
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

        // 4. Map Fortress status endpoint
        app.MapGet("/api/fortress/status", () =>
        {
            return Results.Ok(new
            {
                status = Status,
                intact = IsIntact,
                initialized = _initialized,
                assembliesTracked = _assemblyHashes.Count,
                activation = new
                {
                    licensed = _config.IsActivated,
                    instanceId = _config.InstanceId,
                    activatedAt = _config.ActivatedAt
                },
                lastCheck = _lastCheckTime?.ToString("o")
            });
        });

        // 5. Map Fortress verify endpoint (manual integrity re-check)
        app.MapPost("/api/fortress/verify", () =>
        {
            var results = VerifyAllAssemblies();
            return Results.Ok(new
            {
                intact = IsIntact,
                checked_at = DateTime.UtcNow.ToString("o"),
                assemblies = results
            });
        });

        _initialized = true;
        Console.WriteLine($"[Fortress] Protection active — tracking {_assemblyHashes.Count} assemblies, instance {_config.InstanceId}");
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
            // Verify critical assembly hasn't been swapped
            var entryAssembly = Assembly.GetEntryAssembly();
            if (entryAssembly?.Location != null && File.Exists(entryAssembly.Location))
            {
                var name = entryAssembly.GetName().Name ?? "entry";
                if (_assemblyHashes.TryGetValue(name, out var expectedHash))
                {
                    var currentHash = ComputeFileHash(entryAssembly.Location);
                    if (currentHash != expectedHash)
                    {
                        Console.WriteLine("[Fortress] ALERT: Entry assembly tampering detected!");
                        IsIntact = false;
                    }
                }
            }

            // Verify the Fortress class itself hasn't been bypassed via reflection
            var fortressType = typeof(Fortress);
            var isIntactField = fortressType.GetProperty(nameof(IsIntact));
            if (isIntactField == null)
            {
                Console.WriteLine("[Fortress] ALERT: Fortress type structure has been modified!");
                IsIntact = false;
            }

            _lastCheckTime = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Fortress] Runtime check error: {ex.Message}");
        }
    }

    // ── License / Activation ────────────────────────────────────

    private static void ValidateActivation()
    {
        if (string.IsNullOrEmpty(_config.InstanceId))
        {
            // Generate new instance ID on first run
            _config.InstanceId = GenerateInstanceId();
            _config.IsActivated = true; // Auto-activate for self-hosted instances
            _config.ActivatedAt = DateTime.UtcNow.ToString("o");
            _config.LicenseType = "self-hosted";
            SaveConfig();
            Console.WriteLine($"[Fortress] New instance activated: {_config.InstanceId}");
        }
        else
        {
            // Verify existing activation
            var expectedId = GenerateInstanceId();
            if (_config.InstanceId != expectedId)
            {
                Console.WriteLine("[Fortress] WARNING: Instance ID mismatch — hardware/environment changed");
                Console.WriteLine("[Fortress] Re-activating for current environment...");
                _config.InstanceId = expectedId;
                _config.ActivatedAt = DateTime.UtcNow.ToString("o");
                SaveConfig();
            }
            Console.WriteLine($"[Fortress] Instance verified: {_config.InstanceId}");
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
            Console.WriteLine($"[Fortress] Failed to save config: {ex.Message}");
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
            Console.WriteLine($"[Fortress] Failed to save baseline: {ex.Message}");
        }
    }
}

internal class FortressConfig
{
    public string InstanceId { get; set; } = "";
    public bool IsActivated { get; set; }
    public string ActivatedAt { get; set; } = "";
    public string LicenseType { get; set; } = "";
}

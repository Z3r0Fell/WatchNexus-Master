using System.Diagnostics;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using WatchNexus.Shared;

namespace WatchNexus.Core;

/// <summary>Discovers, compiles, and loads WatchNexus modules from the modules and separated directories</summary>
public static class ModuleLoader
{
    private static readonly List<IWatchNexusModule> _loadedModules = new();
    private static readonly List<IWatchNexusModule> _separatedModules = new();
    private static readonly List<ModuleManifest> _discoveredManifests = new();
    public static Action<string>? Logger { get; set; }

    private static void Log(string msg) => Logger?.Invoke(msg);

    public static IReadOnlyList<IWatchNexusModule> LoadedModules => _loadedModules;
    public static IReadOnlyList<IWatchNexusModule> SeparatedModules => _separatedModules;
    public static IReadOnlyList<ModuleManifest> DiscoveredManifests => _discoveredManifests;

    private static readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Discovers modules from the built-in modules directory (manifest + optional pre-built DLL)</summary>
    public static void DiscoverAndRegister(IServiceCollection services, string modulesPath)
    {
        if (!Directory.Exists(modulesPath))
        {
            Log($"[ModuleLoader] Modules directory not found: {modulesPath}");
            return;
        }

        Log($"[ModuleLoader] Scanning built-in modules: {modulesPath}");

        foreach (var dir in Directory.GetDirectories(modulesPath))
        {
            var manifestPath = Path.Combine(dir, "module.json");
            if (!File.Exists(manifestPath)) continue;

            try
            {
                var json = File.ReadAllText(manifestPath);
                var manifest = JsonSerializer.Deserialize<ModuleManifest>(json, _jsonOpts);
                if (manifest == null) continue;

                _discoveredManifests.Add(manifest);
                ModuleRegistry.Register(manifest);

                // Try to load a pre-compiled module DLL
                var dllPath = Path.Combine(dir, $"WatchNexus.Module.{manifest.Name}.dll");
                if (File.Exists(dllPath))
                {
                    var module = LoadModuleFromDll(dllPath);
                    if (module != null)
                    {
                        module.ConfigureServices(services);
                        _loadedModules.Add(module);
                        Log($"[ModuleLoader]   {manifest.DisplayName} v{manifest.Version} (external DLL)");
                        continue;
                    }
                }

                // No DLL — register as built-in (controller already mapped by MapControllers)
                var builtIn = new BuiltInModule(manifest);
                _loadedModules.Add(builtIn);
                Log($"[ModuleLoader]   {manifest.DisplayName} v{manifest.Version} (built-in)");
            }
            catch (Exception ex)
            {
                Log($"[ModuleLoader] Error loading module from {dir}: {ex.Message}");
            }
        }

        Log($"[ModuleLoader] {_discoveredManifests.Count} modules discovered, {_loadedModules.Count} loaded ({_loadedModules.Count(m => m is BuiltInModule)} built-in, {_loadedModules.Count(m => !(m is BuiltInModule))} external DLL)");
    }

    /// <summary>Scans the separated/ directory, compiles each module via dotnet build, and loads the resulting DLL</summary>
    public static void CompileAndLoadSeparated(IServiceCollection services, string separatedPath)
    {
        if (!Directory.Exists(separatedPath))
        {
            Log($"[ModuleLoader] Separated directory not found: {separatedPath}");
            return;
        }

        Log($"[ModuleLoader] Scanning separated modules: {separatedPath}");

        foreach (var dir in Directory.GetDirectories(separatedPath))
        {
            var manifestPath = Path.Combine(dir, "module.json");
            if (!File.Exists(manifestPath)) continue;

            try
            {
                var json = File.ReadAllText(manifestPath);
                var manifest = JsonSerializer.Deserialize<ModuleManifest>(json, _jsonOpts);
                if (manifest == null) continue;

                _discoveredManifests.Add(manifest);

                // Look for a .csproj file in the directory
                var csprojFiles = Directory.GetFiles(dir, "*.csproj");
                if (csprojFiles.Length == 0)
                {
                        Log($"[ModuleLoader]   {manifest.DisplayName}: No .csproj found, skipping compilation");
                    continue;
                }

                var csprojPath = csprojFiles[0];
                var projectName = Path.GetFileNameWithoutExtension(csprojPath);

                // Check for pre-built DLL first (avoid recompilation if already built)
                var expectedDll = Path.Combine(dir, "bin", "Release", "net10.0", $"{projectName}.dll");
                if (!File.Exists(expectedDll))
                    expectedDll = Path.Combine(dir, "bin", "Debug", "net10.0", $"{projectName}.dll");
                // Also check for a DLL shipped directly in the module directory
                if (!File.Exists(expectedDll))
                    expectedDll = Path.Combine(dir, $"{projectName}.dll");

                // Compile if no DLL exists and dotnet is available
                if (!File.Exists(expectedDll))
                {
                    var dotnetPath = FindDotnetPath();
                    if (dotnetPath == null)
                    {
                        Log($"[ModuleLoader]   {manifest.DisplayName}: No pre-built DLL and dotnet SDK not available, skipping");
                        continue;
                    }

                    Log($"[ModuleLoader]   Compiling {manifest.DisplayName}...");
                    var compiled = CompileModule(csprojPath, dir);
                    if (!compiled)
                    {
                        Log($"[ModuleLoader]   {manifest.DisplayName}: Compilation failed, skipping");
                        continue;
                    }

                    // Find the output DLL after compilation
                    expectedDll = Path.Combine(dir, "bin", "Release", "net10.0", $"{projectName}.dll");
                    if (!File.Exists(expectedDll))
                        expectedDll = Path.Combine(dir, "bin", "Debug", "net10.0", $"{projectName}.dll");
                }

                if (!File.Exists(expectedDll))
                {
                        Log($"[ModuleLoader]   {manifest.DisplayName}: Built but DLL not found at expected path");
                    continue;
                }

                // Load the compiled DLL
                var module = LoadModuleFromDll(expectedDll);
                if (module != null)
                {
                    module.ConfigureServices(services);
                    _separatedModules.Add(module);
                    Log($"[ModuleLoader]   {manifest.DisplayName} v{manifest.Version} (separated, compiled)");
                }
                else
                {
                    Log($"[ModuleLoader]   {manifest.DisplayName}: DLL loaded but no IWatchNexusModule found");
                }
            }
            catch (Exception ex)
            {
                        Log($"[ModuleLoader] Error with separated module {dir}: {ex.Message}");
            }
        }

        Log($"[ModuleLoader] Separated: {_separatedModules.Count} modules compiled and loaded");
    }

    /// <summary>Maps routes for all loaded modules (external + separated)</summary>
    public static void MapAllRoutes(IEndpointRouteBuilder routes)
    {
        foreach (var module in _loadedModules.Concat(_separatedModules))
        {
            try
            {
                module.MapRoutes(routes);
            }
            catch (Exception ex)
            {
                Log($"[ModuleLoader] Error mapping routes for {module.Manifest.DisplayName}: {ex.Message}");
            }
        }
    }

    /// <summary>Gets a combined list of all loaded module manifests (for status/health endpoints)</summary>
    public static List<object> GetModuleStatus()
    {
        var result = new List<object>();
        foreach (var manifest in _discoveredManifests)
        {
            var isLoaded = _loadedModules.Any(m => m.Manifest.Name == manifest.Name)
                        || _separatedModules.Any(m => m.Manifest.Name == manifest.Name);
            result.Add(new
            {
                name = manifest.Name,
                displayName = manifest.DisplayName,
                version = manifest.Version,
                description = manifest.Description,
                codename = manifest.Codename,
                loaded = isLoaded,
                source = _separatedModules.Any(m => m.Manifest.Name == manifest.Name) ? "separated"
                       : _loadedModules.Any(m => m.Manifest.Name == manifest.Name) ? "external"
                       : "built-in"
            });
        }
        return result;
    }

    // ── Private helpers ──────────────────────────────────────────

    private static IWatchNexusModule? LoadModuleFromDll(string dllPath)
    {
        try
        {
            var loadContext = new ModuleLoadContext(dllPath);
            var assembly = loadContext.LoadFromAssemblyPath(Path.GetFullPath(dllPath));
            var moduleType = assembly.GetTypes()
                .FirstOrDefault(t => typeof(IWatchNexusModule).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);

            if (moduleType == null) return null;

            return (IWatchNexusModule)Activator.CreateInstance(moduleType)!;
        }
        catch (Exception ex)
        {
            Log($"[ModuleLoader] Failed to load DLL {dllPath}: {ex.Message}");
            return null;
        }
    }

    private static bool CompileModule(string csprojPath, string workingDir)
    {
        try
        {
            var dotnetPath = FindDotnetPath();
            if (dotnetPath == null)
            {
                Log("[ModuleLoader] dotnet CLI not found, cannot compile separated modules");
                return false;
            }

            var psi = new ProcessStartInfo
            {
                FileName = dotnetPath,
                Arguments = $"build \"{csprojPath}\" -c Release --nologo -v quiet",
                WorkingDirectory = workingDir,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                Environment =
                {
                    ["DOTNET_ROOT"] = Path.GetDirectoryName(dotnetPath) ?? ""
                }
            };

            using var process = Process.Start(psi);
            if (process == null) return false;

            process.WaitForExit(60_000); // 60s timeout
            if (!process.HasExited)
            {
                process.Kill(true);
                return false;
            }

            if (process.ExitCode != 0)
            {
                var stderr = process.StandardError.ReadToEnd();
                if (!string.IsNullOrWhiteSpace(stderr))
                    Log($"[ModuleLoader] Build errors: {stderr.Trim()}");
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            Log($"[ModuleLoader] Compilation exception: {ex.Message}");
            return false;
        }
    }

    private static string? FindDotnetPath()
    {
        // Check known locations
        var candidates = new[]
        {
            "/opt/dotnet/dotnet",
            "/usr/share/dotnet/dotnet",
            "/usr/local/share/dotnet/dotnet",
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path)) return path;
        }

        // Check PATH
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "which",
                Arguments = "dotnet",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                var output = proc.StandardOutput.ReadToEnd().Trim();
                proc.WaitForExit(5000);
                if (proc.ExitCode == 0 && !string.IsNullOrEmpty(output))
                    return output;
            }
        }
        catch { }

        return null;
    }
}

/// <summary>Isolated assembly load context for module DLLs to avoid type conflicts</summary>
internal class ModuleLoadContext : AssemblyLoadContext
{
    private readonly AssemblyDependencyResolver _resolver;

    public ModuleLoadContext(string pluginPath) : base(isCollectible: true)
    {
        _resolver = new AssemblyDependencyResolver(pluginPath);
    }

    protected override Assembly? Load(AssemblyName assemblyName)
    {
        // Let shared framework assemblies resolve from the default context
        var defaultAssembly = Default.Assemblies.FirstOrDefault(a => a.GetName().Name == assemblyName.Name);
        if (defaultAssembly != null) return defaultAssembly;

        var assemblyPath = _resolver.ResolveAssemblyToPath(assemblyName);
        if (assemblyPath != null)
            return LoadFromAssemblyPath(assemblyPath);

        return null;
    }

    protected override IntPtr LoadUnmanagedDll(string unmanagedDllName)
    {
        var libraryPath = _resolver.ResolveUnmanagedDllToPath(unmanagedDllName);
        if (libraryPath != null)
            return LoadUnmanagedDllFromPath(libraryPath);

        return IntPtr.Zero;
    }
}

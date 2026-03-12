using System.Text.Json;
using WatchNexus.Shared;

namespace WatchNexus.Core;

/// <summary>Discovers and loads WatchNexus modules from the modules directory</summary>
public static class ModuleLoader
{
    private static readonly List<IWatchNexusModule> _loadedModules = new();
    private static readonly List<ModuleManifest> _discoveredManifests = new();
    public static IReadOnlyList<IWatchNexusModule> LoadedModules => _loadedModules;
    public static IReadOnlyList<ModuleManifest> DiscoveredManifests => _discoveredManifests;

    public static void DiscoverAndRegister(IServiceCollection services, string modulesPath)
    {
        if (!Directory.Exists(modulesPath))
        {
            Console.WriteLine($"[ModuleLoader] Modules directory not found: {modulesPath}");
            return;
        }

        Console.WriteLine($"[ModuleLoader] Scanning: {modulesPath}");

        foreach (var dir in Directory.GetDirectories(modulesPath))
        {
            var manifestPath = Path.Combine(dir, "module.json");
            if (!File.Exists(manifestPath)) continue;

            try
            {
                var json = File.ReadAllText(manifestPath);
                var manifest = JsonSerializer.Deserialize<ModuleManifest>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                if (manifest == null) continue;

                _discoveredManifests.Add(manifest);

                // Try to load a compiled module DLL (for external/third-party modules)
                var dllPath = Path.Combine(dir, $"WatchNexus.Module.{manifest.Name}.dll");
                if (File.Exists(dllPath))
                {
                    var assembly = System.Runtime.Loader.AssemblyLoadContext.Default.LoadFromAssemblyPath(dllPath);
                    var moduleType = assembly.GetTypes().FirstOrDefault(t => typeof(IWatchNexusModule).IsAssignableFrom(t) && !t.IsInterface);
                    if (moduleType != null)
                    {
                        var module = (IWatchNexusModule)Activator.CreateInstance(moduleType)!;
                        module.ConfigureServices(services);
                        _loadedModules.Add(module);
                        Console.WriteLine($"[ModuleLoader]   {manifest.DisplayName} v{manifest.Version} (external)");
                    }
                }
                else
                {
                    // Module manifest registered — code is built into core or in separated/
                    Console.WriteLine($"[ModuleLoader]   {manifest.DisplayName} v{manifest.Version} (registered)");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ModuleLoader] Error loading module from {dir}: {ex.Message}");
            }
        }

        Console.WriteLine($"[ModuleLoader] {_discoveredManifests.Count} modules discovered, {_loadedModules.Count} external DLLs loaded");
    }

    public static void MapAllRoutes(IEndpointRouteBuilder routes)
    {
        foreach (var module in _loadedModules)
        {
            try
            {
                module.MapRoutes(routes);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ModuleLoader] Error mapping routes for {module.Manifest.DisplayName}: {ex.Message}");
            }
        }
    }
}

using System.Text.Json;
using WatchNexus.Shared;

namespace WatchNexus.Core;

/// <summary>Discovers and loads WatchNexus modules from the modules directory</summary>
public static class ModuleLoader
{
    private static readonly List<IWatchNexusModule> _loadedModules = new();
    public static IReadOnlyList<IWatchNexusModule> LoadedModules => _loadedModules;

    public static void DiscoverAndRegister(IServiceCollection services, string modulesPath)
    {
        if (!Directory.Exists(modulesPath))
        {
            Console.WriteLine($"[ModuleLoader] Modules directory not found: {modulesPath}");
            return;
        }

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

                // Load the module assembly
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
                        Console.WriteLine($"[ModuleLoader] Loaded external module: {manifest.DisplayName} v{manifest.Version}");
                    }
                }
                else
                {
                    Console.WriteLine($"[ModuleLoader] Manifest found for '{manifest.DisplayName}' but no DLL at {dllPath}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ModuleLoader] Error loading module from {dir}: {ex.Message}");
            }
        }
    }

    public static void MapAllRoutes(IEndpointRouteBuilder routes)
    {
        foreach (var module in _loadedModules)
        {
            try
            {
                module.MapRoutes(routes);
                Console.WriteLine($"[ModuleLoader] Routes mapped for: {module.Manifest.DisplayName}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ModuleLoader] Error mapping routes for {module.Manifest.DisplayName}: {ex.Message}");
            }
        }
    }
}

using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace WatchNexus.Shared;

/// <summary>Module manifest loaded from module.json</summary>
public class ModuleManifest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("display_name")]
    public string DisplayName { get; set; } = "";

    [JsonPropertyName("version")]
    public string Version { get; set; } = "1.0.1";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("codename")]
    public string Codename { get; set; } = "";

    [JsonPropertyName("author")]
    public string Author { get; set; } = "WatchNexus";

    [JsonPropertyName("tier")]
    public string Tier { get; set; } = "standard";

    [JsonPropertyName("dependencies")]
    public string[] Dependencies { get; set; } = Array.Empty<string>();

    [JsonPropertyName("api_route_prefix")]
    public string ApiRoutePrefix { get; set; } = "";

    [JsonPropertyName("api_routes")]
    public string[] ApiRoutes { get; set; } = Array.Empty<string>();

    [JsonPropertyName("frontend_pages")]
    public string[] FrontendPages { get; set; } = Array.Empty<string>();

    [JsonPropertyName("type")]
    public string Type { get; set; } = "controller";
}

/// <summary>Interface every WatchNexus module must implement</summary>
public interface IWatchNexusModule
{
    ModuleManifest Manifest { get; }
    void ConfigureServices(IServiceCollection services);
    void MapRoutes(IEndpointRouteBuilder routes);
}

/// <summary>Built-in module wrapper for controllers already mapped by MapControllers()</summary>
public class BuiltInModule : IWatchNexusModule
{
    public ModuleManifest Manifest { get; }
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }

    public BuiltInModule(ModuleManifest manifest) => Manifest = manifest;
}

/// <summary>Global registry of all known modules (built-in + external)</summary>
public static class ModuleRegistry
{
    private static readonly Dictionary<string, ModuleManifest> _modules = new(StringComparer.OrdinalIgnoreCase);
    private static readonly Dictionary<string, string> _routeToCodename = new(StringComparer.OrdinalIgnoreCase);
    private static readonly object _lock = new();

    public static IReadOnlyDictionary<string, ModuleManifest> All => _modules;
    public static IReadOnlyDictionary<string, string> RouteMap => _routeToCodename;

    public static void Register(ModuleManifest manifest)
    {
        lock (_lock)
        {
            _modules[manifest.Codename] = manifest;
            if (!string.IsNullOrWhiteSpace(manifest.ApiRoutePrefix))
            {
                var prefix = manifest.ApiRoutePrefix.Trim('/').ToLowerInvariant();
                _routeToCodename[$"api/{prefix}"] = manifest.Codename;
            }
            foreach (var route in manifest.ApiRoutes ?? Array.Empty<string>())
            {
                var trimmed = route.Trim('/').ToLowerInvariant();
                _routeToCodename[trimmed] = manifest.Codename;
            }
        }
    }

    public static bool TryGetTier(string codename, out string? tier)
    {
        lock (_lock)
        {
            if (_modules.TryGetValue(codename, out var manifest))
            {
                tier = manifest.Tier;
                return true;
            }
        }
        tier = null;
        return false;
    }

    public static bool TryGetByRoute(string path, out string? codename)
    {
        lock (_lock)
        {
            var lower = path.Trim('/').ToLowerInvariant();
            if (_routeToCodename.TryGetValue(lower, out codename))
                return true;
            var segments = lower.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length >= 2 && segments[0] == "api")
            {
                if (_routeToCodename.TryGetValue($"api/{segments[1]}", out codename))
                    return true;
            }
        }
        codename = null;
        return false;
    }
}

/// <summary>Shared DB entities</summary>
public class AppUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = "";
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string? Avatar { get; set; }
    public string Role { get; set; } = "user";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AppSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
    public string? UserId { get; set; }
}

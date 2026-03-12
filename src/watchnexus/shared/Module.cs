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
    public string Version { get; set; } = "1.0.0";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("codename")]
    public string Codename { get; set; } = "";

    [JsonPropertyName("dependencies")]
    public string[] Dependencies { get; set; } = Array.Empty<string>();
}

/// <summary>Interface every WatchNexus module must implement</summary>
public interface IWatchNexusModule
{
    ModuleManifest Manifest { get; }
    void ConfigureServices(IServiceCollection services);
    void MapRoutes(IEndpointRouteBuilder routes);
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

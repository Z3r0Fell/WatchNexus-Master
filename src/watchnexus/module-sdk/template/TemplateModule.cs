using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Module.Template;

/// <summary>
/// Example WatchNexus module. Replace this implementation with your module logic.
/// </summary>
public class TemplateModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new ModuleManifest
    {
        Name = "Template",
        DisplayName = "Template Module",
        Version = "1.0.0",
        Description = "A starter module for WatchNexus. Replace this with your module description.",
        Codename = "template",
        Author = "Your Name",
        Tier = "standard",
        Dependencies = Array.Empty<string>(),
        ApiRoutePrefix = "template",
        ApiRoutes = new[]
        {
            "/api/template/status",
            "/api/template/hello"
        },
        FrontendPages = new[]
        {
            "TemplatePage"
        },
        Type = "controller"
    };

    public void ConfigureServices(IServiceCollection services)
    {
        // Register your module's services here (repositories, background workers, etc.)
        // services.AddScoped<IMyService, MyService>();
    }

    public void MapRoutes(IEndpointRouteBuilder routes)
    {
        var prefix = Manifest.ApiRoutePrefix;

        routes.MapGet($"{prefix}/status", () => Results.Json(new
        {
            module = Manifest.Codename,
            version = Manifest.Version,
            status = "active"
        })).WithName($"template-status");

        routes.MapGet($"{prefix}/hello", (string? name) => Results.Json(new
        {
            message = $"Hello, {name ?? "World"}! This is {Manifest.DisplayName} v{Manifest.Version}."
        })).WithName($"template-hello");
    }
}

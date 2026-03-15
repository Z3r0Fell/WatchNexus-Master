using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Syrup;

// ── Models ───────────────────────────────────────────────────
public class ScraperSource
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string Type { get; set; } = "iptv";
    public bool IsEnabled { get; set; } = true;
    public DateTime LastScraped { get; set; } = DateTime.UtcNow;
}

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api/syrup")]
[Authorize]
public class SyrupController : ControllerBase
{
    [HttpGet("sources")]
    public IActionResult GetSources() => Ok(Array.Empty<object>());

    [HttpPost("sources")]
    public IActionResult AddSource([FromBody] object req) =>
        Ok(new { id = Guid.NewGuid().ToString(), status = "added" });

    [HttpGet("streams")]
    public IActionResult GetStreams(string? category = null) =>
        Ok(new { streams = Array.Empty<object>(), total = 0 });

    [HttpPost("scrape")]
    public IActionResult TriggerScrape() =>
        Ok(new { status = "started", message = "Scrape initiated" });
}

// ── Module Registration ──────────────────────────────────────
public class SyrupModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Syrup", Codename = "syrup",
        DisplayName = "Live Scrapers", Version = "2.7.3",
        Description = "IPTV and live content scraper engine",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

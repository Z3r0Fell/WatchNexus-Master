using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Compote;

// ── Models ───────────────────────────────────────────────────
public class Indexer
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string Type { get; set; } = "torznab";
    public string? ApiKey { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTime LastChecked { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api/compote")]
[Authorize]
public class CompoteController : ControllerBase
{
    [HttpGet("indexers")]
    public IActionResult GetIndexers() => Ok(Array.Empty<object>());

    [HttpPost("indexers")]
    public IActionResult AddIndexer([FromBody] object req) =>
        Ok(new { id = Guid.NewGuid().ToString(), status = "added" });

    [HttpGet("search")]
    public IActionResult Search(string? q = null) =>
        Ok(new { results = Array.Empty<object>(), query = q, total = 0 });
}

// ── Module Registration ──────────────────────────────────────
public class CompoteModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Compote", Codename = "compote",
        DisplayName = "Indexer Manager", Version = "2.6.5",
        Description = "Torrent indexer management and search aggregation",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

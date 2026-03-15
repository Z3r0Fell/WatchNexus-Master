using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WatchNexus.Core.Controllers;

[Route("api/gadgets")]
[ApiController]
[Authorize]
public class GadgetsCatalogueController : ControllerBase
{
    [HttpGet("plugins")]
    public IActionResult Plugins() => Ok(new[]
    {
        new { id = "weather", name = "Weather", version = "1.0.0", author = "WatchNexus", status = "active", description = "Weather dashboard using Open-Meteo" },
        new { id = "podcasts", name = "Podcasts", version = "1.0.0", author = "WatchNexus", status = "active", description = "Podcast player with iTunes search and RSS" },
        new { id = "radio", name = "Radio", version = "1.0.0", author = "WatchNexus", status = "active", description = "Internet radio via Radio Browser" },
        new { id = "photos", name = "Photos", version = "1.0.0", author = "WatchNexus", status = "active", description = "Photo gallery from local filesystem" },
        new { id = "webvideo", name = "Web Video", version = "1.0.0", author = "WatchNexus", status = "active", description = "Web video bookmarks and history" },
    });

    [HttpGet("plugins/{id}")]
    public IActionResult Plugin(string id) => Ok(new { id, name = id, status = "active" });

    [HttpGet("catalogue/search")]
    public IActionResult CatalogueSearch([FromQuery] string q = "") => Ok(Array.Empty<object>());

    [HttpGet("catalogue/categories")]
    public IActionResult Categories() => Ok(new[] { "media", "utilities", "social", "productivity", "customization" });

    [HttpGet("discover")]
    public IActionResult Discover() => Ok(Array.Empty<object>());

    [HttpPost("import-url")]
    public IActionResult ImportUrl() => Ok(new { status = "imported" });

    [HttpPost("import-file")]
    public IActionResult ImportFile() => Ok(new { status = "imported" });
}

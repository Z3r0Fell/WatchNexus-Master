using Microsoft.AspNetCore.Mvc;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            status = "healthy",
            version = "2.7.0",
            framework = ".NET 8",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("info")]
    public IActionResult Info()
    {
        return Ok(new
        {
            name = "WatchNexus",
            version = "2.7.0",
            codename = "Operation Fortress",
            framework = ".NET 8",
            modules = new[]
            {
                new { name = "Marmalade", description = "Library Management" },
                new { name = "Compote", description = "Indexer Hub" },
                new { name = "Fondue", description = "Download Engine" },
                new { name = "Garnish", description = "Subtitle Manager" },
                new { name = "Gelatin", description = "Transcoding" },
                new { name = "Zest", description = "Torrent Search" },
                new { name = "Relish", description = "IPTV Player" },
                new { name = "Drizzle", description = "Playlists" },
                new { name = "Cream", description = "Stream Links" },
                new { name = "Fprint", description = "Audio Fingerprint" },
                new { name = "Potluck", description = "Request System" },
                new { name = "Sieve", description = "Quality Profiles" },
                new { name = "Syrup", description = "Scraper Engine" }
            }
        });
    }
}

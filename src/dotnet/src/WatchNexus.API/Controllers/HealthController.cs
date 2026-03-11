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
            version = "3.0.0",
            framework = ".NET 8",
            runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
            os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("info")]
    public IActionResult Info()
    {
        return Ok(new
        {
            name = "WatchNexus",
            version = "3.0.0",
            codename = "Operation Bastion",
            framework = ".NET 8",
            architecture = "Clean Architecture (C#)",
            modules = new[]
            {
                new { name = "Marmalade", description = "Library Management", status = "active" },
                new { name = "Compote", description = "Indexer Hub", status = "active" },
                new { name = "Fondue", description = "Download Engine", status = "active" },
                new { name = "Garnish", description = "Subtitle Manager", status = "active" },
                new { name = "Gelatin", description = "External Access & Tunnels", status = "active" },
                new { name = "Zest", description = "Log Viewer & Diagnostics", status = "active" },
                new { name = "Relish", description = "IPTV Player", status = "active" },
                new { name = "Drizzle", description = "Playlists", status = "active" },
                new { name = "Cream", description = "Stream Links", status = "active" },
                new { name = "Fprint", description = "Audio Fingerprint", status = "active" },
                new { name = "Potluck", description = "Request System", status = "active" },
                new { name = "Sieve", description = "Quality Profiles", status = "active" },
                new { name = "Syrup", description = "Scraper Engine", status = "active" },
                new { name = "Tiramisu", description = "Auto-Updater", status = "active" },
                new { name = "Bastion", description = "Security & Audit", status = "active" },
                new { name = "Tunnel", description = "VPN Portal", status = "active" }
            },
            security = new
            {
                rate_limiting = true,
                security_headers = true,
                audit_logging = true,
                ip_filtering = true,
                jwt_auth = true,
                api_key_auth = true,
                vpn_portal = true
            }
        });
    }
}

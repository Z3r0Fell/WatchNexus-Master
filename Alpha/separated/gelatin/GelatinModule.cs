using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Gelatin;

// ── Models ───────────────────────────────────────────────────
public class TranscodeJob
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SourcePath { get; set; } = "";
    public string OutputPath { get; set; } = "";
    public string Profile { get; set; } = "h264-1080p";
    public string Status { get; set; } = "queued";
    public double Progress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class TranscodeProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string VideoCodec { get; set; } = "libx264";
    public string AudioCodec { get; set; } = "aac";
    public string Resolution { get; set; } = "1920x1080";
    public int Bitrate { get; set; } = 8000;
}

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api/gelatin")]
[Authorize]
public class GelatinController : ControllerBase
{
    [HttpGet("jobs")]
    public IActionResult GetJobs() => Ok(Array.Empty<object>());

    [HttpPost("transcode")]
    public IActionResult StartTranscode([FromBody] object req) =>
        Ok(new { id = Guid.NewGuid().ToString(), status = "queued" });

    [HttpGet("profiles")]
    public IActionResult GetProfiles() => Ok(new[]
    {
        new { id = "h264-1080p", name = "H.264 1080p", codec = "libx264", resolution = "1920x1080" },
        new { id = "h265-4k", name = "H.265 4K", codec = "libx265", resolution = "3840x2160" },
        new { id = "h264-720p", name = "H.264 720p", codec = "libx264", resolution = "1280x720" },
    });
}

// ── Module Registration ──────────────────────────────────────
public class GelatinModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Gelatin", Codename = "gelatin",
        DisplayName = "Transcoding Engine", Version = "2.7.3-alpha",
        Description = "FFmpeg-based media transcoding with quality profiles",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

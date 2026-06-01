using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Core.Services;

namespace WatchNexus.Core.Controllers;

[Route("api/gadgets/spotdl")]
[ApiController]
[Authorize]
public class SpotdlController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SpotdlKeyManager _keyManager;

    public SpotdlController(AppDbContext db, SpotdlKeyManager keyManager)
    {
        _db = db;
        _keyManager = keyManager;
    }

    /// <summary>
    /// Search for tracks/albums/playlists via spotdl.
    /// Uses "spotdl save" operation which outputs track metadata as JSON to stdout.
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q = "", [FromQuery] string type = "track")
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { detail = "Search query required" });

        try
        {
            // Use spotdl save to get metadata as JSON
            var psi = new ProcessStartInfo
            {
                FileName = "/usr/bin/spotdl",
                Arguments = $"save \"{q}\" --save-file - --format mp3 --log-level ERROR",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using var process = new Process { StartInfo = psi };
            process.Start();

            var stdout = await process.StandardOutput.ReadToEndAsync();
            var stderr = await process.StandardError.ReadToEndAsync();

            if (!process.WaitForExit(30000))
            {
                process.Kill(entireProcessTree: true);
                return StatusCode(504, new { detail = "Search timed out" });
            }

            if (process.ExitCode != 0)
            {
                return Ok(new { results = new List<object>(), error = stderr });
            }

            // Parse JSON output — spotdl save outputs a JSON array of track objects
            var results = new List<object>();
            try
            {
                if (!string.IsNullOrWhiteSpace(stdout))
                {
                    var doc = JsonDocument.Parse(stdout);
                    if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in doc.RootElement.EnumerateArray())
                        {
                            var result = new
                            {
                                title = item.TryGetProperty("name", out var n) ? n.GetString() ?? "" :
                                        item.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "Unknown",
                                artist = item.TryGetProperty("artists", out var a) ? FormatArtists(a) :
                                         item.TryGetProperty("artist", out var ar) ? ar.GetString() ?? "" : "",
                                url = item.TryGetProperty("url", out var u) ? u.GetString() ?? "" :
                                      item.TryGetProperty("external_urls", out var eu) && eu.TryGetProperty("spotify", out var sp) ? sp.GetString() ?? "" : "",
                                duration = item.TryGetProperty("duration", out var d) ? d.GetInt32() :
                                           item.TryGetProperty("duration_ms", out var dm) ? dm.GetInt32() / 1000 : 0,
                                thumbnail = item.TryGetProperty("image", out var img) ? img.GetString() :
                                            item.TryGetProperty("album", out var alb) && alb.TryGetProperty("images", out var imgs) && imgs.GetArrayLength() > 0 ?
                                            (imgs[0].TryGetProperty("url", out var iu) ? iu.GetString() : null) : null,
                                type = item.TryGetProperty("type", out var tp) ? tp.GetString() : "track",
                                id = item.TryGetProperty("id", out var idProp) ? idProp.GetString() : "",
                            };
                            results.Add(result);
                        }
                    }
                }
            }
            catch (JsonException ex)
            {
                // spotdl output may not be valid JSON for save op
                return Ok(new { results = new List<object>(), raw = stdout, error = ex.Message });
            }

            return Ok(new { results });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = $"Search failed: {ex.Message}" });
        }
    }

    /// <summary>
    /// Queue a new download.
    /// </summary>
    [HttpPost("download")]
    public async Task<IActionResult> QueueDownload([FromBody] JsonElement body)
    {
        var url = body.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";
        var format = body.TryGetProperty("format", out var f) ? f.GetString() ?? "mp3" : "mp3";

        if (string.IsNullOrWhiteSpace(url))
            return BadRequest(new { detail = "URL required" });

        var download = new SpotdlDownload
        {
            UserId = this.UserId(),
            Url = url,
            Title = "Queued...",
            Status = "queued",
            Format = format,
            Progress = 0,
        };

        _db.SpotdlDownloads.Add(download);
        await _db.SaveChangesAsync();

        return Ok(new { download.Id, status = download.Status });
    }

    /// <summary>
    /// List all downloads for the current user.
    /// </summary>
    [HttpGet("downloads")]
    public async Task<IActionResult> GetDownloads()
    {
        var downloads = await _db.SpotdlDownloads
            .Where(d => d.UserId == this.UserId())
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new
            {
                d.Id,
                d.Url,
                d.Title,
                d.Artist,
                d.Status,
                d.Format,
                d.Progress,
                d.OutputPath,
                d.ErrorMessage,
                d.RetryCount,
                d.CreatedAt,
                d.CompletedAt
            })
            .ToListAsync();

        return Ok(new { downloads });
    }

    /// <summary>
    /// Get a single download by ID.
    /// </summary>
    [HttpGet("downloads/{id}")]
    public async Task<IActionResult> GetDownload(string id)
    {
        var d = await _db.SpotdlDownloads.FirstOrDefaultAsync(x => x.Id == id && x.UserId == this.UserId());
        if (d == null) return NotFound(new { detail = "Download not found" });

        return Ok(new
        {
            d.Id,
            d.Url,
            d.Title,
            d.Artist,
            d.Status,
            d.Format,
            d.Progress,
            d.OutputPath,
            d.ErrorMessage,
            d.KeyUsed,
            d.RetryCount,
            d.CreatedAt,
            d.CompletedAt
        });
    }

    /// <summary>
    /// Delete a download record.
    /// </summary>
    [HttpDelete("downloads/{id}")]
    public async Task<IActionResult> DeleteDownload(string id)
    {
        var d = await _db.SpotdlDownloads.FirstOrDefaultAsync(x => x.Id == id && x.UserId == this.UserId());
        if (d == null) return NotFound(new { detail = "Download not found" });

        _db.SpotdlDownloads.Remove(d);
        await _db.SaveChangesAsync();

        return Ok(new { status = "deleted" });
    }

    /// <summary>
    /// Retry a failed download.
    /// </summary>
    [HttpPost("retry/{id}")]
    public async Task<IActionResult> RetryDownload(string id)
    {
        var d = await _db.SpotdlDownloads.FirstOrDefaultAsync(x => x.Id == id && x.UserId == this.UserId());
        if (d == null) return NotFound(new { detail = "Download not found" });

        d.Status = "queued";
        d.Progress = 0;
        d.ErrorMessage = null;
        d.RetryCount = 0;
        await _db.SaveChangesAsync();

        return Ok(new { d.Id, status = "queued" });
    }

    /// <summary>
    /// Add a new Spotify API key.
    /// </summary>
    [HttpPost("keys")]
    public async Task<IActionResult> AddKey([FromBody] JsonElement body)
    {
        var key = body.TryGetProperty("key", out var k) ? k.GetString() ?? "" : "";
        var service = body.TryGetProperty("service", out var s) ? s.GetString() ?? "spotify" : "spotify";

        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(new { detail = "Key value required" });

        var result = await _keyManager.AddKey(key, service);
        return Ok(new { result.Id, status = "added" });
    }

    /// <summary>
    /// List all API keys (masked).
    /// </summary>
    [HttpGet("keys")]
    public async Task<IActionResult> GetKeys()
    {
        var keys = await _keyManager.GetKeys("spotify");
        return Ok(new { keys });
    }

    /// <summary>
    /// Delete an API key.
    /// </summary>
    [HttpDelete("keys/{id}")]
    public async Task<IActionResult> DeleteKey(string id)
    {
        var removed = await _keyManager.RemoveKey(id);
        if (!removed) return NotFound(new { detail = "Key not found" });
        return Ok(new { status = "deleted" });
    }

    /// <summary>
    /// Format artists array to a readable string.
    /// </summary>
    private static string FormatArtists(JsonElement artists)
    {
        if (artists.ValueKind == JsonValueKind.Array)
        {
            var names = artists.EnumerateArray()
                .Select(a => a.TryGetProperty("name", out var n) ? n.GetString() : null)
                .Where(n => n != null)
                .ToList();
            return string.Join(", ", names!);
        }
        return artists.GetString() ?? "";
    }
}

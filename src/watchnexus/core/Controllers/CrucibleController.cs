using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Crucible — Media Processing Pipeline.
/// Built-in FFmpeg integration for H.265 conversion, bitrate optimization,
/// subtitle burning, corrupt file detection, with background workers and progress UI.
/// </summary>
[Route("api/crucible")]
[ApiController]
[Authorize]
public class CrucibleController : ControllerBase
{
    private readonly AppDbContext _db;
    public CrucibleController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "crucible", version = "1.0.0", status = "active", description = "Media processing: FFmpeg transcoding, H.265 conversion, subtitle extraction" });

    // ── Transcode Profiles ──────────────────────────────────
    [HttpGet("profiles")]
    public IActionResult Profiles() => Ok(new[]
    {
        new { id = "h265-default", name = "H.265 Default", codec = "libx265", description = "Convert to H.265/HEVC with CRF 23, medium preset. ~50% size reduction.", crf = 23, preset = "medium", audio = "copy" },
        new { id = "h265-quality", name = "H.265 High Quality", codec = "libx265", description = "H.265 with CRF 18 for near-lossless quality.", crf = 18, preset = "slow", audio = "copy" },
        new { id = "h265-compact", name = "H.265 Compact", codec = "libx265", description = "Aggressive compression for maximum space savings.", crf = 28, preset = "fast", audio = "aac" },
        new { id = "h264-compat", name = "H.264 Compatible", codec = "libx264", description = "Broad compatibility. Good for streaming to older devices.", crf = 20, preset = "medium", audio = "aac" },
        new { id = "extract-subs", name = "Extract Subtitles", codec = "copy", description = "Extract all subtitle tracks to .srt files.", crf = 0, preset = "copy", audio = "copy" },
        new { id = "burn-subs", name = "Burn Subtitles", codec = "libx265", description = "Hardcode subtitle track into video.", crf = 23, preset = "medium", audio = "copy" },
        new { id = "audio-normalize", name = "Normalize Audio", codec = "copy", description = "Normalize audio levels across the file.", crf = 0, preset = "copy", audio = "loudnorm" },
    });

    // ── Submit Job ──────────────────────────────────
    [HttpPost("jobs")]
    public async Task<IActionResult> SubmitJob([FromBody] JsonElement body)
    {
        var sourcePath = body.TryGetProperty("source_path", out var sp) ? sp.GetString() ?? "" : "";
        if (string.IsNullOrEmpty(sourcePath)) return BadRequest(new { detail = "source_path is required" });

        var job = new TranscodeJob
        {
            UserId = this.UserId(),
            SourcePath = sourcePath,
            OutputPath = body.TryGetProperty("output_path", out var op) ? op.GetString() : null,
            Profile = body.TryGetProperty("profile", out var pr) ? pr.GetString() ?? "h265-default" : "h265-default",
            SettingsJson = body.TryGetProperty("settings", out var s) ? s.GetRawText() : null,
        };

        // Probe source file
        if (System.IO.File.Exists(sourcePath))
        {
            var fi = new System.IO.FileInfo(sourcePath);
            job.SourceSize = fi.Length;
        }

        _db.TranscodeJobs.Add(job);
        await _db.SaveChangesAsync();
        return Ok(new { id = job.Id, status = "queued" });
    }

    // ── Queue ──────────────────────────────────
    [HttpGet("jobs")]
    public async Task<IActionResult> GetJobs([FromQuery] string? status = null, [FromQuery] int limit = 50)
    {
        var uid = this.UserId();
        var query = _db.TranscodeJobs.Where(j => j.UserId == uid);
        if (!string.IsNullOrEmpty(status)) query = query.Where(j => j.Status == status);

        var jobs = await query
            .OrderByDescending(j => j.CreatedAt)
            .Take(limit)
            .Select(j => new
            {
                j.Id, j.SourcePath, j.OutputPath, j.Profile, j.Status, j.Progress,
                j.SourceSize, j.OutputSize, j.Resolution, j.Codec, j.Error,
                j.CreatedAt, j.StartedAt, j.CompletedAt,
                savings = j.SourceSize > 0 && j.OutputSize > 0
                    ? Math.Round((1.0 - (double)j.OutputSize.Value / j.SourceSize.Value) * 100, 1) : (double?)null,
            })
            .ToListAsync();
        return Ok(jobs);
    }

    [HttpGet("jobs/{id}")]
    public async Task<IActionResult> GetJob(string id)
    {
        var job = await _db.TranscodeJobs.FirstOrDefaultAsync(j => j.Id == id && j.UserId == this.UserId());
        if (job == null) return NotFound();
        return Ok(new
        {
            job.Id, job.SourcePath, job.OutputPath, job.Profile, job.Status, job.Progress,
            job.SourceSize, job.OutputSize, job.Resolution, job.Codec, job.Error, job.SettingsJson,
            job.CreatedAt, job.StartedAt, job.CompletedAt,
        });
    }

    // ── Cancel / Delete ──────────────────────────────────
    [HttpDelete("jobs/{id}")]
    public async Task<IActionResult> CancelJob(string id)
    {
        var job = await _db.TranscodeJobs.FirstOrDefaultAsync(j => j.Id == id && j.UserId == this.UserId());
        if (job == null) return NotFound();
        if (job.Status == "processing") job.Status = "cancelled";
        else _db.TranscodeJobs.Remove(job);
        await _db.SaveChangesAsync();
        return Ok(new { status = "cancelled" });
    }

    [HttpPost("jobs/{id}/retry")]
    public async Task<IActionResult> RetryJob(string id)
    {
        var job = await _db.TranscodeJobs.FirstOrDefaultAsync(j => j.Id == id && j.UserId == this.UserId());
        if (job == null) return NotFound();
        job.Status = "queued";
        job.Progress = 0;
        job.Error = null;
        job.StartedAt = null;
        job.CompletedAt = null;
        await _db.SaveChangesAsync();
        return Ok(new { status = "requeued" });
    }

    // ── Probe File (FFprobe) ──────────────────────────────────
    [HttpPost("probe")]
    public async Task<IActionResult> ProbeFile([FromBody] JsonElement body)
    {
        var path = body.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "";
        if (!System.IO.File.Exists(path)) return NotFound(new { detail = "File not found" });

        var fi = new System.IO.FileInfo(path);
        var result = new
        {
            path,
            filename = fi.Name,
            size = fi.Length,
            size_mb = Math.Round(fi.Length / 1048576.0, 1),
            extension = fi.Extension,
            last_modified = fi.LastWriteTimeUtc,
            ffprobe = await RunFfprobe(path),
        };
        return Ok(result);
    }

    // ── Stats ──────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var uid = this.UserId();
        var jobs = await _db.TranscodeJobs.Where(j => j.UserId == uid).ToListAsync();
        var completed = jobs.Where(j => j.Status == "complete").ToList();
        var totalSaved = completed
            .Where(j => j.SourceSize > 0 && j.OutputSize > 0)
            .Sum(j => j.SourceSize!.Value - j.OutputSize!.Value);

        return Ok(new
        {
            total_jobs = jobs.Count,
            queued = jobs.Count(j => j.Status == "queued"),
            processing = jobs.Count(j => j.Status == "processing"),
            completed = completed.Count,
            failed = jobs.Count(j => j.Status == "failed"),
            total_space_saved_mb = Math.Round(totalSaved / 1048576.0, 1),
        });
    }

    // ── FFmpeg Status ──────────────────────────────────
    [HttpGet("ffmpeg-status")]
    public async Task<IActionResult> FfmpegStatus()
    {
        var ffmpegPath = FindExecutable("ffmpeg");
        var ffprobePath = FindExecutable("ffprobe");
        string? ffmpegVersion = null;

        if (ffmpegPath != null)
        {
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo(ffmpegPath, "-version")
                { RedirectStandardOutput = true, UseShellExecute = false };
                var proc = System.Diagnostics.Process.Start(psi);
                if (proc != null)
                {
                    var output = await proc.StandardOutput.ReadLineAsync();
                    await proc.WaitForExitAsync();
                    ffmpegVersion = output;
                }
            }
            catch { Log.Error("[CrucibleController] operation failed"); }
        }

        return Ok(new
        {
            ffmpeg_installed = ffmpegPath != null,
            ffmpeg_path = ffmpegPath,
            ffprobe_installed = ffprobePath != null,
            ffprobe_path = ffprobePath,
            ffmpeg_version = ffmpegVersion,
            hw_accel = new[] { "vaapi", "qsv", "nvenc", "videotoolbox" },
        });
    }

    // ── Helpers ──────────────────────────────────
    private static string? FindExecutable(string name)
    {
        var paths = new[] { $"/usr/bin/{name}", $"/usr/local/bin/{name}", $"/opt/ffmpeg/bin/{name}" };
        foreach (var p in paths) if (System.IO.File.Exists(p)) return p;
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo("which", name)
            { RedirectStandardOutput = true, UseShellExecute = false };
            var proc = System.Diagnostics.Process.Start(psi);
            var output = proc?.StandardOutput.ReadToEnd().Trim();
            proc?.WaitForExit();
            if (!string.IsNullOrEmpty(output) && System.IO.File.Exists(output)) return output;
        }
        catch { Log.Error("[CrucibleController] operation failed"); }
        return null;
    }

    private static async Task<object?> RunFfprobe(string path)
    {
        var ffprobe = FindExecutable("ffprobe");
        if (ffprobe == null) return new { error = "ffprobe not installed" };
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo(ffprobe,
                $"-v quiet -print_format json -show_format -show_streams \"{path}\"")
            { RedirectStandardOutput = true, UseShellExecute = false };
            var proc = System.Diagnostics.Process.Start(psi);
            if (proc == null) return null;
            var output = await proc.StandardOutput.ReadToEndAsync();
            await proc.WaitForExitAsync();
            return JsonDocument.Parse(output).RootElement;
        }
        catch (Exception ex) { Log.Error(ex, "[CrucibleController] operation failed"); return new { error = ex.Message }; }
    }
}

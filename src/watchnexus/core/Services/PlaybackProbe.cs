using System.Diagnostics;
using System.Text.Json;

namespace WatchNexus.Core.Services;

/// <summary>How a file has to be delivered for an HTML5 &lt;video&gt; element to play it.</summary>
public enum PlaybackMode
{
    /// <summary>Browser can decode the file as-is — serve the bytes with range support.</summary>
    Direct,
    /// <summary>Video stream is browser-safe (8-bit H.264) but the container and/or
    /// audio isn't — copy the video, re-encode audio to AAC, wrap in fragmented MP4.</summary>
    Remux,
    /// <summary>Video codec is not browser-safe (HEVC, MPEG-4 ASP/XviD, MPEG-2, VC-1,
    /// 10-bit H.264, …) — full re-encode to H.264/AAC fragmented MP4.</summary>
    Transcode,
}

public sealed record MediaProbe(string? VideoCodec, string? PixelFormat, string? AudioCodec, double? DurationSeconds);

public sealed record PlaybackDecision(PlaybackMode Mode, string Reason);

/// <summary>
/// Decides whether a local media file can be direct-played in a browser or must go
/// through ffmpeg, and builds the ffmpeg argument list for the non-direct cases.
///
/// Background: the original playback path only ever served raw file bytes. That works
/// for music (MP3/FLAC/AAC decode everywhere) but most video libraries are MKV/AVI
/// and/or HEVC/AC3/DTS, which browsers can't decode — so video "didn't play" while
/// music did.
/// </summary>
public static class PlaybackProbe
{
    // Containers every mainstream browser can demux natively.
    private static readonly HashSet<string> BrowserContainers = new(StringComparer.OrdinalIgnoreCase)
        { ".mp4", ".m4v", ".mov", ".webm" };

    private static readonly HashSet<string> BrowserVideoCodecs = new(StringComparer.OrdinalIgnoreCase)
        { "h264", "vp8", "vp9", "av1" };

    private static readonly HashSet<string> BrowserAudioCodecs = new(StringComparer.OrdinalIgnoreCase)
        { "aac", "mp3", "opus", "vorbis", "flac" };

    // Audio codecs that can be stream-copied into fragmented MP4 and still play in browsers.
    private static readonly HashSet<string> Mp4CopyableAudio = new(StringComparer.OrdinalIgnoreCase)
        { "aac", "mp3" };

    // Chrome/Firefox/Safari only reliably decode 8-bit 4:2:0 H.264.
    private static readonly HashSet<string> BrowserH264PixelFormats = new(StringComparer.OrdinalIgnoreCase)
        { "yuv420p", "yuvj420p" };

    public static readonly HashSet<string> AudioExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wma", ".alac", ".m4b" };

    public static bool IsAudioFile(string path) => AudioExtensions.Contains(Path.GetExtension(path));

    private static bool IsBrowserSafeH264(MediaProbe p) =>
        string.Equals(p.VideoCodec, "h264", StringComparison.OrdinalIgnoreCase)
        && (p.PixelFormat == null || BrowserH264PixelFormats.Contains(p.PixelFormat));

    /// <summary>Pure decision function (no I/O) — see <see cref="PlaybackMode"/>.</summary>
    public static PlaybackDecision Decide(string filePath, MediaProbe? probe)
    {
        var ext = Path.GetExtension(filePath);
        var browserContainer = BrowserContainers.Contains(ext);

        if (probe == null)
        {
            // ffprobe unavailable/failed: we can only judge by extension. A browser
            // container is worth a direct attempt (the player falls back to transcode
            // on a decode error); anything else needs a full transcode since we can't
            // tell whether the video stream is safe to copy.
            return browserContainer
                ? new PlaybackDecision(PlaybackMode.Direct, $"{ext} container (codecs not probed)")
                : new PlaybackDecision(PlaybackMode.Transcode, $"{ext} container is not browser-playable");
        }

        if (probe.VideoCodec == null)
            return new PlaybackDecision(PlaybackMode.Transcode, "no video stream detected");

        var videoOk = BrowserVideoCodecs.Contains(probe.VideoCodec)
            && (!string.Equals(probe.VideoCodec, "h264", StringComparison.OrdinalIgnoreCase) || IsBrowserSafeH264(probe));
        var audioOk = probe.AudioCodec == null || BrowserAudioCodecs.Contains(probe.AudioCodec);

        if (browserContainer && videoOk && audioOk)
            return new PlaybackDecision(PlaybackMode.Direct, $"{probe.VideoCodec}/{probe.AudioCodec ?? "no audio"} in {ext}");

        if (IsBrowserSafeH264(probe))
            return new PlaybackDecision(PlaybackMode.Remux,
                $"h264 video is browser-safe; repackaging {ext} with {probe.AudioCodec ?? "no"} audio");

        return new PlaybackDecision(PlaybackMode.Transcode,
            $"{probe.VideoCodec}{(probe.PixelFormat != null ? $" ({probe.PixelFormat})" : "")} video is not browser-playable");
    }

    /// <summary>Run ffprobe and extract the first video/audio codec + duration. Null on any failure.</summary>
    public static async Task<MediaProbe?> ProbeAsync(string filePath, CancellationToken ct)
    {
        var ffprobe = FfmpegLocator.Ffprobe;
        if (ffprobe == null) return null;

        var psi = new ProcessStartInfo(ffprobe)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var a in new[] { "-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath })
            psi.ArgumentList.Add(a);

        Process? proc = null;
        try
        {
            proc = Process.Start(psi);
            if (proc == null) return null;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            var stdoutTask = proc.StandardOutput.ReadToEndAsync(timeout.Token);
            _ = proc.StandardError.ReadToEndAsync(timeout.Token); // drain so ffprobe can't block on a full pipe
            await proc.WaitForExitAsync(timeout.Token);
            if (proc.ExitCode != 0) return null;
            return ParseProbeJson(await stdoutTask);
        }
        catch
        {
            try { if (proc is { HasExited: false }) proc.Kill(true); } catch { }
            return null;
        }
        finally
        {
            proc?.Dispose();
        }
    }

    public static MediaProbe? ParseProbeJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            string? vCodec = null, pixFmt = null, aCodec = null;
            double? duration = null;

            if (doc.RootElement.TryGetProperty("streams", out var streams) && streams.ValueKind == JsonValueKind.Array)
            {
                foreach (var s in streams.EnumerateArray())
                {
                    var type = s.TryGetProperty("codec_type", out var t) ? t.GetString() : null;
                    var codec = s.TryGetProperty("codec_name", out var c) ? c.GetString() : null;
                    // Cover art in MKV/MP4 shows up as an mjpeg/png "video" stream — skip it.
                    var attachedPic = s.TryGetProperty("disposition", out var disp)
                        && disp.TryGetProperty("attached_pic", out var ap) && ap.ValueKind == JsonValueKind.Number && ap.GetInt32() == 1;
                    if (type == "video" && vCodec == null && !attachedPic)
                    {
                        vCodec = codec;
                        pixFmt = s.TryGetProperty("pix_fmt", out var pf) ? pf.GetString() : null;
                    }
                    else if (type == "audio" && aCodec == null)
                    {
                        aCodec = codec;
                    }
                }
            }

            if (doc.RootElement.TryGetProperty("format", out var fmt)
                && fmt.TryGetProperty("duration", out var d)
                && double.TryParse(d.GetString(), System.Globalization.NumberStyles.Float,
                       System.Globalization.CultureInfo.InvariantCulture, out var secs)
                && secs > 0)
                duration = secs;

            return new MediaProbe(vCodec, pixFmt, aCodec, duration);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// ffmpeg arguments that write a browser-playable fragmented MP4 to stdout.
    /// Passed via ArgumentList (no shell), so the file path needs no quoting.
    /// </summary>
    public static IReadOnlyList<string> BuildFfmpegArgs(string filePath, PlaybackMode mode, string? audioCodec, double startSeconds)
    {
        var args = new List<string> { "-hide_banner", "-loglevel", "error", "-nostdin" };
        if (startSeconds > 0)
        {
            // Input-side seek: fast, keyframe-accurate. Output timestamps restart at 0,
            // which is why the player tracks the offset itself.
            args.Add("-ss");
            args.Add(startSeconds.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture));
        }
        args.AddRange(new[] { "-i", filePath, "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn" });

        if (mode == PlaybackMode.Remux)
        {
            args.AddRange(new[] { "-c:v", "copy" });
        }
        else
        {
            args.AddRange(new[]
            {
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
                "-pix_fmt", "yuv420p", "-profile:v", "high",
                // Cap at 1080p (keeps 4K HEVC sources real-time on modest CPUs);
                // never upscale; keep dimensions even for yuv420p.
                "-vf", "scale='min(1920,iw)':-2",
            });
        }

        if (audioCodec != null && Mp4CopyableAudio.Contains(audioCodec))
            args.AddRange(new[] { "-c:a", "copy" });
        else
            args.AddRange(new[] { "-c:a", "aac", "-b:a", "192k", "-ac", "2" });

        args.AddRange(new[]
        {
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",
            "-f", "mp4", "pipe:1",
        });
        return args;
    }
}

using System.Diagnostics;
using Microsoft.Extensions.Logging;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.Infrastructure.Services;

/// <summary>
/// FFmpeg transcoding service - Gelatin implementation
/// </summary>
public class TranscodingService : ITranscodingService
{
    private readonly ILogger<TranscodingService> _logger;
    private const string FfmpegPath = "ffmpeg";
    private const string FfprobePath = "ffprobe";

    public TranscodingService(ILogger<TranscodingService> logger)
    {
        _logger = logger;
    }

    public async Task<string> TranscodeAsync(string inputPath, string outputPath, TranscodeOptions options, CancellationToken ct = default)
    {
        _logger.LogInformation("Starting transcode: {Input} -> {Output}", inputPath, outputPath);

        var args = BuildTranscodeArgs(inputPath, outputPath, options);
        var result = await RunFfmpegAsync(args, ct);

        if (!File.Exists(outputPath))
            throw new InvalidOperationException($"Transcode failed: output file not created. Error: {result}");

        return outputPath;
    }

    public async Task<string> GenerateThumbnailAsync(string videoPath, int timeSeconds, CancellationToken ct = default)
    {
        var outputPath = Path.Combine(Path.GetTempPath(), $"thumb_{Guid.NewGuid():N}.jpg");
        var args = $"-ss {timeSeconds} -i \"{videoPath}\" -vframes 1 -q:v 2 -y \"{outputPath}\"";

        await RunFfmpegAsync(args, ct);

        if (!File.Exists(outputPath))
            throw new InvalidOperationException("Thumbnail generation failed");

        return outputPath;
    }

    public async Task<MediaInfo> GetMediaInfoAsync(string filePath, CancellationToken ct = default)
    {
        var args = $"-v quiet -print_format json -show_format -show_streams \"{filePath}\"";

        var psi = new ProcessStartInfo
        {
            FileName = FfprobePath,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process == null)
            throw new InvalidOperationException("Failed to start ffprobe");

        var output = await process.StandardOutput.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        try
        {
            var doc = System.Text.Json.JsonDocument.Parse(output);
            var root = doc.RootElement;

            int? width = null, height = null, duration = null, bitrate = null;
            string? videoCodec = null, audioCodec = null, container = null;

            if (root.TryGetProperty("format", out var format))
            {
                if (format.TryGetProperty("duration", out var d) && double.TryParse(d.GetString(), out var dur))
                    duration = (int)dur;
                if (format.TryGetProperty("bit_rate", out var br) && int.TryParse(br.GetString(), out var b))
                    bitrate = b;
                if (format.TryGetProperty("format_name", out var fn))
                    container = fn.GetString()?.Split(',')[0];
            }

            if (root.TryGetProperty("streams", out var streams))
            {
                foreach (var stream in streams.EnumerateArray())
                {
                    var codecType = stream.TryGetProperty("codec_type", out var ct2) ? ct2.GetString() : null;

                    if (codecType == "video" && videoCodec == null)
                    {
                        videoCodec = stream.TryGetProperty("codec_name", out var cn) ? cn.GetString() : null;
                        width = stream.TryGetProperty("width", out var w) ? w.GetInt32() : null;
                        height = stream.TryGetProperty("height", out var h) ? h.GetInt32() : null;
                    }
                    else if (codecType == "audio" && audioCodec == null)
                    {
                        audioCodec = stream.TryGetProperty("codec_name", out var cn) ? cn.GetString() : null;
                    }
                }
            }

            return new MediaInfo(duration, width, height, videoCodec, audioCodec, bitrate, container);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse media info for {FilePath}", filePath);
            return new MediaInfo(null, null, null, null, null, null, null);
        }
    }

    private static string BuildTranscodeArgs(string input, string output, TranscodeOptions options)
    {
        var args = $"-i \"{input}\" ";

        // Video codec
        args += $"-c:v {options.VideoCodec} ";

        // Resolution
        if (options.Width.HasValue && options.Height.HasValue)
            args += $"-vf scale={options.Width}:{options.Height} ";
        else if (options.Width.HasValue)
            args += $"-vf scale={options.Width}:-2 ";

        // Bitrate
        if (options.Bitrate.HasValue)
            args += $"-b:v {options.Bitrate}k ";

        // Audio codec
        args += $"-c:a {options.AudioCodec} ";

        // Output
        args += $"-y \"{output}\"";

        return args;
    }

    private async Task<string> RunFfmpegAsync(string args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = FfmpegPath,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process == null)
            throw new InvalidOperationException("Failed to start ffmpeg");

        var error = await process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
            _logger.LogWarning("FFmpeg exited with code {ExitCode}: {Error}", process.ExitCode, error);

        return error;
    }
}

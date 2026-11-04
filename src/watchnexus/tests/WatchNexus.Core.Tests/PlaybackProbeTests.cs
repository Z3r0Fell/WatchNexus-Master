using WatchNexus.Core.Services;
using Xunit;

namespace WatchNexus.Core.Tests;

/// <summary>
/// Direct-play vs remux vs transcode decision for the HTML5 video player.
/// Regression: video files were always served raw, so MKV/HEVC/AC3 libraries
/// never played in the browser while music did.
/// </summary>
public class PlaybackProbeTests
{
    [Theory]
    // Browser-native: direct
    [InlineData("/m/a.mp4", "h264", "yuv420p", "aac", PlaybackMode.Direct)]
    [InlineData("/m/a.webm", "vp9", "yuv420p", "opus", PlaybackMode.Direct)]
    [InlineData("/m/a.m4v", "h264", "yuv420p", null, PlaybackMode.Direct)]
    [InlineData("/m/a.mp4", "av1", "yuv420p10le", "aac", PlaybackMode.Direct)]
    // H.264 8-bit in a non-browser container or with non-browser audio: remux
    [InlineData("/m/a.mkv", "h264", "yuv420p", "aac", PlaybackMode.Remux)]
    [InlineData("/m/a.mkv", "h264", "yuv420p", "ac3", PlaybackMode.Remux)]
    [InlineData("/m/a.mp4", "h264", "yuv420p", "dts", PlaybackMode.Remux)]
    [InlineData("/m/a.avi", "h264", "yuv420p", "mp3", PlaybackMode.Remux)]
    // Video codec browsers can't decode: full transcode
    [InlineData("/m/a.mkv", "hevc", "yuv420p10le", "eac3", PlaybackMode.Transcode)]
    [InlineData("/m/a.mp4", "hevc", "yuv420p", "aac", PlaybackMode.Transcode)]
    [InlineData("/m/a.avi", "mpeg4", "yuv420p", "mp3", PlaybackMode.Transcode)]
    [InlineData("/m/a.mkv", "h264", "yuv420p10le", "aac", PlaybackMode.Transcode)] // Hi10P anime
    [InlineData("/m/a.ts", "mpeg2video", "yuv420p", "ac3", PlaybackMode.Transcode)]
    public void Decide_PicksModeFromCodecsAndContainer(string path, string vcodec, string pixfmt, string? acodec, PlaybackMode expected)
    {
        var decision = PlaybackProbe.Decide(path, new MediaProbe(vcodec, pixfmt, acodec, 100));
        Assert.Equal(expected, decision.Mode);
        Assert.False(string.IsNullOrWhiteSpace(decision.Reason));
    }

    [Theory]
    [InlineData("/m/a.mp4", PlaybackMode.Direct)]
    [InlineData("/m/a.webm", PlaybackMode.Direct)]
    [InlineData("/m/a.mkv", PlaybackMode.Transcode)]
    [InlineData("/m/a.avi", PlaybackMode.Transcode)]
    public void Decide_WithoutProbe_FallsBackToContainer(string path, PlaybackMode expected) =>
        Assert.Equal(expected, PlaybackProbe.Decide(path, null).Mode);

    [Fact]
    public void Decide_NoVideoStream_Transcodes() =>
        Assert.Equal(PlaybackMode.Transcode, PlaybackProbe.Decide("/m/a.mp4", new MediaProbe(null, null, "aac", 10)).Mode);

    [Theory]
    [InlineData("/m/song.mp3", true)]
    [InlineData("/m/song.FLAC", true)]
    [InlineData("/m/book.m4b", true)]
    [InlineData("/m/movie.mkv", false)]
    [InlineData("/m/movie.mp4", false)]
    public void IsAudioFile(string path, bool expected) => Assert.Equal(expected, PlaybackProbe.IsAudioFile(path));

    [Fact]
    public void ParseProbeJson_SkipsCoverArtAndReadsDuration()
    {
        const string json = """
        {
          "streams": [
            { "codec_type": "video", "codec_name": "mjpeg", "disposition": { "attached_pic": 1 } },
            { "codec_type": "video", "codec_name": "hevc", "pix_fmt": "yuv420p10le", "disposition": { "attached_pic": 0 } },
            { "codec_type": "audio", "codec_name": "eac3" },
            { "codec_type": "audio", "codec_name": "aac" }
          ],
          "format": { "duration": "5423.120000" }
        }
        """;
        var p = PlaybackProbe.ParseProbeJson(json);
        Assert.NotNull(p);
        Assert.Equal("hevc", p!.VideoCodec);
        Assert.Equal("yuv420p10le", p.PixelFormat);
        Assert.Equal("eac3", p.AudioCodec);
        Assert.Equal(5423.12, p.DurationSeconds!.Value, 2);
    }

    [Fact]
    public void ParseProbeJson_Garbage_ReturnsNull() => Assert.Null(PlaybackProbe.ParseProbeJson("not json"));

    [Fact]
    public void BuildFfmpegArgs_Remux_CopiesVideo_ReencodesNonMp4Audio_FragmentedMp4ToStdout()
    {
        var args = PlaybackProbe.BuildFfmpegArgs("/m/My Movie (2020).mkv", PlaybackMode.Remux, "ac3", 0).ToList();
        Assert.Contains("/m/My Movie (2020).mkv", args); // passed as one argv entry, no shell quoting
        Assert.Equal("copy", args[args.IndexOf("-c:v") + 1]);
        Assert.Equal("aac", args[args.IndexOf("-c:a") + 1]);
        Assert.Contains("frag_keyframe+empty_moov+default_base_moof", args);
        Assert.Equal("pipe:1", args[^1]);
        Assert.DoesNotContain("-ss", args);
    }

    [Fact]
    public void BuildFfmpegArgs_Transcode_EncodesH264_SeeksBeforeInput()
    {
        var args = PlaybackProbe.BuildFfmpegArgs("/m/a.mkv", PlaybackMode.Transcode, "aac", 754.5).ToList();
        Assert.Equal("libx264", args[args.IndexOf("-c:v") + 1]);
        Assert.Equal("yuv420p", args[args.IndexOf("-pix_fmt") + 1]);
        Assert.Equal("copy", args[args.IndexOf("-c:a") + 1]);
        Assert.True(args.IndexOf("-ss") < args.IndexOf("-i"));
        Assert.Equal("754.5", args[args.IndexOf("-ss") + 1]);
    }
}

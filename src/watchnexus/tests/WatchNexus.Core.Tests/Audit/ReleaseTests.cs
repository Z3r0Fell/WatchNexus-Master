using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using WatchNexus.Core.Controllers;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

public class ReleaseTests
{
    private static byte[] Encode(Action<Image<Rgba32>, MemoryStream> save)
    {
        using var img = new Image<Rgba32>(4, 4);
        using var ms = new MemoryStream();
        save(img, ms);
        return ms.ToArray();
    }

    [Fact]
    public void SafeDecoder_LoadsPng()
    {
        var png = Encode((i, s) => i.SaveAsPng(s));
        using var loaded = Image.Load<Rgba32>(GameBotController.SafeDecoderOptions, png);
        Assert.Equal(4, loaded.Width);
    }

    [Fact]
    public void SafeDecoder_RejectsTiff()
    {
        // TIFF decoders carry unpatched advisories in ImageSharp 3.1.x; they must be unreachable.
        var tiff = Encode((i, s) => i.SaveAsTiff(s));
        Assert.Throws<UnknownImageFormatException>(() =>
            Image.Load<Rgba32>(GameBotController.SafeDecoderOptions, tiff));
    }
}

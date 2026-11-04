using Microsoft.AspNetCore.Http;
using WatchNexus.Core.Services;
using Xunit;

namespace WatchNexus.Core.Tests;

public class SpaCacheHeadersTests
{
    [Theory]
    [InlineData("/static/js/123.abcd1234.chunk.js")]
    [InlineData("/static/css/main.css")]
    [InlineData("/favicon.png")]
    [InlineData("/manifest.json")]
    [InlineData("/locales/en/translation.json")]
    public void AssetPaths_AreAssets(string path)
        => Assert.True(SpaCacheHeaders.IsAssetRequest(new PathString(path)));

    [Theory]
    [InlineData("/")]
    [InlineData("/movies")]
    [InlineData("/watch/3f2b6c1e-8a1d-4c55-9e57-0a4c2f2d1b7e")]
    [InlineData("/movie/603")]
    [InlineData("/log-viewer")]
    public void ClientRoutes_AreNotAssets(string path)
        => Assert.False(SpaCacheHeaders.IsAssetRequest(new PathString(path)));

    [Fact]
    public void IndexHtml_IsNoCache()
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/index.html";
        SpaCacheHeaders.Apply(ctx);
        Assert.Contains("no-cache", ctx.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public void HashedStatic_IsImmutable()
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/static/js/main.abc123.js";
        SpaCacheHeaders.Apply(ctx);
        Assert.Contains("immutable", ctx.Response.Headers.CacheControl.ToString());
    }
}

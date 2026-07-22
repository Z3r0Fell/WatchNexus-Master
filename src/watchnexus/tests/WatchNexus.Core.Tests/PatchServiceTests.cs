using System.Security.Cryptography;
using WatchNexus.Core.Services;

namespace WatchNexus.Core.Tests;

public class PatchServiceSafeResolveTests
{
    private static readonly string Root = Path.Combine(Path.GetTempPath(), "wn-patch-root");

    [Theory]
    [InlineData("static/js/main.js")]
    [InlineData("index.html")]
    [InlineData("modules/marmalade/module.json")]
    public void Accepts_paths_inside_root(string rel)
    {
        var resolved = PatchService.SafeResolve(Root, rel);
        Assert.NotNull(resolved);
        Assert.StartsWith(Path.GetFullPath(Root), resolved);
    }

    [Fact]
    public void Accepts_root_with_trailing_separator()
    {
        // AppContext.BaseDirectory always has a trailing slash — regression guard.
        var resolved = PatchService.SafeResolve(Root + Path.DirectorySeparatorChar, "WatchNexus.Core.dll");
        Assert.NotNull(resolved);
    }

    [Theory]
    [InlineData("../outside.dll")]
    [InlineData("static/../../etc/passwd")]
    [InlineData("/etc/passwd")]
    [InlineData("..\\windows\\system32\\evil.dll")]
    [InlineData("")]
    [InlineData("   ")]
    public void Rejects_escaping_or_absolute_paths(string rel)
    {
        Assert.Null(PatchService.SafeResolve(Root, rel));
    }
}

public class PatchServiceSha256Tests
{
    [Fact]
    public void Accepts_matching_hash_case_insensitive()
    {
        var data = System.Text.Encoding.UTF8.GetBytes("patched content");
        var hex = Convert.ToHexString(SHA256.HashData(data));
        Assert.True(PatchService.VerifySha256(data, hex.ToLowerInvariant()));
        Assert.True(PatchService.VerifySha256(data, hex.ToUpperInvariant()));
    }

    [Fact]
    public void Rejects_wrong_missing_or_empty_hash()
    {
        var data = System.Text.Encoding.UTF8.GetBytes("patched content");
        Assert.False(PatchService.VerifySha256(data, new string('0', 64)));
        Assert.False(PatchService.VerifySha256(data, null));
        Assert.False(PatchService.VerifySha256(data, ""));
    }
}

public class PatchManifestParseTests
{
    [Fact]
    public void Parses_full_manifest()
    {
        var m = PatchService.ParseManifest("""
        {
          "patch_id": "2026-07-22-hotfix-01",
          "description": "Fix dashboard crash",
          "severity": "high",
          "silent": true,
          "files": [
            { "path": "static/js/fix.js", "target": "web", "sha256": "abc123" },
            { "path": "WatchNexus.Core.dll", "target": "app", "url": "https://example.com/f.dll", "sha256": "def456" }
          ]
        }
        """);
        Assert.NotNull(m);
        Assert.Equal("2026-07-22-hotfix-01", m!.PatchId);
        Assert.True(m.Silent);
        Assert.Equal(2, m.Files.Count);
        Assert.Equal("web", m.Files[0].Target);
        Assert.Equal("https://example.com/f.dll", m.Files[1].Url);
    }

    [Fact]
    public void Invalid_json_returns_null()
    {
        Assert.Null(PatchService.ParseManifest("not json"));
    }
}

public class PatchApplyPendingTests
{
    [Fact]
    public async Task Apply_rejects_manifest_without_hashes()
    {
        // ApplyAsync must refuse unverifiable patches before touching disk.
        var svc = new PatchService(new DummyHttpFactory(), new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());
        var manifest = new PatchManifest("p1", "test", "low", true,
            new List<PatchFileEntry> { new("a.js", "web", null, null) });
        var result = await svc.ApplyAsync(manifest);
        Assert.False(result.Success);
        Assert.Contains("sha256", result.Error);
    }

    private class DummyHttpFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}

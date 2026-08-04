using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
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

public class ManifestSignerTests
{
    [Fact]
    public void GenerateKeyPair_produces_valid_keys()
    {
        var (pub, priv) = ManifestSigner.GenerateKeyPair();
        Assert.False(string.IsNullOrEmpty(pub));
        Assert.False(string.IsNullOrEmpty(priv));
        // BouncyCastle Ed25519: public key 32 bytes (44 base64), private key seed 32 bytes (44 base64)
        Assert.Equal(44, pub.Length);
        Assert.Equal(44, priv.Length);
    }

    [Fact]
    public void Sign_and_verify_round_trip()
    {
        var (pub, priv) = ManifestSigner.GenerateKeyPair();
        var manifest = """{"patch_id":"test-01","description":"test","severity":"low","silent":true,"files":[]}""";

        var signature = ManifestSigner.Sign(manifest, priv);
        Assert.False(string.IsNullOrEmpty(signature));

        Assert.True(ManifestSigner.Verify(manifest, signature, pub));
    }

    [Fact]
    public void Verify_rejects_tampered_manifest()
    {
        var (pub, priv) = ManifestSigner.GenerateKeyPair();
        var manifest = """{"patch_id":"test-01","description":"original","severity":"low","silent":true,"files":[]}""";

        var signature = ManifestSigner.Sign(manifest, priv);

        var tampered = manifest.Replace("original", "MALICIOUS");
        Assert.False(ManifestSigner.Verify(tampered, signature, pub));
    }

    [Fact]
    public void Verify_rejects_wrong_public_key()
    {
        var (_, priv) = ManifestSigner.GenerateKeyPair();
        var (wrongPub, _) = ManifestSigner.GenerateKeyPair();
        var manifest = """{"patch_id":"test-01","description":"test","severity":"low","silent":true,"files":[]}""";

        var signature = ManifestSigner.Sign(manifest, priv);
        Assert.False(ManifestSigner.Verify(manifest, signature, wrongPub));
    }

    [Fact]
    public void Verify_rejects_empty_signature()
    {
        var (pub, _) = ManifestSigner.GenerateKeyPair();
        var manifest = """{"patch_id":"test-01"}""";
        Assert.False(ManifestSigner.Verify(manifest, "", pub));
        Assert.False(ManifestSigner.Verify(manifest, "invalid-base64!!!", pub));
    }

    [Fact]
    public void StripSignature_removes_signature_field()
    {
        var json = """{"patch_id":"test-01","signature":"abc123","description":"test"}""";
        var stripped = ManifestSigner.StripSignature(json);
        Assert.DoesNotContain("signature", stripped);
        Assert.Contains("patch_id", stripped);
        Assert.Contains("description", stripped);
    }

    [Fact]
    public void StripSignature_handles_no_signature_field()
    {
        var json = """{"patch_id":"test-01","description":"test"}""";
        var stripped = ManifestSigner.StripSignature(json);
        // Re-serializes with sorted keys, no whitespace
        Assert.Equal("""{"description":"test","patch_id":"test-01"}""", stripped);
    }

    [Fact]
    public void Canonicalize_sorts_keys_deterministically()
    {
        var json1 = """{"z":1,"a":2,"m":3}""";
        var json2 = """{"a":2,"m":3,"z":1}""";

        var c1 = ManifestSigner.Canonicalize(json1);
        var c2 = ManifestSigner.Canonicalize(json2);
        Assert.Equal(c1, c2);
        Assert.Equal("""{"a":2,"m":3,"z":1}""", c1);
    }

    [Fact]
    public void Canonicalize_handles_nested_objects_and_arrays()
    {
        var json = """{"files":[{"path":"b.js","sha256":"xxx"},{"path":"a.js","sha256":"yyy"}],"patch_id":"test"}""";
        var canonical = ManifestSigner.Canonicalize(json);
        // Top-level keys sorted
        Assert.StartsWith("""{"files":""", canonical);
        Assert.Contains("""{"path":"a.js","sha256":"yyy"}""", canonical);
        // No whitespace
        Assert.DoesNotContain(": ", canonical);
    }

    [Fact]
    public void PatchService_VerifyManifestSignature_rejects_unsigned_when_configured()
    {
        var (pub, _) = ManifestSigner.GenerateKeyPair();
        var config = BuildConfig(new Dictionary<string, string?> { { "PATCH_SIGNING_PUBLIC_KEY", pub } });
        var svc = new PatchService(new DummyHttpFactory(), config);

        var manifest = """{"patch_id":"test-01","description":"test","severity":"low","silent":true,"files":[]}""";
        var (valid, error) = svc.VerifyManifestSignature(manifest);
        Assert.False(valid);
        Assert.Contains("no signature", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void PatchService_VerifyManifestSignature_passes_valid_signature()
    {
        var (pub, priv) = ManifestSigner.GenerateKeyPair();
        var config = BuildConfig(new Dictionary<string, string?> { { "PATCH_SIGNING_PUBLIC_KEY", pub } });
        var svc = new PatchService(new DummyHttpFactory(), config);

        var manifest = """{"patch_id":"test-01","description":"test","severity":"low","silent":true,"files":[]}""";
        var signature = ManifestSigner.Sign(manifest, priv);
        var signed = System.Text.Json.JsonSerializer.Serialize(
            new SortedDictionary<string, object?>
            {
                ["patch_id"] = "test-01",
                ["description"] = "test",
                ["severity"] = "low",
                ["silent"] = true,
                ["files"] = Array.Empty<object>(),
                ["signature"] = signature
            });

        var (valid, error) = svc.VerifyManifestSignature(signed);
        Assert.True(valid);
        Assert.Null(error);
    }

    [Fact]
    public void PatchService_VerifyManifestSignature_skips_when_not_configured()
    {
        var config = new ConfigurationBuilder().Build();
        var svc = new PatchService(new DummyHttpFactory(), config);

        var manifest = """{"patch_id":"test-01"}""";
        var (valid, error) = svc.VerifyManifestSignature(manifest);
        Assert.Null(valid); // null = not configured
        Assert.NotNull(error); // informational message about skipping
    }

    private static IConfiguration BuildConfig(Dictionary<string, string?> overrides)
    {
        var tmpFile = Path.Combine(Path.GetTempPath(), $"wn-test-{Guid.NewGuid():N}.json");
        File.WriteAllText(tmpFile, System.Text.Json.JsonSerializer.Serialize(overrides));
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddJsonFile(tmpFile, optional: false, reloadOnChange: false)
            .Build();
        try { File.Delete(tmpFile); } catch { }
        return config;
    }

    private class DummyHttpFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}

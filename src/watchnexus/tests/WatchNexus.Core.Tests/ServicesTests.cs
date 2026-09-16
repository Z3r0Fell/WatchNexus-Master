using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Core.Services;

namespace WatchNexus.Core.Tests;

public class PatchServiceTests
{
    private readonly Mock<IHttpClientFactory> _httpFactoryMock;
    private readonly Mock<IConfiguration> _configMock;
    private readonly Mock<ILogger<PatchService>> _loggerMock;
    private readonly PatchService _service;

    public PatchServiceTests()
    {
        _httpFactoryMock = new Mock<IHttpClientFactory>();
        _configMock = new Mock<IConfiguration>();
        _configMock.Setup(c => c["PATCH_REPO_URL"]).Returns("https://api.github.com/repos/owner/repo");
        _configMock.Setup(c => c["PATCH_REPO_TOKEN"]).Returns("ghp_test_token");
        _configMock.Setup(c => c["PATCH_SIGNING_PUBLIC_KEY"]).Returns((string?)null);
        _loggerMock = new Mock<ILogger<PatchService>>();

        _service = new PatchService(_httpFactoryMock.Object, _configMock.Object, _loggerMock.Object);
    }

    [Fact]
    public void IsConfigured_ReturnsTrue_WhenRepoUrlSet()
    {
        Assert.True(_service.IsConfigured);
    }

    [Fact]
    public void IsConfigured_ReturnsFalse_WhenRepoUrlEmpty()
    {
        _configMock.Setup(c => c["PATCH_REPO_URL"]).Returns("");
        var service = new PatchService(_httpFactoryMock.Object, _configMock.Object, _loggerMock.Object);
        Assert.False(service.IsConfigured);
    }

    [Fact]
    public void IsSigningConfigured_ReturnsFalse_WhenKeyNotSet()
    {
        Assert.False(_service.IsSigningConfigured);
    }

    [Fact]
    public void IsSigningConfigured_ReturnsTrue_WhenKeySet()
    {
        _configMock.Setup(c => c["PATCH_SIGNING_PUBLIC_KEY"]).Returns("base64publickey==");
        var service = new PatchService(_httpFactoryMock.Object, _configMock.Object, _loggerMock.Object);
        Assert.True(service.IsSigningConfigured);
    }

    [Fact]
    public void SafeResolve_AcceptsPathsInsideRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), "wn-test-root");
        Directory.CreateDirectory(root);
        
        try
        {
            var result = PatchService.SafeResolve(root, "subdir/file.js");
            Assert.NotNull(result);
            Assert.StartsWith(Path.GetFullPath(root), result);
        }
        finally
        {
            Directory.Delete(root, true);
        }
    }

    [Fact]
    public void SafeResolve_RejectsEscapingPaths()
    {
        var root = Path.Combine(Path.GetTempPath(), "wn-test-root");
        Directory.CreateDirectory(root);
        
        try
        {
            Assert.Null(PatchService.SafeResolve(root, "../outside.dll"));
            Assert.Null(PatchService.SafeResolve(root, "static/../../etc/passwd"));
            Assert.Null(PatchService.SafeResolve(root, "/etc/passwd"));
            Assert.Null(PatchService.SafeResolve(root, "..\\windows\\system32\\evil.dll"));
            Assert.Null(PatchService.SafeResolve(root, ""));
            Assert.Null(PatchService.SafeResolve(root, "   "));
        }
        finally
        {
            Directory.Delete(root, true);
        }
    }

    [Fact]
    public void VerifySha256_AcceptsMatchingHash()
    {
        var data = System.Text.Encoding.UTF8.GetBytes("patched content");
        var hex = Convert.ToHexString(SHA256.HashData(data));
        
        Assert.True(PatchService.VerifySha256(data, hex.ToLowerInvariant()));
        Assert.True(PatchService.VerifySha256(data, hex.ToUpperInvariant()));
    }

    [Fact]
    public void VerifySha256_RejectsWrongHash()
    {
        var data = System.Text.Encoding.UTF8.GetBytes("patched content");
        
        Assert.False(PatchService.VerifySha256(data, new string('0', 64)));
        Assert.False(PatchService.VerifySha256(data, null));
        Assert.False(PatchService.VerifySha256(data, ""));
    }

    [Fact]
    public void ParseManifest_ParsesFullManifest()
    {
        var manifest = PatchService.ParseManifest("""
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

        Assert.NotNull(manifest);
        Assert.Equal("2026-07-22-hotfix-01", manifest!.PatchId);
        Assert.True(manifest.Silent);
        Assert.Equal(2, manifest.Files.Count);
        Assert.Equal("web", manifest.Files[0].Target);
        Assert.Equal("https://example.com/f.dll", manifest.Files[1].Url);
    }

    [Fact]
    public void ParseManifest_ReturnsNull_ForInvalidJson()
    {
        Assert.Null(PatchService.ParseManifest("not json"));
    }

    [Fact]
    public async Task ApplyAsync_RejectsManifestWithoutHashes()
    {
        var manifest = new PatchManifest("p1", "test", "low", true,
            new List<PatchFileEntry> { new("a.js", "web", null, null) });

        var result = await _service.ApplyAsync(manifest);

        Assert.False(result.Success);
        Assert.Contains("sha256", result.Error);
    }

    [Fact]
    public async Task ApplyAsync_RejectsBinaryPatchWithoutSignature()
    {
        _configMock.Setup(c => c["PATCH_SIGNING_PUBLIC_KEY"]).Returns("base64publickey==");
        var service = new PatchService(_httpFactoryMock.Object, _configMock.Object, _loggerMock.Object);

        var manifest = new PatchManifest("p1", "test", "low", true,
            new List<PatchFileEntry> { new("WatchNexus.Core.dll", "app", null, "hash123") });

        var result = await service.ApplyAsync(manifest, signatureValid: false);

        Assert.False(result.Success);
        Assert.Contains("signature verification failed", result.Error);
    }

    [Fact]
    public async Task ApplyAsync_AllowsWebPatchWithoutSignature()
    {
        var manifest = new PatchManifest("p1", "test", "low", true,
            new List<PatchFileEntry> { new("static/js/fix.js", "web", null, "hash123") });

        var result = await _service.ApplyAsync(manifest, signatureValid: false);

        Assert.False(result.Success); // Will fail on download, but not due to signature
        Assert.DoesNotContain("signature", result.Error);
    }

    [Fact]
    public void ResolveTargetRoot_ResolvesWebTarget()
    {
        var resolveMethod = typeof(PatchService).GetMethod("ResolveTargetRoot", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        var entry = new PatchFileEntry("test.js", "web", null, "hash");
        var result = resolveMethod!.Invoke(_service, new object[] { entry });
        
        Assert.NotNull(result);
    }
}

public class AuthServiceTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IConfiguration> _configMock;
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"AuthTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _configMock = new Mock<IConfiguration>();
        _configMock.Setup(c => c["Jwt:Secret"]).Returns("this-is-a-very-long-secret-key-that-is-at-least-32-chars");

        _service = new AuthService(_db, _configMock.Object);
    }

    [Fact]
    public void Constructor_Throws_WhenJwtSecretMissing()
    {
        _configMock.Setup(c => c["Jwt:Secret"]).Returns((string?)null);
        
        Assert.Throws<InvalidOperationException>(() => new AuthService(_db, _configMock.Object));
    }

    [Fact]
    public void CreateUser_CreatesUser_WithHashedPassword()
    {
        var user = _service.CreateUser("test@example.com", "testuser", "password123", "user");

        Assert.NotNull(user);
        Assert.Equal("test@example.com", user.Email);
        Assert.Equal("testuser", user.Username);
        Assert.Equal("user", user.Role);
        Assert.True(BCrypt.Net.BCrypt.Verify("password123", user.PasswordHash));
    }

    [Fact]
    public void CreateUser_ReturnsNull_WhenEmailExists()
    {
        _service.CreateUser("test@example.com", "testuser1", "password123");
        var user = _service.CreateUser("test@example.com", "testuser2", "password456");

        Assert.Null(user);
    }

    [Fact]
    public void Login_ReturnsUserAndToken_ForValidCredentials()
    {
        _service.CreateUser("test@example.com", "testuser", "password123");

        var (user, token) = _service.Login("test@example.com", "password123");

        Assert.NotNull(user);
        Assert.Equal("test@example.com", user!.Email);
        Assert.NotNull(token);
        Assert.NotEmpty(token);
    }

    [Fact]
    public void Login_ReturnsNull_ForInvalidEmail()
    {
        var (user, token) = _service.Login("nonexistent@example.com", "password123");

        Assert.Null(user);
        Assert.Null(token);
    }

    [Fact]
    public void Login_ReturnsNull_ForInvalidPassword()
    {
        _service.CreateUser("test@example.com", "testuser", "password123");

        var (user, token) = _service.Login("test@example.com", "wrongpassword");

        Assert.Null(user);
        Assert.Null(token);
    }

    [Fact]
    public void Login_AcceptsUsername_AsEmail()
    {
        _service.CreateUser("test@example.com", "testuser", "password123");

        var (user, token) = _service.Login("testuser", "password123");

        Assert.NotNull(user);
        Assert.NotNull(token);
    }

    [Fact]
    public void GenerateToken_IncludesRequiredClaims()
    {
        var user = new AppUser
        {
            Id = "user-1",
            Email = "test@example.com",
            Username = "testuser",
            Role = "admin",
            PasswordHash = "hash"
        };

        var token = _service.GenerateToken(user);

        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);
        
        Assert.Equal("WatchNexus", jwt.Issuer);
        Assert.Equal("WatchNexus", jwt.Audiences.First());
        Assert.Contains(jwt.Claims, c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier && c.Value == "user-1");
        Assert.Contains(jwt.Claims, c => c.Type == System.Security.Claims.ClaimTypes.Email && c.Value == "test@example.com");
        Assert.Contains(jwt.Claims, c => c.Type == System.Security.Claims.ClaimTypes.Name && c.Value == "testuser");
        Assert.Contains(jwt.Claims, c => c.Type == System.Security.Claims.ClaimTypes.Role && c.Value == "admin");
        Assert.Contains(jwt.Claims, c => c.Type == "tv"); // token version
    }
}

public class ModuleLoaderTests
{
    public ModuleLoaderTests()
    {
        ModuleRegistry.ClearForTesting();
    }

    [Fact]
    public void ModuleRegistry_RegistersManifest()
    {
        var manifest = new ModuleManifest
        {
            Name = "test-module",
            DisplayName = "Test Module",
            Version = "1.0.0",
            Codename = "test",
            Tier = "pro",
            ApiRoutePrefix = "test"
        };

        ModuleRegistry.Register(manifest);

        Assert.True(ModuleRegistry.All.ContainsKey("test"));
        Assert.Equal("pro", ModuleRegistry.All["test"].Tier);
        Assert.True(ModuleRegistry.RouteMap.ContainsKey("api/test"));
        Assert.Equal("test", ModuleRegistry.RouteMap["api/test"]);
    }

    [Fact]
    public void ModuleRegistry_TryGetTier_ReturnsTier()
    {
        var manifest = new ModuleManifest
        {
            Name = "test-module",
            Codename = "test",
            Tier = "ultra"
        };

        ModuleRegistry.Register(manifest);

        Assert.True(ModuleRegistry.TryGetTier("test", out var tier));
        Assert.Equal("ultra", tier);
    }

    [Fact]
    public void ModuleRegistry_TryGetByRoute_FindsByPrefix()
    {
        var manifest = new ModuleManifest
        {
            Name = "test-module",
            Codename = "test",
            Tier = "pro",
            ApiRoutePrefix = "test"
        };

        ModuleRegistry.Register(manifest);

        Assert.True(ModuleRegistry.TryGetByRoute("api/test/endpoint", out var codename));
        Assert.Equal("test", codename);
    }

    [Fact]
    public void ModuleRegistry_TryGetByRoute_FindsByRoute()
    {
        var manifest = new ModuleManifest
        {
            Name = "test-module",
            Codename = "test",
            Tier = "pro",
            ApiRoutes = new[] { "api/custom/route" }
        };

        ModuleRegistry.Register(manifest);

        Assert.True(ModuleRegistry.TryGetByRoute("api/custom/route", out var codename));
        Assert.Equal("test", codename);
    }

    [Fact]
    public void ModuleManifest_DeserializesFromJson()
    {
        var json = """{"name":"test","display_name":"Test Module","version":"1.0.0","codename":"test","tier":"pro","api_route_prefix":"api/test"}""";
        var manifest = JsonSerializer.Deserialize<ModuleManifest>(json);

        Assert.NotNull(manifest);
        Assert.Equal("test", manifest!.Name);
        Assert.Equal("Test Module", manifest.DisplayName);
        Assert.Equal("pro", manifest.Tier);
        Assert.Equal("api/test", manifest.ApiRoutePrefix);
    }
}
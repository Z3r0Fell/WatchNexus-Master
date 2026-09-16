using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Core.Services;
using WatchNexus.Shared;

namespace WatchNexus.Core.Tests;

public class UpdateBackgroundServiceTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IHttpClientFactory> _httpFactoryMock;
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<ILogger<UpdateBackgroundService>> _loggerMock;
    private readonly UpdateBackgroundService _service;

    public UpdateBackgroundServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"UpdateTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _httpFactoryMock = new Mock<IHttpClientFactory>();
        _loggerMock = new Mock<ILogger<UpdateBackgroundService>>();

        var services = new ServiceCollection();
        services.AddSingleton(_db);
        services.AddSingleton(_httpFactoryMock.Object);
        services.AddSingleton<PatchService>(sp => new PatchService(
            _httpFactoryMock.Object, 
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PATCH_REPO_URL"] = "https://api.github.com/repos/owner/repo"
            }).Build(),
            new Mock<ILogger<PatchService>>().Object));
        var provider = services.BuildServiceProvider();
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _scopeFactoryMock.Setup(f => f.CreateScope()).Returns(provider.CreateScope());

        _service = new UpdateBackgroundService(_scopeFactoryMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task RecordAsync_RecordsAppliedPatch()
    {
        var manifest = new PatchManifest("patch-123", "Test patch", "low", true, new List<PatchFileEntry>());
        var result = new PatchApplyResult(true, "patch-123", new List<string> { "file1.js" }, new List<string>(), false, null, true);

        await UpdateBackgroundService.RecordAsync(_db, manifest, result, "test");

        var record = await _db.Settings.FirstOrDefaultAsync(s => s.Key.StartsWith("update_applied:") && s.UserId == "");
        Assert.NotNull(record);
        
        var done = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_patch_done:patch-123" && s.UserId == "");
        Assert.NotNull(done);
    }

    [Fact]
    public async Task RecordAsync_RecordsRestartPending_WhenRestartRequired()
    {
        var manifest = new PatchManifest("patch-123", "Test patch", "low", true, new List<PatchFileEntry>());
        var result = new PatchApplyResult(true, "patch-123", new List<string>(), new List<string> { "WatchNexus.Core.dll" }, true, null, true);

        await UpdateBackgroundService.RecordAsync(_db, manifest, result, "auto");

        var restart = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "update_restart_pending" && s.UserId == "");
        Assert.NotNull(restart);
        var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(restart!.Value!);
        Assert.Equal("patch-123", parsed!["patch_id"].GetString());
        var stagedArray = parsed["staged"].EnumerateArray();
        Assert.Contains(stagedArray, e => e.GetString() == "WatchNexus.Core.dll");
    }
}

public class BotBackgroundServiceTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IServiceProvider> _servicesMock;
    private readonly Mock<IHttpClientFactory> _httpFactoryMock;
    private readonly Mock<ILogger<BotBackgroundService>> _loggerMock;
    private readonly BotBackgroundService _service;

    public BotBackgroundServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"BotTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _httpFactoryMock = new Mock<IHttpClientFactory>();
        _loggerMock = new Mock<ILogger<BotBackgroundService>>();
        _servicesMock = new Mock<IServiceProvider>();

        var scopeMock = new Mock<IServiceScope>();
        scopeMock.Setup(s => s.ServiceProvider).Returns(_servicesMock.Object);
        _servicesMock.Setup(s => s.GetService(typeof(AppDbContext))).Returns(_db);
        _servicesMock.Setup(s => s.GetService(typeof(IHttpClientFactory))).Returns(_httpFactoryMock.Object);
        
        var scopeFactoryMock = new Mock<IServiceScopeFactory>();
        scopeFactoryMock.Setup(f => f.CreateScope()).Returns(scopeMock.Object);
        
        _servicesMock.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(scopeFactoryMock.Object);

        _service = new BotBackgroundService(_servicesMock.Object, _loggerMock.Object);
    }

    [Fact]
    public void Constructor_CreatesInstance()
    {
        Assert.NotNull(_service);
    }
}

public class WatchPartyConnectionManagerTests
{
    private readonly WatchPartyConnectionManager _manager;

    public WatchPartyConnectionManagerTests()
    {
        _manager = new WatchPartyConnectionManager();
    }

    [Fact]
    public async Task BroadcastToParty_DoesNothing_WhenNoConnections()
    {
        await _manager.BroadcastToParty("nonexistent", "test message");
        // Should not throw
    }
}

public class TrayIconServiceTests
{
    private readonly Mock<IHostApplicationLifetime> _lifetimeMock;
    private readonly Mock<ILogger<TrayIconService>> _loggerMock;
    private readonly TrayIconService _service;

    public TrayIconServiceTests()
    {
        _lifetimeMock = new Mock<IHostApplicationLifetime>();
        _loggerMock = new Mock<ILogger<TrayIconService>>();
        _service = new TrayIconService(_lifetimeMock.Object, _loggerMock.Object);
    }

    [Fact]
    public void Constructor_CreatesInstance()
    {
        Assert.NotNull(_service);
    }
}

public class FortressIntegrityTests
{
    private readonly AppDbContext _db;

    public FortressIntegrityTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"FortressIntegrityTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);
    }

    [Fact]
    public async Task SealBuild_CreatesManifest()
    {
        await FortressIntegrity.SealBuild(_db);

        var manifest = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fortress_manifest" && s.UserId == "");
        Assert.NotNull(manifest);
        Assert.NotNull(manifest!.Value);

        var doc = JsonDocument.Parse(manifest.Value).RootElement;
        Assert.Equal("1.0", doc.GetProperty("version").GetString());
        Assert.Equal("1.0.4", doc.GetProperty("app_version").GetString());
        Assert.NotNull(doc.GetProperty("file_hashes"));
        Assert.NotNull(doc.GetProperty("sealed_at"));
        Assert.NotNull(doc.GetProperty("machine_id"));
    }

    [Fact]
    public async Task VerifyIntegrity_FirstRun_SealsAndReturnsValid()
    {
        var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);

        Assert.True(valid);
        Assert.Empty(violations);
    }

    [Fact]
    public async Task VerifyIntegrity_DetectsMissingFiles()
    {
        await FortressIntegrity.SealBuild(_db);

        var manifest = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fortress_manifest" && s.UserId == "");
        var doc = JsonDocument.Parse(manifest!.Value!).RootElement;
        var hashes = doc.GetProperty("file_hashes");
        var firstFile = hashes.EnumerateObject().First().Name;
        var filePath = Path.Combine(AppContext.BaseDirectory, firstFile);

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);

        Assert.False(valid);
        Assert.Contains(violations, v => v.StartsWith("MISSING:"));
    }

    [Fact]
    public async Task VerifyIntegrity_DetectsTamperedFiles()
    {
        await FortressIntegrity.SealBuild(_db);

        var manifest = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fortress_manifest" && s.UserId == "");
        var doc = JsonDocument.Parse(manifest!.Value!).RootElement;
        var hashes = doc.GetProperty("file_hashes");
        var firstFile = hashes.EnumerateObject().First().Name;
        var filePath = Path.Combine(AppContext.BaseDirectory, firstFile);

        if (File.Exists(filePath))
        {
            var originalContent = await File.ReadAllBytesAsync(filePath);
            await File.WriteAllBytesAsync(filePath, System.Text.Encoding.UTF8.GetBytes("TAMPERED CONTENT"));

            var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);

            await File.WriteAllBytesAsync(filePath, originalContent);

            Assert.False(valid);
            Assert.Contains(violations, v => v.StartsWith("TAMPERED:"));
        }
    }

    [Fact]
    public async Task VerifyIntegrity_ReturnsValid_WhenManifestMissing()
    {
        var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);
        
        Assert.True(valid);
        Assert.Empty(violations);
    }
}

public class ModuleLoaderIntegrationTests
{
    [Fact]
    public void DiscoverAndRegister_LogsWhenDirectoryNotFound()
    {
        var logger = new Mock<Action<string>>();
        ModuleLoader.Logger = logger.Object;

        ModuleLoader.DiscoverAndRegister(new ServiceCollection(), "/nonexistent/path");

        logger.Verify(l => l(It.Is<string>(s => s.Contains("not found"))), Times.Once);
    }

    [Fact]
    public void CompileAndLoadSeparated_LogsWhenDirectoryNotFound()
    {
        var logger = new Mock<Action<string>>();
        ModuleLoader.Logger = logger.Object;

        ModuleLoader.CompileAndLoadSeparated(new ServiceCollection(), "/nonexistent/path");

        logger.Verify(l => l(It.Is<string>(s => s.Contains("not found"))), Times.Once);
    }

    [Fact]
    public void GetModuleStatus_ReturnsDiscoveredManifests()
    {
        var manifest = new ModuleManifest
        {
            Name = "test-module",
            DisplayName = "Test Module",
            Version = "1.0.0",
            Codename = "test",
            Tier = "standard"
        };
        ModuleRegistry.Register(manifest);

        var status = ModuleLoader.GetModuleStatus();

        Assert.NotEmpty(status);
        var found = status.FirstOrDefault(s => s.GetType().GetProperty("name")!.GetValue(s)!.ToString() == "test-module");
        Assert.NotNull(found);
    }
}

// Helper classes
internal class MockHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, CancellationToken, HttpResponseMessage> _handler;

    public MockHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, HttpResponseMessage> handler)
    {
        _handler = handler;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        return Task.FromResult(_handler(request, cancellationToken));
    }
}

internal class TestDataProtectionProvider : Microsoft.AspNetCore.DataProtection.IDataProtectionProvider
{
    private readonly Microsoft.AspNetCore.DataProtection.IDataProtectionProvider _realProvider;

    public TestDataProtectionProvider()
    {
        var services = new ServiceCollection();
        services.AddDataProtection()
            .SetApplicationName("WatchNexus.Tests")
            .DisableAutomaticKeyGeneration()
            .UseEphemeralDataProtectionProvider();
        var provider = services.BuildServiceProvider();
        _realProvider = provider.GetRequiredService<IDataProtectionProvider>();
    }

    public Microsoft.AspNetCore.DataProtection.IDataProtector CreateProtector(string purpose)
    {
        return _realProvider.CreateProtector(purpose);
    }
}
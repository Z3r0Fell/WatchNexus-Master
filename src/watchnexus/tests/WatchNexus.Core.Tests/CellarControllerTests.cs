using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Tests;

public class CellarControllerTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IHttpClientFactory> _httpFactoryMock;
    private readonly Mock<IConfiguration> _configMock;
    private readonly CellarController _controller;

    public CellarControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"CellarTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _httpFactoryMock = new Mock<IHttpClientFactory>();
        _configMock = new Mock<IConfiguration>();
        _configMock.Setup(c => c["LICENSE_SERVER_URL"]).Returns("https://licenses.watchnexus.ca");
        _configMock.Setup(c => c["LICENSE_SERVER_API_KEY"]).Returns("test-api-key");

        _controller = new CellarController(_db, _httpFactoryMock.Object, _configMock.Object);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user"),
            new Claim(ClaimTypes.Role, "admin")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user, Connection = { RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1") } }
        };
    }

    [Fact]
    public async Task FirstLaunch_ReturnsCorrectStatus_WhenNoLicense()
    {
        var result = await _controller.FirstLaunch();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.False((bool)props.First(p => p.Name == "has_license").GetValue(value)!);
        Assert.False((bool)props.First(p => p.Name == "setup_completed").GetValue(value)!);
        Assert.True((bool)props.First(p => p.Name == "needs_activation").GetValue(value)!);
    }

    [Fact]
    public async Task FirstLaunch_RateLimits_After5Attempts()
    {
        for (int i = 0; i < 5; i++)
        {
            var result = await _controller.FirstLaunch();
            Assert.IsType<OkObjectResult>(result);
        }

        var rateLimited = await _controller.FirstLaunch();
        var statusResult = Assert.IsType<ObjectResult>(rateLimited);
        Assert.Equal(429, statusResult.StatusCode);
    }

    [Fact]
    public async Task GetStatus_ReturnsStandardTier_WhenNoLicense()
    {
        var result = await _controller.GetStatus();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("standard", props.First(p => p.Name == "tier").GetValue(value));
        Assert.Equal("Standard", props.First(p => p.Name == "tier_name").GetValue(value));
        Assert.False((bool)props.First(p => p.Name == "activated").GetValue(value)!);
    }

    [Fact]
    public async Task GetStatus_ReturnsProTier_WhenValidLicenseStored()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash = CellarController.ComputeHash(serial);
        var licenseJson = JsonSerializer.Serialize(new
        {
            tier = "pro",
            serial,
            hash,
            activated_at = DateTime.UtcNow.ToString("o"),
            activation_id = "act-123"
        });

        _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseJson });
        await _db.SaveChangesAsync();

        var result = await _controller.GetStatus();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("pro", props.First(p => p.Name == "tier").GetValue(value));
        Assert.Equal("Pro", props.First(p => p.Name == "tier_name").GetValue(value));
        Assert.True((bool)props.First(p => p.Name == "activated").GetValue(value)!);
    }

    [Fact]
    public async Task Activate_RequiresAdminRole()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user"),
            new Claim(ClaimTypes.Role, "user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user, Connection = { RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1") } }
        };

        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.Activate(jsonElement);

        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, statusResult.StatusCode);
    }

    [Fact]
    public async Task Activate_RejectsEmptySerial()
    {
        var body = JsonSerializer.Serialize(new { serial = "" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.Activate(jsonElement);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task Activate_Returns503_WhenNoLicenseServerKey()
    {
        _configMock.Setup(c => c["LICENSE_SERVER_API_KEY"]).Returns((string?)null);

        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.Activate(jsonElement);

        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(503, statusResult.StatusCode);
    }

    [Fact]
    public async Task ActivateFirstLaunch_RejectsAfterSetupComplete()
    {
        _db.Settings.Add(new AppSetting { Key = "setup_completed", UserId = "", Value = "true" });
        await _db.SaveChangesAsync();

        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.ActivateFirstLaunch(jsonElement);

        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, statusResult.StatusCode);
    }

    [Fact]
    public async Task ActivateFirstLaunch_AcceptsSkip()
    {
        var body = JsonSerializer.Serialize(new { skip = true });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.ActivateFirstLaunch(jsonElement);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.True((bool)props.First(p => p.Name == "success").GetValue(value)!);
        Assert.Equal("standard", props.First(p => p.Name == "tier").GetValue(value));
    }

    [Fact]
    public async Task Deactivate_RemovesLicense()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash = CellarController.ComputeHash(serial);
        var licenseJson = JsonSerializer.Serialize(new
        {
            tier = "pro",
            serial,
            hash,
            activation_id = "act-123",
            activation_token = "token-123"
        });

        _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseJson });
        await _db.SaveChangesAsync();

        var result = await _controller.Deactivate();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.True((bool)props.First(p => p.Name == "success").GetValue(value)!);
        Assert.Equal("standard", props.First(p => p.Name == "tier").GetValue(value));

        var remaining = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        Assert.Null(remaining);
    }

    [Fact]
    public async Task GetTiers_ReturnsAllTiers()
    {
        var result = _controller.GetTiers();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var tiers = props.First(p => p.Name == "tiers").GetValue(value);
        Assert.NotNull(tiers);
    }

    [Fact]
    public async Task CheckModule_ReturnsUnlocked_ForStandardModule()
    {
        var result = await _controller.CheckModule("marmalade");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.True((bool)props.First(p => p.Name == "unlocked").GetValue(value)!);
        Assert.Equal("standard", props.First(p => p.Name == "required_tier").GetValue(value));
    }

    [Fact]
    public async Task CheckModule_ReturnsLocked_ForUltraModuleOnStandard()
    {
        var result = await _controller.CheckModule("crucible");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.False((bool)props.First(p => p.Name == "unlocked").GetValue(value)!);
        Assert.Equal("ultra", props.First(p => p.Name == "required_tier").GetValue(value));
    }

    [Fact]
    public void ResolveTier_FallsBackToStandard_OnTamperedHash()
    {
        var json = JsonSerializer.Serialize(new { tier = "ultra", serial = "WNX-ULT-AAAA-BBBB-CCCC", hash = "deadbeefdeadbeef" });
        var tier = CellarController.ResolveTier(json);
        Assert.Equal("standard", tier);
    }

    [Fact]
    public void ResolveTier_FallsBackToStandard_OnMissingSerialOrHash()
    {
        Assert.Equal("standard", CellarController.ResolveTier("{\"tier\":\"ultra\"}"));
        Assert.Equal("standard", CellarController.ResolveTier(JsonSerializer.Serialize(new { tier = "pro", serial = "WNX-PRO-AAAA-BBBB-CCCC", hash = (string?)null })));
        Assert.Equal("standard", CellarController.ResolveTier(JsonSerializer.Serialize(new { tier = "pro", serial = "", hash = "abc" })));
    }

    [Fact]
    public void ResolveTier_GrantsPaidTier_WhenHashMatches()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash = CellarController.ComputeHash(serial);
        var json = JsonSerializer.Serialize(new { tier = "pro", serial, hash });
        var tier = CellarController.ResolveTier(json);
        Assert.Equal("pro", tier);
    }

    [Fact]
    public void ComputeHash_IsDeterministic()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash1 = CellarController.ComputeHash(serial);
        var hash2 = CellarController.ComputeHash(serial);
        Assert.Equal(hash1, hash2);
    }

    [Fact]
    public void MaskSerial_MasksShortFormat()
    {
        var maskMethod = typeof(CellarController).GetMethod("MaskSerial", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var masked = maskMethod!.Invoke(null, new object[] { "WNX-PRO-AAAA-BBBB-CCCC" });
        Assert.Equal("WNX-PRO-AAAA-****-****", masked);
    }

    [Fact]
    public void IsValidUpgrade_AllowsValidUpgrades()
    {
        var upgradeMethod = typeof(CellarController).GetMethod("IsValidUpgrade", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        Assert.True((bool)upgradeMethod!.Invoke(null, new object[] { "standard", "pro" })!);
        Assert.True((bool)upgradeMethod.Invoke(null, new object[] { "standard", "ultra" })!);
        Assert.True((bool)upgradeMethod.Invoke(null, new object[] { "pro", "ultra" })!);
    }

    [Fact]
    public void IsValidUpgrade_RejectsInvalidUpgrades()
    {
        var upgradeMethod = typeof(CellarController).GetMethod("IsValidUpgrade", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        Assert.False((bool)upgradeMethod!.Invoke(null, new object[] { "pro", "standard" })!);
        Assert.False((bool)upgradeMethod.Invoke(null, new object[] { "ultra", "pro" })!);
        Assert.False((bool)upgradeMethod.Invoke(null, new object[] { "pro", "pro" })!);
    }

    [Fact]
    public void GetUnlockedModules_IncludesAllLowerTiers()
    {
        var standard = CellarController.GetUnlockedModules("standard");
        var pro = CellarController.GetUnlockedModules("pro");
        var ultra = CellarController.GetUnlockedModules("ultra");

        Assert.Contains("marmalade", standard);
        Assert.Contains("compote", pro);
        Assert.Contains("crucible", ultra);
        Assert.True(standard.Length < pro.Length);
        Assert.True(pro.Length < ultra.Length);
    }
}
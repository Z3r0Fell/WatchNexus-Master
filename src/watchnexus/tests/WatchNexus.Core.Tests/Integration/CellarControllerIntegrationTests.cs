using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for CellarController (License Tier Management)
/// Covers: /api/cellar/*
/// </summary>
public class CellarControllerIntegrationTests : IntegrationTestBase
    {
    public CellarControllerIntegrationTests() : base() { }

    #region First Launch

    [Fact]
    public async Task FirstLaunch_NoLicense_ReturnsCorrectStatus()
    {
        // Act
        var response = await Client.GetAsync("/api/cellar/first-launch");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.False(json.GetProperty("has_license").GetBoolean());
        Assert.False(json.GetProperty("setup_completed").GetBoolean());
        Assert.True(json.GetProperty("needs_activation").GetBoolean());
    }

    [Fact]
    public async Task FirstLaunch_WithLicense_ReturnsHasLicense()
    {
        // Arrange
        await SeedLicenseAsync("pro");

        // Act
        var response = await Client.GetAsync("/api/cellar/first-launch");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("has_license").GetBoolean());
        Assert.False(json.GetProperty("setup_completed").GetBoolean());
        Assert.False(json.GetProperty("needs_activation").GetBoolean());
    }

    [Fact]
    public async Task FirstLaunch_RateLimited_After5Requests()
    {
        // Act - make 5 requests
        for (int i = 0; i < 5; i++)
        {
            var response = await Client.GetAsync("/api/cellar/first-launch");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        // 6th request should be rate limited
        var rateLimited = await Client.GetAsync("/api/cellar/first-launch");
        
        // Assert
        Assert.Equal(HttpStatusCode.TooManyRequests, rateLimited.StatusCode);
        var json = await DeserializeResponseElement(rateLimited);
        Assert.False(json.GetProperty("success").GetBoolean());
        Assert.Contains("Too many requests", json.GetProperty("message").GetString() ?? "");
    }

    #endregion

    #region Get Status

    [Fact]
    public async Task GetStatus_NoAuth_Returns401()
    {
        // Arrange
        ClearAuthentication();

        // Act
        var response = await Client.GetAsync("/api/cellar/status");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetStatus_NoLicense_ReturnsStandardTier()
    {
        // Arrange
        AuthenticateAsUser();

        // Act
        var response = await Client.GetAsync("/api/cellar/status");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("standard", json.GetProperty("tier").GetString());
        Assert.Equal("Standard", json.GetProperty("tier_name").GetString());
        Assert.False(json.GetProperty("activated").GetBoolean());
        Assert.Null(json.GetProperty("serial"));
        Assert.Equal(71, json.GetProperty("total_modules").GetInt32()); // Standard modules count
    }

    [Fact]
    public async Task GetStatus_WithProLicense_ReturnsProTier()
    {
        // Arrange
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Act
        var response = await Client.GetAsync("/api/cellar/status");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("pro", json.GetProperty("tier").GetString());
        Assert.Equal("Pro", json.GetProperty("tier_name").GetString());
        Assert.True(json.GetProperty("activated").GetBoolean());
        Assert.NotNull(json.GetProperty("serial").GetString());
        Assert.True(json.GetProperty("total_modules").GetInt32() > 71); // Pro has more modules
    }

    [Fact]
    public async Task GetStatus_WithUltraLicense_ReturnsUltraTier()
    {
        // Arrange
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        // Act
        var response = await Client.GetAsync("/api/cellar/status");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("ultra", json.GetProperty("tier").GetString());
        Assert.Equal("Ultra", json.GetProperty("tier_name").GetString());
        Assert.True(json.GetProperty("activated").GetBoolean());
        Assert.Equal(112, json.GetProperty("total_modules").GetInt32()); // All modules
    }

    [Fact]
    public async Task GetStatus_TamperedLicense_FallsBackToStandard()
    {
        // Arrange
        AuthenticateAsUser();
        var tamperedJson = JsonSerializer.Serialize(new { tier = "ultra", serial = "WNX-ULT-AAAA-BBBB-CCCC", hash = "deadbeefdeadbeef" });
        DbContext.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = tamperedJson });
        await DbContext.SaveChangesAsync();

        // Act
        var response = await Client.GetAsync("/api/cellar/status");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("standard", json.GetProperty("tier").GetString());
        Assert.False(json.GetProperty("activated").GetBoolean());
    }

    #endregion

    #region Get Tiers

    [Fact]
    public async Task GetTiers_NoAuth_ReturnsTierManifest()
    {
        // Arrange
        ClearAuthentication();

        // Act
        var response = await Client.GetAsync("/api/cellar/tiers");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("tiers").GetProperty("standard").GetProperty("module_count").GetInt32() > 0);
        Assert.True(json.GetProperty("tiers").GetProperty("pro").GetProperty("includes_standard").GetBoolean());
        Assert.True(json.GetProperty("tiers").GetProperty("ultra").GetProperty("includes_pro").GetBoolean());
        Assert.Equal(3, json.GetProperty("upgrade_paths").GetArrayLength());
    }

    #endregion

    #region Check Module

    [Fact]
    public async Task CheckModule_StandardModuleOnStandard_ReturnsUnlocked()
    {
        // Arrange
        AuthenticateAsUser();

        // Act
        var response = await Client.GetAsync("/api/cellar/check/marmalade");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("unlocked").GetBoolean());
        Assert.Equal("standard", json.GetProperty("required_tier").GetString());
        Assert.Equal("standard", json.GetProperty("current_tier").GetString());
    }

    [Fact]
    public async Task CheckModule_UltraModuleOnStandard_ReturnsLocked()
    {
        // Arrange
        AuthenticateAsUser();

        // Act
        var response = await Client.GetAsync("/api/cellar/check/crucible");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.False(json.GetProperty("unlocked").GetBoolean());
        Assert.Equal("ultra", json.GetProperty("required_tier").GetString());
        Assert.Equal("standard", json.GetProperty("current_tier").GetString());
    }

    [Fact]
    public async Task CheckModule_ProModuleOnPro_ReturnsUnlocked()
    {
        // Arrange
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Act
        var response = await Client.GetAsync("/api/cellar/check/compote");

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("unlocked").GetBoolean());
        Assert.Equal("pro", json.GetProperty("required_tier").GetString());
        Assert.Equal("pro", json.GetProperty("current_tier").GetString());
    }

    #endregion

    #region Activate (Requires Admin)

    [Fact]
    public async Task Activate_NonAdmin_Returns403()
    {
        // Arrange
        AuthenticateAsUser("user", "user");
        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        // Act
        var response = await Client.PostAsync("/api/cellar/activate", content);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Activate_EmptySerial_Returns400()
    {
        // Arrange
        AuthenticateAsAdmin();
        var body = JsonSerializer.Serialize(new { serial = "" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        // Act
        var response = await Client.PostAsync("/api/cellar/activate", content);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Activate_NoLicenseServerKey_Returns503()
    {
        // Arrange
        AuthenticateAsAdmin();
        Services.GetRequiredService<IConfiguration>()["LICENSE_SERVER_API_KEY"] = "";
        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        // Act
        var response = await Client.PostAsync("/api/cellar/activate", content);

        // Assert
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    #endregion

    #region Activate First Launch

    [Fact]
    public async Task ActivateFirstLaunch_AfterSetupComplete_Returns403()
    {
        // Arrange
        DbContext.Settings.Add(new AppSetting { Key = "setup_completed", UserId = "", Value = "true" });
        await DbContext.SaveChangesAsync();
        
        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        // Act
        var response = await Client.PostAsync("/api/cellar/activate-first-launch", content);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ActivateFirstLaunch_Skip_ReturnsStandard()
    {
        // Arrange
        var body = JsonSerializer.Serialize(new { skip = true });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        // Act
        var response = await Client.PostAsync("/api/cellar/activate-first-launch", content);

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Equal("standard", json.GetProperty("tier").GetString());
    }

    #endregion

    #region Deactivate

    [Fact]
    public async Task Deactivate_RemovesLicenseAndReturnsStandard()
    {
        // Arrange
        AuthenticateAsAdmin();
        await SeedLicenseAsync("pro");

        // Act
        var response = await Client.PostAsync("/api/cellar/deactivate", null);

        // Assert
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Equal("standard", json.GetProperty("tier").GetString());
        
        // Verify license removed from DB
        var license = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        Assert.Null(license);
    }

    #endregion

    #region Idempotency Tests

    [Fact]
    public async Task GetStatus_RepeatedCalls_ReturnsConsistentResults()
    {
        // Arrange
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Act - multiple calls
        var responses = new List<HttpResponseMessage>();
        for (int i = 0; i < 5; i++)
        {
            responses.Add(await Client.GetAsync("/api/cellar/status"));
        }

        // Assert - all should be identical
        var firstJson = await DeserializeResponseElement(responses[0]);
        foreach (var resp in responses.Skip(1))
        {
            var json = await DeserializeResponseElement(resp);
            Assert.Equal(firstJson.GetProperty("tier").GetString(), json.GetProperty("tier").GetString());
            Assert.Equal(firstJson.GetProperty("activated").GetBoolean(), json.GetProperty("activated").GetBoolean());
        }
    }

    #endregion
}
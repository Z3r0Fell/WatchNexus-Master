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
/// Integration tests for FortressController and FortressFilter (Tier Enforcement)
/// Covers: /api/fortress/* and tier gating on all /api/{module}/* endpoints
/// </summary>
public class FortressControllerIntegrationTests : IntegrationTestBase
    {
    public FortressControllerIntegrationTests() : base() { }


    #region Fortress Status Endpoints (Admin Only)

    [Fact]
    public async Task FortressStatus_NoAuth_Returns401()
    {
        ClearAuthentication();
        var response = await Client.GetAsync("/api/fortress/status");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task FortressStatus_NonAdmin_Returns403()
    {
        AuthenticateAsUser("user", "user");
        var response = await Client.GetAsync("/api/fortress/status");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task FortressStatus_Admin_ReturnsIntegrityStatus()
    {
        AuthenticateAsAdmin();
        var response = await Client.GetAsync("/api/fortress/status");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("1.0", json.GetProperty("fortress_version").GetString());
        Assert.Equal("1.0.4", json.GetProperty("app_version").GetString());
        Assert.NotNull(json.GetProperty("integrity_valid"));
        Assert.NotNull(json.GetProperty("protections"));
        Assert.True(json.GetProperty("protections").GetProperty("tier_enforcement").GetBoolean());
        Assert.True(json.GetProperty("protections").GetProperty("integrity_checks").GetBoolean());
    }

    [Fact]
    public async Task FortressReseal_Admin_CreatesNewManifest()
    {
        AuthenticateAsAdmin();
        var response = await Client.PostAsync("/api/fortress/reseal", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Contains("re-sealed", json.GetProperty("message").GetString() ?? "");
    }

    [Fact]
    public async Task FortressVerify_Admin_ReturnsValidationResult()
    {
        AuthenticateAsAdmin();
        var response = await Client.PostAsync("/api/fortress/verify", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("valid"));
        Assert.NotNull(json.GetProperty("violations"));
        Assert.NotNull(json.GetProperty("checked_at"));
    }

    #endregion

    #region Tier Enforcement - FortressFilter Integration Tests

    [Theory]
    [InlineData("/api/compote/indexers", "standard", HttpStatusCode.Forbidden)]      // Pro module
    [InlineData("/api/compote/indexers", "pro", HttpStatusCode.OK)]                  // Pro module with Pro license
    [InlineData("/api/compote/indexers", "ultra", HttpStatusCode.OK)]                // Pro module with Ultra license
    [InlineData("/api/crucible/jobs", "standard", HttpStatusCode.Forbidden)]         // Ultra module
    [InlineData("/api/crucible/jobs", "pro", HttpStatusCode.Forbidden)]              // Ultra module with Pro license
    [InlineData("/api/crucible/jobs", "ultra", HttpStatusCode.OK)]                   // Ultra module with Ultra license
    [InlineData("/api/pepper/channels", "standard", HttpStatusCode.Forbidden)]       // Ultra module
    [InlineData("/api/pepper/channels", "pro", HttpStatusCode.Forbidden)]            // Ultra module with Pro license
    [InlineData("/api/pepper/channels", "ultra", HttpStatusCode.OK)]                 // Ultra module with Ultra license
    [InlineData("/api/vpn/server", "standard", HttpStatusCode.Forbidden)]            // Ultra module
    [InlineData("/api/vpn/server", "pro", HttpStatusCode.Forbidden)]                 // Ultra module with Pro license
    [InlineData("/api/vpn/server", "ultra", HttpStatusCode.OK)]                      // Ultra module with Ultra license
    public async Task FortressFilter_EnforcesTierOnModuleEndpoints(string endpoint, string tier, HttpStatusCode expectedStatus)
    {
        // Arrange
        AuthenticateAsUser();
        if (tier != "standard") await SeedLicenseAsync(tier);

        // Act
        var response = await Client.GetAsync(endpoint);

        // Assert
        Assert.Equal(expectedStatus, response.StatusCode);
        
        if (expectedStatus == HttpStatusCode.Forbidden)
        {
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.Equal("FORTRESS_TIER_LOCKED", json.GetProperty("error").GetString());
            Assert.Equal(tier, json.GetProperty("current_tier").GetString());
        }
    }

    [Fact]
    public async Task FortressFilter_ExemptsCrucibleFfmpegStatus()
    {
        // Arrange - no license (standard tier)
        AuthenticateAsUser();

        // Act - ffmpeg-status is exempt
        var response = await Client.GetAsync("/api/crucible/ffmpeg-status");

        // Assert - should be allowed even on standard tier
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/gadgets/synapse-admin/status", "standard", HttpStatusCode.Forbidden)]  // Maps to cinnamon (ultra)
    [InlineData("/api/gadgets/synapse-admin/status", "pro", HttpStatusCode.Forbidden)]       // cinnamon is ultra
    [InlineData("/api/gadgets/synapse-admin/status", "ultra", HttpStatusCode.OK)]            // ultra allowed
    [InlineData("/api/gadgets/gamebot/status", "standard", HttpStatusCode.Forbidden)]        // Maps to waffle (ultra)
    [InlineData("/api/gadgets/gamebot/status", "pro", HttpStatusCode.Forbidden)]             // waffle is ultra
    [InlineData("/api/gadgets/gamebot/status", "ultra", HttpStatusCode.OK)]                  // ultra allowed
    [InlineData("/api/gadgets/media-bridge/status", "standard", HttpStatusCode.Forbidden)]   // Maps to custard (ultra)
    [InlineData("/api/gadgets/media-bridge/status", "pro", HttpStatusCode.Forbidden)]        // custard is ultra
    [InlineData("/api/gadgets/media-bridge/status", "ultra", HttpStatusCode.OK)]             // ultra allowed
    [InlineData("/api/gadgets/bot/status", "standard", HttpStatusCode.Forbidden)]            // Maps to yeast (ultra)
    [InlineData("/api/gadgets/bot/status", "pro", HttpStatusCode.Forbidden)]                 // yeast is ultra
    [InlineData("/api/gadgets/bot/status", "ultra", HttpStatusCode.OK)]                      // ultra allowed
    [InlineData("/api/gadgets/matrix/status", "standard", HttpStatusCode.Forbidden)]         // Maps to marzipan (ultra)
    [InlineData("/api/gadgets/matrix/status", "pro", HttpStatusCode.Forbidden)]              // marzipan is ultra
    [InlineData("/api/gadgets/matrix/status", "ultra", HttpStatusCode.OK)]                   // ultra allowed
    [InlineData("/api/gadgets/brine/status", "standard", HttpStatusCode.Forbidden)]          // Maps to brine (ultra)
    [InlineData("/api/gadgets/brine/status", "pro", HttpStatusCode.Forbidden)]               // brine is ultra
    [InlineData("/api/gadgets/brine/status", "ultra", HttpStatusCode.OK)]                    // ultra allowed
    [InlineData("/api/gadgets/ladle/status", "standard", HttpStatusCode.Forbidden)]          // Maps to ladle (ultra)
    [InlineData("/api/gadgets/ladle/status", "pro", HttpStatusCode.Forbidden)]               // ladle is ultra
    [InlineData("/api/gadgets/ladle/status", "ultra", HttpStatusCode.OK)]                    // ultra allowed
    public async Task FortressFilter_GadgetRoutes_EnforcesTier(string endpoint, string tier, HttpStatusCode expectedStatus)
    {
        // Arrange
        AuthenticateAsUser();
        if (tier != "standard") await SeedLicenseAsync(tier);

        // Act
        var response = await Client.GetAsync(endpoint);

        // Assert
        Assert.Equal(expectedStatus, response.StatusCode);
        
        if (expectedStatus == HttpStatusCode.Forbidden)
        {
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.Equal("FORTRESS_TIER_LOCKED", json.GetProperty("error").GetString());
        }
    }

    [Fact]
    public async Task FortressFilter_StandardEndpoints_AlwaysAccessible()
    {
        // Arrange
        AuthenticateAsUser(); // standard tier

        // Act & Assert - standard tier endpoints should always work
        var standardEndpoints = new[]
        {
            "/api/cellar/status",
            "/api/cellar/tiers",
            "/api/cellar/check/marmalade",
            "/api/system/info",
            "/api/system/stats",
            "/api/settings",
            "/api/tmdb/search?query=test",
            "/api/watchlist",
            "/api/watch-progress",
            "/api/next-up",
            "/api/library",
            "/api/media/health-check"
        };

        foreach (var endpoint in standardEndpoints)
        {
            var response = await Client.GetAsync(endpoint);
            Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Fact]
    public async Task FortressFilter_ProEndpoints_BlockedOnStandard()
    {
        // Arrange
        AuthenticateAsUser(); // standard tier

        // Act & Assert - Pro endpoints should be blocked
        var proEndpoints = new[]
        {
            "/api/compote/indexers",
            "/api/fondue/status",
            "/api/bastion/status",
            "/api/truffle/status",
            "/api/tunnel/status",
            "/api/sprout/status",
            "/api/drizzle/status",
            "/api/meringue/status",
            "/api/nutmeg/status",
            "/api/streaming-logins/services",
            "/api/streaming-services",
            "/api/iptv/sources",
            "/api/biscotti/status",
            "/api/treacle/status",
            "/api/sage/status",
            "/api/terrine/status"
        };

        foreach (var endpoint in proEndpoints)
        {
            var response = await Client.GetAsync(endpoint);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    [Fact]
    public async Task FortressFilter_UltraEndpoints_BlockedOnPro()
    {
        // Arrange
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Act & Assert - Ultra endpoints should be blocked on Pro
        var ultraEndpoints = new[]
        {
            "/api/security/stats",
            "/api/rind/profile",
            "/api/pepper/channels",
            "/api/crucible/jobs",
            "/api/strudel/status",
            "/api/crumbs/status",
            "/api/taffy/status",
            "/api/cinnamon/status",
            "/api/waffle/status",
            "/api/custard/status",
            "/api/yeast/status",
            "/api/brine/status",
            "/api/ladle/status",
            "/api/vpn/server",
            "/api/qbittorrent/status",
            "/api/subtitles/settings",
            "/api/pretzel/status",
            "/api/parfait/status",
            "/api/menu/status",
            "/api/popsicle/status",
            "/api/preserves/status",
            "/api/marshmallow/status",
            "/api/chowder/status",
            "/api/watch-party/list"
        };

        foreach (var endpoint in ultraEndpoints)
        {
            var response = await Client.GetAsync(endpoint);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }

    #endregion

    #region Module Registry Integration

    [Fact]
    public async Task FortressFilter_RespectsModuleRegistryOverHardcodedMap()
    {
        // Arrange - Register a custom module with a specific tier
        var module = new ModuleManifest
        {
            Codename = "custom-test-module",
            Tier = "pro",
            ApiRoutePrefix = "custom"
        };
        ModuleRegistry.Register(module);

        AuthenticateAsUser(); // standard tier

        // Act - should be blocked (pro tier required)
        var response = await Client.GetAsync("/api/custom/test");

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        
        var json = await DeserializeResponseElement(response);
        Assert.Equal("pro", json.GetProperty("required_tier").GetString());
    }

    #endregion
}
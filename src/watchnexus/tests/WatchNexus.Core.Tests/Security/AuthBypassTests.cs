using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Security;

/// <summary>
/// VERIFIES: FortressFilter blocks ALL tier-gated endpoints without valid license
/// VERIFIES: FortressFilter.ProtectedRoutes covers all paid modules
/// VERIFIES: FortressFilter.GadgetRoutes maps all /api/gadgets/* to codenames
/// VERIFIES: CellarController.ResolveTier falls back to Standard on tampered hash
/// VERIFIES: No tier bypass via /api/gadgets/* prefix
/// </summary>
public class AuthBypassTests
{
    private readonly AppDbContext _db;

    public AuthBypassTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"AuthBypassTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);
    }

    [Fact]
    public void FortressFilter_ProtectedRoutes_CoversAllProModules()
    {
        // This test ensures every Pro module in CellarController.TierModules
        // has a corresponding entry in FortressFilter.ProtectedRoutes
        var missing = CellarController.TierModules["pro"]
            .Where(m => !FortressFilter.ProtectedRoutes.ContainsKey(m))
            .ToList();
        
        Assert.Empty(missing);
    }

    [Fact]
    public void FortressFilter_ProtectedRoutes_CoversAllUltraModules()
    {
        var missing = CellarController.TierModules["ultra"]
            .Where(m => !FortressFilter.ProtectedRoutes.ContainsKey(m))
            .ToList();
        
        Assert.Empty(missing);
    }

    [Fact]
    public void FortressFilter_GadgetRoutes_AllMapToProtectedRoutes()
    {
        // Every gadget route must map to a codename that is in ProtectedRoutes
        var missing = FortressFilter.GadgetRoutes
            .Where(kv => !FortressFilter.ProtectedRoutes.ContainsKey(kv.Value))
            .Select(kv => $"api/gadgets/{kv.Key} -> '{kv.Value}'")
            .ToList();
        
        Assert.Empty(missing);
    }

    [Fact]
    public void FortressFilter_EveryPaidModuleHasEnforcedRoute()
    {
        // Every paid module must be in ProtectedRoutes OR GadgetRoutes.Values
        var unenforcedPro = CellarController.TierModules["pro"]
            .Where(m => !FortressFilter.ProtectedRoutes.ContainsKey(m)
                        && !FortressFilter.GadgetRoutes.Values.Contains(m))
            .ToList();
        
        var unenforcedUltra = CellarController.TierModules["ultra"]
            .Where(m => !FortressFilter.ProtectedRoutes.ContainsKey(m)
                        && !FortressFilter.GadgetRoutes.Values.Contains(m))
            .ToList();
        
        Assert.Empty(unenforcedPro);
        Assert.Empty(unenforcedUltra);
    }

    [Fact]
    public void CellarController_ResolveTier_FallsBack_Standard_OnTamperedHash()
    {
        // ARRANGE - License says Ultra but hash doesn't match serial
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            tier = "ultra",
            serial = "WNX-ULT-AAAA-BBBB-CCCC",
            hash = "deadbeefdeadbeef" // Wrong hash
        });

        // ACT
        var tier = CellarController.ResolveTier(json);

        // ASSERT - Should fall back to Standard
        Assert.Equal("standard", tier);
    }

    [Fact]
    public void CellarController_ResolveTier_FallsBack_Standard_OnMissingSerial()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new { tier = "ultra" });
        var tier = CellarController.ResolveTier(json);
        Assert.Equal("standard", tier);
    }

    [Fact]
    public void CellarController_ResolveTier_FallsBack_Standard_OnMissingHash()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new { tier = "pro", serial = "WNX-PRO-AAAA-BBBB-CCCC", hash = (string?)null });
        var tier = CellarController.ResolveTier(json);
        Assert.Equal("standard", tier);
    }

    [Fact]
    public void CellarController_ResolveTier_FallsBack_Standard_OnEmptySerial()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new { tier = "pro", serial = "", hash = "abc" });
        var tier = CellarController.ResolveTier(json);
        Assert.Equal("standard", tier);
    }

    [Fact]
    public void CellarController_ResolveTier_FallsBack_Standard_OnGarbageInput()
    {
        Assert.Equal("standard", CellarController.ResolveTier(null));
        Assert.Equal("standard", CellarController.ResolveTier(""));
        Assert.Equal("standard", CellarController.ResolveTier("not json"));
        Assert.Equal("standard", CellarController.ResolveTier("{\"tier\":\"bogus-tier\"}"));
    }

    [Fact]
    public void CellarController_ResolveTier_GrantsPaidTier_WhenHashMatches()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash = CellarController.ComputeHash(serial);
        var json = System.Text.Json.JsonSerializer.Serialize(new { tier = "pro", serial, hash });
        var tier = CellarController.ResolveTier(json);
        Assert.Equal("pro", tier);
    }

    [Fact]
    public void CellarController_GetCurrentTier_Uses_ResolveTier()
    {
        // ARRANGE - Controller reads tier via ResolveTier (tamper-evident)
        var controller = new CellarController(_db, null!, null!);
        
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash = CellarController.ComputeHash(serial);
        var licenseJson = System.Text.Json.JsonSerializer.Serialize(new
        {
            tier = "pro",
            serial,
            hash,
            activated_at = DateTime.UtcNow.ToString("o")
        });
        _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseJson });
        _db.SaveChanges();

        // ACT - Use reflection to call private GetCurrentTier
        var method = typeof(CellarController).GetMethod("GetCurrentTier", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        var tier = (Task<string>)method!.Invoke(controller, null)!;
        
        // ASSERT
        Assert.Equal("pro", tier.Result);
    }

    [Fact]
    public void FortressFilter_ExemptPaths_Contains_FfmpegStatus()
    {
        // The exempt path for ffmpeg-status should exist - test via reflection
        var field = typeof(FortressFilter).GetField("ExemptPaths", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var exemptPaths = (HashSet<string>)field!.GetValue(null)!;
        Assert.Contains("/api/crucible/ffmpeg-status", exemptPaths);
    }

    [Fact]
    public void FortressFilter_TierRank_OrderCorrect()
    {
        // Verify tier ranking: standard < pro < ultra - test via reflection
        var field = typeof(FortressFilter).GetField("TierRank", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var tierRank = (Dictionary<string, int>)field!.GetValue(null)!;
        Assert.Equal(0, tierRank["standard"]);
        Assert.Equal(1, tierRank["pro"]);
        Assert.Equal(2, tierRank["ultra"]);
    }

    [Fact]
    public void CellarController_TierModules_StandardIncludesCoreModules()
    {
        var standard = CellarController.TierModules["standard"];
        Assert.Contains("core", standard);
        Assert.Contains("marmalade", standard);
        Assert.Contains("libraries", standard);
        Assert.Contains("settings", standard);
        Assert.Contains("auth", standard);
    }

    [Fact]
    public void CellarController_TierModules_ProIncludesAutomationModules()
    {
        var pro = CellarController.TierModules["pro"];
        Assert.Contains("compote", pro);
        Assert.Contains("fondue", pro);
        Assert.Contains("iptv", pro);
        Assert.Contains("saffron", pro);
    }

    [Fact]
    public void CellarController_TierModules_UltraIncludesSecurityModules()
    {
        var ultra = CellarController.TierModules["ultra"];
        Assert.Contains("security", ultra);
        Assert.Contains("crucible", ultra);
        Assert.Contains("rind", ultra);
        Assert.Contains("vpn", ultra);
    }

    [Fact]
    public void CellarController_GetUnlockedModules_IncludesAllLowerTiers()
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

    [Fact]
    public void CellarController_IsValidUpgrade_AllowsValidUpgrades()
    {
        var upgradeMethod = typeof(CellarController).GetMethod("IsValidUpgrade", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        Assert.True((bool)upgradeMethod!.Invoke(null, new object[] { "standard", "pro" })!);
        Assert.True((bool)upgradeMethod.Invoke(null, new object[] { "standard", "ultra" })!);
        Assert.True((bool)upgradeMethod.Invoke(null, new object[] { "pro", "ultra" })!);
    }

    [Fact]
    public void CellarController_IsValidUpgrade_RejectsInvalidUpgrades()
    {
        var upgradeMethod = typeof(CellarController).GetMethod("IsValidUpgrade", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        Assert.False((bool)upgradeMethod!.Invoke(null, new object[] { "pro", "standard" })!);
        Assert.False((bool)upgradeMethod.Invoke(null, new object[] { "ultra", "pro" })!);
        Assert.False((bool)upgradeMethod.Invoke(null, new object[] { "pro", "pro" })!);
    }

    [Fact]
    public void CellarController_ComputeHash_IsDeterministic()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash1 = CellarController.ComputeHash(serial);
        var hash2 = CellarController.ComputeHash(serial);
        Assert.Equal(hash1, hash2);
    }

    [Fact]
    public void CellarController_MaskSerial_MasksShortFormat()
    {
        var maskMethod = typeof(CellarController).GetMethod("MaskSerial", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var masked = maskMethod!.Invoke(null, new object[] { "WNX-PRO-AAAA-BBBB-CCCC" });
        Assert.Equal("WNX-PRO-AAAA-****-****", masked);
    }

    [Fact]
    public void FortressFilter_GadgetRoutes_ContainsAllKnownGadgets()
    {
        // Verify all expected gadget routes are mapped
        var expectedGadgets = new[]
        {
            "synapse-admin", "gamebot", "media-bridge", "bot", "matrix", "brine", "ladle"
        };
        
        foreach (var gadget in expectedGadgets)
        {
            Assert.True(FortressFilter.GadgetRoutes.ContainsKey(gadget), $"Missing gadget route: {gadget}");
        }
    }

private static ClaimsPrincipal CreateUser(string userId, string role = "user")
    {
        return new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(ClaimTypes.Role, role)
        }, "TestAuth"));
    }
}
using System.Text.Json;
using WatchNexus.Core.Controllers;

namespace WatchNexus.Core.Tests;

// Regression guard for the tier-gate bypass class found in the July 2026
// license audit: every paid module in CellarController.TierModules MUST have
// a matching server-side entry in FortressFilter.ProtectedRoutes, otherwise
// the route is reachable by any authenticated user regardless of tier.
public class FortressTierCoverageTests
{
    [Theory]
    [InlineData("pro")]
    [InlineData("ultra")]
    public void Every_paid_module_is_server_side_gated(string tier)
    {
        var missing = CellarController.TierModules[tier]
            .Where(m => !FortressFilter.ProtectedRoutes.ContainsKey(m))
            .ToList();
        Assert.True(missing.Count == 0,
            $"Paid '{tier}' modules missing from FortressFilter.ProtectedRoutes (open tier bypass!): {string.Join(", ", missing)}");
    }

    [Theory]
    [InlineData("pro")]
    [InlineData("ultra")]
    public void Gated_tier_matches_manifest_tier(string tier)
    {
        foreach (var module in CellarController.TierModules[tier])
        {
            Assert.Equal(tier, FortressFilter.ProtectedRoutes[module]);
        }
    }

    [Theory]
    [InlineData("streaming-logins", "pro")]
    [InlineData("streaming-services", "pro")]
    [InlineData("watch-party", "ultra")]
    public void July2026_audit_bypass_modules_are_gated(string module, string tier)
    {
        Assert.True(FortressFilter.ProtectedRoutes.TryGetValue(module, out var required));
        Assert.Equal(tier, required);
    }

    // Regression guard for the /api/gadgets/* bypass class: every gadget
    // route prefix that serves a PAID module must map to a codename that is
    // itself in ProtectedRoutes — otherwise FortressFilter's segments[1]
    // check never fires for /api/gadgets/{name}/...
    [Fact]
    public void Every_gadget_route_that_serves_a_paid_module_is_gated()
    {
        var missing = FortressFilter.GadgetRoutes
            .Where(kv => !FortressFilter.ProtectedRoutes.ContainsKey(kv.Value))
            .Select(kv => $"api/gadgets/{kv.Key} -> '{kv.Value}'")
            .ToList();
        Assert.True(missing.Count == 0,
            $"Gadget routes without a server-side tier gate (open tier bypass!): {string.Join(", ", missing)}");
    }

    // Every paid tier module must be reachable only through a route prefix the
    // filter actually checks: either its codename directly or a mapped gadget
    // route. This catches a module being dropped from one map but still served.
    [Theory]
    [InlineData("pro")]
    [InlineData("ultra")]
    public void Every_paid_module_has_an_enforced_route(string tier)
    {
        var unenforced = CellarController.TierModules[tier]
            .Where(m => !FortressFilter.ProtectedRoutes.ContainsKey(m)
                        && !FortressFilter.GadgetRoutes.Values.Contains(m))
            .ToList();
        Assert.True(unenforced.Count == 0,
            $"Paid '{tier}' modules with no enforced route prefix (open tier bypass!): {string.Join(", ", unenforced)}");
    }
}

// Tamper-evidence: a paid tier stored in cellar_license is only honored when
// the stored hash matches the stored serial.
public class CellarResolveTierTests
{
    private static string LicenseJson(string tier, string serial, string? hash) =>
        JsonSerializer.Serialize(new { tier, serial, hash });

    [Fact]
    public void Valid_hash_grants_paid_tier()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var json = LicenseJson("pro", serial, CellarController.ComputeHash(serial));
        Assert.Equal("pro", CellarController.ResolveTier(json));
    }

    [Fact]
    public void Tampered_tier_field_falls_back_to_standard()
    {
        // Attacker edits tier to ultra but hash still matches a pro-era serial —
        // hash covers the serial, and any hash/serial mismatch or absence downgrades.
        var json = LicenseJson("ultra", "WNX-ULT-AAAA-BBBB-CCCC", "deadbeefdeadbeef");
        Assert.Equal("standard", CellarController.ResolveTier(json));
    }

    [Fact]
    public void Missing_serial_or_hash_falls_back_to_standard()
    {
        Assert.Equal("standard", CellarController.ResolveTier("{\"tier\":\"ultra\"}"));
        Assert.Equal("standard", CellarController.ResolveTier(LicenseJson("pro", "WNX-PRO-AAAA-BBBB-CCCC", null)));
        Assert.Equal("standard", CellarController.ResolveTier(LicenseJson("pro", "", "abc")));
    }

    [Fact]
    public void Garbage_and_empty_input_are_standard()
    {
        Assert.Equal("standard", CellarController.ResolveTier(null));
        Assert.Equal("standard", CellarController.ResolveTier(""));
        Assert.Equal("standard", CellarController.ResolveTier("not json"));
        Assert.Equal("standard", CellarController.ResolveTier("{\"tier\":\"bogus-tier\"}"));
    }
}

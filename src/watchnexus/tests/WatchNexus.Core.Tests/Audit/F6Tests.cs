using System.Net;
using WatchNexus.Core.Tests.Integration;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

/// <summary>
/// F6 audit regressions — first-launch wizard probes.
/// </summary>
public class F6Tests : IntegrationTestBase
{
    [Fact]
    public async Task FirstLaunchProbe_IsNotRateLimited_AcrossManyPageLoads()
    {
        // The SPA calls this on every page load; it previously shared the
        // activation rate-limit bucket and 429'd after 5 loads, which made the
        // FirstLaunchGate skip the admin-setup wizard entirely.
        for (var i = 0; i < 8; i++)
        {
            var resp = await Client.GetAsync("/api/cellar/first-launch");
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        }
    }
}

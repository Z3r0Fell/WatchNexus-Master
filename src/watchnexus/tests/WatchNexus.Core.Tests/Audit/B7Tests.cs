using System.Net;
using System.Net.Http.Json;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Tests.Integration;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

/// <summary>B7 audit regressions: Program.cs wiring + MediaPaths secret exclusion.</summary>
public class B7LoginRateLimitPolicyTests : IntegrationTestBase
{
    [Fact]
    public async Task Login_UnderTestHost_DoesNotFailOnMissingAuthRateLimitPolicy()
    {
        // [EnableRateLimiting("auth")] on login used to 500 under the test host
        // because the "auth" policy was not registered there.
        var resp = await Client.PostAsJsonAsync("/api/auth/login",
            new { email = "nobody@example.com", password = "wrong-password1" });
        Assert.NotEqual(HttpStatusCode.InternalServerError, resp.StatusCode);
    }
}

[Collection("B7-env")]
public class B7MediaPathsTests
{
    [Fact]
    public void IsAllowedPath_RejectsServerSecretsInDataDir()
    {
        var data = Path.Combine(Path.GetTempPath(), "b7-data-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(data, "dp-keys"));
        Directory.CreateDirectory(Path.Combine(data, "posters"));
        File.WriteAllText(Path.Combine(data, "dp-keys", "key-1.xml"), "<k/>");
        File.WriteAllText(Path.Combine(data, "jwt.key"), "x");
        File.WriteAllText(Path.Combine(data, "watchnexus.db"), "x");
        File.WriteAllText(Path.Combine(data, "posters", "a.xml"), "x");
        var prevData = Environment.GetEnvironmentVariable("WATCHNEXUS_DATA_DIR");
        var prevRoots = Environment.GetEnvironmentVariable("MEDIA_ROOTS");
        try
        {
            Environment.SetEnvironmentVariable("WATCHNEXUS_DATA_DIR", data);
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", data);
            Assert.False(MediaPaths.IsAllowedPath(Path.Combine(data, "dp-keys", "key-1.xml")));
            Assert.False(MediaPaths.IsAllowedPath(Path.Combine(data, "jwt.key")));
            Assert.False(MediaPaths.IsAllowedPath(Path.Combine(data, "watchnexus.db")));
            Assert.True(MediaPaths.IsAllowedPath(Path.Combine(data, "posters", "a.xml")));
        }
        finally
        {
            Environment.SetEnvironmentVariable("WATCHNEXUS_DATA_DIR", prevData);
            Environment.SetEnvironmentVariable("MEDIA_ROOTS", prevRoots);
            try { Directory.Delete(data, true); } catch { }
        }
    }
}

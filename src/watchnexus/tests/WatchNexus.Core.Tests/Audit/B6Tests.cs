using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Core.Tests.Integration;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

/// <summary>B6 audit regressions (System/Update/Utility/Vpn/Weather/WebVideo/Truffle/Subtitles/Synapse/Strudel).</summary>
public class B6IntegrationTests : IntegrationTestBase
{
    private static StringContent Json(object o) =>
        new(JsonSerializer.Serialize(o), Encoding.UTF8, "application/json");

    [Fact]
    public async Task SystemInfo_VersionComesFromVersionSource()
    {
        AuthenticateAsUser();
        var json = await DeserializeResponseElement(await Client.GetAsync("/api/system/info"));
        Assert.Equal(WatchNexus.Core.Services.UpdateBackgroundService.CurrentVersion, json.GetProperty("version").GetString());
    }

    [Theory]
    [InlineData("/api/cache/clear")]
    [InlineData("/api/db/backup")]
    public async Task DestructiveMaintenance_IsAdminOnly(string path)
    {
        AuthenticateAsUser();
        var resp = await Client.PostAsync(path, null);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task DbBackups_ReturnsWrappedListTheMaintenancePageReads()
    {
        AuthenticateAsAdmin();
        var json = await DeserializeResponseElement(await Client.GetAsync("/api/db/backups"));
        Assert.Equal(JsonValueKind.Array, json.GetProperty("backups").ValueKind);
    }

    [Fact]
    public async Task Preferences_Put_ShallowMergesTopLevelKeys()
    {
        AuthenticateAsUser("b6-prefs");
        await Client.PutAsync("/api/user/preferences", Json(new { theme = "dark", visible_tabs = new[] { "a" } }));
        await Client.PutAsync("/api/user/preferences", Json(new { visible_tabs = new[] { "b" } }));
        var json = await DeserializeResponseElement(await Client.GetAsync("/api/user/preferences"));
        Assert.Equal("dark", json.GetProperty("theme").GetString());
        Assert.Equal("b", json.GetProperty("visible_tabs")[0].GetString());
    }

    [Fact]
    public async Task ZestLogClear_IsAdminOnly()
    {
        AuthenticateAsUser();
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.PostAsync("/api/zest/logs/clear", null)).StatusCode);
    }

    [Fact]
    public async Task AdapterConvert_RejectsPathOutsideMediaRoots()
    {
        AuthenticateAsUser();
        var resp = await Client.PostAsync("/api/adapter/convert", Json(new { source_path = "/etc/passwd" }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task TruffleAdminOverview_IsAdminOnly()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.GetAsync("/api/truffle/admin/overview")).StatusCode);
    }

    [Fact]
    public async Task SynapseAdmin_IsAdminOnly()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.GetAsync("/api/gadgets/synapse-admin/config")).StatusCode);
    }

    [Fact]
    public async Task WebVideoBookmark_RejectsJavascriptUrl()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        var resp = await Client.PostAsync("/api/gadgets/webvideo/bookmarks", Json(new { url = "javascript:alert(1)", title = "x" }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Vpn_PeerListHidesKeys_CreateReturnsCompleteConfig_UsersForbidden()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.PostAsync("/api/vpn/peers", Json(new { name = "x" }))).StatusCode);

        AuthenticateAsAdmin();
        var created = await DeserializeResponseElement(await Client.PostAsync("/api/vpn/peers",
            Json(new { name = "Phone", allowed_ips = "10.0.0.2/32" })));
        Assert.Equal("10.0.0.2/32", created.GetProperty("allowed_ips").GetString());
        var cfg = created.GetProperty("client_config").GetString()!;
        Assert.Contains("PrivateKey = ", cfg);
        Assert.Contains("PresharedKey = ", cfg);

        var list = await DeserializeResponseElement(await Client.GetAsync("/api/vpn/peers"));
        var peer = list[0];
        Assert.True(peer.TryGetProperty("assigned_ip", out _));
        Assert.True(peer.TryGetProperty("is_enabled", out _));
        Assert.False(peer.TryGetProperty("private_key", out _));
        Assert.False(peer.TryGetProperty("privateKey", out _));
    }

    [Fact]
    public async Task Vpn_Setup_AcceptsSnakeCaseFormFields()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsAdmin();
        var resp = await Client.PostAsync("/api/vpn/server/setup",
            Json(new { external_endpoint = "vpn.example.com", listen_port = 51999, dns_servers = "9.9.9.9" }));
        AssertJsonResponse(resp);
        var server = await DeserializeResponseElement(await Client.GetAsync("/api/vpn/server"));
        Assert.Equal("vpn.example.com", server.GetProperty("endpoint").GetString());
        Assert.Equal(51999, server.GetProperty("listen_port").GetInt32());
        Assert.Equal("9.9.9.9", server.GetProperty("dns_servers").GetString());
    }
}

public class B6UnitTests
{
    [Fact]
    public void MergePreferences_KeepsUnsentKeys_AndToleratesCorruptStoredValue()
    {
        using var upd = JsonDocument.Parse("{\"b\":2}");
        var merged = JsonDocument.Parse(UserPreferencesController.MergePreferences("{\"a\":1,\"b\":1}", upd.RootElement)).RootElement;
        Assert.Equal(1, merged.GetProperty("a").GetInt32());
        Assert.Equal(2, merged.GetProperty("b").GetInt32());
        var fromBad = JsonDocument.Parse(UserPreferencesController.MergePreferences("not json", upd.RootElement)).RootElement;
        Assert.Equal(2, fromBad.GetProperty("b").GetInt32());
    }

    [Fact]
    public void WeatherNormalize_AddsKeysThePageRenders()
    {
        var raw = "{\"current\":{\"temperature_2m\":12.5,\"apparent_temperature\":10,\"relative_humidity_2m\":80,\"wind_speed_10m\":5,\"weather_code\":61}," +
                  "\"daily\":{\"time\":[\"2026-11-02\"],\"temperature_2m_max\":[14],\"temperature_2m_min\":[6],\"weather_code\":[0]}}";
        var j = JsonDocument.Parse(WeatherController.Normalize(raw)).RootElement;
        Assert.Equal(12.5, j.GetProperty("current").GetProperty("temperature").GetDouble());
        Assert.Equal("cloud-rain", j.GetProperty("current").GetProperty("icon").GetString());
        Assert.Equal(14, j.GetProperty("forecast")[0].GetProperty("temp_max").GetDouble());
        Assert.Equal("sun", j.GetProperty("forecast")[0].GetProperty("icon").GetString());
    }

    [Fact]
    public async Task SqliteVacuumInto_WithBoundPath_ProducesBackup()
    {
        // DbControllerReal.CreateBackup relies on VACUUM INTO accepting a bound parameter.
        var dir = Path.Combine(Path.GetTempPath(), "b6-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var src = Path.Combine(dir, "src.db");
            var opts = new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={src};Pooling=False").Options;
            await using (var db = new AppDbContext(opts))
            {
                await db.Database.EnsureCreatedAsync();
                Assert.Equal(Path.GetFullPath(src), Path.GetFullPath(db.Database.GetDbConnection().DataSource));
                var dest = Path.Combine(dir, "backup.db");
                await db.Database.ExecuteSqlRawAsync("VACUUM INTO {0}", dest);
                Assert.True(File.Exists(dest));
                Assert.True(new FileInfo(dest).Length > 0);
            }
            SqliteConnection.ClearAllPools();
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}

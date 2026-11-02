using System.Net;
using System.Text.Json;
using Moq;
using Moq.Protected;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// /api/downloads/engine/* — the download-engine facade the Downloads page polls.
/// Previously every route 404'd; these lock in status/empty-state, 501 for
/// unsupported capabilities, the Ultra gate, and qBittorrent delegation.
/// </summary>
public class DownloadEngineControllerIntegrationTests : IntegrationTestBase
{
    private const string Hash = "0123456789abcdef0123456789abcdef01234567";
    private readonly List<HttpRequestMessage> _qbitRequests = new();

    private async Task SeedQbitConfigAsync(string userId = "test-user")
    {
        DbContext.Settings.Add(new AppSetting
        {
            Key = "qbit_config",
            UserId = userId,
            Value = JsonSerializer.Serialize(new { host = "localhost", port = 8080, username = "admin", password = "pw" }),
        });
        await DbContext.SaveChangesAsync();
    }

    /// <summary>Fake qBittorrent Web API that routes by path.</summary>
    private void SetupFakeQbit(string torrentsJson, bool loginOk = true)
    {
        var handler = new Mock<HttpMessageHandler>();
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync((HttpRequestMessage req, CancellationToken _) =>
            {
                _qbitRequests.Add(req);
                var path = req.RequestUri!.AbsolutePath;
                var resp = new HttpResponseMessage(HttpStatusCode.OK);
                if (path.EndsWith("/auth/login"))
                {
                    resp.Content = new StringContent(loginOk ? "Ok." : "Fails.");
                    if (loginOk) resp.Headers.Add("Set-Cookie", "SID=abc123; HttpOnly; path=/");
                }
                else if (path.EndsWith("/app/version")) resp.Content = new StringContent("v4.6.2");
                else if (path.EndsWith("/torrents/info")) resp.Content = new StringContent(torrentsJson, System.Text.Encoding.UTF8, "application/json");
                else if (path.EndsWith("/torrents/files")) resp.Content = new StringContent("[{\"index\":0,\"name\":\"video.mkv\",\"size\":1073741824,\"progress\":0.5}]");
                else resp.Content = new StringContent("");
                return resp;
            });
        HandlerMocks.Add(handler);
    }

    private static string OneTorrent(bool seqDl = false) => JsonSerializer.Serialize(new[]
    {
        new
        {
            hash = Hash, name = "Big Buck Bunny", state = "stalledDL", progress = 0.5,
            dlspeed = 1048576, upspeed = 0, size = 1073741824L, eta = 3600,
            num_seeds = 10, num_leechs = 5, seq_dl = seqDl, save_path = "/downloads", category = "watchnexus",
        },
    });

    [Fact]
    public async Task Status_RequiresAuthentication()
    {
        ClearAuthentication();
        var response = await Client.GetAsync("/api/downloads/engine/status");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Status_NoClientConfigured_ReportsNotConfigured()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/downloads/engine/status");

        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.False(json.GetProperty("success").GetBoolean());
        Assert.False(json.GetProperty("configured").GetBoolean());
        Assert.Equal("not_configured", json.GetProperty("status").GetString());
        Assert.False(json.GetProperty("builtin_available").GetBoolean());
        Assert.False(string.IsNullOrEmpty(json.GetProperty("message").GetString()));
    }

    [Fact]
    public async Task Status_StandardTier_ReportsTierLocked()
    {
        AuthenticateAsUser();
        await SeedQbitConfigAsync();

        var response = await Client.GetAsync("/api/downloads/engine/status");

        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("tier_locked", json.GetProperty("status").GetString());
        Assert.Equal("ultra", json.GetProperty("required_tier").GetString());
        Assert.False(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Status_ConfiguredAndReachable_ReportsConnected()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        await SeedQbitConfigAsync();
        SetupFakeQbit("[]");

        var response = await Client.GetAsync("/api/downloads/engine/status");

        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Equal("connected", json.GetProperty("status").GetString());
        Assert.Equal("qbittorrent", json.GetProperty("client").GetString());
        Assert.Equal("v4.6.2", json.GetProperty("version").GetString());
    }

    [Fact]
    public async Task Status_BadCredentials_ReportsAuthFailed()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        await SeedQbitConfigAsync();
        SetupFakeQbit("[]", loginOk: false);

        var json = await DeserializeResponseElement(await Client.GetAsync("/api/downloads/engine/status"));

        Assert.Equal("auth_failed", json.GetProperty("status").GetString());
        Assert.True(json.GetProperty("configured").GetBoolean());
        Assert.False(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Torrents_NoClientConfigured_Returns409NotConfigured()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/downloads/engine/torrents");

        AssertJsonResponse(response, HttpStatusCode.Conflict);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("not_configured", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Torrents_StandardTier_Returns403TierLocked()
    {
        AuthenticateAsUser();
        await SeedQbitConfigAsync();

        var response = await Client.GetAsync("/api/downloads/engine/torrents");

        AssertJsonResponse(response, HttpStatusCode.Forbidden);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("tier_locked", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Torrents_Configured_MapsQbitShapeToEngineShape()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        await SeedQbitConfigAsync();
        SetupFakeQbit(OneTorrent());

        var response = await Client.GetAsync("/api/downloads/engine/torrents");

        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
        var t = json[0];
        Assert.Equal(Hash, t.GetProperty("id").GetString());
        Assert.Equal("downloading", t.GetProperty("state").GetString());
        Assert.Equal(50.0, t.GetProperty("progress").GetDouble());
        Assert.Equal("1.0 MB/s", t.GetProperty("download_rate_formatted").GetString());
        Assert.Equal("1.0 GB", t.GetProperty("total_size_formatted").GetString());
        Assert.Equal("1h 0m", t.GetProperty("eta_formatted").GetString());
        Assert.Equal(5, t.GetProperty("num_peers").GetInt32());

        // The SID cookie from login is forwarded to the data call.
        var infoReq = _qbitRequests.Single(r => r.RequestUri!.AbsolutePath.EndsWith("/torrents/info"));
        Assert.Contains("SID=abc123", infoReq.Headers.GetValues("Cookie").Single());
    }

    [Fact]
    public async Task Files_Configured_MapsFiles()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        await SeedQbitConfigAsync();
        SetupFakeQbit(OneTorrent());

        var response = await Client.GetAsync($"/api/downloads/engine/{Hash}/files");

        AssertJsonResponse(response);
        var f = (await DeserializeResponseElement(response))[0];
        Assert.Equal("video.mkv", f.GetProperty("path").GetString());
        Assert.Equal(50.0, f.GetProperty("progress").GetDouble());
        Assert.Equal("1.0 GB", f.GetProperty("size_formatted").GetString());
    }

    [Fact]
    public async Task Sequential_TogglesOnlyWhenStateDiffers()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        await SeedQbitConfigAsync();
        SetupFakeQbit(OneTorrent(seqDl: false));

        var already = await Client.PostAsync($"/api/downloads/engine/{Hash}/sequential?enabled=false", null);
        AssertJsonResponse(already);
        Assert.DoesNotContain(_qbitRequests, r => r.RequestUri!.AbsolutePath.EndsWith("/toggleSequentialDownload"));

        var toggle = await Client.PostAsync($"/api/downloads/engine/{Hash}/sequential?enabled=true", null);
        AssertJsonResponse(toggle);
        Assert.Single(_qbitRequests, r => r.RequestUri!.AbsolutePath.EndsWith("/toggleSequentialDownload"));
    }

    [Fact]
    public async Task Pause_Configured_DelegatesToQbit()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");
        await SeedQbitConfigAsync();
        SetupFakeQbit("[]");

        var response = await Client.PostAsync($"/api/downloads/engine/{Hash}/pause", null);

        AssertJsonResponse(response);
        Assert.Contains(_qbitRequests, r => r.RequestUri!.AbsolutePath.EndsWith("/torrents/pause"));
    }

    [Theory]
    [InlineData("not-a-hash")]
    [InlineData("0123456789abcdef0123456789abcdef0123456z")]
    public async Task Pause_InvalidId_Returns400(string id)
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.PostAsync($"/api/downloads/engine/{id}/pause", null);

        AssertJsonResponse(response, HttpStatusCode.BadRequest);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("invalid_request", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Add_RejectsNonMagnet()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.PostAsync("/api/downloads/engine/add?magnet=file:///etc/passwd", null);

        AssertJsonResponse(response, HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Settings_Get_Returns501NotSupported()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/downloads/engine/settings");

        AssertJsonResponse(response, HttpStatusCode.NotImplemented);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("not_supported", json.GetProperty("code").GetString());
        Assert.False(string.IsNullOrEmpty(json.GetProperty("error").GetString()));
    }

    [Fact]
    public async Task Settings_Put_Returns501NotSupported()
    {
        AuthenticateAsUser();

        var response = await Client.PutAsync("/api/downloads/engine/settings",
            new StringContent("{\"max_active_downloads\":3}", System.Text.Encoding.UTF8, "application/json"));

        AssertJsonResponse(response, HttpStatusCode.NotImplemented);
    }

    [Fact]
    public async Task ExistingDownloadsRoutes_StillWork()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/downloads");

        AssertJsonResponse(response);
    }
}

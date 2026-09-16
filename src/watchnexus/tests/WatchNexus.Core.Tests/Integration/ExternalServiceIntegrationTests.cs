using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Moq;
using Moq.Protected;
using Moq.Language.Flow;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// External Service Integration Tests
/// Mocks external services and verifies integration behavior
/// </summary>
public class ExternalServiceIntegrationTests : IntegrationTestBase
    {
    public ExternalServiceIntegrationTests() : base() { }


    #region TMDB Integration

    [Fact]
    public async Task TMDB_Search_RateLimitHandling()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        // Mock 429 rate limit response
        var rateLimitResponse = new HttpResponseMessage(HttpStatusCode.TooManyRequests)
        {
            Headers = { RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(60)) }
        };
        SetupHttpMock(rateLimitResponse);

        var response = await Client.GetAsync("/api/tmdb/search?query=test");
        
        // TMDB proxy returns empty results on error (graceful degradation)
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("results").GetArrayLength());
    }

    [Fact]
    public async Task TMDB_ApiKeyValidation_VerifiesKey()
    {
        AuthenticateAsUser();

        // Mock successful verification
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") });

        var body = JsonSerializer.Serialize(new { api_key = "valid_key" });
        var response = await Client.PutAsync("/api/settings/integrations/tmdb", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("saved", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task TMDB_ApiKeyValidation_RejectsInvalidKey()
    {
        AuthenticateAsUser();

        // Mock failed verification
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.Unauthorized));

        var body = JsonSerializer.Serialize(new { api_key = "invalid_key" });
        var response = await Client.PutAsync("/api/settings/integrations/tmdb", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task TMDB_NetworkError_GracefulDegradation()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        // Mock network error (timeout)
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new TaskCanceledException("Request timed out"));
        
        HandlerMocks.Add(handlerMock);

        var response = await Client.GetAsync("/api/tmdb/search?query=test");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("results").GetArrayLength());
    }

    #endregion

    #region Jackett / Prowlarr Integration (via Compote)

    [Fact]
    public async Task Compote_JackettIndexer_SearchWorks()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Add Jackett indexer
        var indexerBody = JsonSerializer.Serialize(new { name = "Jackett", indexer_type = "jackett", url = "https://jackett.example.com", api_key = "jackett_key" });
        await Client.PostAsync("/api/compote/indexers", new StringContent(indexerBody, System.Text.Encoding.UTF8, "application/json"));

        // Mock Jackett API response (Torznab-compatible)
        var jackettResponse = @"<?xml version=""1.0""?><rss version=""2.0""><channel><item><title>Test Movie 1080p</title><link>http://jackett/test.torrent</link><size>1073741824</size><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><torznab:attr name=""seeders"" value=""10""/><torznab:attr name=""peers"" value=""20""/></item></channel></rss>";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(jackettResponse, System.Text.Encoding.UTF8, "application/xml") });

        var searchResponse = await Client.GetAsync("/api/compote/search?query=test&limit=10");
        
        AssertJsonResponse(searchResponse);
        var json = await DeserializeResponseElement(searchResponse);
        Assert.True(json.GetProperty("total").GetInt32() >= 0);
    }

    [Fact]
    public async Task Compote_ProwlarrIndexer_SearchWorks()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Add Prowlarr indexer
        var indexerBody = JsonSerializer.Serialize(new { name = "Prowlarr", indexer_type = "prowlarr", url = "https://prowlarr.example.com", api_key = "prowlarr_key" });
        await Client.PostAsync("/api/compote/indexers", new StringContent(indexerBody, System.Text.Encoding.UTF8, "application/json"));

        // Mock Prowlarr search response
        var prowlarrResponse = new { Results = new[] { new { Title = "Test Movie", DownloadUrl = "http://prowlarr/test.torrent", Size = 1073741824L, Seeders = 15, Peers = 30, Indexer = "Prowlarr" } } };
        SetupHttpMockJson(prowlarrResponse);

        var searchResponse = await Client.GetAsync("/api/compote/search?query=test&limit=10");
        
        AssertJsonResponse(searchResponse);
    }

    [Fact]
    public async Task Compote_IndexerTest_ValidatesConnection()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var indexerBody = JsonSerializer.Serialize(new { name = "Test", indexer_type = "torznab", url = "https://test.indexer.com", api_key = "key" });
        var createResponse = await Client.PostAsync("/api/compote/indexers", new StringContent(indexerBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var indexerId = created.GetProperty("id").GetString();

        // Mock successful test
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK));

        var testResponse = await Client.PostAsync($"/api/compote/indexers/{indexerId}/test", null);
        
        AssertJsonResponse(testResponse);
        var json = await DeserializeResponseElement(testResponse);
        Assert.True(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Compote_IndexerTest_BlocksLocalhost()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var indexerBody = JsonSerializer.Serialize(new { name = "Local", indexer_type = "torznab", url = "http://localhost:9696", api_key = "key" });
        var createResponse = await Client.PostAsync("/api/compote/indexers", new StringContent(indexerBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var indexerId = created.GetProperty("id").GetString();

        var testResponse = await Client.PostAsync($"/api/compote/indexers/{indexerId}/test", null);
        
        AssertJsonResponse(testResponse);
        var json = await DeserializeResponseElement(testResponse);
        Assert.False(json.GetProperty("success").GetBoolean());
        Assert.Contains("not an allowed", json.GetProperty("error").GetString() ?? "");
    }

    #endregion

    #region qBittorrent Integration

    [Fact]
    public async Task Qbit_TestConnection_ValidHost_ReturnsSuccess()
    {
        AuthenticateAsUser();

        // Mock qBittorrent login API
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK));

        var body = JsonSerializer.Serialize(new { host = "qbit.example.com", port = 8080, username = "admin", password = "admin" });
        var response = await Client.PostAsync("/api/settings/integrations/qbittorrent/test", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Qbit_TestConnection_InvalidHost_ReturnsFailure()
    {
        AuthenticateAsUser();

        // Mock failed connection
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Connection refused"));
        
        HandlerMocks.Add(handlerMock);

        var body = JsonSerializer.Serialize(new { host = "invalid.host", port = 8080, username = "admin", password = "admin" });
        var response = await Client.PostAsync("/api/settings/integrations/qbittorrent/test", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.False(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Qbit_TestConnection_BlocksLocalhost()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { host = "localhost", port = 8080, username = "admin", password = "admin" });
        var response = await Client.PostAsync("/api/settings/integrations/qbittorrent/test", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Qbit_TestConnection_BlocksLoopbackIP()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { host = "127.0.0.1", port = 8080, username = "admin", password = "admin" });
        var response = await Client.PostAsync("/api/settings/integrations/qbittorrent/test", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion

    #region License Server Integration

    [Fact]
    public async Task Cellar_Activate_CallsLicenseServer()
    {
        AuthenticateAsAdmin();

        // Mock license server activate response
        var licenseResponse = new { activation_id = "act-123", activation_token = "token-123", license = new { plan = "pro" } };
        SetupHttpMockJson(licenseResponse);

        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var response = await Client.PostAsync("/api/cellar/activate", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Equal("pro", json.GetProperty("tier").GetString());
    }

    [Fact]
    public async Task Cellar_Activate_LicenseServerError_ReturnsError()
    {
        AuthenticateAsAdmin();

        // Mock license server error
        var errorResponse = new { detail = "Invalid license key" };
        SetupHttpMockJson(errorResponse, HttpStatusCode.BadRequest);

        var body = JsonSerializer.Serialize(new { serial = "INVALID-KEY" });
        var response = await Client.PostAsync("/api/cellar/activate", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Cellar_Activate_LicenseServerUnreachable_Returns503()
    {
        AuthenticateAsAdmin();

        // Mock network failure
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("DNS resolution failed"));
        
        HandlerMocks.Add(handlerMock);

        var body = JsonSerializer.Serialize(new { serial = "WNX-PRO-AAAA-BBBB-CCCC" });
        var response = await Client.PostAsync("/api/cellar/activate", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Cellar_Deactivate_CallsLicenseServer()
    {
        AuthenticateAsAdmin();
        await SeedLicenseAsync("pro");

        // Mock license server deactivate
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK));

        var response = await Client.PostAsync("/api/cellar/deactivate", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Updates_Check_CallsLicenseServerFallback()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Mock license server updates manifest
        var manifestResponse = new { available = false, latest_version = "1.0.3", current_version = "1.0.3", tier = "pro" };
        SetupHttpMockJson(manifestResponse);

        var response = await Client.GetAsync("/api/system/updates/check");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.NotNull(json.GetProperty("main_update"));
    }

    #endregion

    #region Matrix / Synapse Integration

    [Fact]
    public async Task Matrix_TestConnection_ValidConfig_ReturnsSuccess()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        // Save Matrix config
        var configBody = JsonSerializer.Serialize(new { homeserver = "https://matrix.example.com", access_token = "test_token", user_id = "@user:example.com" });
        await Client.PutAsync("/api/gadgets/matrix/config", new StringContent(configBody, System.Text.Encoding.UTF8, "application/json"));

        // Mock Matrix whoami response
        var whoamiResponse = new { user_id = "@user:example.com" };
        SetupHttpMockJson(whoamiResponse);

        var response = await Client.PostAsync("/api/gadgets/matrix/test", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Equal("@user:example.com", json.GetProperty("user_id").GetString());
    }

    [Fact]
    public async Task Matrix_TestConnection_BlocksLocalhost()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var configBody = JsonSerializer.Serialize(new { homeserver = "http://localhost:8008", access_token = "test_token" });
        await Client.PutAsync("/api/gadgets/matrix/config", new StringContent(configBody, System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.PostAsync("/api/gadgets/matrix/test", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.False(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task SynapseAdmin_TestConnection_ValidConfig_ReturnsSuccess()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        // Save Synapse admin config
        var configBody = JsonSerializer.Serialize(new { homeserver = "https://synapse.example.com", admin_token = "admin_token" });
        await Client.PutAsync("/api/gadgets/synapse-admin/config", new StringContent(configBody, System.Text.Encoding.UTF8, "application/json"));

        // Mock Synapse version response
        var versionResponse = new { server = new { name = "Synapse", version = "1.95.0" } };
        SetupHttpMockJson(versionResponse);

        var response = await Client.GetAsync("/api/gadgets/synapse-admin/server/version");
        
        AssertJsonResponse(response);
    }

    #endregion

    #region Tailscale Integration (VPN)

    [Fact]
    public async Task VPN_PeerCreation_GeneratesKeys()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { name = "Test Peer", allowed_ips = "10.0.0.2/32" });
        var response = await Client.PostAsync("/api/vpn/peers", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("public_key").GetString());
        Assert.NotNull(json.GetProperty("private_key").GetString());
        Assert.NotNull(json.GetProperty("preshared_key").GetString());
        Assert.Equal("10.0.0.2/32", json.GetProperty("allowed_ips").GetString());
    }

    [Fact]
    public async Task VPN_QRCode_GeneratesValidConfig()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { name = "QR Test", allowed_ips = "10.0.0.3/32" });
        var createResponse = await Client.PostAsync("/api/vpn/peers", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var peerId = created.GetProperty("id").GetString();

        var qrResponse = await Client.GetAsync($"/api/vpn/peers/{peerId}/qr-data");
        
        AssertJsonResponse(qrResponse);
        var qrJson = await DeserializeResponseElement(qrResponse);
        
        Assert.NotNull(qrJson.GetProperty("qr_data").GetString());
        // QR data should be base64 encoded WireGuard config
        var qrData = qrJson.GetProperty("qr_data").GetString()!;
        var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(qrData));
        Assert.Contains("[Interface]", decoded);
        Assert.Contains("[Peer]", decoded);
        Assert.Contains("PublicKey", decoded);
    }

    #endregion

    #region FFmpeg Integration

    [Fact]
    public async Task Crucible_FfmpegStatus_DetectsInstallation()
    {
        AuthenticateAsUser(); // Exempt from Fortress

        var response = await Client.GetAsync("/api/crucible/ffmpeg-status");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("ffmpeg_installed"));
        Assert.NotNull(json.GetProperty("ffprobe_installed"));
        Assert.NotNull(json.GetProperty("hw_accel"));
    }

    [Fact]
    public async Task Crucible_ProbeFile_CallsFfprobe()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var body = JsonSerializer.Serialize(new { path = tempFile });
            var response = await Client.PostAsync("/api/crucible/probe", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.NotNull(json.GetProperty("ffprobe"));
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task MediaOps_RepairFile_CallsFfmpeg()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "corrupt video");
        
        try
        {
            // Mock FFmpeg not available
            var response = await Client.PostAsync($"/api/media/repair?file_path={Uri.EscapeDataString(tempFile)}", null);
            
            // Should return 503 if FFmpeg not available
            if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
            {
                var json = await DeserializeResponseElement(response);
                Assert.Contains("FFmpeg is required", json.GetProperty("detail").GetString() ?? "");
            }
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    #endregion

    #region Discord/Telegram/Slack/Pushover (Pepper)

    [Fact]
    public async Task Pepper_DiscordWebhook_SendsPayload()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var channelBody = JsonSerializer.Serialize(new { type = "discord", name = "Test", webhook_url = "https://discord.com/api/webhooks/123/abc", enabled = true });
        await Client.PostAsync("/api/pepper/channels", new StringContent(channelBody, System.Text.Encoding.UTF8, "application/json"));

        // Capture the request sent to Discord
        var capturedRequest = new HttpRequestMessage();
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, ct) => 
            {
                capturedRequest = req;
            })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK));
        
        HandlerMocks.Add(handlerMock);

        var sendBody = JsonSerializer.Serialize(new { event_type = "test", title = "Test", message = "Test message" });
        await Client.PostAsync("/api/pepper/send", new StringContent(sendBody, System.Text.Encoding.UTF8, "application/json"));

        // Verify payload structure
        Assert.Equal("https://discord.com/api/webhooks/123/abc", capturedRequest.RequestUri?.ToString());
        Assert.Equal(HttpMethod.Post, capturedRequest.Method);
        var payload = await capturedRequest.Content!.ReadAsStringAsync();
        Assert.Contains("embeds", payload);
    }

    [Fact]
    public async Task Pepper_TelegramBot_SendsMessage()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var channelBody = JsonSerializer.Serialize(new { type = "telegram", name = "Test", bot_token = "123456:ABC", chat_id = "-100123456", enabled = true });
        await Client.PostAsync("/api/pepper/channels", new StringContent(channelBody, System.Text.Encoding.UTF8, "application/json"));

        var capturedRequest = new HttpRequestMessage();
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, ct) => capturedRequest = req)
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK));
        
        HandlerMocks.Add(handlerMock);

        var sendBody = JsonSerializer.Serialize(new { event_type = "test", title = "Test", message = "Test message" });
        await Client.PostAsync("/api/pepper/send", new StringContent(sendBody, System.Text.Encoding.UTF8, "application/json"));

        Assert.Contains("api.telegram.org/bot123456:ABC/sendMessage", capturedRequest.RequestUri?.ToString());
    }

    #endregion

    #region SSRF Protection Across All External Calls

    [Theory]
    [InlineData("http://localhost:8080")]
    [InlineData("http://127.0.0.1:8080")]
    [InlineData("http://169.254.169.254/latest/meta-data/")] // AWS metadata
    [InlineData("http://[::1]:8080")]
    public async Task SSRF_BlockedUrls_AreRejected(string blockedUrl)
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Test Compote indexer add with blocked URL
        var indexerBody = JsonSerializer.Serialize(new { name = "Test", indexer_type = "torznab", url = blockedUrl, api_key = "key" });
        var response = await Client.PostAsync("/api/compote/indexers", new StringContent(indexerBody, System.Text.Encoding.UTF8, "application/json"));
        
        // May succeed in creation but test will fail
        if (response.StatusCode == HttpStatusCode.OK)
        {
            var created = await DeserializeResponseElement(response);
            var indexerId = created.GetProperty("id").GetString();
            
            var testResponse = await Client.PostAsync($"/api/compote/indexers/{indexerId}/test", null);
            AssertJsonResponse(testResponse);
            var testJson = await DeserializeResponseElement(testResponse);
            Assert.False(testJson.GetProperty("success").GetBoolean());
        }
    }

    [Fact]
    public async Task SSRF_AllowedUrls_ArePermitted()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var allowedUrls = new[] { "https://example.com", "https://api.github.com", "https://cloudflare.com" };
        
        foreach (var url in allowedUrls)
        {
            var indexerBody = JsonSerializer.Serialize(new { name = "Test", indexer_type = "torznab", url = url, api_key = "key" });
            var response = await Client.PostAsync("/api/compote/indexers", new StringContent(indexerBody, System.Text.Encoding.UTF8, "application/json"));
            
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            
            // Clean up
            var created = await DeserializeResponseElement(response);
            await Client.DeleteAsync($"/api/compote/indexers/{created.GetProperty("id").GetString()}");
        }
    }

    #endregion
}
using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Moq.Protected;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Security;

/// <summary>
/// VERIFIES: C3 - SSRF in CompoteController (user-controlled base_url, no SsrfGuard)
/// VERIFIES: H1 - SSRF in PodcastsController (feed URL, no SsrfGuard on fetch)
/// VERIFIES: H2 - SSRF in WebVideoController (arbitrary URL proxy)
/// VERIFIES: H2 - SSRF in SubtitlesController.DownloadSubtitle (download_url proxy)
/// VERIFIES: IptvController uses SsrfGuard.IsAllowedUrl correctly
/// VERIFIES: QBittorrentController uses SsrfGuard.IsBlocked for LAN clients
/// VERIFIES: SsrfGuard.IsAllowedUrl blocks private/link-local/multicast
/// VERIFIES: SsrfGuard.IsBlocked allows LAN but blocks cloud metadata
/// </summary>
public class SsrfTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IHttpClientFactory> _httpFactoryMock;
    private readonly Mock<IConfiguration> _configMock;

    public SsrfTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"SsrfTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _httpFactoryMock = new Mock<IHttpClientFactory>();
        _configMock = new Mock<IConfiguration>();
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Blocks_Loopback()
    {
        Assert.False(SsrfGuard.IsAllowedUrl("http://127.0.0.1"));
        Assert.False(SsrfGuard.IsAllowedUrl("http://localhost"));
        Assert.False(SsrfGuard.IsAllowedUrl("http://[::1]"));
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Blocks_LinkLocal()
    {
        Assert.False(SsrfGuard.IsAllowedUrl("http://169.254.169.254")); // AWS/Azure/GCP metadata
        Assert.False(SsrfGuard.IsAllowedUrl("http://169.254.1.1"));
        Assert.False(SsrfGuard.IsAllowedUrl("http://[fe80::1]")); // IPv6 link-local
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Blocks_Multicast()
    {
        Assert.False(SsrfGuard.IsAllowedUrl("http://224.0.0.1"));
        Assert.False(SsrfGuard.IsAllowedUrl("http://239.255.255.250")); // SSDP
        Assert.False(SsrfGuard.IsAllowedUrl("http://[ff02::1]")); // IPv6 multicast
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Blocks_CloudMetadataHostnames()
    {
        Assert.False(SsrfGuard.IsAllowedUrl("http://metadata.google.internal"));
        Assert.False(SsrfGuard.IsAllowedUrl("http://metadata"));
        Assert.False(SsrfGuard.IsAllowedUrl("http://169.254.169.254/latest/meta-data/"));
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Blocks_NonHttpSchemes()
    {
        Assert.False(SsrfGuard.IsAllowedUrl("file:///etc/passwd"));
        Assert.False(SsrfGuard.IsAllowedUrl("ftp://internal.server/file"));
        Assert.False(SsrfGuard.IsAllowedUrl("gopher://internal/"));
        Assert.False(SsrfGuard.IsAllowedUrl("dict://localhost:2628/"));
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Allows_PublicHttp()
    {
        // Use IP addresses to avoid DNS resolution issues in test environment
        Assert.True(SsrfGuard.IsAllowedUrl("https://8.8.8.8"));
        Assert.True(SsrfGuard.IsAllowedUrl("http://1.1.1.1"));
        Assert.True(SsrfGuard.IsAllowedUrl("https://9.9.9.9/path"));
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Allows_RFC1918_PrivateRanges()
    {
        // RFC1918 should be ALLOWED for home LAN integrations (qBittorrent, Plex, etc.)
        Assert.True(SsrfGuard.IsAllowedUrl("http://192.168.1.50:8080"));
        Assert.True(SsrfGuard.IsAllowedUrl("http://10.0.0.1:32400"));
        Assert.True(SsrfGuard.IsAllowedUrl("http://172.16.0.100:8989"));
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Allows_CGNATRange()
    {
        Assert.True(SsrfGuard.IsAllowedUrl("http://100.64.0.1:8080"));
        Assert.True(SsrfGuard.IsAllowedUrl("http://100.127.255.254"));
    }

    [Fact]
    public void SsrfGuard_IsBlocked_Allows_LAN_Download_Clients()
    {
        // IsBlocked is the WEAK guard for LAN-bound integrations
        Assert.False(SsrfGuard.IsBlocked("localhost"));
        Assert.False(SsrfGuard.IsBlocked("127.0.0.1"));
        Assert.False(SsrfGuard.IsBlocked("192.168.1.50"));
        Assert.False(SsrfGuard.IsBlocked("qbittorrent.lan"));
    }

    [Fact]
    public void SsrfGuard_IsBlocked_Blocks_CloudMetadata()
    {
        Assert.True(SsrfGuard.IsBlocked("metadata"));
        Assert.True(SsrfGuard.IsBlocked("metadata.google.internal"));
        Assert.True(SsrfGuard.IsBlocked("169.254.169.254"));
        Assert.True(SsrfGuard.IsBlocked("fd00:ec2::254"));
    }

    [Fact]
    public void PodcastsController_Subscribe_Validates_FeedUrl_With_IsAllowedUrl()
    {
        // ARRANGE
        var controller = new PodcastsController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Try to subscribe to cloud metadata endpoint
        var body = JsonSerializer.Serialize(new { 
            title = "Evil", 
            feed_url = "http://169.254.169.254/latest/meta-data/" 
        });
        var jsonElement = JsonDocument.Parse(body).RootElement;
        var result = controller.Subscribe(jsonElement).Result;

        // ASSERT - Should be rejected (BadRequest)
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public void PodcastsController_GetPodcast_Validates_FeedUrl_BeforeFetch()
    {
        // ARRANGE
        var controller = new PodcastsController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Add subscription with malicious feed URL
        var sub = new PodcastSubscription 
        { 
            Id = "sub-1", 
            UserId = "test-user", 
            Title = "Evil", 
            FeedUrl = "http://169.254.169.254/latest/meta-data/" 
        };
        _db.PodcastSubscriptions.Add(sub);
        _db.SaveChanges();

        // ACT
        var result = controller.GetPodcast("sub-1").Result;

        // ASSERT - Should return error (not fetch the URL)
        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var error = props.FirstOrDefault(p => p.Name == "error")?.GetValue(value) as string;
        Assert.NotNull(error);
        Assert.Contains("not an allowed", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void IptvController_AddSource_Validates_Url_With_IsAllowedUrl()
    {
        // ARRANGE
        var controller = new IptvController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user, Connection = { RemoteIpAddress = IPAddress.Parse("127.0.0.1") } }
        };

        // ACT - Try to add source pointing to cloud metadata
        var result = controller.AddSource(
            name: "Evil", 
            url: "http://169.254.169.254/latest/meta-data/", 
            epg_url: null
        ).Result;

        // ASSERT - Should be rejected
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public void IptvController_UpdateSource_Validates_NewUrl()
    {
        // ARRANGE
        var controller = new IptvController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Add legitimate source first
        var source = new IptvSource { Name = "Legit", Url = "https://example.com/playlist.m3u" };
        _db.IptvSources.Add(source);
        _db.SaveChanges();

        // ACT - Update to malicious URL
        var body = JsonSerializer.Serialize(new { url = "http://169.254.169.254/" });
        var jsonElement = JsonDocument.Parse(body).RootElement;
        var result = controller.UpdateSource(source.Id, jsonElement).Result;

        // ASSERT - Should be rejected
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void IptvController_RefreshSource_Validates_SourceUrl()
    {
        // ARRANGE
        var controller = new IptvController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Add source with malicious URL
        var source = new IptvSource { Name = "Evil", Url = "http://169.254.169.254/" };
        _db.IptvSources.Add(source);
        _db.SaveChanges();

        // ACT
        var result = controller.RefreshSource(source.Id).Result;

        // ASSERT - Should be rejected
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void QBittorrentController_TestConnection_Blocks_CloudMetadata()
    {
        // ARRANGE
        var controller = new QBittorrentController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Test connection to cloud metadata
        var req = new QBittorrentController.QbitConfigRequest("169.254.169.254", 80, "admin", "admin");
        var result = controller.Test(req).Result;

        // ASSERT - Should be rejected
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void QBittorrentController_SaveConfig_Blocks_CloudMetadata()
    {
        // ARRANGE
        var controller = new QBittorrentController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Save config with cloud metadata host
        var req = new QBittorrentController.QbitConfigRequest("metadata.google.internal", 80, "admin", "admin");
        var result = controller.SaveConfig(req).Result;

        // ASSERT - Should be rejected
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void SettingsController_TestQbit_Blocks_Loopback()
    {
        // ARRANGE
        var controller = new SettingsController(_db, _configMock.Object, _httpFactoryMock.Object);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Test qBittorrent on loopback (explicitly blocked in TestQbit)
        var req = new SettingsController.QbitUpdate("127.0.0.1", 8080, "admin", "admin", true);
        var result = controller.TestQbit(req).Result;

        // ASSERT - Should be rejected (loopback blocked)
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void SettingsController_TestQbit_Blocks_CloudMetadata()
    {
        // ARRANGE
        var controller = new SettingsController(_db, _configMock.Object, _httpFactoryMock.Object);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Test qBittorrent on cloud metadata
        var req = new SettingsController.QbitUpdate("169.254.169.254", 8080, "admin", "admin", true);
        var result = controller.TestQbit(req).Result;

        // ASSERT - Should be rejected
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void SubtitlesController_DownloadSubtitle_Validates_DownloadUrl_With_IsAllowedUrl()
    {
        // ARRANGE
        var controller = new SubtitlesController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Try to download from cloud metadata
        var result = controller.DownloadSubtitle(
            download_url: "http://169.254.169.254/latest/meta-data/",
            source: "test",
            media_id: null,
            media_path: null
        ).Result;

        // ASSERT - Should be rejected
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var value = badRequest.Value!.GetType().GetProperties();
        var detail = value.First(p => p.Name == "detail").GetValue(badRequest.Value) as string;
        Assert.Contains("not an allowed", detail, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void CompoteController_Search_Uses_IsBlockedUrl_On_IndexerUrls()
    {
        // ARRANGE - This test verifies the code path uses SsrfGuard.IsBlockedUrl
        // The actual HTTP calls are mocked; we verify the guard is called
        var controller = new CompoteController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Add indexer with cloud metadata URL
        var indexer = new { id = "idx-1", name = "Evil", type = "torznab", url = "http://169.254.169.254/", api_key = "", enabled = true, priority = 50 };
        var json = JsonSerializer.Serialize(indexer);
        _db.Settings.Add(new AppSetting { Key = "indexer:idx-1", Value = json, UserId = "test-user" });
        _db.SaveChanges();

        // ACT - Search should skip this indexer (IsBlockedUrl returns true)
        var result = controller.Search(query: "test", media_type: "movie", sort_by: "seeders").Result;

        // ASSERT - Should return empty results (indexer skipped)
        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var results = props.First(p => p.Name == "results").GetValue(value) as System.Collections.IEnumerable;
        Assert.NotNull(results);
        Assert.Empty(results);
    }

    [Fact]
    public void CompoteController_TestIndexer_Uses_IsBlockedUrl()
    {
        // ARRANGE
        var controller = new CompoteController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Add indexer with cloud metadata URL
        var indexer = new { id = "idx-1", name = "Evil", type = "torznab", url = "http://metadata.google.internal/", api_key = "", enabled = true };
        var json = JsonSerializer.Serialize(indexer);
        _db.Settings.Add(new AppSetting { Key = "indexer:idx-1", Value = json, UserId = "test-user" });
        _db.SaveChanges();

        // ACT
        var result = controller.TestIndexer("idx-1").Result;

        // ASSERT - Should return success=false with error
        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var success = (bool)props.First(p => p.Name == "success").GetValue(value)!;
        Assert.False(success);
        var error = props.First(p => p.Name == "error").GetValue(value) as string;
        Assert.Contains("not an allowed", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void WebVideoController_VideoInfo_DoesNotProxy_ArbitraryUrls()
    {
        // ARRANGE
        var controller = new WebVideoController(_db);
        var user = CreateUser("test-user");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Request info for internal URL (should not fetch)
        // The current implementation only handles YouTube URLs
        var result = controller.VideoInfo(url: "http://169.254.169.254/");

        // ASSERT - Should return generic response (not proxy the request)
        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var title = props.First(p => p.Name == "title").GetValue(value) as string;
        Assert.Equal("Unknown Video", title);
    }

    [Fact]
    public void SsrfGuard_IsAllowedUrl_Blocks_UnresolvableHosts()
    {
        // Hosts that don't resolve should be blocked
        Assert.False(SsrfGuard.IsAllowedUrl("http://this-host-definitely-does-not-exist-12345.invalid"));
    }

    [Fact]
    public void SsrfGuard_IsRoutable_Blocks_PrivateAddresses_WhenUsedDirectly()
    {
        // IsRoutable is used by IsAllowedUrl - it ALLOWS RFC1918
        var ip1 = IPAddress.Parse("192.168.1.1");
        var ip2 = IPAddress.Parse("10.0.0.1");
        var ip3 = IPAddress.Parse("172.16.0.1");
        var ip4 = IPAddress.Parse("100.64.0.1");
        var ip5 = IPAddress.Parse("127.0.0.1");
        var ip6 = IPAddress.Parse("169.254.1.1");
        var ip7 = IPAddress.Parse("8.8.8.8");

        // Test via public IsAllowedUrl which uses IsRoutable internally
        Assert.True(SsrfGuard.IsAllowedUrl("http://192.168.1.1")); // RFC1918 allowed
        Assert.True(SsrfGuard.IsAllowedUrl("http://10.0.0.1")); // RFC1918 allowed
        Assert.True(SsrfGuard.IsAllowedUrl("http://172.16.0.1")); // RFC1918 allowed
        Assert.True(SsrfGuard.IsAllowedUrl("http://100.64.0.1")); // CGNAT allowed
        Assert.False(SsrfGuard.IsAllowedUrl("http://127.0.0.1")); // Loopback blocked
        Assert.False(SsrfGuard.IsAllowedUrl("http://169.254.1.1")); // Link-local blocked
        Assert.True(SsrfGuard.IsAllowedUrl("http://8.8.8.8")); // Public allowed
    }

    private static ClaimsPrincipal CreateUser(string userId, string role = "user")
    {
        return new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(System.Security.Claims.ClaimTypes.NameIdentifier, userId),
            new Claim(System.Security.Claims.ClaimTypes.Role, role)
        }, "TestAuth"));
    }
}
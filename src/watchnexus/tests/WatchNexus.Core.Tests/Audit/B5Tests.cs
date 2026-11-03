using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

public class B5Tests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase($"B5_{Guid.NewGuid()}").Options);

    private static void SetUser(ControllerBase c, string uid, string role = "user")
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, uid),
            new Claim(ClaimTypes.Role, role),
        }, "TestAuth"));
        c.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };
    }

    private static JsonElement Json(IActionResult r) =>
        JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(r).Value);

    private static SettingsController NewSettings(AppDbContext db, string? envTmdb = null)
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["TMDB_API_KEY"] = envTmdb })
            .Build();
        var c = new SettingsController(db, cfg, new Mock<IHttpClientFactory>().Object);
        SetUser(c, "u1");
        return c;
    }

    [Fact]
    public async Task Integrations_NeverReturnsEnvTmdbKey()
    {
        using var db = NewDb();
        var json = Json(await NewSettings(db, "SERVERSECRETKEY1234").GetIntegrations());
        var tmdb = json.GetProperty("tmdb");
        Assert.DoesNotContain("SERVERSECRET", tmdb.GetRawText());
        Assert.True(tmdb.GetProperty("has_key").GetBoolean());
        Assert.Equal("1234", tmdb.GetProperty("last4").GetString());
    }

    [Fact]
    public async Task Integrations_ReadsLegacyPascalCaseQbit_AndMasksPassword()
    {
        using var db = NewDb();
        db.Settings.Add(new AppSetting { Key = "qbittorrent_settings", UserId = "u1",
            Value = "{\"Host\":\"10.0.0.5\",\"Port\":9090,\"Username\":\"bob\",\"Password\":\"hunter22\",\"Enabled\":true}" });
        await db.SaveChangesAsync();
        var q = Json(await NewSettings(db).GetIntegrations()).GetProperty("qbittorrent");
        Assert.Equal("10.0.0.5", q.GetProperty("host").GetString());
        Assert.Equal(9090, q.GetProperty("port").GetInt32());
        Assert.DoesNotContain("hunter22", q.GetRawText());
    }

    [Fact]
    public async Task UpdateQbit_WritesLowercaseKeys_KeepsPasswordOnMask_AndSyncsQbitConfig()
    {
        using var db = NewDb();
        var c = NewSettings(db);
        await c.UpdateQbit(new SettingsController.QbitUpdate("10.0.0.5", 9090, "bob", "hunter22", true));
        await c.UpdateQbit(new SettingsController.QbitUpdate("10.0.0.5", 9091, "bob", SettingsController.MaskSecret("hunter22"), true));

        var cfg = QBittorrentController.ParseCfg(db.Settings.Single(s => s.Key == "qbit_config" && s.UserId == "u1").Value);
        Assert.NotNull(cfg);
        Assert.Equal(9091, cfg!.Port);
        Assert.Equal("hunter22", cfg.Password);
        Assert.Contains("\"host\"", db.Settings.Single(s => s.Key == "qbittorrent_settings").Value);
    }

    [Fact]
    public void QbitParseCfg_ToleratesPascalCaseAndStringPort()
    {
        var cfg = QBittorrentController.ParseCfg("{\"Host\":\"nas\",\"Port\":\"8081\",\"Username\":\"a\",\"Password\":\"b\"}");
        Assert.Equal(("nas", 8081, "a", "b"), (cfg!.Host, cfg.Port, cfg.Username, cfg.Password));
    }

    [Fact]
    public async Task Downloads_AreScopedToOwner()
    {
        using var db = NewDb();
        var a = new DownloadsController(db); SetUser(a, "alice");
        var b = new DownloadsController(db); SetUser(b, "bob");
        var created = Json(await a.Add("Movie", "movie", 1, 10));
        var id = created.GetProperty("id").GetString()!;

        var bobList = Assert.IsAssignableFrom<IEnumerable<DownloadItem>>(Assert.IsType<OkObjectResult>(await b.GetAll()).Value);
        Assert.Empty(bobList);
        Assert.IsType<NotFoundObjectResult>(await b.Update(id, "completed", 100));
        Assert.IsType<NotFoundObjectResult>(await b.Delete(id));

        var aliceList = Assert.IsAssignableFrom<IEnumerable<DownloadItem>>(Assert.IsType<OkObjectResult>(await a.GetAll()).Value);
        Assert.Single(aliceList);
        Assert.IsType<OkObjectResult>(await a.Delete(id));
        Assert.Empty(db.Downloads);
    }

    [Fact]
    public async Task Settings_CannotForgeDownloadOwnershipOrRindRows()
    {
        using var db = NewDb();
        var c = NewSettings(db);
        Assert.IsType<BadRequestObjectResult>(await c.Set("download_owner:x", JsonSerializer.SerializeToElement(new { value = "1" })));
        Assert.IsType<BadRequestObjectResult>(await c.Set("rind_pin", JsonSerializer.SerializeToElement(new { value = "1" })));
    }

    [Fact]
    public void AdminOnlyAttributes_PresentOnSecurityAndRindAdmin()
    {
        static bool AdminOnly(System.Reflection.MemberInfo m) => m.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), true)
            .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>().Any(a => a.Roles == "admin");
        Assert.True(AdminOnly(typeof(SecurityController)));
        Assert.True(AdminOnly(typeof(RindController).GetMethod(nameof(RindController.AdminProfiles))!));
        Assert.True(AdminOnly(typeof(RindController).GetMethod(nameof(RindController.AdminSetProfile))!));
    }

    [Fact]
    public async Task Rind_ChangingOrRemovingPinRequiresCurrentPin()
    {
        using var db = NewDb();
        var c = new RindController(db); SetUser(c, "kid");
        Assert.IsType<OkObjectResult>(await c.SetPin(JsonSerializer.SerializeToElement(new { pin = "1234" })));
        Assert.IsType<ObjectResult>(await c.SetPin(JsonSerializer.SerializeToElement(new { pin = "9999" })));
        Assert.IsType<ObjectResult>(await c.RemovePin());
        Assert.IsType<ObjectResult>(await c.SaveProfile(JsonSerializer.SerializeToElement(new { pin = "0000", max_rating = "R" })));
        Assert.IsType<OkObjectResult>(await c.SetPin(JsonSerializer.SerializeToElement(new { pin = "9999", current_pin = "1234" })));
        Assert.IsType<OkObjectResult>(await c.RemovePin("9999"));
    }

    [Fact]
    public async Task Security_AddIpRule_AcceptsFrontendShape()
    {
        using var db = NewDb();
        var c = new SecurityController(db); SetUser(c, "admin", "admin");
        var req = new SecurityController.IpRuleRequest { Ip_address = "10.0.0.9", Is_allowed = true, Description = "lan" };
        var json = Json(await c.AddIpRule(req));
        Assert.Equal("10.0.0.9", json.GetProperty("ip_address").GetString());
        Assert.True(json.GetProperty("is_allowed").GetBoolean());
        Assert.Equal("allow", json.GetProperty("rule_type").GetString());
    }

    private static void SeedMedia(AppDbContext db, string owner, string title)
    {
        var lib = new Library { UserId = owner, Name = owner + "-lib" };
        db.Libraries.Add(lib);
        db.MediaItems.Add(new MediaItem { LibraryId = lib.Id, Title = title, MediaType = "movies" });
        db.SaveChanges();
    }

    [Fact]
    public async Task SproutFeed_FailsClosed_AndOnlyShowsKeyOwnersLibrary()
    {
        using var db = NewDb();
        SeedMedia(db, "alice", "AliceMovie");
        SeedMedia(db, "bob", "BobMovie");
        var cfg = new ConfigurationBuilder().Build();
        var anon = new SproutController(db, cfg); SetUser(anon, "");
        Assert.IsType<UnauthorizedObjectResult>(await anon.RecentFeed(null));
        Assert.IsType<UnauthorizedObjectResult>(await anon.RecentFeed("nope"));

        var alice = new SproutController(db, cfg); SetUser(alice, "alice");
        var key = Json(await alice.GenerateApiKey()).GetProperty("api_key").GetString();
        var feed = Assert.IsType<ContentResult>(await anon.RecentFeed(key)).Content!;
        Assert.Contains("AliceMovie", feed);
        Assert.DoesNotContain("BobMovie", feed);
    }

    [Fact]
    public async Task Roux_CollectionsAndItemsArePerUser_AndDeleteWorks()
    {
        using var db = NewDb();
        SeedMedia(db, "alice", "AliceMovie");
        SeedMedia(db, "bob", "BobMovie");
        var a = new RouxController(db); SetUser(a, "alice");
        var b = new RouxController(db); SetUser(b, "bob");
        var created = Json(await a.CreateCollection(JsonSerializer.SerializeToElement(new { name = "Mine" })));
        var id = created.GetProperty("collection").GetProperty("id").GetString()!;
        Assert.DoesNotContain("Mine", Json(await b.GetCollections()).GetRawText());
        Assert.DoesNotContain("AliceMovie", Json(await b.GetCollection("x")).GetRawText());
        Assert.IsType<NotFoundObjectResult>(await b.DeleteCollection(id));
        Assert.IsType<OkObjectResult>(await a.DeleteCollection(id));
        Assert.DoesNotContain("Mine", Json(await a.GetCollections()).GetRawText());
    }

    [Fact]
    public async Task QbitGetConfig_MasksPassword()
    {
        using var db = NewDb();
        db.Settings.Add(new AppSetting { Key = "qbit_config", UserId = "u1", Value = "{\"host\":\"nas\",\"port\":8080,\"username\":\"a\",\"password\":\"topsecret\"}" });
        await db.SaveChangesAsync();
        var c = new QBittorrentController(db);
        SetUser(c, "u1");
        var json = Json(await c.GetConfig());
        Assert.DoesNotContain("topsecret", json.GetRawText());
        Assert.True(json.GetProperty("configured").GetBoolean());
    }
}

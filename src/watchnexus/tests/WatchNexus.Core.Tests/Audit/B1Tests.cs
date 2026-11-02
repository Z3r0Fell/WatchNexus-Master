using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Tests.Audit;

public class B1Tests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase($"B1_{Guid.NewGuid()}").Options);

    private static ControllerContext Ctx(string userId, bool admin = false)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
        if (admin) claims.Add(new Claim(ClaimTypes.Role, "admin"));
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")) }
        };
    }

    private static bool IsAdminOnly(Type controller, string method)
    {
        var m = controller.GetMethod(method, BindingFlags.Public | BindingFlags.Instance)!;
        return m.GetCustomAttributes<AuthorizeAttribute>().Any(a => a.Roles == "admin");
    }

    [Theory]
    [InlineData(typeof(PreservesController), "SaveConfig")]
    [InlineData(typeof(PreservesController), "CreateBackup")]
    [InlineData(typeof(PreservesController), "DeleteBackup")]
    [InlineData(typeof(PopsicleController), "SaveSettings")]
    [InlineData(typeof(MarshmallowController), "SaveConfig")]
    [InlineData(typeof(BiscottiController), "DeleteItem")]
    [InlineData(typeof(BiscottiController), "Scan")]
    [InlineData(typeof(TreacleController), "DeleteTrack")]
    [InlineData(typeof(TreacleController), "Scan")]
    [InlineData(typeof(ChowderController), "AddServer")]
    [InlineData(typeof(ChowderController), "RemoveServer")]
    [InlineData(typeof(ChowderController), "PauseAll")]
    [InlineData(typeof(ChowderController), "ResumeAll")]
    [InlineData(typeof(ChowderController), "CreateSyncMap")]
    [InlineData(typeof(ChowderController), "DeleteSyncMap")]
    [InlineData(typeof(ChowderController), "SaveSchedule")]
    [InlineData(typeof(SetupWizardController), "Reset")]
    public void ServerWideMutations_AreAdminOnly(Type controller, string method) =>
        Assert.True(IsAdminOnly(controller, method), $"{controller.Name}.{method} must require the admin role");

    [Fact]
    public async Task Chowder_AddServer_RejectsMetadataUrl()
    {
        using var db = NewDb();
        var c = new ChowderController(db, new Mock<IHttpClientFactory>().Object) { ControllerContext = Ctx("a", admin: true) };
        var body = JsonDocument.Parse("""{"name":"x","url":"http://169.254.169.254","api_key":"k"}""").RootElement;
        Assert.IsType<BadRequestObjectResult>(await c.AddServer(body));
        Assert.Empty(db.Settings);
    }

    [Fact]
    public void Cellar_RateLimiter_PrunesAndCounts()
    {
        CellarController.ResetRateLimits();
        try
        {
            for (int i = 0; i < 5; i++) Assert.False(CellarController.IsRateLimited("b1-ip"));
            Assert.True(CellarController.IsRateLimited("b1-ip"));
            // first-launch probes use their own bucket and don't consume activation attempts
            Assert.False(CellarController.IsRateLimited("first-launch:b1-ip2", 5));
            Assert.Equal(2, CellarController.RateLimitEntryCount);
        }
        finally { CellarController.ResetRateLimits(); }
    }

    [Fact]
    public async Task Bridge_StatsAndLibraryAlias_AreScopedToCaller()
    {
        using var db = NewDb();
        var mine = new Library { UserId = "me", Name = "m", Path = "/m" };
        var theirs = new Library { UserId = "other", Name = "o", Path = "/o" };
        db.Libraries.AddRange(mine, theirs);
        db.MediaItems.Add(new MediaItem { LibraryId = mine.Id, Title = "Mine", FilePath = "/m/a.mkv", FileSize = 10 });
        db.MediaItems.Add(new MediaItem { LibraryId = theirs.Id, Title = "Theirs", FilePath = "/o/b.mkv", FileSize = 1000 });
        await db.SaveChangesAsync();

        var bridge = new MarmaladeBridgeController(db, new Mock<IConfiguration>().Object,
            new Mock<IHttpClientFactory>().Object, new Mock<Microsoft.Extensions.DependencyInjection.IServiceScopeFactory>().Object)
        { ControllerContext = Ctx("me") };
        var stats = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(await bridge.Stats()).Value);
        Assert.Equal(1, stats.GetProperty("total_libraries").GetInt32());
        Assert.Equal(1, stats.GetProperty("total_media").GetInt32());
        Assert.Equal(10, stats.GetProperty("total_size").GetInt64());

        var alias = new LibraryAliasController(db) { ControllerContext = Ctx("me") };
        var all = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(await alias.GetAll()).Value);
        Assert.Equal(1, all.GetArrayLength());
        Assert.Equal("Mine", all[0].GetProperty("Title").GetString());

        // Adding into someone else's library is refused.
        var add = JsonDocument.Parse($$"""{"title":"x","file_path":"/data/media/x.mkv","library_id":"{{theirs.Id}}"}""").RootElement;
        Assert.IsType<BadRequestObjectResult>(await alias.Add(add));
    }

    [Fact]
    public async Task Brine_SaveConfig_KeepsStoredApiKeyWhenBlank()
    {
        using var db = NewDb();
        var c = new BrineController(db) { ControllerContext = Ctx("u") };
        await c.SaveConfig(JsonDocument.Parse("""{"url":"http://prowlarr:9696","api_key":"secret"}""").RootElement);
        await c.SaveConfig(JsonDocument.Parse("""{"url":"http://prowlarr:9697","api_key":""}""").RootElement);
        var stored = JsonDocument.Parse(db.Settings.Single(s => s.Key == "brine_config" && s.UserId == "u").Value).RootElement;
        Assert.Equal("secret", stored.GetProperty("api_key").GetString());
        Assert.Equal("http://prowlarr:9697", stored.GetProperty("url").GetString());
        Assert.IsType<BadRequestObjectResult>(await c.SaveConfig(JsonDocument.Parse("[]").RootElement));
    }

    [Fact]
    public async Task Glaze_Config_IsPerUser()
    {
        using var db = NewDb();
        var a = new GlazeController(db) { ControllerContext = Ctx("alice") };
        await a.UpdateConfig(JsonDocument.Parse("""{"trakt":{"client_id":"alice-id","access_token":"tok"}}""").RootElement);
        var b = new GlazeController(db) { ControllerContext = Ctx("bob") };
        var bobCfg = JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(await b.GetConfig()).Value);
        Assert.DoesNotContain("alice-id", bobCfg);
        Assert.IsType<BadRequestObjectResult>(await b.TraktAuth());
    }
}

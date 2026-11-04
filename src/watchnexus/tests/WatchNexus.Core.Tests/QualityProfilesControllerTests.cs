using System.Text.Json.Nodes;

namespace WatchNexus.Core.Tests;

public class QualityProfilesCrudTests
{
    private readonly AppDbContext _db;

    public QualityProfilesCrudTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"QualityProfiles_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);
    }

    private QualityProfilesController For(string userId) => new(_db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId) }, "Test"))
            }
        }
    };

    private static JsonElement Body(object o) => JsonSerializer.SerializeToElement(o);

    private static JsonArray ListOf(IActionResult r) =>
        JsonNode.Parse(Assert.IsType<ContentResult>(r).Content!)!.AsArray();

    private static JsonObject ObjOf(IActionResult r) =>
        JsonNode.Parse(Assert.IsType<ContentResult>(r).Content!)!.AsObject();

    [Fact]
    public async Task List_ReturnsBuiltIns_WhenUserHasNoProfiles()
    {
        var list = ListOf(await For("u1").List());
        Assert.Equal(5, list.Count);
        Assert.Contains(list, p => p!["id"]!.GetValue<string>() == "fhd");
    }

    [Fact]
    public async Task Create_AddsProfile_AndSeedsBuiltIns()
    {
        var created = ObjOf(await For("u1").Create(Body(new { name = "My Profile", cutoff = "webdl_1080p", qualities = new[] { "webdl_1080p" } })));
        var id = created["id"]!.GetValue<string>();
        Assert.False(string.IsNullOrEmpty(id));

        var list = ListOf(await For("u1").List());
        Assert.Equal(6, list.Count);
        var mine = list.Single(p => p!["id"]!.GetValue<string>() == id)!;
        Assert.Equal("My Profile", mine["name"]!.GetValue<string>());
        Assert.Equal("webdl_1080p", mine["qualities"]![0]!.GetValue<string>());
    }

    [Fact]
    public async Task Create_RequiresName()
    {
        Assert.IsType<BadRequestObjectResult>(await For("u1").Create(Body(new { name = "  " })));
    }

    [Fact]
    public async Task Profiles_AreScopedPerUser()
    {
        await For("u1").Create(Body(new { name = "Only Mine" }));
        var other = ListOf(await For("u2").List());
        Assert.DoesNotContain(other, p => p!["name"]!.GetValue<string>() == "Only Mine");
        Assert.Equal(5, other.Count);
    }

    [Fact]
    public async Task Update_MergesPartialFields_AndSetsSingleDefault()
    {
        var ctl = For("u1");
        var updated = ObjOf(await ctl.Update("hd", Body(new { is_default = true })));
        Assert.Equal("HD (720p)", updated["name"]!.GetValue<string>());
        Assert.True(updated["is_default"]!.GetValue<bool>());

        var list = ListOf(await For("u1").List());
        var defaults = list.Where(p => p!["is_default"]!.GetValue<bool>()).Select(p => p!["id"]!.GetValue<string>()).ToList();
        Assert.Equal(new[] { "hd" }, defaults);
    }

    [Fact]
    public async Task Update_ReturnsNotFound_ForUnknownId()
    {
        Assert.IsType<NotFoundObjectResult>(await For("u1").Update("nope", Body(new { name = "x" })));
    }

    [Fact]
    public async Task Delete_RemovesProfile()
    {
        Assert.IsType<OkObjectResult>(await For("u1").Delete("sd"));
        var list = ListOf(await For("u1").List());
        Assert.Equal(4, list.Count);
        Assert.DoesNotContain(list, p => p!["id"]!.GetValue<string>() == "sd");
        Assert.IsType<NotFoundObjectResult>(await For("u1").Delete("sd"));
    }
}

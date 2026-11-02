using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

public class B4Tests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly string _root;
    private readonly string? _prevRoots;

    public B4Tests()
    {
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"B4_{Guid.NewGuid()}").Options);
        _root = Path.Combine(Path.GetTempPath(), $"wn_b4_{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(_root, "media", "photos"));
        Directory.CreateDirectory(Path.Combine(_root, "outside"));
        _prevRoots = Environment.GetEnvironmentVariable("MEDIA_ROOTS");
        Environment.SetEnvironmentVariable("MEDIA_ROOTS", Path.Combine(_root, "media"));
    }

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("MEDIA_ROOTS", _prevRoots);
        try { Directory.Delete(_root, true); } catch { }
        _db.Dispose();
    }

    private static T WithUser<T>(T c, string uid = "u1") where T : ControllerBase
    {
        c.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, uid) }, "Test"))
            }
        };
        return c;
    }

    private static JsonElement Json(object o) => JsonSerializer.SerializeToElement(o);

    [Fact]
    public async Task Photos_AddLibrary_RejectsPathOutsideMediaRoots()
    {
        var c = WithUser(new PhotosController(_db));
        var res = await c.AddLibrary(Json(new { name = "x", path = Path.Combine(_root, "outside") }));
        Assert.Equal(403, Assert.IsType<ObjectResult>(res).StatusCode);
        Assert.Empty(_db.PhotoLibraries);
    }

    [Fact]
    public async Task Photos_AddLibrary_AllowsPathInsideMediaRoots()
    {
        var c = WithUser(new PhotosController(_db));
        var res = await c.AddLibrary(Json(new { name = "x", path = Path.Combine(_root, "media", "photos") }));
        Assert.IsType<OkObjectResult>(res);
    }

    [Fact]
    public async Task Photos_ServePhoto_RefusesNonImageFiles()
    {
        var dir = Path.Combine(_root, "media", "photos");
        File.WriteAllText(Path.Combine(dir, "secret.txt"), "s");
        File.WriteAllText(Path.Combine(dir, "a.jpg"), "j");
        _db.PhotoLibraries.Add(new PhotoLibrary { UserId = "u1", Name = "p", Path = dir });
        await _db.SaveChangesAsync();
        var c = WithUser(new PhotosController(_db));

        Assert.IsType<NotFoundResult>(await c.ServePhoto(Path.Combine(dir, "secret.txt").TrimStart('/')));
        Assert.IsType<PhysicalFileResult>(await c.ServePhoto(Path.Combine(dir, "a.jpg").TrimStart('/')));
    }

    [Fact]
    public async Task Parfait_GetSettings_ShortApiKey_DoesNotThrowOrLeak()
    {
        _db.Settings.Add(new AppSetting { Key = "parfait_config", UserId = "", Value = "{\"url\":\"http://lan:5055\",\"api_key\":\"abc\"}" });
        await _db.SaveChangesAsync();
        var c = WithUser(new ParfaitController(_db, null!));
        var ok = Assert.IsType<OkObjectResult>(await c.GetSettings());
        var json = JsonSerializer.Serialize(ok.Value);
        Assert.DoesNotContain("abc", json);
    }

    [Fact]
    public async Task Parfait_SaveSettings_RejectsMetadataUrl()
    {
        var c = WithUser(new ParfaitController(_db, null!));
        var res = await c.SaveSettings(Json(new { url = "http://169.254.169.254", api_key = "k" }));
        Assert.IsType<BadRequestObjectResult>(res);
    }

    [Fact]
    public async Task Menu_SaveSonarrConfig_RejectsMetadataUrl_And_ShortKeyMasked()
    {
        var c = WithUser(new MenuController(_db, null!, null!));
        Assert.IsType<BadRequestObjectResult>(await c.SaveSonarrConfig(Json(new { url = "http://169.254.169.254", api_key = "k" })));

        _db.Settings.Add(new AppSetting { Key = "menu_sonarr", UserId = "", Value = "{\"url\":\"http://lan:8989\",\"api_key\":\"ab\"}" });
        await _db.SaveChangesAsync();
        var ok = Assert.IsType<OkObjectResult>(await c.GetSonarrConfig());
        Assert.DoesNotContain("\"ab\"", JsonSerializer.Serialize(ok.Value));
    }

    [Fact]
    public async Task Menu_CreateRequest_NullVoteAverage_DoesNotThrow()
    {
        var c = WithUser(new MenuController(_db, null!, null!));
        var res = await c.CreateRequest(JsonSerializer.Deserialize<JsonElement>(
            "{\"media_type\":\"movie\",\"tmdb_id\":5,\"title\":\"t\",\"vote_average\":null,\"year\":2020}"));
        Assert.IsType<OkObjectResult>(res);
    }
}

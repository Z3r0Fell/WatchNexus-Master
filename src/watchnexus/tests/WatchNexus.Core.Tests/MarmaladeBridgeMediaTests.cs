using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Tests;

/// <summary>
/// The Movies / TV / Anime pages list a library's contents through
/// GET /api/marmalade/media. These cover the bugs behind "I click a library
/// card and nothing happens": media_type spelling and per-user scoping.
/// </summary>
public class MarmaladeBridgeMediaTests
{
    private readonly AppDbContext _db;
    private readonly MarmaladeBridgeController _controller;

    public MarmaladeBridgeMediaTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"BridgeMediaTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        var services = new ServiceCollection();
        services.AddSingleton(_db);
        var scopeFactory = services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();

        _controller = new MarmaladeBridgeController(_db, new Mock<IConfiguration>().Object,
            new Mock<IHttpClientFactory>().Object, scopeFactory)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        new[] { new Claim(ClaimTypes.NameIdentifier, "me") }, "TestAuth"))
                }
            }
        };

        _db.Libraries.AddRange(
            new Library { Id = "movies", UserId = "me", Name = "My Movies", Path = "/m", MediaType = "movies" },
            new Library { Id = "anime-movies", UserId = "me", Name = "My Anime Movies", Path = "/a", MediaType = "movies" },
            new Library { Id = "other", UserId = "someone-else", Name = "Theirs", Path = "/o", MediaType = "movies" });
        _db.MediaItems.AddRange(
            new MediaItem { Id = "m1", LibraryId = "movies", Title = "Heat", MediaType = "movies", FilePath = "/m/heat.mkv" },
            new MediaItem { Id = "a1", LibraryId = "anime-movies", Title = "Akira", MediaType = "movies", FilePath = "/a/akira.mkv" },
            new MediaItem { Id = "o1", LibraryId = "other", Title = "Private", MediaType = "movies", FilePath = "/o/p.mkv" });
        _db.SaveChanges();
    }

    private static List<JsonElement> Items(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return JsonSerializer.SerializeToElement(ok.Value).EnumerateArray().ToList();
    }

    [Fact]
    public async Task GetMedia_ByLibraryId_ReturnsOnlyThatLibrary_WithLibraryId()
    {
        var items = Items(await _controller.GetMedia(library_id: "anime-movies"));

        var item = Assert.Single(items);
        Assert.Equal("a1", item.GetProperty("Id").GetString());
        Assert.Equal("anime-movies", item.GetProperty("library_id").GetString());
    }

    [Fact]
    public async Task GetMedia_SingularMovieType_MatchesItemsStoredAsMovies()
    {
        var ids = Items(await _controller.GetMedia(media_type: "movie"))
            .Select(i => i.GetProperty("Id").GetString()).OrderBy(x => x).ToList();

        Assert.Equal(new[] { "a1", "m1" }, ids);
    }

    [Fact]
    public async Task GetMedia_DoesNotReturnOtherUsersLibraryItems()
    {
        Assert.Empty(Items(await _controller.GetMedia(library_id: "other")));
        Assert.DoesNotContain(Items(await _controller.GetMedia()),
            i => i.GetProperty("Id").GetString() == "o1");
    }
}

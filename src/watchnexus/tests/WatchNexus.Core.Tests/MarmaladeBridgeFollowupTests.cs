using System.Net;
using System.Security.Claims;
using System.Text;
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
/// Follow-ups to the per-user library scoping: every bridge endpoint that
/// returns or serves a media item must only see the caller's libraries, and
/// other users' item ids must look like they don't exist (404, not 403).
/// Also covers Add Library JSON body, anime TMDB TV matching, and the
/// skip-segments / next-episode endpoints the VideoPlayer calls.
/// </summary>
public class MarmaladeBridgeFollowupTests
{
    private readonly AppDbContext _db;
    private readonly IServiceScopeFactory _scopeFactory;

    public MarmaladeBridgeFollowupTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"BridgeFollowup_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);
        var services = new ServiceCollection();
        services.AddSingleton(_db);
        _scopeFactory = services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();

        _db.Libraries.AddRange(
            new Library { Id = "movies", UserId = "me", Name = "My Movies", Path = "/m", MediaType = "movies" },
            new Library { Id = "tv", UserId = "me", Name = "My TV", Path = "/t", MediaType = "tv" },
            new Library { Id = "other", UserId = "someone-else", Name = "Theirs", Path = "/o", MediaType = "movies" });
        _db.MediaItems.AddRange(
            new MediaItem { Id = "m1", LibraryId = "movies", Title = "Heat", MediaType = "movies", TmdbId = 99, FilePath = "/m/heat.mkv" },
            new MediaItem { Id = "o1", LibraryId = "other", Title = "Private Heat", MediaType = "movies", TmdbId = 99, FilePath = "/o/p.mkv" },
            new MediaItem { Id = "e101", LibraryId = "tv", Title = "Show", MediaType = "tv", FilePath = "/t/Show/Season 1/Show.S01E01.mkv" },
            new MediaItem { Id = "e102", LibraryId = "tv", Title = "Show", MediaType = "tv", FilePath = "/t/Show/Season 1/Show.S01E02.mkv" },
            new MediaItem { Id = "e201", LibraryId = "tv", Title = "Show", MediaType = "tv", FilePath = "/t/Show/Season 2/Show.S02E01.mkv" },
            new MediaItem { Id = "x103", LibraryId = "tv", Title = "Other Show", MediaType = "tv", FilePath = "/t/Other Show/Other.Show.S01E03.mkv" });
        _db.SaveChanges();
    }

    private MarmaladeBridgeController Bridge(string user = "me", IConfiguration? config = null, IHttpClientFactory? http = null) =>
        new(_db, config ?? new Mock<IConfiguration>().Object, http ?? new Mock<IHttpClientFactory>().Object, _scopeFactory)
        {
            ControllerContext = new ControllerContext { HttpContext = Ctx(user) }
        };

    private LibrariesController Libraries(string user = "me") =>
        new(_db, new Mock<IConfiguration>().Object, new Mock<IHttpClientFactory>().Object, _scopeFactory)
        {
            ControllerContext = new ControllerContext { HttpContext = Ctx(user) }
        };

    private static DefaultHttpContext Ctx(string user) => new()
    {
        User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user) }, "TestAuth"))
    };

    private static JsonElement Json(IActionResult result) =>
        JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(result).Value);

    private static List<string?> Ids(IActionResult result) =>
        Json(result).EnumerateArray().Select(i => i.GetProperty("Id").GetString()).ToList();

    // ── 1. Cross-user scoping ────────────────────────────────────────────

    [Fact]
    public async Task RecentMedia_ExcludesOtherUsersItems()
    {
        var ids = Ids(await Bridge().RecentMedia(50));
        Assert.Contains("m1", ids);
        Assert.DoesNotContain("o1", ids);
    }

    [Fact]
    public async Task GetMediaItem_OtherUsersItem_Returns404()
    {
        Assert.IsType<NotFoundObjectResult>(await Bridge().GetMediaItem("o1"));
        Assert.IsType<OkObjectResult>(await Bridge().GetMediaItem("m1"));
    }

    [Fact]
    public async Task SearchMedia_ExcludesOtherUsersItems()
    {
        var ids = Ids(await Bridge().SearchMedia("heat"));
        Assert.Equal(new[] { "m1" }, ids);
    }

    [Fact]
    public async Task MediaByTmdb_ExcludesOtherUsersItems()
    {
        var ids = Ids(await Bridge().GetMediaByTmdb(99));
        Assert.Equal(new[] { "m1" }, ids);
    }

    [Fact]
    public async Task StreamInfo_OtherUsersItem_Returns404MediaNotFound()
    {
        var nf = Assert.IsType<NotFoundObjectResult>(await Bridge().GetStreamInfo("o1"));
        Assert.Contains("Media not found", JsonSerializer.Serialize(nf.Value));
    }

    [Fact]
    public async Task AuthorizeStream_OtherUsersItem_Returns404MediaNotFound()
    {
        var nf = Assert.IsType<NotFoundObjectResult>(await Bridge().AuthorizeStream("o1"));
        Assert.Contains("Media not found", JsonSerializer.Serialize(nf.Value));
    }

    [Fact]
    public async Task Progress_And_Watched_OtherUsersItem_Return404()
    {
        Assert.IsAssignableFrom<NotFoundResult>(await Bridge().UpdateProgress("o1", 10));
        Assert.IsAssignableFrom<NotFoundResult>(await Bridge().MarkWatched("o1"));
    }

    [Fact]
    public async Task LibrariesRecent_ExcludesOtherUsersItems()
    {
        var ids = Ids(await Libraries().Recent(50));
        Assert.Contains("m1", ids);
        Assert.DoesNotContain("o1", ids);
    }

    // ── 2. Add Library accepts JSON body ─────────────────────────────────

    [Fact]
    public async Task AddLibrary_ReadsNameAndPathFromJsonBody()
    {
        var result = await Bridge().AddLibrary(
            new MarmaladeBridgeController.AddLibraryRequest("Anime", "/definitely/not/a/media/root", "anime"),
            null, null, null);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var detail = JsonSerializer.Serialize(bad.Value);
        Assert.DoesNotContain("Name and path are required", detail);
        Assert.Contains("media roots", detail);
    }

    [Fact]
    public async Task AddLibrary_QueryFallbackStillWorks()
    {
        var result = await Bridge().AddLibrary(null, "Anime", "/definitely/not/a/media/root", "anime");
        var detail = JsonSerializer.Serialize(Assert.IsType<BadRequestObjectResult>(result).Value);
        Assert.Contains("media roots", detail);
    }

    [Fact]
    public async Task AddLibrary_NothingProvided_StillRejected()
    {
        var result = await Bridge().AddLibrary(null, null, null, null);
        var detail = JsonSerializer.Serialize(Assert.IsType<BadRequestObjectResult>(result).Value);
        Assert.Contains("Name and path are required", detail);
    }

    // ── 3. Anime libraries match TMDB TV, falling back to movie ──────────

    private static HttpResponseMessage JsonResp(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static IHttpClientFactory Tmdb(Func<string, string> bodyForPath)
    {
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(() =>
            new HttpClient(new MockHttpMessageHandler((req, _) => JsonResp(bodyForPath(req.RequestUri!.AbsolutePath)))));
        return factory.Object;
    }

    private static IConfiguration TmdbConfig()
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["TMDB_API_KEY"]).Returns("test-key");
        return cfg.Object;
    }

    private async Task<MediaItem> ScanAnimeFile(Func<string, string> tmdb)
    {
        var dir = Directory.CreateTempSubdirectory("wn-anime-");
        try
        {
            File.WriteAllText(Path.Combine(dir.FullName, "Frieren.S01E01.mkv"), "x");
            _db.Libraries.Add(new Library { Id = "anime", UserId = "me", Name = "Anime", Path = dir.FullName, MediaType = "anime" });
            await _db.SaveChangesAsync();
            Assert.IsType<OkObjectResult>(await Bridge(config: TmdbConfig(), http: Tmdb(tmdb)).ScanLibrary("anime"));
            return Assert.Single(_db.MediaItems.Where(m => m.LibraryId == "anime"));
        }
        finally { dir.Delete(true); }
    }

    [Fact]
    public async Task ScanAnime_SearchesTmdbTv_AndRecordsTvKind()
    {
        var item = await ScanAnimeFile(path => path.EndsWith("/search/tv")
            ? """{"results":[{"id":209867,"name":"Frieren: Beyond Journey's End"}]}"""
            : """{"results":[{"id":1,"title":"Wrong Movie"}]}""");

        Assert.Equal(209867, item.TmdbId);
        Assert.Equal("tv", item.TmdbKind);
        Assert.Equal("Frieren: Beyond Journey's End", item.Title);
    }

    [Fact]
    public async Task ScanAnime_FallsBackToMovie_WhenNoTvHit()
    {
        var item = await ScanAnimeFile(path => path.EndsWith("/search/tv")
            ? """{"results":[]}"""
            : """{"results":[{"id":4935,"title":"Howl's Moving Castle"}]}""");

        Assert.Equal(4935, item.TmdbId);
        Assert.Equal("movie", item.TmdbKind);
    }

    [Fact]
    public async Task LibrariesScanMetadata_Anime_PrefersTv_ThenMovie()
    {
        var tvFirst = Tmdb(path => path switch
        {
            var p when p.EndsWith("/search/tv") => """{"results":[{"id":77}]}""",
            var p when p.EndsWith("/tv/77") => """{"id":77,"name":"Some Anime"}""",
            _ => """{"results":[{"id":5}]}""",
        });
        var tv = await LibrariesController.FetchTmdbMetadataStatic(tvFirst, "k", "Some Anime", null, "anime");
        Assert.NotNull(tv);
        Assert.Equal(77, tv!.TmdbId);
        Assert.Equal("tv", tv.Kind);
        Assert.Equal("Some Anime", tv.Title);

        var movieOnly = Tmdb(path => path switch
        {
            var p when p.EndsWith("/search/tv") => """{"results":[]}""",
            var p when p.EndsWith("/search/movie") => """{"results":[{"id":5}]}""",
            var p when p.EndsWith("/movie/5") => """{"id":5,"title":"Anime Film"}""",
            _ => "{}",
        });
        var movie = await LibrariesController.FetchTmdbMetadataStatic(movieOnly, "k", "Anime Film", null, "anime");
        Assert.NotNull(movie);
        Assert.Equal(5, movie!.TmdbId);
        Assert.Equal("movie", movie.Kind);
    }

    [Fact]
    public async Task MediaResponses_ExposeTmdbKind()
    {
        var anime = new Library { Id = "anime2", UserId = "me", Name = "A", Path = "/a", MediaType = "anime" };
        _db.Libraries.Add(anime);
        _db.MediaItems.Add(new MediaItem { Id = "an1", LibraryId = "anime2", Title = "Frieren", MediaType = "anime", TmdbId = 209867, TmdbKind = "tv", FilePath = "/a/f.mkv" });
        await _db.SaveChangesAsync();

        var item = Json(await Bridge().GetMedia(library_id: "anime2")).EnumerateArray().Single();
        Assert.Equal("tv", item.GetProperty("tmdb_kind").GetString());
        Assert.Equal("tv", Json(await Bridge().GetMediaItem("an1")).GetProperty("tmdb_kind").GetString());
    }

    // ── 4. skip-segments / next-episode ──────────────────────────────────

    [Fact]
    public async Task SkipSegments_OwnItem_ReturnsEmptySegments_OtherUsers404()
    {
        var json = Json(await Bridge().GetSkipSegments("m1"));
        Assert.Equal(JsonValueKind.Array, json.GetProperty("segments").ValueKind);
        Assert.Equal(0, json.GetProperty("segments").GetArrayLength());

        Assert.IsType<NotFoundObjectResult>(await Bridge().GetSkipSegments("o1"));
    }

    [Fact]
    public async Task NextEpisode_ReturnsNextInSameSeries_AcrossSeasonFolders()
    {
        var next = Json(await Bridge().GetNextEpisode("e101"));
        Assert.Equal("e102", next.GetProperty("id").GetString());
        Assert.Equal(1, next.GetProperty("season_number").GetInt32());
        Assert.Equal(2, next.GetProperty("episode_number").GetInt32());
        Assert.Equal("Show", next.GetProperty("series_name").GetString());

        var afterSeason = Json(await Bridge().GetNextEpisode("e102"));
        Assert.Equal("e201", afterSeason.GetProperty("id").GetString());
    }

    [Fact]
    public async Task NextEpisode_LastEpisode_Or_NonEpisode_Or_OtherUser_Returns404()
    {
        Assert.IsType<NotFoundObjectResult>(await Bridge().GetNextEpisode("e201"));
        Assert.IsType<NotFoundObjectResult>(await Bridge().GetNextEpisode("m1"));
        Assert.IsType<NotFoundObjectResult>(await Bridge().GetNextEpisode("o1"));
        Assert.IsType<NotFoundObjectResult>(await Bridge("someone-else").GetNextEpisode("e101"));
    }
}

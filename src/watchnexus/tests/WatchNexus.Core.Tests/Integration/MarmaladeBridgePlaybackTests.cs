using System.Net;
using System.Text.Json;
using WatchNexus.Core.Data;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Playback-path contract for /api/marmalade/* used by the Dashboard
/// "Recently Added" row, the TMDB details page and the VideoPlayer.
/// </summary>
public class MarmaladeBridgePlaybackTests : IntegrationTestBase
{
    private async Task<MediaItem> AddItemAsync(string libraryId, string title, string mediaType, int? tmdbId, string filePath)
    {
        var item = new MediaItem
        {
            Id = Guid.NewGuid().ToString(), LibraryId = libraryId, Title = title, MediaType = mediaType,
            TmdbId = tmdbId, FilePath = filePath, FileSize = 1000, CreatedAt = DateTime.UtcNow,
        };
        DbContext.MediaItems.Add(item);
        await DbContext.SaveChangesAsync();
        return item;
    }

    [Fact]
    public async Task RecentMedia_ReturnsLibraryIdAndTmdbId()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();
        var movie = await AddItemAsync(library.Id, "Movie", "movies", 550, "/data/media/movies/movie.mkv");

        var response = await Client.GetAsync("/api/marmalade/media/recent?limit=10");

        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        var first = json[0];
        Assert.Equal(movie.Id, first.GetProperty("id").GetString());
        Assert.Equal(550, first.GetProperty("tmdb_id").GetInt32());
        Assert.Equal("movies", first.GetProperty("media_type").GetString());
    }

    [Fact]
    public async Task AuthorizeStream_FileMissingOnDisk_Returns404WithDetail()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();
        var movie = await AddItemAsync(library.Id, "Gone", "movies", null, "/data/media/movies/does-not-exist.mkv");

        var response = await Client.GetAsync($"/api/marmalade/stream/{movie.Id}/authorize");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var json = await DeserializeResponseElement(response);
        Assert.Contains("not found", json.GetProperty("detail").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task StreamInfo_FileMissingOnDisk_Returns404()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();
        var movie = await AddItemAsync(library.Id, "Gone", "movies", null, "/data/media/movies/does-not-exist.mkv");

        var response = await Client.GetAsync($"/api/marmalade/stream/{movie.Id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MediaByTmdb_ReturnsLocalItemsWithSeasonAndEpisode()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync(path: "/data/media/tv", mediaType: "tv");
        var ep = await AddItemAsync(library.Id, "Show", "tv", 1399, "/data/media/tv/Show/Show.S02E05.mkv");
        await AddItemAsync(library.Id, "Other", "tv", 42, "/data/media/tv/Other/Other.S01E01.mkv");

        var response = await Client.GetAsync("/api/marmalade/media/by-tmdb/1399");

        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
        Assert.Equal(ep.Id, json[0].GetProperty("id").GetString());
        Assert.Equal(2, json[0].GetProperty("season_number").GetInt32());
        Assert.Equal(5, json[0].GetProperty("episode_number").GetInt32());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task AddLibrary_AcceptsJsonBody_AndQueryFallback(bool jsonBody)
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        const string badRoot = "/definitely/not/a/media/root";

        var response = jsonBody
            ? await Client.PostAsync("/api/marmalade/libraries", new StringContent(
                JsonSerializer.Serialize(new { name = "Anime", path = badRoot, media_type = "anime" }),
                System.Text.Encoding.UTF8, "application/json"))
            : await Client.PostAsync($"/api/marmalade/libraries?name=Anime&path={Uri.EscapeDataString(badRoot)}&media_type=anime", null);

        // Reaching path validation proves name/path were bound (not "Name and path are required").
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var detail = (await DeserializeResponseElement(response)).GetProperty("detail").GetString();
        Assert.DoesNotContain("Name and path are required", detail);
        Assert.Contains("media roots", detail);
    }

    [Fact]
    public async Task OtherUsersItem_IsNotFound_OnMediaAndStreamEndpoints()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var theirs = await CreateTestLibraryAsync(userId: "someone-else");
        var item = await AddItemAsync(theirs.Id, "Theirs", "movies", 550, "/data/media/movies/theirs.mkv");

        foreach (var url in new[] { $"/api/marmalade/media/{item.Id}", $"/api/marmalade/stream/{item.Id}",
                     $"/api/marmalade/stream/{item.Id}/authorize", $"/api/marmalade/media/{item.Id}/skip-segments",
                     $"/api/marmalade/media/{item.Id}/next-episode" })
            Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync(url)).StatusCode);

        var byTmdb = await DeserializeResponseElement(await Client.GetAsync("/api/marmalade/media/by-tmdb/550"));
        Assert.Equal(0, byTmdb.GetArrayLength());
    }
}

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

    // ── Video playback: direct vs ffmpeg remux/transcode ──────────────

    /// <summary>Generate a short real video with ffmpeg; null when ffmpeg isn't installed.</summary>
    private string? MakeVideo(string relativePath, params string[] codecArgs)
    {
        var ffmpeg = WatchNexus.Core.Services.FfmpegLocator.Ffmpeg;
        if (ffmpeg == null || WatchNexus.Core.Services.FfmpegLocator.Ffprobe == null) return null;
        var full = Path.Combine(MediaRoot, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        var psi = new System.Diagnostics.ProcessStartInfo(ffmpeg) { RedirectStandardError = true, UseShellExecute = false };
        foreach (var a in new[] { "-y", "-hide_banner", "-loglevel", "error",
                     "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=25",
                     "-f", "lavfi", "-i", "sine=frequency=440:duration=2" })
            psi.ArgumentList.Add(a);
        foreach (var a in codecArgs) psi.ArgumentList.Add(a);
        psi.ArgumentList.Add(full);
        using var p = System.Diagnostics.Process.Start(psi)!;
        p.StandardError.ReadToEnd();
        p.WaitForExit();
        return p.ExitCode == 0 ? full : null;
    }

    [Fact]
    public async Task AuthorizeStream_AudioFile_IsDirectPlay()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync(path: MediaRoot, mediaType: "music");
        var song = await AddItemAsync(library.Id, "Song", "music", null, CreateMediaFile("music/song.mp3"));

        var json = await DeserializeResponseElement(await Client.GetAsync($"/api/marmalade/stream/{song.Id}/authorize"));

        Assert.True(json.GetProperty("direct_play").GetBoolean());
        Assert.Contains($"/stream/{song.Id}/file?token=", json.GetProperty("stream_url").GetString());
    }

    [Fact]
    public async Task AuthorizeStream_MkvWithAc3_IsRemuxedThroughFfmpeg_AndTranscodeEndpointStreamsFragmentedMp4()
    {
        var path = MakeVideo("movies/Remux Me (2020).mkv", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "ac3");
        if (path == null) return; // ffmpeg not installed on this runner
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync(path: MediaRoot);
        var movie = await AddItemAsync(library.Id, "Remux Me", "movies", null, path);

        var auth = await Client.GetAsync($"/api/marmalade/stream/{movie.Id}/authorize");
        AssertJsonResponse(auth);
        var json = await DeserializeResponseElement(auth);
        Assert.False(json.GetProperty("direct_play").GetBoolean());
        Assert.Equal("remux", json.GetProperty("playback_mode").GetString());
        var transcodeUrl = json.GetProperty("transcode_url").GetString()!;
        Assert.Equal(transcodeUrl, json.GetProperty("stream_url").GetString());
        Assert.InRange(json.GetProperty("duration").GetDouble(), 1.5, 2.5);

        var stream = await Client.GetAsync(transcodeUrl + "&start=0.5");
        Assert.Equal(HttpStatusCode.OK, stream.StatusCode);
        Assert.Equal("video/mp4", stream.Content.Headers.ContentType?.MediaType);
        var bytes = await stream.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 1000);
        Assert.Equal("ftyp", System.Text.Encoding.ASCII.GetString(bytes, 4, 4));
    }

    [Fact]
    public async Task AuthorizeStream_Mpeg4Avi_IsFullyTranscoded()
    {
        var path = MakeVideo("movies/old.avi", "-c:v", "mpeg4", "-c:a", "libmp3lame");
        if (path == null) return;
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync(path: MediaRoot);
        var movie = await AddItemAsync(library.Id, "Old", "movies", null, path);

        var json = await DeserializeResponseElement(await Client.GetAsync($"/api/marmalade/stream/{movie.Id}/authorize"));
        Assert.Equal("transcode", json.GetProperty("playback_mode").GetString());

        var stream = await Client.GetAsync(json.GetProperty("transcode_url").GetString());
        Assert.Equal(HttpStatusCode.OK, stream.StatusCode);
        var bytes = await stream.Content.ReadAsByteArrayAsync();
        Assert.Equal("ftyp", System.Text.Encoding.ASCII.GetString(bytes, 4, 4));
    }

    [Fact]
    public async Task AuthorizeStream_BrowserNativeMp4_IsDirectPlay()
    {
        var path = MakeVideo("movies/native.mp4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac");
        if (path == null) return;
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync(path: MediaRoot);
        var movie = await AddItemAsync(library.Id, "Native", "movies", null, path);

        var json = await DeserializeResponseElement(await Client.GetAsync($"/api/marmalade/stream/{movie.Id}/authorize"));
        Assert.True(json.GetProperty("direct_play").GetBoolean());
        Assert.Contains("/file?token=", json.GetProperty("stream_url").GetString());
        // Fallback stays available in case the browser still can't decode it.
        Assert.Contains("/transcode?token=", json.GetProperty("transcode_url").GetString());
    }

    [Fact]
    public async Task TranscodeStream_InvalidToken_Returns401()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync(path: MediaRoot);
        var movie = await AddItemAsync(library.Id, "M", "movies", null, CreateMediaFile("movies/m.mkv"));

        var response = await Client.GetAsync($"/api/marmalade/stream/{movie.Id}/transcode?token=999999999999.forged");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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

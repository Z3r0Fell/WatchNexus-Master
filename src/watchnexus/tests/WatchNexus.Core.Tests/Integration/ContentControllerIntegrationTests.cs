using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for ContentController (TMDB Proxy, Watchlist, Watch Progress, Next Up)
/// Covers: /api/tmdb/*, /api/watchlist/*, /api/watch-progress/*, /api/next-up/*
/// </summary>
public class ContentControllerIntegrationTests : IntegrationTestBase
    {
    public ContentControllerIntegrationTests() : base() { }

    #region TMDB Proxy

    [Fact]
    public async Task TMDBProxy_NoAuth_Returns401()
    {
        ClearAuthentication();
        var response = await Client.GetAsync("/api/tmdb/search?query=test");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TMDBProxy_NoApiKey_ReturnsEmptyResults()
    {
        AuthenticateAsUser();
        // No TMDB key seeded

        var response = await Client.GetAsync("/api/tmdb/search?query=test");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("results").GetArrayLength());
        Assert.Equal(0, json.GetProperty("total_results").GetInt32());
    }

    [Fact]
    public async Task TMDBProxy_WithApiKey_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        // Mock TMDB API response
        var tmdbResponse = new
        {
            page = 1,
            results = new[] { new { id = 12345, title = "Test Movie", overview = "Test", poster_path = "/test.jpg" } },
            total_pages = 1,
            total_results = 1
        };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/search?query=test&page=1&media_type=movie");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetProperty("results").GetArrayLength());
        Assert.Equal("Test Movie", json.GetProperty("results")[0].GetProperty("title").GetString());
    }

    [Fact]
    public async Task TMDBProxy_MovieDetail_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { id = 12345, title = "Test Movie", runtime = 120, vote_average = 8.5 };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/movie/12345");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(12345, json.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task TMDBProxy_TvDetail_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { id = 67890, name = "Test Show", number_of_seasons = 2 };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/tv/67890");
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task TMDBProxy_Season_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { id = 67890, season_number = 1, episodes = new object[] { } };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/tv/67890/season/1");
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task TMDBProxy_Discover_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { page = 1, results = new object[] { }, total_pages = 1, total_results = 0 };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/discover/movie?page=1&with_genres=28&sort_by=popularity.desc");
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task TMDBProxy_Genres_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { genres = new[] { new { id = 28, name = "Action" }, new { id = 12, name = "Adventure" } } };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/genres/movie");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(2, json.GetProperty("genres").GetArrayLength());
    }

    [Fact]
    public async Task TMDBProxy_Trending_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { page = 1, results = new object[] { }, total_pages = 1, total_results = 0 };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/trending/movie/week");
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task TMDBProxy_NowPlaying_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { page = 1, results = new object[] { }, total_pages = 1, total_results = 0 };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/movie/now_playing?page=1");
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task TMDBProxy_OnTheAir_CallsExternalAPI()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        var tmdbResponse = new { page = 1, results = new object[] { }, total_pages = 1, total_results = 0 };
        SetupHttpMockJson(tmdbResponse);

        var response = await Client.GetAsync("/api/tmdb/tv/on_the_air?page=1");
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task TMDBProxy_APIError_ReturnsEmptyResults()
    {
        AuthenticateAsUser();
        await SeedTmdbKeyAsync("test-key");

        // Mock 500 error
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.InternalServerError));

        var response = await Client.GetAsync("/api/tmdb/search?query=test");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("results").GetArrayLength());
    }

    #endregion

    #region Watchlist

    [Fact]
    public async Task GetWatchlist_Empty_ReturnsEmptyArray()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/watchlist");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    [Fact]
    public async Task AddToWatchlist_ValidItem_AddsItem()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 12345, title = "Test Movie", media_type = "movie", poster_path = "/test.jpg" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/watchlist", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("added", json.GetProperty("status").GetString());
        Assert.Equal("12345", json.GetProperty("tmdb_id").GetString());
    }

    [Fact]
    public async Task AddToWatchlist_Duplicate_UpdatesExisting()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 12345, title = "Test Movie" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        await Client.PostAsync("/api/watchlist", content);
        var response = await Client.PostAsync("/api/watchlist", content); // Add again
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("added", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task RemoveFromWatchlist_ExistingItem_RemovesItem()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 12345, title = "Test Movie" });
        await Client.PostAsync("/api/watchlist", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.DeleteAsync("/api/watchlist/12345");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("removed", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task RemoveFromWatchlist_NonExistent_ReturnsOK()
    {
        AuthenticateAsUser();

        var response = await Client.DeleteAsync("/api/watchlist/99999");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("removed", json.GetProperty("status").GetString());
    }

    #endregion

    #region Watch Progress

    [Fact]
    public async Task GetWatchProgress_Empty_ReturnsEmptyArray()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/watch-progress");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    [Fact]
    public async Task UpdateWatchProgress_ValidProgress_SavesProgress()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 12345, media_type = "movie", progress = 45.5, current_time = 5400, duration = 12000 });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/watch-progress", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("saved", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task UpdateWatchProgress_TVEpisode_SavesWithSeasonEpisode()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 67890, media_type = "tv", season = 1, episode = 5, progress = 100, current_time = 2400, duration = 2400 });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/watch-progress", content);
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task GetAllWatchProgress_ReturnsAllProgress()
    {
        AuthenticateAsUser();

        var body1 = JsonSerializer.Serialize(new { tmdb_id = 12345, media_type = "movie", progress = 50 });
        var body2 = JsonSerializer.Serialize(new { tmdb_id = 67890, media_type = "tv", progress = 75 });
        await Client.PostAsync("/api/watch-progress", new StringContent(body1, System.Text.Encoding.UTF8, "application/json"));
        await Client.PostAsync("/api/watch-progress", new StringContent(body2, System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/watch-progress/all");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(2, json.GetArrayLength());
    }

    [Fact]
    public async Task DeleteWatchProgress_ByTmdbId_RemovesProgress()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 12345, media_type = "movie", progress = 50 });
        await Client.PostAsync("/api/watch-progress", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.DeleteAsync("/api/watch-progress?tmdb_id=12345&media_type=movie");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("deleted", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task ClearAllWatchProgress_RemovesAll()
    {
        AuthenticateAsUser();

        var body1 = JsonSerializer.Serialize(new { tmdb_id = 12345, media_type = "movie", progress = 50 });
        var body2 = JsonSerializer.Serialize(new { tmdb_id = 67890, media_type = "tv", progress = 75 });
        await Client.PostAsync("/api/watch-progress", new StringContent(body1, System.Text.Encoding.UTF8, "application/json"));
        await Client.PostAsync("/api/watch-progress", new StringContent(body2, System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.DeleteAsync("/api/watch-progress/all");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("cleared", json.GetProperty("status").GetString());
    }

    #endregion

    #region Next Up

    [Fact]
    public async Task GetNextUp_NoProgress_ReturnsEmpty()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/next-up?limit=10");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    [Fact]
    public async Task GetNextUp_WithProgress_ReturnsInProgressItems()
    {
        AuthenticateAsUser();

        // Add progress items - one in progress (10%), one finished (95%), one not started (5%)
        var body1 = JsonSerializer.Serialize(new { tmdb_id = 12345, media_type = "movie", title = "In Progress Movie", progress = 10, poster_url = "/poster1.jpg", backdrop_path = "/backdrop1.jpg" });
        var body2 = JsonSerializer.Serialize(new { tmdb_id = 67890, media_type = "movie", title = "Finished Movie", progress = 95, poster_url = "/poster2.jpg" });
        var body3 = JsonSerializer.Serialize(new { tmdb_id = 11111, media_type = "movie", title = "Not Started", progress = 5, poster_url = "/poster3.jpg" });
        
        await Client.PostAsync("/api/watch-progress", new StringContent(body1, System.Text.Encoding.UTF8, "application/json"));
        await Client.PostAsync("/api/watch-progress", new StringContent(body2, System.Text.Encoding.UTF8, "application/json"));
        await Client.PostAsync("/api/watch-progress", new StringContent(body3, System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/next-up?limit=10");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        // Only progress between 5% and 95% should appear
        Assert.Equal(1, json.GetArrayLength());
        Assert.Equal("In Progress Movie", json[0].GetProperty("title").GetString());
        Assert.Equal(10, json[0].GetProperty("progress").GetDouble());
    }

    #endregion

    #region Idempotency

    [Fact]
    public async Task Watchlist_AddTwice_Idempotent()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 12345, title = "Test" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        await Client.PostAsync("/api/watchlist", content);
        await Client.PostAsync("/api/watchlist", content);
        await Client.PostAsync("/api/watchlist", content);

        var response = await Client.GetAsync("/api/watchlist");
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength()); // Only one entry
    }

    [Fact]
    public async Task WatchProgress_UpdateTwice_Idempotent()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { tmdb_id = 12345, media_type = "movie", progress = 50 });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        await Client.PostAsync("/api/watch-progress", content);
        await Client.PostAsync("/api/watch-progress", content);

        var response = await Client.GetAsync("/api/watch-progress");
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
    }

    #endregion
}
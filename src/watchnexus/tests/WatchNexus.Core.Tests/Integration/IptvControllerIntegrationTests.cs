using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for IptvController (Live TV / IPTV)
/// Covers: /api/iptv/*
/// </summary>
public class IptvControllerIntegrationTests : IntegrationTestBase
    {
    public IptvControllerIntegrationTests() : base() { }


    #region Sources CRUD

    [Fact]
    public async Task GetSources_Empty_ReturnsEmptyArray()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro"); // IPTV is Pro

        var response = await Client.GetAsync("/api/iptv/sources");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    [Fact]
    public async Task AddSource_ValidUrl_CreatesSourceAndParsesM3U()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Mock HTTP response for M3U fetch
        var m3uContent = "#EXTM3U\n#EXTINF:-1 tvg-id=\"ch1\" group-title=\"News\",Channel 1\nhttp://example.com/stream1.m3u8\n#EXTINF:-1 tvg-id=\"ch2\" group-title=\"Sports\",Channel 2\nhttp://example.com/stream2.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) 
        { 
            Content = new StringContent(m3uContent, System.Text.Encoding.UTF8, "text/plain") 
        });

        var body = JsonSerializer.Serialize(new { name = "Test Source", url = "https://example.com/playlist.m3u", epg_url = "https://example.com/epg.xml" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/iptv/sources", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("id").GetString());
        Assert.Equal("Test Source", json.GetProperty("name").GetString());
        Assert.Equal(2, json.GetProperty("channel_count").GetInt32());
        Assert.Equal("added", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task AddSource_BlockedUrl_Returns400()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var body = JsonSerializer.Serialize(new { name = "Test", url = "http://localhost:8080/playlist.m3u" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/iptv/sources", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddSource_InvalidUrl_ReturnsParseError()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.NotFound));

        var body = JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/notfound.m3u" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/iptv/sources", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("added", json.GetProperty("status").GetString());
        Assert.NotNull(json.GetProperty("parse_error").GetString());
        Assert.Equal(0, json.GetProperty("channel_count").GetInt32());
    }

    [Fact]
    public async Task UpdateSource_ValidInput_UpdatesSource()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Create source first
        var m3uContent = "#EXTM3U\n#EXTINF:-1,Test\nhttp://test.com/stream.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        var createBody = JsonSerializer.Serialize(new { name = "Original", url = "https://example.com/orig.m3u" });
        var createResponse = await Client.PostAsync("/api/iptv/sources", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var sourceId = created.GetProperty("id").GetString();

        // Update
        var updateBody = JsonSerializer.Serialize(new { name = "Updated" });
        var updateContent = new StringContent(updateBody, System.Text.Encoding.UTF8, "application/json");
        
        var response = await Client.PutAsync($"/api/iptv/sources/{sourceId}", updateContent);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("updated", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task RefreshSource_RefetchesM3U()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1,Channel 1\nhttp://test.com/1.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        var createBody = JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" });
        var createResponse = await Client.PostAsync("/api/iptv/sources", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var sourceId = created.GetProperty("id").GetString();

        // Refresh
        var response = await Client.PostAsync($"/api/iptv/sources/{sourceId}/refresh", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("refreshed", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task DeleteSource_RemovesSourceAndChannels()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1,Test\nhttp://test.com/stream.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        var createBody = JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" });
        var createResponse = await Client.PostAsync("/api/iptv/sources", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var sourceId = created.GetProperty("id").GetString();

        var response = await Client.DeleteAsync($"/api/iptv/sources/{sourceId}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("deleted", json.GetProperty("status").GetString());

        // Verify cascade delete
        var source = await DbContext.IptvSources.FindAsync(sourceId);
        Assert.Null(source);
        var channels = await DbContext.IptvChannels.Where(c => c.SourceId == sourceId).ToListAsync();
        Assert.Empty(channels);
    }

    #endregion

    #region Channels

    [Fact]
    public async Task GetChannels_ReturnsPaginatedChannels()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 tvg-id=\"ch1\" group-title=\"News\",Channel 1\nhttp://test.com/1.m3u8\n#EXTINF:-1 tvg-id=\"ch2\" group-title=\"Sports\",Channel 2\nhttp://test.com/2.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        var createBody = JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" });
        await Client.PostAsync("/api/iptv/sources", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/iptv/channels?limit=10&offset=0");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(2, json.GetArrayLength());
        
        var first = json[0];
        Assert.NotNull(first.GetProperty("id"));
        Assert.NotNull(first.GetProperty("name"));
        Assert.NotNull(first.GetProperty("stream_url"));
        Assert.NotNull(first.GetProperty("group_title"));
    }

    [Fact]
    public async Task GetChannels_FilterBySource_Works()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Create two sources
        var m3u1 = "#EXTM3U\n#EXTINF:-1,Source1 Ch1\nhttp://test.com/s1c1.m3u8";
        var m3u2 = "#EXTM3U\n#EXTINF:-1,Source2 Ch1\nhttp://test.com/s2c1.m3u8";
        
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3u1) });
        var create1 = await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Source 1", url = "https://example.com/s1.m3u" }), System.Text.Encoding.UTF8, "application/json"));
        var source1 = await DeserializeResponseElement(create1);
        var source1Id = source1.GetProperty("id").GetString();

        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3u2) });
        var create2 = await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Source 2", url = "https://example.com/s2.m3u" }), System.Text.Encoding.UTF8, "application/json"));
        var source2 = await DeserializeResponseElement(create2);
        var source2Id = source2.GetProperty("id").GetString();

        // Filter by source 1
        var response = await Client.GetAsync($"/api/iptv/channels?source_id={source1Id}");
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
        Assert.Equal("Source1 Ch1", json[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetChannels_FilterByGroup_Works()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 group-title=\"News\",News Channel\nhttp://test.com/news.m3u8\n#EXTINF:-1 group-title=\"Sports\",Sports Channel\nhttp://test.com/sports.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/iptv/channels?group=News");
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
        Assert.Equal("News Channel", json[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetChannels_Search_Works()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1,BBC News\nhttp://test.com/bbc.m3u8\n#EXTINF:-1,CNN News\nhttp://test.com/cnn.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/iptv/channels?search=BBC");
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
        Assert.Equal("BBC News", json[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetChannels_FavoritesOnly_Works()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 tvg-id=\"ch1\",Channel 1\nhttp://test.com/1.m3u8\n#EXTINF:-1 tvg-id=\"ch2\",Channel 2\nhttp://test.com/2.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        // Get channel IDs
        var channelsResponse = await Client.GetAsync("/api/iptv/channels");
        var channels = await DeserializeResponseElement(channelsResponse);
        var ch1Id = channels[0].GetProperty("id").GetString();

        // Add to favorites
        await Client.PostAsync($"/api/iptv/channels/{ch1Id}/favorite", null);

        // Filter favorites only
        var response = await Client.GetAsync("/api/iptv/channels?favorites_only=true");
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
        Assert.True(json[0].GetProperty("is_favorite").GetBoolean());
    }

    #endregion

    #region Favorites

    [Fact]
    public async Task ToggleFavorite_AddsFavorite()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 tvg-id=\"ch1\",Channel 1\nhttp://test.com/1.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var channelsResponse = await Client.GetAsync("/api/iptv/channels");
        var channels = await DeserializeResponseElement(channelsResponse);
        var ch1Id = channels[0].GetProperty("id").GetString();

        var response = await Client.PostAsync($"/api/iptv/channels/{ch1Id}/favorite", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("is_favorite").GetBoolean());
    }

    [Fact]
    public async Task ToggleFavorite_RemovesFavorite()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 tvg-id=\"ch1\",Channel 1\nhttp://test.com/1.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var channelsResponse = await Client.GetAsync("/api/iptv/channels");
        var channels = await DeserializeResponseElement(channelsResponse);
        var ch1Id = channels[0].GetProperty("id").GetString();

        await Client.PostAsync($"/api/iptv/channels/{ch1Id}/favorite", null); // Add
        var response = await Client.PostAsync($"/api/iptv/channels/{ch1Id}/favorite", null); // Remove
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.False(json.GetProperty("is_favorite").GetBoolean());
    }

    [Fact]
    public async Task GetChannel_ById_ReturnsChannel()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 tvg-id=\"ch1\" tvg-logo=\"http://logo.png\" group-title=\"News\",Channel 1\nhttp://test.com/1.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var channelsResponse = await Client.GetAsync("/api/iptv/channels");
        var channels = await DeserializeResponseElement(channelsResponse);
        var ch1Id = channels[0].GetProperty("id").GetString();

        var response = await Client.GetAsync($"/api/iptv/channels/{ch1Id}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(ch1Id, json.GetProperty("id").GetString());
        Assert.Equal("Channel 1", json.GetProperty("name").GetString());
        Assert.Equal("http://logo.png", json.GetProperty("logo_url").GetString());
    }

    #endregion

    #region Groups

    [Fact]
    public async Task GetGroups_ReturnsGroupCounts()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 group-title=\"News\",News 1\nhttp://test.com/n1.m3u8\n#EXTINF:-1 group-title=\"News\",News 2\nhttp://test.com/n2.m3u8\n#EXTINF:-1 group-title=\"Sports\",Sports 1\nhttp://test.com/s1.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/iptv/groups");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(2, json.GetArrayLength());
        
        var news = json.EnumerateArray().First(g => g.GetProperty("name").GetString() == "News");
        Assert.Equal(2, news.GetProperty("count").GetInt32());
    }

    #endregion

    #region EPG (Not Implemented)

    [Fact]
    public async Task GetEpg_ReturnsEmptyArray()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync("/api/iptv/epg/test-channel");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    #endregion

    #region Stats

    [Fact]
    public async Task GetStats_ReturnsAggregatedStats()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1,Ch1\nhttp://test.com/1.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/iptv/stats");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetProperty("sources").GetInt32());
        Assert.Equal(1, json.GetProperty("channels").GetInt32());
        Assert.Equal(1, json.GetProperty("groups").GetInt32());
        Assert.Equal(0, json.GetProperty("favorites_count").GetInt32());
    }

    #endregion

    #region Export

    [Fact]
    public async Task Export_ReturnsM3UContent()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var m3uContent = "#EXTM3U\n#EXTINF:-1 tvg-id=\"ch1\",Channel 1\nhttp://test.com/1.m3u8";
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(m3uContent) });
        
        await Client.PostAsync("/api/iptv/sources", new StringContent(JsonSerializer.Serialize(new { name = "Test", url = "https://example.com/test.m3u" }), System.Text.Encoding.UTF8, "application/json"));

        var response = await Client.GetAsync("/api/iptv/export");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("content").GetString());
        Assert.Contains("#EXTM3U", json.GetProperty("content").GetString());
        Assert.Contains("Channel 1", json.GetProperty("content").GetString());
        Assert.Equal("watchnexus.m3u", json.GetProperty("filename").GetString());
    }

    #endregion
}
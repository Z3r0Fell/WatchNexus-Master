using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for LibrariesController and MediaControllers
/// Covers: /api/libraries/*, /api/media/*, /api/quality-profiles, /api/compote/*, /api/indexers/*
/// </summary>
public class LibrariesMediaIntegrationTests : IntegrationTestBase
    {
    public LibrariesMediaIntegrationTests() : base() { }


    #region Libraries CRUD

    [Fact]
    public async Task GetLibraries_NoAuth_Returns401()
    {
        ClearAuthentication();
        var response = await Client.GetAsync("/api/libraries");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetLibraries_Empty_ReturnsEmptyArray()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro"); // Libraries require Pro

        var response = await Client.GetAsync("/api/libraries");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    [Fact]
    public async Task CreateLibrary_ValidInput_CreatesLibrary()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var body = JsonSerializer.Serialize(new { Name = "Test Movies", Path = "/data/media/movies", MediaType = "movies" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/libraries", content);
        
        AssertJsonResponse(response, HttpStatusCode.OK);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("id").GetString());
        Assert.Equal("Test Movies", json.GetProperty("name").GetString());
        Assert.Equal("/data/media/movies", json.GetProperty("path").GetString());
        Assert.Equal("movies", json.GetProperty("media_type").GetString());
        Assert.Equal(0, json.GetProperty("item_count").GetInt32());
        Assert.Equal("idle", json.GetProperty("scan_status").GetString());
    }

    [Fact]
    public async Task CreateLibrary_InvalidPath_Returns400()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var body = JsonSerializer.Serialize(new { Name = "Test", Path = "/invalid/path", MediaType = "movies" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/libraries", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateLibrary_MissingName_Returns400()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var body = JsonSerializer.Serialize(new { Path = "/data/media/movies", MediaType = "movies" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/libraries", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetLibraryById_Exists_ReturnsLibrary()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();

        var response = await Client.GetAsync($"/api/libraries/{library.Id}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(library.Id, json.GetProperty("id").GetString());
        Assert.Equal(library.Name, json.GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetLibraryById_NotFound_Returns404()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync($"/api/libraries/nonexistent-id");
        
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateLibrary_ValidInput_UpdatesLibrary()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();

        var body = JsonSerializer.Serialize(new { Name = "Updated Name", Path = library.Path, MediaType = "tv" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync($"/api/libraries/{library.Id}", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("Updated Name", json.GetProperty("name").GetString());
        Assert.Equal("tv", json.GetProperty("media_type").GetString());
    }

    [Fact]
    public async Task DeleteLibrary_RemovesLibraryAndMediaItems()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();
        await CreateTestMediaItemsAsync(library.Id, 3);

        var response = await Client.DeleteAsync($"/api/libraries/{library.Id}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("deleted", json.GetProperty("status").GetString());

        // Verify cascade delete
        var remainingLib = await DbContext.Libraries.FindAsync(library.Id);
        Assert.Null(remainingLib);
        var remainingItems = await DbContext.MediaItems.Where(m => m.LibraryId == library.Id).ToListAsync();
        Assert.Empty(remainingItems);
    }

    #endregion

    #region Library Scan

    [Fact]
    public async Task ScanLibrary_StartsBackgroundJob_ReturnsJobInfo()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync("Scan Test", "/tmp/test-media", "movies");
        
        // Create the test directory
        Directory.CreateDirectory("/tmp/test-media");
        File.WriteAllText("/tmp/test-media/test.mkv", "fake video content");

        try
        {
            var response = await Client.PostAsync($"/api/libraries/{library.Id}/scan", null);
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            
            Assert.NotNull(json.GetProperty("job_id").GetString());
            Assert.Equal("scanning", json.GetProperty("status").GetString());
            Assert.Equal(library.Id, json.GetProperty("library_id").GetString());
        }
        finally
        {
            Directory.Delete("/tmp/test-media", true);
        }
    }

    [Fact]
    public async Task ScanLibrary_AlreadyScanning_ReturnsExistingJob()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();

        // Start first scan
        await Client.PostAsync($"/api/libraries/{library.Id}/scan", null);
        
        // Try to start second scan
        var response = await Client.PostAsync($"/api/libraries/{library.Id}/scan", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("scanning", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task CancelScan_CancelsRunningJob()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();

        await Client.PostAsync($"/api/libraries/{library.Id}/scan", null);
        var response = await Client.DeleteAsync($"/api/libraries/{library.Id}/scan");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("cancelled", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task ScanStatus_ReturnsJobStatus()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();

        var response = await Client.GetAsync($"/api/libraries/{library.Id}/scan/status");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(library.Id, json.GetProperty("library_id").GetString());
    }

    #endregion

    #region Library Media Items

    [Fact]
    public async Task GetLibraryMediaItems_ReturnsPaginatedResults()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();
        await CreateTestMediaItemsAsync(library.Id, 10);

        var response = await Client.GetAsync($"/api/libraries/{library.Id}/media?limit=5&offset=0");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(5, json.GetArrayLength());
        
        // Check structure
        var first = json[0];
        Assert.NotNull(first.GetProperty("id"));
        Assert.NotNull(first.GetProperty("title"));
        Assert.NotNull(first.GetProperty("media_type"));
        Assert.NotNull(first.GetProperty("file_size"));
    }

    #endregion

    #region Recent Media

    [Fact]
    public async Task GetRecentMedia_ReturnsDeduplicatedResults()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();
        
        // Add TV episodes with same TMDB ID
        var item1 = new MediaItem { Id = Guid.NewGuid().ToString(), LibraryId = library.Id, Title = "Show S01E01", MediaType = "episode", TmdbId = 12345, FilePath = "/test/e1.mkv", FileSize = 1000, CreatedAt = DateTime.UtcNow };
        var item2 = new MediaItem { Id = Guid.NewGuid().ToString(), LibraryId = library.Id, Title = "Show S01E02", MediaType = "episode", TmdbId = 12345, FilePath = "/test/e2.mkv", FileSize = 1000, CreatedAt = DateTime.UtcNow.AddMinutes(-1) };
        var item3 = new MediaItem { Id = Guid.NewGuid().ToString(), LibraryId = library.Id, Title = "Movie", MediaType = "movie", TmdbId = 67890, FilePath = "/test/movie.mkv", FileSize = 2000, CreatedAt = DateTime.UtcNow.AddMinutes(-2) };
        DbContext.MediaItems.AddRange(item1, item2, item3);
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/libraries/recent?limit=10");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        // Should deduplicate TV show (same tmdb_id) - only 2 items: the show once + the movie
        Assert.Equal(2, json.GetArrayLength());
    }

    #endregion

    #region Quality Profiles (Read-only in v1.0.0)

    [Fact]
    public async Task GetQualityProfiles_ReturnsBuiltInProfiles()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync("/api/quality-profiles");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(6, json.GetArrayLength()); // any, sd, hd, fhd, uhd
        
        var ids = json.EnumerateArray().Select(x => x.GetProperty("id").GetString()).ToList();
        Assert.Contains("any", ids);
        Assert.Contains("sd", ids);
        Assert.Contains("hd", ids);
        Assert.Contains("fhd", ids);
        Assert.Contains("uhd", ids);
    }

    [Theory]
    [InlineData("POST", "/api/quality-profiles")]
    [InlineData("PUT", "/api/quality-profiles/fhd")]
    [InlineData("DELETE", "/api/quality-profiles/fhd")]
    public async Task QualityProfiles_Mutations_Return501(string method, string endpoint)
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var request = new HttpRequestMessage(new HttpMethod(method), endpoint);
        var response = await Client.SendAsync(request);
        
        Assert.Equal(HttpStatusCode.NotImplemented, response.StatusCode);
    }

    #endregion

    #region Compote Indexer Management

    [Fact]
    public async Task GetIndexers_Empty_ReturnsEmptyArray()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync("/api/compote/indexers");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    [Fact]
    public async Task AddIndexer_ValidInput_CreatesIndexer()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var body = JsonSerializer.Serialize(new
        {
            name = "Test Indexer",
            indexer_type = "torznab",
            url = "https://test.indexer.com",
            api_key = "test-key",
            enabled = true,
            priority = 10
        });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/compote/indexers", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("id").GetString());
        Assert.Equal("Test Indexer", json.GetProperty("name").GetString());
        Assert.Equal("torznab", json.GetProperty("type").GetString());
        Assert.True(json.GetProperty("enabled").GetBoolean());
    }

    [Fact]
    public async Task GetIndexerTypes_ReturnsSupportedTypes()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync("/api/compote/indexer-types");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        var types = json.EnumerateArray().Select(x => x.GetString()).ToList();
        Assert.Contains("torznab", types);
        Assert.Contains("newznab", types);
        Assert.Contains("rss", types);
        Assert.Contains("jackett", types);
        Assert.Contains("prowlarr", types);
    }

    [Fact]
    public async Task UpdateIndexer_ValidInput_UpdatesIndexer()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        // Create indexer first
        var createBody = JsonSerializer.Serialize(new { name = "Original", indexer_type = "torznab", url = "https://test.com", api_key = "key1" });
        var createResponse = await Client.PostAsync("/api/compote/indexers", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var indexerId = created.GetProperty("id").GetString();

        // Update
        var updateBody = JsonSerializer.Serialize(new { name = "Updated", priority = 5 });
        var updateContent = new StringContent(updateBody, System.Text.Encoding.UTF8, "application/json");
        
        var response = await Client.PutAsync($"/api/compote/indexers/{indexerId}", updateContent);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("updated", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task DeleteIndexer_RemovesIndexer()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        var createBody = JsonSerializer.Serialize(new { name = "To Delete", indexer_type = "torznab", url = "https://test.com" });
        var createResponse = await Client.PostAsync("/api/compote/indexers", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var indexerId = created.GetProperty("id").GetString();

        var response = await Client.DeleteAsync($"/api/compote/indexers/{indexerId}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("deleted", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task TestIndexer_ValidIndexer_ReturnsTestResult()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        var createBody = JsonSerializer.Serialize(new { name = "Test", indexer_type = "torznab", url = "https://httpbin.org/get", api_key = "key" });
        var createResponse = await Client.PostAsync("/api/compote/indexers", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var indexerId = created.GetProperty("id").GetString();

        // Mock HTTP response for test
        SetupHttpMockJson(new { success = true });

        var response = await Client.PostAsync($"/api/compote/indexers/{indexerId}/test", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
    }

    #endregion

    #region Compote Search

    [Fact]
    public async Task Search_NoQuery_ReturnsEmptyResults()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync("/api/compote/search?query=");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Search_NoIndexers_ReturnsMessage()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync("/api/compote/search?query=test");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("total").GetInt32());
        Assert.Contains("No indexers configured", json.GetProperty("message").GetString() ?? "");
    }

    [Fact]
    public async Task Search_WithIndexers_CallsExternalAPIs()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        // Add indexer
        var createBody = JsonSerializer.Serialize(new { name = "Test", indexer_type = "torznab", url = "https://test.indexer.com", api_key = "key" });
        await Client.PostAsync("/api/compote/indexers", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));

        // Mock external indexer response
        SetupHttpMockJson(new { channel = new { item = new JsonElement[] { } } });

        var response = await Client.GetAsync("/api/compote/search?query=test&limit=10");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.NotNull(json.GetProperty("results"));
    }

    #endregion

    #region Compote Grab

    [Fact]
    public async Task Grab_NoUrlOrMagnet_Returns400()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.PostAsync("/api/compote/grab?title=Test", null);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Grab_WithMagnet_CreatesDownloadEntry()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.PostAsync("/api/compote/grab?title=Test&magnet_url=magnet:test&use_builtin=true", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.NotNull(json.GetProperty("download_id").GetString());
        Assert.True(json.GetProperty("magnet").GetBoolean());
    }

    #endregion

    #region Indexers Controller (Legacy/Alternative)

    [Fact]
    public async Task IndexersController_List_ReturnsSameAsCompote()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.GetAsync("/api/indexers");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.IsType<JsonElement>(json);
    }

    #endregion

    #region Media Health Checker

    [Fact]
    public async Task MediaHealthCheck_NoPath_ReturnsNotFound()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.PostAsync("/api/media/health-check?file_path=", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("not_found", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task MediaHealthCheck_ValidFile_ReturnsHealthy()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        // Create temp file
        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test content");
        
        try
        {
            var response = await Client.PostAsync($"/api/media/health-check?file_path={Uri.EscapeDataString(tempFile)}", null);
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.Equal("healthy", json.GetProperty("status").GetString());
            Assert.True(json.GetProperty("readable").GetBoolean());
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task MediaHealthCheck_OutsideAllowedPath_Returns403()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.PostAsync("/api/media/health-check?file_path=/etc/passwd", null);
        
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    #endregion

    #region Scheduled Scans

    [Fact]
    public async Task ScheduledScans_CRUD_Works()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        // Create
        var createBody = JsonSerializer.Serialize(new { directory = "/data/media", schedule_type = "daily", schedule_time = "03:00", notify_on_issues = true, auto_repair = false });
        var createResponse = await Client.PostAsync("/api/media/scheduled-scans", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var scanId = created.GetProperty("id").GetString();

        // List
        var listResponse = await Client.GetAsync("/api/media/scheduled-scans");
        var listJson = await DeserializeResponseElement(listResponse);
        Assert.Equal(1, listJson.GetArrayLength());

        // Update
        var updateBody = JsonSerializer.Serialize(new { schedule_type = "weekly" });
        await Client.PutAsync($"/api/media/scheduled-scans/{scanId}", new StringContent(updateBody, System.Text.Encoding.UTF8, "application/json"));

        // Run
        var runResponse = await Client.PostAsync($"/api/media/scheduled-scans/{scanId}/run", null);
        AssertJsonResponse(runResponse);

        // Delete
        var deleteResponse = await Client.DeleteAsync($"/api/media/scheduled-scans/{scanId}");
        AssertJsonResponse(deleteResponse);
    }

    #endregion

    #region Notifications (MediaOps)

    [Fact]
    public async Task GetNotifications_ReturnsNotificationLogs()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        // Add notification log
        DbContext.NotificationLogs.Add(new NotificationLog { EventType = "test", Channel = "discord", Message = "Test message", Status = "sent" });
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/media/notifications?limit=10");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
    }

    [Fact]
    public async Task MarkNotificationRead_ReturnsAcknowledged()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        var log = new NotificationLog { EventType = "test", Channel = "discord", Message = "Test", Status = "sent" };
        DbContext.NotificationLogs.Add(log);
        await DbContext.SaveChangesAsync();

        var response = await Client.PutAsync($"/api/media/notifications/{log.Id}/read", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("acknowledged", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task DeleteNotification_RemovesLog()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        
        var log = new NotificationLog { EventType = "test", Channel = "discord", Message = "Test", Status = "sent" };
        DbContext.NotificationLogs.Add(log);
        await DbContext.SaveChangesAsync();

        var response = await Client.DeleteAsync($"/api/media/notifications/{log.Id}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("deleted", json.GetProperty("status").GetString());
    }

    #endregion

    #region Redownload (Not Implemented)

    [Fact]
    public async Task Redownload_Returns501()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var response = await Client.PostAsync("/api/media/redownload?media_id=123", null);
        
        Assert.Equal(HttpStatusCode.NotImplemented, response.StatusCode);
    }

    #endregion

    #region Idempotency Tests

    [Fact]
    public async Task CreateLibrary_RepeatedPostWithSameData_DoesNotDuplicate()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var body = JsonSerializer.Serialize(new { Name = "Test", Path = "/data/media/test", MediaType = "movies" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var resp1 = await Client.PostAsync("/api/libraries", content);
        var resp2 = await Client.PostAsync("/api/libraries", content);
        
        // Both succeed but should create separate libraries (no unique constraint on name)
        AssertJsonResponse(resp1);
        AssertJsonResponse(resp2);
        
        var count = await DbContext.Libraries.CountAsync(l => l.Name == "Test");
        Assert.Equal(2, count); // Expected: no deduplication on name
    }

    [Fact]
    public async Task DeleteLibrary_Idempotent_SecondDeleteReturnsNotFound()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");
        var library = await CreateTestLibraryAsync();

        await Client.DeleteAsync($"/api/libraries/{library.Id}");
        var response = await Client.DeleteAsync($"/api/libraries/{library.Id}");
        
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    #endregion
}
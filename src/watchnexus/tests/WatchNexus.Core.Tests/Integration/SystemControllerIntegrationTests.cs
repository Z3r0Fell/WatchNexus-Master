using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for SystemController and related endpoints
/// Covers: /api/system/*, /api/cache/*, /api/db/*, /api/logs/*, /api/health
/// </summary>
public class SystemControllerIntegrationTests : IntegrationTestBase
    {
    public SystemControllerIntegrationTests() : base() { }


    #region System Info

    [Fact]
    public async Task GetSystemInfo_ReturnsSystemInfo()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/system/info");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("1.0.4", json.GetProperty("version").GetString());
        Assert.NotNull(json.GetProperty("hostname").GetString());
        Assert.NotNull(json.GetProperty("platform").GetString());
        Assert.NotNull(json.GetProperty("architecture").GetString());
        Assert.NotNull(json.GetProperty("dotnet_version").GetString());
        Assert.True(json.GetProperty("cpu_count").GetInt32() > 0);
        Assert.True(json.GetProperty("memory_mb").GetDouble() > 0);
        Assert.True(json.GetProperty("uptime_seconds").GetDouble() > 0);
        Assert.True(json.GetProperty("module_count").GetInt32() > 0);
        Assert.True(json.GetProperty("modules").GetArrayLength() > 0);
    }

    #endregion

    #region System Stats

    [Fact]
    public async Task GetSystemStats_ReturnsStats()
    {
        AuthenticateAsUser();

        // Add test data
        DbContext.Libraries.Add(new Library { Name = "Test", Path = "/data/media", MediaType = "movies" });
        DbContext.MediaItems.Add(new MediaItem { Title = "Test", LibraryId = "1", FilePath = "/test.mkv", FileSize = 1000, MediaType = "movie" });
        DbContext.Users.Add(new AppUser { Email = "test@test.com", Username = "testuser" });
        DbContext.Playlists.Add(new Playlist { Name = "Test", UserId = "test" });
        DbContext.Downloads.Add(new DownloadItem { Name = "Test", Url = "test", Status = "queued" });
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/system/stats");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("memory_mb").GetDouble() > 0);
        Assert.True(json.GetProperty("cpu_time_seconds").GetDouble() >= 0);
        Assert.True(json.GetProperty("threads").GetInt32() > 0);
        Assert.Equal(1, json.GetProperty("libraries").GetInt32());
        Assert.Equal(1, json.GetProperty("media_items").GetInt32());
        Assert.Equal(1, json.GetProperty("users").GetInt32());
        Assert.Equal(1, json.GetProperty("playlists").GetInt32());
        Assert.Equal(1, json.GetProperty("downloads").GetInt32());
    }

    #endregion

    #region Chromaprint Status

    [Fact]
    public async Task GetChromaprintStatus_ReturnsStatus()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/system/chromaprint-status");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("installed"));
        // Version may be null if not installed
    }

    #endregion

    #region Cache

    [Fact]
    public async Task GetCacheStats_ReturnsCacheInfo()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/cache/stats");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("entries"));
        Assert.NotNull(json.GetProperty("size_bytes"));
    }

    [Fact]
    public async Task ClearCache_ClearsCache()
    {
        AuthenticateAsUser();

        var response = await Client.PostAsync("/api/cache/clear", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("cleared", json.GetProperty("status").GetString());
    }

    #endregion

    #region Database

    [Fact]
    public async Task GetDbStats_ReturnsDbInfo()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/db/stats");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("size_bytes"));
        Assert.NotNull(json.GetProperty("path"));
        Assert.NotNull(json.GetProperty("tables"));
    }

    [Fact]
    public async Task GetDbBackups_ReturnsBackupList()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/db/backups");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.IsType<JsonElement>(json);
    }

    [Fact]
    public async Task CreateDbBackup_CreatesBackup()
    {
        AuthenticateAsUser();

        var response = await Client.PostAsync("/api/db/backup", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("created", json.GetProperty("status").GetString());
        Assert.NotNull(json.GetProperty("path").GetString());
    }

    #endregion

    #region Logs

    [Fact]
    public async Task GetLogFiles_ReturnsLogFiles()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/logs/list");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.IsType<JsonElement>(json);
    }

    [Fact]
    public async Task GetLatestLogs_ReturnsLogEntries()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/logs/latest?lines=50");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("entries"));
        Assert.NotNull(json.GetProperty("total"));
    }

    [Fact]
    public async Task GetSystemHealth_ReturnsHealthInfo()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/logs/system");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.GetProperty("uptime_seconds").GetDouble() > 0);
        Assert.True(json.GetProperty("memory_mb").GetDouble() > 0);
        Assert.True(json.GetProperty("cpu_time_seconds").GetDouble() >= 0);
        Assert.True(json.GetProperty("threads").GetInt32() > 0);
    }

    #endregion

    #region Health Check (No Auth Required)

    [Fact]
    public async Task HealthCheck_NoAuth_ReturnsHealthy()
    {
        ClearAuthentication();

        var response = await Client.GetAsync("/api/health");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("healthy", json.GetProperty("status").GetString());
    }

    #endregion

    #region Updates

    [Fact]
    public async Task CheckForUpdates_ReturnsUpdateInfo()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/system/updates/check");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("1.0.4", json.GetProperty("current_version").GetString());
        Assert.NotNull(json.GetProperty("tier"));
        Assert.NotNull(json.GetProperty("main_update"));
        Assert.NotNull(json.GetProperty("hotfix_patch"));
        Assert.NotNull(json.GetProperty("releases_page"));
        Assert.NotNull(json.GetProperty("checked_at"));
    }

    [Fact]
    public async Task GetCurrentVersion_ReturnsVersionInfo()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/system/updates/current");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal("1.0.4", json.GetProperty("version").GetString());
        Assert.NotNull(json.GetProperty("tier"));
        Assert.NotNull(json.GetProperty("tier_name"));
        Assert.NotNull(json.GetProperty("update_channels"));
    }

    [Fact]
    public async Task ListReleases_ReturnsReleases()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/system/updates/releases");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("releases"));
        Assert.NotNull(json.GetProperty("releases_page"));
    }

    [Fact]
    public async Task GetUpdateHistory_ReturnsHistory()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/system/updates/history");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("history"));
        Assert.NotNull(json.GetProperty("total"));
    }

    [Fact]
    public async Task GetUpdateSettings_ReturnsSettings()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/system/updates/settings");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("auto_check"));
        Assert.NotNull(json.GetProperty("check_interval_hours"));
        Assert.NotNull(json.GetProperty("auto_install_patches"));
        Assert.NotNull(json.GetProperty("notify_on_update"));
        Assert.NotNull(json.GetProperty("channel"));
    }

    [Fact]
    public async Task SaveUpdateSettings_Admin_UpdatesSettings()
    {
        AuthenticateAsAdmin();

        var body = JsonSerializer.Serialize(new { auto_check = false, check_interval_hours = 12 });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/system/updates/settings", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task SaveUpdateSettings_NonAdmin_Returns403()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { auto_check = false });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/system/updates/settings", content);
        
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DismissUpdate_ReturnsSuccess()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { version = "1.0.4" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/system/updates/dismiss", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
    }

    #endregion
}
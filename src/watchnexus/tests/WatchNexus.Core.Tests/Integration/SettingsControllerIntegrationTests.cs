using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for SettingsController
/// Covers: /api/settings/*
/// </summary>
public class SettingsControllerIntegrationTests : IntegrationTestBase
    {
    public SettingsControllerIntegrationTests() : base() { }


    #region Get All Settings

    [Fact]
    public async Task GetAllSettings_ReturnsUserSettings()
    {
        AuthenticateAsUser();

        DbContext.Settings.Add(new AppSetting { Key = "user_setting_1", Value = "value1", UserId = "test-user" });
        DbContext.Settings.Add(new AppSetting { Key = "global_setting", Value = "global", UserId = null });
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/settings");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.True(json.TryGetProperty("user_setting_1", out _));
        Assert.True(json.TryGetProperty("global_setting", out _));
        Assert.Equal("value1", json.GetProperty("user_setting_1").GetString());
        Assert.Equal("global", json.GetProperty("global_setting").GetString());
    }

    #endregion

    #region Get Single Setting

    [Fact]
    public async Task GetSetting_Exists_ReturnsValue()
    {
        AuthenticateAsUser();

        DbContext.Settings.Add(new AppSetting { Key = "test_key", Value = "test_value", UserId = "test-user" });
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/settings/test_key");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("test_key", json.GetProperty("key").GetString());
        Assert.Equal("test_value", json.GetProperty("value").GetString());
    }

    [Fact]
    public async Task GetSetting_JSONValue_ReturnsParsedJSON()
    {
        AuthenticateAsUser();

        var jsonValue = JsonSerializer.Serialize(new { nested = true, value = 123 });
        DbContext.Settings.Add(new AppSetting { Key = "json_key", Value = jsonValue, UserId = "test-user" });
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/settings/json_key");
        
        // Should return raw JSON content
        AssertJsonResponse(response);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("nested", content);
        Assert.Contains("123", content);
    }

    [Fact]
    public async Task GetSetting_NotFound_ReturnsNull()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/settings/nonexistent");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("nonexistent", json.GetProperty("key").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("value").ValueKind);
    }

    #endregion

    #region Set Single Setting

    [Fact]
    public async Task SetSetting_ValidInput_CreatesSetting()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { value = "new_value" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/new_key", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("new_key", json.GetProperty("key").GetString());
        Assert.Equal("new_value", json.GetProperty("value").GetString());

        // Verify in DB
        var setting = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "new_key" && s.UserId == "test-user");
        Assert.NotNull(setting);
        Assert.Equal("new_value", setting.Value);
    }

    [Fact]
    public async Task SetSetting_JSONValue_StoresRawJSON()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { complex = true, array = new[] { 1, 2, 3 } });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/json_key", content);
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task SetSetting_NullValue_DeletesSetting()
    {
        AuthenticateAsUser();

        DbContext.Settings.Add(new AppSetting { Key = "to_delete", Value = "value", UserId = "test-user" });
        await DbContext.SaveChangesAsync();

        var body = JsonSerializer.Serialize(new { value = (string?)null });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/to_delete", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("deleted").GetBoolean());

        var setting = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "to_delete" && s.UserId == "test-user");
        Assert.Null(setting);
    }

    [Fact]
    public async Task SetSetting_ReservedKey_Returns400()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { value = "hack" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/cellar_license", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("sec_test")]
    [InlineData("fortress_test")]
    [InlineData("jwt_test")]
    [InlineData("license_server_test")]
    [InlineData("patch_repo_test")]
    [InlineData("setup_completed")]
    [InlineData("test_secret_key")]
    public async Task SetSetting_ReservedPrefixes_Returns400(string reservedKey)
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { value = "hack" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync($"/api/settings/{reservedKey}", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion

    #region Set Bulk Settings

    [Fact]
    public async Task SetBulkSettings_ValidInput_SetsMultiple()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { key1 = "value1", key2 = "value2", key3 = (string?)null });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("saved", json.GetProperty("status").GetString());

        var s1 = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "key1" && s.UserId == "test-user");
        var s2 = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "key2" && s.UserId == "test-user");
        var s3 = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "key3" && s.UserId == "test-user");
        
        Assert.NotNull(s1);
        Assert.Equal("value1", s1!.Value);
        Assert.NotNull(s2);
        Assert.Equal("value2", s2!.Value);
        Assert.Null(s3); // null = delete
    }

    [Fact]
    public async Task SetBulkSettings_SkipsReservedKeys()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { cellar_license = "hack", user_setting = "ok" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings", content);
        
        AssertJsonResponse(response);
        
        // cellar_license should not be set
        var hack = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "test-user");
        Assert.Null(hack);
        
        // user_setting should be set
        var ok = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "user_setting" && s.UserId == "test-user");
        Assert.NotNull(ok);
    }

    #endregion

    #region Delete Setting

    [Fact]
    public async Task DeleteSetting_Existing_RemovesSetting()
    {
        AuthenticateAsUser();

        DbContext.Settings.Add(new AppSetting { Key = "to_delete", Value = "value", UserId = "test-user" });
        await DbContext.SaveChangesAsync();

        var response = await Client.DeleteAsync("/api/settings/to_delete");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("deleted").GetBoolean());

        var setting = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "to_delete" && s.UserId == "test-user");
        Assert.Null(setting);
    }

    [Fact]
    public async Task DeleteSetting_NonExistent_ReturnsDeletedFalse()
    {
        AuthenticateAsUser();

        var response = await Client.DeleteAsync("/api/settings/nonexistent");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.False(json.GetProperty("deleted").GetBoolean());
    }

    [Fact]
    public async Task DeleteSetting_ReservedKey_Returns400()
    {
        AuthenticateAsUser();

        var response = await Client.DeleteAsync("/api/settings/cellar_license");
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion

    #region Integrations

    [Fact]
    public async Task GetIntegrations_ReturnsIntegrationStatus()
    {
        AuthenticateAsUser();

        var response = await Client.GetAsync("/api/settings/integrations");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("tmdb"));
        Assert.NotNull(json.GetProperty("tmdb").GetProperty("has_key"));
        Assert.NotNull(json.GetProperty("tmdb").GetProperty("source"));
        Assert.NotNull(json.GetProperty("qbittorrent"));
    }

    [Fact]
    public async Task UpdateTmdb_ValidKey_SavesAndVerifies()
    {
        AuthenticateAsUser();

        // Mock TMDB verification
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") });

        var body = JsonSerializer.Serialize(new { api_key = "valid_tmdb_key" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/integrations/tmdb", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("saved", json.GetProperty("status").GetString());
        Assert.True(json.GetProperty("has_key").GetBoolean());
    }

    [Fact]
    public async Task UpdateTmdb_InvalidKey_Returns400()
    {
        AuthenticateAsUser();

        // Mock TMDB verification failure
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.Unauthorized));

        var body = JsonSerializer.Serialize(new { api_key = "invalid_key" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/integrations/tmdb", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTmdb_EmptyKey_ClearsKey()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { api_key = "" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/integrations/tmdb", content);
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task UpdateQbitSettings_ValidInput_SavesSettings()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { host = "qbit.example.com", port = 8080, username = "admin", password = "pass", enabled = true });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync("/api/settings/integrations/qbittorrent", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("saved", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task TestQbitConnection_ValidHost_ReturnsResult()
    {
        AuthenticateAsUser();

        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK));

        var body = JsonSerializer.Serialize(new { host = "qbit.example.com", port = 8080, username = "admin", password = "pass" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/settings/integrations/qbittorrent/test", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.NotNull(json.GetProperty("success"));
    }

    [Fact]
    public async Task TestQbitConnection_BlockedHost_Returns400()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { host = "localhost", port = 8080, username = "admin", password = "pass" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/settings/integrations/qbittorrent/test", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task TestQbitConnection_LoopbackIP_Returns400()
    {
        AuthenticateAsUser();

        var body = JsonSerializer.Serialize(new { host = "127.0.0.1", port = 8080, username = "admin", password = "pass" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/settings/integrations/qbittorrent/test", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion
}
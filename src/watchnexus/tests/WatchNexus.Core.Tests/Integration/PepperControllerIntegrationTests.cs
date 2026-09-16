using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for PepperController (Notification Hub)
/// Covers: /api/pepper/*
/// </summary>
public class PepperControllerIntegrationTests : IntegrationTestBase
    {
    public PepperControllerIntegrationTests() : base() { }


    #region Status

    [Fact]
    public async Task GetStatus_ReturnsModuleInfo()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra"); // Pepper is Ultra

        var response = await Client.GetAsync("/api/pepper/status");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("pepper", json.GetProperty("module").GetString());
        Assert.Equal("active", json.GetProperty("status").GetString());
    }

    #endregion

    #region Channels CRUD

    [Fact]
    public async Task GetChannels_Empty_ReturnsEmptyArray()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/pepper/channels");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetArrayLength());
    }

    [Fact]
    public async Task CreateChannel_Discord_CreatesChannel()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { type = "discord", name = "Test Discord", webhook_url = "https://discord.com/api/webhooks/test", enabled = true });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/pepper/channels", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("created", json.GetProperty("status").GetString());
        Assert.NotNull(json.GetProperty("id").GetString());
    }

    [Fact]
    public async Task CreateChannel_Telegram_CreatesChannel()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { type = "telegram", name = "Test Telegram", bot_token = "123456:ABC", chat_id = "-100123456", enabled = true });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/pepper/channels", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("created", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task CreateChannel_Slack_CreatesChannel()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { type = "slack", name = "Test Slack", webhook_url = "https://hooks.slack.com/services/test", enabled = true });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/pepper/channels", content);
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task CreateChannel_Pushover_CreatesChannel()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { type = "pushover", name = "Test Pushover", app_token = "app_token", user_key = "user_key", enabled = true });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/pepper/channels", content);
        
        AssertJsonResponse(response);
    }

    [Fact]
    public async Task UpdateChannel_ValidInput_UpdatesChannel()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var createBody = JsonSerializer.Serialize(new { type = "discord", name = "Original", webhook_url = "https://discord.com/api/webhooks/orig" });
        var createResponse = await Client.PostAsync("/api/pepper/channels", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var channelId = created.GetProperty("id").GetString();

        var updateBody = JsonSerializer.Serialize(new { name = "Updated", enabled = false });
        var updateContent = new StringContent(updateBody, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PutAsync($"/api/pepper/channels/{channelId}", updateContent);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("saved", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task DeleteChannel_RemovesChannel()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var createBody = JsonSerializer.Serialize(new { type = "discord", name = "To Delete", webhook_url = "https://discord.com/api/webhooks/delete" });
        var createResponse = await Client.PostAsync("/api/pepper/channels", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var channelId = created.GetProperty("id").GetString();

        var response = await Client.DeleteAsync($"/api/pepper/channels/{channelId}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("deleted", json.GetProperty("status").GetString());
    }

    #endregion

    #region Events

    [Fact]
    public async Task GetSupportedEvents_ReturnsEventList()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/pepper/events");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetArrayLength() >= 8);
        
        var eventIds = json.EnumerateArray().Select(x => x.GetProperty("id").GetString()).ToList();
        Assert.Contains("new_media", eventIds);
        Assert.Contains("download_complete", eventIds);
        Assert.Contains("playback_started", eventIds);
        Assert.Contains("user_request", eventIds);
        Assert.Contains("request_approved", eventIds);
        Assert.Contains("transcode_complete", eventIds);
        Assert.Contains("system_alert", eventIds);
    }

    #endregion

    #region Test Channel

    [Fact]
    public async Task TestChannel_Discord_CallsWebhook()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var createBody = JsonSerializer.Serialize(new { type = "discord", name = "Test", webhook_url = "https://discord.com/api/webhooks/test", enabled = true });
        var createResponse = await Client.PostAsync("/api/pepper/channels", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var channelId = created.GetProperty("id").GetString();

        // Mock Discord webhook response
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK));

        var response = await Client.PostAsync($"/api/pepper/test/{channelId}", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Contains("Discord", json.GetProperty("message").GetString() ?? "");
    }

    [Fact]
    public async Task TestChannel_Telegram_CallsAPI()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var createBody = JsonSerializer.Serialize(new { type = "telegram", name = "Test", bot_token = "123456:ABC", chat_id = "-100123456", enabled = true });
        var createResponse = await Client.PostAsync("/api/pepper/channels", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var channelId = created.GetProperty("id").GetString();

        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK));

        var response = await Client.PostAsync($"/api/pepper/test/{channelId}", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.True(json.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task TestChannel_NotFound_Returns404()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.PostAsync("/api/pepper/test/nonexistent", null);
        
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task TestChannel_DisabledChannel_Skips()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var createBody = JsonSerializer.Serialize(new { type = "discord", name = "Disabled", webhook_url = "https://discord.com/api/webhooks/test", enabled = false });
        var createResponse = await Client.PostAsync("/api/pepper/channels", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));
        var created = await DeserializeResponseElement(createResponse);
        var channelId = created.GetProperty("id").GetString();

        var response = await Client.PostAsync($"/api/pepper/test/{channelId}", null);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.False(json.GetProperty("success").GetBoolean());
    }

    #endregion

    #region Send Notification (Internal API)

    [Fact]
    public async Task SendNotification_WithChannels_SendsToAllEnabled()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        // Create multiple channels
        var discordBody = JsonSerializer.Serialize(new { type = "discord", name = "Discord", webhook_url = "https://discord.com/api/webhooks/1", enabled = true });
        var telegramBody = JsonSerializer.Serialize(new { type = "telegram", name = "Telegram", bot_token = "123:ABC", chat_id = "123", enabled = true });
        var slackBody = JsonSerializer.Serialize(new { type = "slack", name = "Slack", webhook_url = "https://hooks.slack.com/1", enabled = false }); // disabled

        await Client.PostAsync("/api/pepper/channels", new StringContent(discordBody, System.Text.Encoding.UTF8, "application/json"));
        await Client.PostAsync("/api/pepper/channels", new StringContent(telegramBody, System.Text.Encoding.UTF8, "application/json"));
        await Client.PostAsync("/api/pepper/channels", new StringContent(slackBody, System.Text.Encoding.UTF8, "application/json"));

        // Mock all webhook responses
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK)); // Discord
        SetupHttpMock(new HttpResponseMessage(HttpStatusCode.OK)); // Telegram

        var sendBody = JsonSerializer.Serialize(new { event_type = "test_event", title = "Test Title", message = "Test message" });
        var sendContent = new StringContent(sendBody, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/pepper/send", sendContent);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal(2, json.GetProperty("sent").GetInt32()); // Only 2 enabled
        Assert.Equal(0, json.GetProperty("failed").GetInt32());
    }

    [Fact]
    public async Task SendNotification_NoChannels_ReturnsZeroSent()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var sendBody = JsonSerializer.Serialize(new { event_type = "test", title = "Test", message = "Test" });
        var sendContent = new StringContent(sendBody, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/pepper/send", sendContent);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("sent").GetInt32());
    }

    #endregion

    #region History (Admin)

    [Fact]
    public async Task GetHistory_Admin_ReturnsLogs()
    {
        AuthenticateAsAdmin();
        await SeedLicenseAsync("ultra");

        // Add notification logs
        DbContext.NotificationLogs.AddRange(
            new NotificationLog { EventType = "test1", Channel = "discord", Message = "Msg 1", Status = "sent" },
            new NotificationLog { EventType = "test2", Channel = "telegram", Message = "Msg 2", Status = "failed", Error = "Timeout" }
        );
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/pepper/history?limit=10");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(2, json.GetArrayLength());
    }

    [Fact]
    public async Task GetHistory_NonAdmin_Returns403()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/pepper/history");
        
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    #endregion

    #region SSRF Protection

    [Fact]
    public async Task SendNotification_DiscordWebhook_BlockedUrl_ReturnsFailed()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var createBody = JsonSerializer.Serialize(new { type = "discord", name = "Bad", webhook_url = "http://localhost:8080/webhook", enabled = true });
        await Client.PostAsync("/api/pepper/channels", new StringContent(createBody, System.Text.Encoding.UTF8, "application/json"));

        var sendBody = JsonSerializer.Serialize(new { event_type = "test", title = "Test", message = "Test" });
        var sendContent = new StringContent(sendBody, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/pepper/send", sendContent);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(0, json.GetProperty("sent").GetInt32());
        Assert.Equal(1, json.GetProperty("failed").GetInt32());
    }

    #endregion
}
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Pepper — Notification Hub.
/// Sends alerts to Discord, Telegram, Slack, email (SMTP), and Pushover
/// on events like new media, download complete, playback, and user requests.
/// </summary>
[Route("api/pepper")]
[ApiController]
[Authorize]
public class PepperController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;

    public PepperController(AppDbContext db, IHttpClientFactory httpFactory)
    {
        _db = db;
        _httpFactory = httpFactory;
    }

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "pepper", version = "1.0.0", status = "active", description = "Notification hub: Discord, Telegram, Slack, and Pushover alerts" });

    // ── Configuration ──────────────────────────────────
    [HttpGet("channels")]
    public async Task<IActionResult> GetChannels()
    {
        var uid = this.UserId();
        var items = await _db.Settings
            .Where(s => s.UserId == uid && s.Key.StartsWith("pepper_channel:"))
            .ToListAsync();
        var channels = items.Select(s =>
        {
            try
            {
                var doc = JsonDocument.Parse(s.Value).RootElement;
                return new
                {
                    id = s.Key.Replace("pepper_channel:", ""),
                    type = doc.TryGetProperty("type", out var t) ? t.GetString() : "",
                    name = doc.TryGetProperty("name", out var n) ? n.GetString() : "",
                    enabled = doc.TryGetProperty("enabled", out var e) && e.GetBoolean(),
                };
            }
            catch { Log.Error("[PepperController] operation failed"); return null; }
        }).Where(x => x != null).ToList();
        return Ok(channels);
    }

    [HttpPost("channels")]
    public async Task<IActionResult> CreateChannel([FromBody] JsonElement body)
    {
        var uid = this.UserId();
        var channelId = Guid.NewGuid().ToString("N")[..8];
        var key = $"pepper_channel:{channelId}";
        _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, Value = body.GetRawText(), UserId = uid });
        await _db.SaveChangesAsync();
        return Ok(new { status = "created", id = channelId });
    }

    [HttpPut("channels/{channelId}")]
    public async Task<IActionResult> SaveChannel(string channelId, [FromBody] JsonElement body)
    {
        var uid = this.UserId();
        var key = $"pepper_channel:{channelId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == key);
        var value = body.GetRawText();
        if (existing != null) existing.Value = value;
        else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, Value = value, UserId = uid });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", channel_id = channelId });
    }

    [HttpDelete("channels/{channelId}")]
    public async Task<IActionResult> DeleteChannel(string channelId)
    {
        var uid = this.UserId();
        var key = $"pepper_channel:{channelId}";
        var item = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == key);
        if (item != null) { _db.Settings.Remove(item); await _db.SaveChangesAsync(); }
        return Ok(new { status = "deleted" });
    }

    // ── Event Preferences ──────────────────────────────────
    [HttpGet("events")]
    public IActionResult SupportedEvents() => Ok(new[]
    {
        new { id = "new_media", name = "New Media Added", description = "When a movie or TV show is added to library" },
        new { id = "download_complete", name = "Download Complete", description = "When a download finishes" },
        new { id = "playback_started", name = "Playback Started", description = "When a user starts watching" },
        new { id = "user_request", name = "User Request", description = "When a user submits a media request" },
        new { id = "request_approved", name = "Request Approved", description = "When an admin approves a request" },
        new { id = "transcode_complete", name = "Transcode Complete", description = "When a media processing job finishes" },
        new { id = "system_alert", name = "System Alert", description = "Server health, disk space, errors" },
    });

    // ── Test ──────────────────────────────────
    [HttpPost("test/{channelId}")]
    public async Task<IActionResult> TestChannel(string channelId)
    {
        var uid = this.UserId();
        var key = $"pepper_channel:{channelId}";
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == key);
        if (setting == null) return NotFound(new { detail = "Channel not found" });

        var cfg = JsonDocument.Parse(setting.Value).RootElement;
        var type = cfg.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "";
        var result = type switch
        {
            "discord" => await SendDiscord(cfg, "WatchNexus Pepper", "Test notification from WatchNexus notification hub."),
            "telegram" => await SendTelegram(cfg, "WatchNexus Pepper: Test notification from WatchNexus notification hub."),
            "slack" => await SendSlack(cfg, "WatchNexus Pepper", "Test notification from WatchNexus notification hub."),
            "pushover" => await SendPushover(cfg, "WatchNexus Pepper", "Test notification from WatchNexus notification hub."),
            _ => (false, $"Unsupported channel type: {type}"),
        };

        _db.NotificationLogs.Add(new NotificationLog
        {
            EventType = "test", Channel = type, Message = "Test notification",
            Status = result.Item1 ? "sent" : "failed", Error = result.Item1 ? null : result.Item2,
        });
        await _db.SaveChangesAsync();
        return Ok(new { success = result.Item1, message = result.Item2 });
    }

    // ── Send Notification (internal API for other controllers) ──────────────────────────────────
    [HttpPost("send")]
    public async Task<IActionResult> Send([FromBody] JsonElement body)
    {
        var eventType = body.TryGetProperty("event_type", out var et) ? et.GetString() ?? "" : "";
        var title = body.TryGetProperty("title", out var ti) ? ti.GetString() ?? "" : "";
        var message = body.TryGetProperty("message", out var m) ? m.GetString() ?? "" : "";

        var channels = await _db.Settings
            .Where(s => s.Key.StartsWith("pepper_channel:"))
            .ToListAsync();

        int sent = 0, failed = 0;
        foreach (var ch in channels)
        {
            try
            {
                var cfg = JsonDocument.Parse(ch.Value).RootElement;
                if (cfg.TryGetProperty("enabled", out var en) && !en.GetBoolean()) continue;
                var type = cfg.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "";
                var result = type switch
                {
                    "discord" => await SendDiscord(cfg, title, message),
                    "telegram" => await SendTelegram(cfg, $"*{title}*\n{message}"),
                    "slack" => await SendSlack(cfg, title, message),
                    "pushover" => await SendPushover(cfg, title, message),
                    _ => (false, "Unsupported"),
                };
                _db.NotificationLogs.Add(new NotificationLog
                {
                    EventType = eventType, Channel = type, Message = $"{title}: {message}",
                    Status = result.Item1 ? "sent" : "failed", Error = result.Item1 ? null : result.Item2,
                });
                if (result.Item1) sent++; else failed++;
            }
            catch { Log.Error("[PepperController] operation failed"); failed++; }
        }
        await _db.SaveChangesAsync();
        return Ok(new { sent, failed });
    }

    // ── History ──────────────────────────────────
    [HttpGet("history")]
    public async Task<IActionResult> History([FromQuery] int limit = 50)
    {
        var logs = await _db.NotificationLogs
            .OrderByDescending(l => l.SentAt)
            .Take(limit)
            .Select(l => new { l.Id, l.EventType, l.Channel, l.Message, l.Status, l.Error, l.SentAt })
            .ToListAsync();
        return Ok(logs);
    }

    // ── Senders ──────────────────────────────────
    private async Task<(bool, string)> SendDiscord(JsonElement cfg, string title, string message)
    {
        var webhookUrl = cfg.TryGetProperty("webhook_url", out var wu) ? wu.GetString() : null;
        if (string.IsNullOrEmpty(webhookUrl)) return (false, "Discord webhook URL not configured");
        var http = _httpFactory.CreateClient();
        var payload = JsonSerializer.Serialize(new
        {
            embeds = new[] { new { title, description = message, color = 0x6C5CE7 } }
        });
        var resp = await http.PostAsync(webhookUrl, new StringContent(payload, Encoding.UTF8, "application/json"));
        return resp.IsSuccessStatusCode ? (true, "Sent to Discord") : (false, $"Discord error: {resp.StatusCode}");
    }

    private async Task<(bool, string)> SendTelegram(JsonElement cfg, string text)
    {
        var botToken = cfg.TryGetProperty("bot_token", out var bt) ? bt.GetString() : null;
        var chatId = cfg.TryGetProperty("chat_id", out var ci) ? ci.GetString() : null;
        if (string.IsNullOrEmpty(botToken) || string.IsNullOrEmpty(chatId)) return (false, "Telegram bot_token and chat_id required");
        var http = _httpFactory.CreateClient();
        var payload = JsonSerializer.Serialize(new { chat_id = chatId, text, parse_mode = "Markdown" });
        var resp = await http.PostAsync($"https://api.telegram.org/bot{botToken}/sendMessage",
            new StringContent(payload, Encoding.UTF8, "application/json"));
        return resp.IsSuccessStatusCode ? (true, "Sent to Telegram") : (false, $"Telegram error: {resp.StatusCode}");
    }

    private async Task<(bool, string)> SendSlack(JsonElement cfg, string title, string message)
    {
        var webhookUrl = cfg.TryGetProperty("webhook_url", out var wu) ? wu.GetString() : null;
        if (string.IsNullOrEmpty(webhookUrl)) return (false, "Slack webhook URL not configured");
        var http = _httpFactory.CreateClient();
        var payload = JsonSerializer.Serialize(new
        {
            blocks = new object[] {
                new { type = "header", text = new { type = "plain_text", text = title } },
                new { type = "section", text = new { type = "mrkdwn", text = message } }
            }
        });
        var resp = await http.PostAsync(webhookUrl, new StringContent(payload, Encoding.UTF8, "application/json"));
        return resp.IsSuccessStatusCode ? (true, "Sent to Slack") : (false, $"Slack error: {resp.StatusCode}");
    }

    private async Task<(bool, string)> SendPushover(JsonElement cfg, string title, string message)
    {
        var token = cfg.TryGetProperty("app_token", out var at) ? at.GetString() : null;
        var userKey = cfg.TryGetProperty("user_key", out var uk) ? uk.GetString() : null;
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(userKey)) return (false, "Pushover app_token and user_key required");
        var http = _httpFactory.CreateClient();
        var form = new FormUrlEncodedContent(new[] {
            new KeyValuePair<string, string>("token", token),
            new KeyValuePair<string, string>("user", userKey),
            new KeyValuePair<string, string>("title", title),
            new KeyValuePair<string, string>("message", message),
        });
        var resp = await http.PostAsync("https://api.pushover.net/1/messages.json", form);
        return resp.IsSuccessStatusCode ? (true, "Sent to Pushover") : (false, $"Pushover error: {resp.StatusCode}");
    }
}

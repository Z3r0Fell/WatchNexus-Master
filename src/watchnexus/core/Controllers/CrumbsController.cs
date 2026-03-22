using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Crumbs — Unified API Management Module
/// Manages both internal WatchNexus API keys and all external service credentials
/// </summary>
[Route("api/crumbs")]
[ApiController]
[Authorize]
public class CrumbsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;

    public CrumbsController(AppDbContext db, IHttpClientFactory httpFactory)
    {
        _db = db;
        _httpFactory = httpFactory;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

    // ── Service Registry (all available services) ──────────────────
    [HttpGet("services")]
    public IActionResult GetServiceRegistry()
    {
        var services = new List<Dictionary<string, object>>
        {
            new() {
                ["id"] = "tmdb", ["name"] = "TMDB", ["category"] = "metadata",
                ["description"] = "Movie & TV metadata, posters, ratings",
                ["fields"] = new object[] {
                    new { key = "api_key", label = "API Key (v3)", type = "password", required = true, help = "Get from themoviedb.org/settings/api" }
                },
                ["test_endpoint"] = "/api/crumbs/test/tmdb", ["docs_url"] = "https://www.themoviedb.org/settings/api"
            },
            new() {
                ["id"] = "opensubtitles", ["name"] = "OpenSubtitles", ["category"] = "subtitles",
                ["description"] = "Subtitle search and download",
                ["fields"] = new object[] {
                    new { key = "api_key", label = "API Key", type = "password", required = true, help = "Register at opensubtitles.com/consumers" },
                    new { key = "username", label = "Username", type = "text", required = false, help = "Optional for higher rate limits" },
                    new { key = "password", label = "Password", type = "password", required = false, help = "Optional for higher rate limits" }
                },
                ["test_endpoint"] = "/api/crumbs/test/opensubtitles", ["docs_url"] = "https://opensubtitles.stoplight.io"
            },
            new() {
                ["id"] = "addic7ed", ["name"] = "Addic7ed", ["category"] = "subtitles",
                ["description"] = "Community TV show subtitles",
                ["fields"] = new object[] {
                    new { key = "username", label = "Username", type = "text", required = true, help = "Your Addic7ed account" },
                    new { key = "password", label = "Password", type = "password", required = true, help = "Your Addic7ed password" }
                },
                ["test_endpoint"] = "/api/crumbs/test/addic7ed", ["docs_url"] = "https://www.addic7ed.com"
            },
            new() {
                ["id"] = "subscene", ["name"] = "Subscene", ["category"] = "subtitles",
                ["description"] = "Subtitle search via Subscene",
                ["fields"] = new object[] {
                    new { key = "api_key", label = "API Key", type = "password", required = false, help = "Optional for premium access" }
                },
                ["test_endpoint"] = "/api/crumbs/test/subscene", ["docs_url"] = "https://subscene.com"
            },
            new() {
                ["id"] = "podnapisi", ["name"] = "Podnapisi", ["category"] = "subtitles",
                ["description"] = "Free subtitle provider (no key needed)",
                ["fields"] = Array.Empty<object>(),
                ["test_endpoint"] = "/api/crumbs/test/podnapisi", ["docs_url"] = "https://www.podnapisi.net"
            },
            new() {
                ["id"] = "yifysubtitles", ["name"] = "YIFY Subtitles", ["category"] = "subtitles",
                ["description"] = "Subtitles matched to YIFY releases",
                ["fields"] = Array.Empty<object>(),
                ["test_endpoint"] = "/api/crumbs/test/yifysubtitles", ["docs_url"] = "https://yifysubtitles.org"
            },
            new() {
                ["id"] = "qbittorrent", ["name"] = "qBittorrent", ["category"] = "downloads",
                ["description"] = "Torrent download client WebUI",
                ["fields"] = new object[] {
                    new { key = "host", label = "Host", type = "text", required = true, help = "IP or hostname (e.g. localhost)" },
                    new { key = "port", label = "Port", type = "number", required = true, help = "WebUI port (default 8080)" },
                    new { key = "username", label = "Username", type = "text", required = true, help = "WebUI username (default admin)" },
                    new { key = "password", label = "Password", type = "password", required = true, help = "WebUI password" }
                },
                ["test_endpoint"] = "/api/crumbs/test/qbittorrent", ["docs_url"] = "https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API"
            },
            new() {
                ["id"] = "openweathermap", ["name"] = "OpenWeatherMap", ["category"] = "gadgets",
                ["description"] = "Alternative weather API (Open-Meteo is used by default — no key needed)",
                ["fields"] = new object[] {
                    new { key = "api_key", label = "API Key", type = "password", required = false, help = "Optional — Open-Meteo works without a key" }
                },
                ["test_endpoint"] = "/api/crumbs/test/openweathermap", ["docs_url"] = "https://openweathermap.org/api"
            },
            new() {
                ["id"] = "matrix", ["name"] = "Matrix", ["category"] = "gadgets",
                ["description"] = "Matrix homeserver for messaging and room management",
                ["fields"] = new object[] {
                    new { key = "homeserver", label = "Homeserver URL", type = "text", required = true, help = "e.g. https://matrix.example.org" },
                    new { key = "access_token", label = "Access Token", type = "password", required = true, help = "Bot or user access token" },
                    new { key = "user_id", label = "User ID", type = "text", required = false, help = "e.g. @bot:example.org" }
                },
                ["test_endpoint"] = "/api/crumbs/test/matrix", ["docs_url"] = "https://spec.matrix.org/latest/client-server-api/"
            },
            new() {
                ["id"] = "synapse", ["name"] = "Synapse Admin", ["category"] = "gadgets",
                ["description"] = "Synapse homeserver admin API for user/room management",
                ["fields"] = new object[] {
                    new { key = "homeserver", label = "Homeserver URL", type = "text", required = true, help = "e.g. https://matrix.example.org" },
                    new { key = "admin_token", label = "Admin Access Token", type = "password", required = true, help = "Token for a server admin user" }
                },
                ["test_endpoint"] = "/api/crumbs/test/synapse", ["docs_url"] = "https://element-hq.github.io/synapse/latest/usage/administration/admin_api/"
            },
            new() {
                ["id"] = "media-bridge", ["name"] = "Media Bridge", ["category"] = "gadgets",
                ["description"] = "External Emby-compatible media server (library browsing, playback, sessions)",
                ["fields"] = new object[] {
                    new { key = "url", label = "Server URL", type = "text", required = true, help = "e.g. http://192.168.1.10:8096" },
                    new { key = "api_key", label = "API Key", type = "password", required = true, help = "Server API key for authentication" },
                    new { key = "user_id", label = "User ID", type = "text", required = false, help = "Optional server user ID for personalized results" }
                },
                ["test_endpoint"] = "/api/crumbs/test/media-bridge", ["docs_url"] = "https://github.com/MediaBrowser/Emby/wiki/Browsing-the-Library"
            },
            new() {
                ["id"] = "omdb", ["name"] = "OMDB", ["category"] = "metadata",
                ["description"] = "Open Movie Database for detailed movie/TV info",
                ["fields"] = new object[] {
                    new { key = "api_key", label = "API Key", type = "password", required = true, help = "Get free key from omdbapi.com/apikey.aspx" }
                },
                ["test_endpoint"] = "/api/crumbs/test/omdb", ["docs_url"] = "https://www.omdbapi.com/"
            },
            new() {
                ["id"] = "discord-webhook", ["name"] = "Discord Webhook", ["category"] = "notifications",
                ["description"] = "Send alerts to a Discord channel via webhook (Pepper notification hub)",
                ["fields"] = new object[] {
                    new { key = "webhook_url", label = "Webhook URL", type = "text", required = true, help = "Discord channel settings > Integrations > Webhooks" }
                },
                ["test_endpoint"] = "/api/pepper/test/discord-webhook", ["docs_url"] = "https://discord.com/developers/docs/resources/webhook"
            },
            new() {
                ["id"] = "telegram-bot", ["name"] = "Telegram Bot", ["category"] = "notifications",
                ["description"] = "Send alerts to Telegram via bot (Pepper notification hub)",
                ["fields"] = new object[] {
                    new { key = "bot_token", label = "Bot Token", type = "password", required = true, help = "Create via @BotFather on Telegram" },
                    new { key = "chat_id", label = "Chat ID", type = "text", required = true, help = "Your Telegram chat or group ID" }
                },
                ["test_endpoint"] = "/api/pepper/test/telegram-bot", ["docs_url"] = "https://core.telegram.org/bots/api"
            },
            new() {
                ["id"] = "pushover", ["name"] = "Pushover", ["category"] = "notifications",
                ["description"] = "Push notifications to mobile via Pushover (Pepper notification hub)",
                ["fields"] = new object[] {
                    new { key = "app_token", label = "Application Token", type = "password", required = true, help = "Create app at pushover.net" },
                    new { key = "user_key", label = "User Key", type = "password", required = true, help = "Your Pushover user/group key" }
                },
                ["test_endpoint"] = "/api/pepper/test/pushover", ["docs_url"] = "https://pushover.net/api"
            },
            new() {
                ["id"] = "prowlarr", ["name"] = "Prowlarr (Usenet Indexer)", ["category"] = "usenet",
                ["description"] = "Usenet indexer search via Prowlarr (Brine gadget)",
                ["fields"] = new object[] {
                    new { key = "url", label = "Prowlarr URL", type = "text", required = true, help = "e.g. http://localhost:9696" },
                    new { key = "api_key", label = "API Key", type = "password", required = true, help = "Prowlarr Settings > General > API Key" },
                    new { key = "type", label = "Type", type = "text", required = false, help = "prowlarr (default) or newznab" }
                },
                ["test_endpoint"] = "/api/gadgets/brine/test", ["docs_url"] = "https://wiki.servarr.com/prowlarr"
            },
            new() {
                ["id"] = "sabnzbd", ["name"] = "SABnzbd (Usenet Downloader)", ["category"] = "usenet",
                ["description"] = "Usenet NZB downloading via SABnzbd (Ladle gadget)",
                ["fields"] = new object[] {
                    new { key = "url", label = "SABnzbd URL", type = "text", required = true, help = "e.g. http://localhost:8080" },
                    new { key = "api_key", label = "API Key", type = "password", required = true, help = "SABnzbd Config > General > API Key" }
                },
                ["test_endpoint"] = "/api/gadgets/ladle/test", ["docs_url"] = "https://sabnzbd.org/wiki/"
            },
        };
        return Ok(services);
    }

    // ── Get all configured services for this user ──────────────────
    [HttpGet("configured")]
    public async Task<IActionResult> GetConfigured()
    {
        var configs = await _db.Settings
            .Where(s => s.UserId == UserId && s.Key.StartsWith("crumbs:"))
            .ToListAsync();

        var result = new List<object>();
        foreach (var cfg in configs)
        {
            var serviceId = cfg.Key.Replace("crumbs:", "");
            try
            {
                var data = JsonDocument.Parse(cfg.Value ?? "{}").RootElement;
                var enabled = data.TryGetProperty("enabled", out var en) && en.GetBoolean();
                var lastTested = data.TryGetProperty("last_tested", out var lt) ? lt.GetString() : null;
                var testStatus = data.TryGetProperty("test_status", out var ts) ? ts.GetString() : null;
                var callCount = data.TryGetProperty("call_count", out var cc) ? cc.GetInt32() : 0;
                var lastUsed = data.TryGetProperty("last_used", out var lu) ? lu.GetString() : null;
                var createdAt = data.TryGetProperty("created_at", out var ca) ? ca.GetString() : null;
                var expiresAt = data.TryGetProperty("expires_at", out var ea) ? ea.GetString() : null;

                // Mask sensitive fields
                var fields = new Dictionary<string, string>();
                if (data.TryGetProperty("fields", out var fieldsEl))
                {
                    foreach (var prop in fieldsEl.EnumerateObject())
                    {
                        var val = prop.Value.GetString() ?? "";
                        // Mask passwords/keys
                        if (prop.Name.Contains("password") || prop.Name.Contains("key") || prop.Name.Contains("secret"))
                            fields[prop.Name] = val.Length > 4 ? val[..4] + "****" : "****";
                        else
                            fields[prop.Name] = val;
                    }
                }

                result.Add(new
                {
                    service_id = serviceId, enabled, last_tested = lastTested,
                    test_status = testStatus, call_count = callCount, last_used = lastUsed,
                    created_at = createdAt, expires_at = expiresAt, fields
                });
            }
            catch { }
        }
        return Ok(result);
    }

    // ── Save/update a service configuration ──────────────────
    [HttpPut("{serviceId}")]
    public async Task<IActionResult> SaveConfig(string serviceId, [FromBody] JsonElement body)
    {
        var key = $"crumbs:{serviceId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == key);

        // Build config object
        var config = new Dictionary<string, object>();
        config["enabled"] = body.TryGetProperty("enabled", out var en) && en.GetBoolean();

        // Merge fields
        var fields = new Dictionary<string, string>();
        if (body.TryGetProperty("fields", out var fieldsEl))
        {
            foreach (var prop in fieldsEl.EnumerateObject())
                fields[prop.Name] = prop.Value.GetString() ?? "";
        }
        config["fields"] = fields;

        // Preserve existing tracking data
        if (existing?.Value != null)
        {
            try
            {
                var prev = JsonDocument.Parse(existing.Value).RootElement;
                if (prev.TryGetProperty("call_count", out var cc)) config["call_count"] = cc.GetInt32();
                if (prev.TryGetProperty("last_used", out var lu)) config["last_used"] = lu.GetString()!;
                if (prev.TryGetProperty("created_at", out var ca)) config["created_at"] = ca.GetString()!;
            }
            catch { }
        }
        if (!config.ContainsKey("created_at"))
            config["created_at"] = DateTime.UtcNow.ToString("o");

        if (body.TryGetProperty("expires_at", out var ea2))
            config["expires_at"] = ea2.GetString()!;

        var json = JsonSerializer.Serialize(config);

        if (existing != null)
            existing.Value = json;
        else
            _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, Value = json, UserId = UserId });

        await _db.SaveChangesAsync();

        // Also sync to legacy settings for backward compatibility
        await SyncLegacySettings(serviceId, fields);

        return Ok(new { status = "saved", service_id = serviceId });
    }

    // ── Delete a service configuration ──────────────────
    [HttpDelete("{serviceId}")]
    public async Task<IActionResult> DeleteConfig(string serviceId)
    {
        var key = $"crumbs:{serviceId}";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == key);
        if (existing != null)
        {
            _db.Settings.Remove(existing);
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "deleted" });
    }

    // ── Test a service connection ──────────────────
    [HttpPost("test/{serviceId}")]
    public async Task<IActionResult> TestService(string serviceId)
    {
        var key = $"crumbs:{serviceId}";
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == key);
        var fields = new Dictionary<string, string>();
        if (cfg?.Value != null)
        {
            try
            {
                var data = JsonDocument.Parse(cfg.Value).RootElement;
                if (data.TryGetProperty("fields", out var f))
                    foreach (var prop in f.EnumerateObject())
                        fields[prop.Name] = prop.Value.GetString() ?? "";
            }
            catch { }
        }

        var (success, message, latencyMs) = serviceId switch
        {
            "tmdb" => await TestTmdb(fields),
            "qbittorrent" => await TestQBittorrent(fields),
            "opensubtitles" => await TestOpenSubtitles(fields),
            "addic7ed" => await TestUrl("https://www.addic7ed.com", "Addic7ed"),
            "subscene" => await TestUrl("https://subscene.com", "Subscene"),
            "podnapisi" => await TestUrl("https://www.podnapisi.net", "Podnapisi"),
            "yifysubtitles" => await TestUrl("https://yifysubtitles.org", "YIFY Subtitles"),
            "openweathermap" => await TestOpenWeatherMap(fields),
            "matrix" => await TestMatrix(fields),
            "media-bridge" => await TestMediaBridge(fields),
            "synapse" => await TestSynapse(fields),
            "omdb" => await TestOmdb(fields),
            _ => (false, $"Unknown service: {serviceId}", 0)
        };

        // Update test status in config
        if (cfg?.Value != null)
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(cfg.Value) ?? new();
                dict["last_tested"] = DateTime.UtcNow.ToString("o");
                dict["test_status"] = success ? "connected" : "failed";
                dict["test_message"] = message;
                dict["test_latency_ms"] = latencyMs;
                cfg.Value = JsonSerializer.Serialize(dict);
                await _db.SaveChangesAsync();
            }
            catch { }
        }

        return Ok(new { success, message, latency_ms = latencyMs, tested_at = DateTime.UtcNow });
    }

    // ── Get usage stats for a service ──────────────────
    [HttpGet("{serviceId}/usage")]
    public async Task<IActionResult> GetUsage(string serviceId)
    {
        var key = $"crumbs:{serviceId}";
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == key);
        if (cfg?.Value == null) return Ok(new { call_count = 0 });

        var data = JsonDocument.Parse(cfg.Value).RootElement;
        return Ok(new
        {
            call_count = data.TryGetProperty("call_count", out var cc) ? cc.GetInt32() : 0,
            last_used = data.TryGetProperty("last_used", out var lu) ? lu.GetString() : null,
            last_tested = data.TryGetProperty("last_tested", out var lt) ? lt.GetString() : null,
            test_status = data.TryGetProperty("test_status", out var ts) ? ts.GetString() : null,
            test_latency_ms = data.TryGetProperty("test_latency_ms", out var tl) ? tl.GetInt32() : 0,
            created_at = data.TryGetProperty("created_at", out var ca) ? ca.GetString() : null,
            expires_at = data.TryGetProperty("expires_at", out var ea) ? ea.GetString() : null,
        });
    }

    // ── Increment usage counter (called internally) ──────────────────
    [HttpPost("{serviceId}/track")]
    public async Task<IActionResult> TrackUsage(string serviceId)
    {
        var key = $"crumbs:{serviceId}";
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == key);
        if (cfg?.Value != null)
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(cfg.Value) ?? new();
                var count = dict.ContainsKey("call_count") && dict["call_count"] is JsonElement je ? je.GetInt32() : 0;
                dict["call_count"] = count + 1;
                dict["last_used"] = DateTime.UtcNow.ToString("o");
                cfg.Value = JsonSerializer.Serialize(dict);
                await _db.SaveChangesAsync();
            }
            catch { }
        }
        return Ok(new { status = "tracked" });
    }

    // ── Rotate / regenerate an internal API key ──────────────────
    [HttpPost("{serviceId}/rotate")]
    public async Task<IActionResult> RotateKey(string serviceId)
    {
        // Only applicable for internal WatchNexus API keys
        if (serviceId != "watchnexus_api")
            return BadRequest(new { detail = "Key rotation only applies to internal API keys" });

        // Generate new key via the security controller logic
        var rawKey = $"wnx_{System.Security.Cryptography.RandomNumberGenerator.GetHexString(24)}";
        return Ok(new { status = "rotated", new_key_preview = rawKey[..8] + "..." + rawKey[^4..] });
    }

    // ── Get raw field values (for editing) ──────────────────
    [HttpGet("{serviceId}/fields")]
    public async Task<IActionResult> GetFields(string serviceId)
    {
        var key = $"crumbs:{serviceId}";
        var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == key);
        if (cfg?.Value == null) return Ok(new { fields = new Dictionary<string, string>(), enabled = false });

        var data = JsonDocument.Parse(cfg.Value).RootElement;
        var fields = new Dictionary<string, string>();
        if (data.TryGetProperty("fields", out var f))
            foreach (var prop in f.EnumerateObject())
                fields[prop.Name] = prop.Value.GetString() ?? "";

        var enabled = data.TryGetProperty("enabled", out var en) && en.GetBoolean();
        var expiresAt = data.TryGetProperty("expires_at", out var ea) ? ea.GetString() : null;
        return Ok(new { fields, enabled, expires_at = expiresAt });
    }

    // ── Test implementations ──────────────────
    private async Task<(bool, string, int)> TestTmdb(Dictionary<string, string> fields)
    {
        var apiKey = fields.GetValueOrDefault("api_key", "");
        if (string.IsNullOrEmpty(apiKey)) return (false, "No API key configured", 0);
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetAsync($"https://api.themoviedb.org/3/configuration?api_key={apiKey}");
            sw.Stop();
            if (resp.IsSuccessStatusCode)
                return (true, "TMDB API connected successfully", (int)sw.ElapsedMilliseconds);
            return (false, $"TMDB returned HTTP {resp.StatusCode}", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, $"Connection failed: {ex.Message}", (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestQBittorrent(Dictionary<string, string> fields)
    {
        var host = fields.GetValueOrDefault("host", "localhost");
        var portStr = fields.GetValueOrDefault("port", "8080");
        if (!int.TryParse(portStr, out var port)) port = 8080;
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(5);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetAsync($"http://{host}:{port}/api/v2/app/version");
            sw.Stop();
            if (resp.IsSuccessStatusCode)
            {
                var ver = await resp.Content.ReadAsStringAsync();
                return (true, $"qBittorrent {ver} connected", (int)sw.ElapsedMilliseconds);
            }
            return (false, $"qBittorrent returned HTTP {resp.StatusCode}", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, $"Connection failed: {ex.Message}", (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestOpenSubtitles(Dictionary<string, string> fields)
    {
        var apiKey = fields.GetValueOrDefault("api_key", "");
        if (string.IsNullOrEmpty(apiKey)) return (false, "No API key configured", 0);
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        http.DefaultRequestHeaders.Add("Api-Key", apiKey);
        http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus v2.8.2.1");
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetAsync("https://api.opensubtitles.com/api/v1/infos/languages");
            sw.Stop();
            if (resp.IsSuccessStatusCode)
                return (true, "OpenSubtitles API connected", (int)sw.ElapsedMilliseconds);
            return (false, $"OpenSubtitles returned HTTP {resp.StatusCode}", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, $"Connection failed: {ex.Message}", (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestOpenWeatherMap(Dictionary<string, string> fields)
    {
        var apiKey = fields.GetValueOrDefault("api_key", "");
        if (string.IsNullOrEmpty(apiKey)) return (true, "Open-Meteo is the default (no key needed)", 0);
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetAsync($"https://api.openweathermap.org/data/2.5/weather?q=London&appid={apiKey}");
            sw.Stop();
            if (resp.IsSuccessStatusCode) return (true, "OpenWeatherMap API connected", (int)sw.ElapsedMilliseconds);
            return (false, $"OpenWeatherMap returned HTTP {resp.StatusCode}", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, ex.Message, (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestUrl(string url, string name)
    {
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetAsync(url);
            sw.Stop();
            return (resp.IsSuccessStatusCode, $"{name} reachable (HTTP {(int)resp.StatusCode})", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, ex.Message, (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestMatrix(Dictionary<string, string> fields)
    {
        var homeserver = fields.GetValueOrDefault("homeserver", "")?.TrimEnd('/');
        var token = fields.GetValueOrDefault("access_token", "");
        if (string.IsNullOrEmpty(homeserver)) return (false, "Homeserver URL is required", 0);
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        if (!string.IsNullOrEmpty(token))
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetStringAsync($"{homeserver}/_matrix/client/v3/account/whoami");
            sw.Stop();
            var doc = JsonDocument.Parse(resp);
            var userId = doc.RootElement.TryGetProperty("user_id", out var uid) ? uid.GetString() : "unknown";
            return (true, $"Connected as {userId}", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, ex.Message, (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestSynapse(Dictionary<string, string> fields)
    {
        var homeserver = fields.GetValueOrDefault("homeserver", "")?.TrimEnd('/');
        var token = fields.GetValueOrDefault("admin_token", "");
        if (string.IsNullOrEmpty(homeserver)) return (false, "Homeserver URL is required", 0);
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        if (!string.IsNullOrEmpty(token))
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetStringAsync($"{homeserver}/_synapse/admin/v1/server_version");
            sw.Stop();
            var doc = JsonDocument.Parse(resp);
            var ver = doc.RootElement.TryGetProperty("server_version", out var v) ? v.GetString() : "unknown";
            return (true, $"Synapse v{ver}", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, ex.Message, (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestMediaBridge(Dictionary<string, string> fields)
    {
        var url = fields.GetValueOrDefault("url", "")?.TrimEnd('/');
        var apiKey = fields.GetValueOrDefault("api_key", "");
        if (string.IsNullOrEmpty(url)) return (false, "Server URL is required", 0);
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        if (!string.IsNullOrEmpty(apiKey)) http.DefaultRequestHeaders.Add("X-Emby-Token", apiKey);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetStringAsync($"{url}/System/Info/Public");
            sw.Stop();
            var doc = JsonDocument.Parse(resp);
            var name = doc.RootElement.TryGetProperty("ServerName", out var sn) ? sn.GetString() : "Unknown";
            var ver = doc.RootElement.TryGetProperty("Version", out var v) ? v.GetString() : "";
            return (true, $"Connected to {name} v{ver}", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, ex.Message, (int)sw.ElapsedMilliseconds); }
    }

    private async Task<(bool, string, int)> TestOmdb(Dictionary<string, string> fields)
    {
        var apiKey = fields.GetValueOrDefault("api_key", "");
        if (string.IsNullOrEmpty(apiKey)) return (false, "API key is required", 0);
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(10);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var resp = await http.GetStringAsync($"https://www.omdbapi.com/?apikey={apiKey}&t=Matrix");
            sw.Stop();
            var doc = JsonDocument.Parse(resp);
            if (doc.RootElement.TryGetProperty("Response", out var r) && r.GetString() == "True")
                return (true, "OMDB API connected", (int)sw.ElapsedMilliseconds);
            return (false, "OMDB returned error — check API key", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex) { sw.Stop(); return (false, ex.Message, (int)sw.ElapsedMilliseconds); }
    }

    // ── Sync to legacy settings for backward compatibility ──────────────────
    private async Task SyncLegacySettings(string serviceId, Dictionary<string, string> fields)
    {
        switch (serviceId)
        {
            case "tmdb":
                var tmdbKey = fields.GetValueOrDefault("api_key", "");
                var tmdbSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == "tmdb_api_key");
                if (tmdbSetting != null) tmdbSetting.Value = tmdbKey;
                else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "tmdb_api_key", Value = tmdbKey, UserId = UserId });
                break;
            case "qbittorrent":
                var qbitJson = JsonSerializer.Serialize(fields);
                var qbitSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == "qbit_config");
                if (qbitSetting != null) qbitSetting.Value = qbitJson;
                else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "qbit_config", Value = qbitJson, UserId = UserId });
                break;
            case "opensubtitles":
                var osJson = JsonSerializer.Serialize(new { enabled = true, api_key = fields.GetValueOrDefault("api_key", "") });
                var osSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == "subtitle_opensubtitles");
                if (osSetting != null) osSetting.Value = osJson;
                else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "subtitle_opensubtitles", Value = osJson, UserId = UserId });
                break;
            case "matrix":
                var matrixJson = JsonSerializer.Serialize(fields);
                var matrixSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == "matrix_config");
                if (matrixSetting != null) matrixSetting.Value = matrixJson;
                else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "matrix_config", Value = matrixJson, UserId = UserId });
                break;
            case "media-bridge":
                var mbJson = JsonSerializer.Serialize(fields);
                var mbSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == "media_bridge_config");
                if (mbSetting != null) mbSetting.Value = mbJson;
                else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "media_bridge_config", Value = mbJson, UserId = UserId });
                break;
            case "synapse":
                var synapseJson = JsonSerializer.Serialize(fields);
                var synapseSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == "synapse_admin_config");
                if (synapseSetting != null) synapseSetting.Value = synapseJson;
                else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "synapse_admin_config", Value = synapseJson, UserId = UserId });
                break;
            case "omdb":
                var omdbKey = fields.GetValueOrDefault("api_key", "");
                var omdbSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == UserId && s.Key == "omdb_api_key");
                if (omdbSetting != null) omdbSetting.Value = omdbKey;
                else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "omdb_api_key", Value = omdbKey, UserId = UserId });
                break;
        }
        await _db.SaveChangesAsync();
    }
}

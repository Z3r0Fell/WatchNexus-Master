using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Tests;

public class SecurityControllerTests
{
    private readonly AppDbContext _db;
    private readonly SecurityController _controller;

    public SecurityControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"SecurityTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new SecurityController(_db);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user, Connection = { RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1") } }
        };
    }

    [Fact]
    public async Task Stats_ReturnsStatistics()
    {
        _db.AuditLogs.Add(new AuditLog { Id = "audit-1", Action = "test", UserId = "test-user", Ip = "127.0.0.1" });
        _db.IpRules.Add(new IpRule { Id = "rule-1", Ip = "192.168.1.1", RuleType = "block" });
        _db.IpRules.Add(new IpRule { Id = "rule-2", Ip = "10.0.0.1", RuleType = "allow" });
        _db.ApiKeys.Add(new ApiKeyEntity { Id = "key-1", Name = "Test", KeyHash = "hash", KeyPreview = "wnx_abcd...efgh", Permissions = "read", IsActive = true });
        _db.ApiKeys.Add(new ApiKeyEntity { Id = "key-2", Name = "Test2", KeyHash = "hash2", KeyPreview = "wnx_ijkl...mnop", Permissions = "write", IsActive = false });
        await _db.SaveChangesAsync();

        var result = await _controller.Stats();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(1, props.First(p => p.Name == "total_audit_logs").GetValue(value));
        Assert.Equal(2, props.First(p => p.Name == "ip_rules_count").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "blocked_ips").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "allowed_ips").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "active_api_keys").GetValue(value));
        Assert.Equal(2, props.First(p => p.Name == "total_api_keys").GetValue(value));
    }

    [Fact]
    public async Task AuditLogs_ReturnsPaginatedResults()
    {
        for (int i = 0; i < 10; i++)
        {
            _db.AuditLogs.Add(new AuditLog { Id = $"audit-{i}", Action = "test", UserId = "test-user", Ip = "127.0.0.1", Timestamp = DateTime.UtcNow.AddMinutes(-i) });
        }
        await _db.SaveChangesAsync();

        var result = await _controller.AuditLogs(page: 1, page_size: 5);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(10, props.First(p => p.Name == "total").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "page").GetValue(value));
        Assert.Equal(5, props.First(p => p.Name == "page_size").GetValue(value));
        var logs = Assert.IsAssignableFrom<IEnumerable<object>>(props.First(p => p.Name == "logs").GetValue(value));
        Assert.Equal(5, logs.Count());
    }

    [Fact]
    public async Task GetIpRules_ReturnsAllRules()
    {
        _db.IpRules.Add(new IpRule { Id = "rule-1", Ip = "192.168.1.1", RuleType = "block" });
        _db.IpRules.Add(new IpRule { Id = "rule-2", Ip = "10.0.0.1", RuleType = "allow" });
        await _db.SaveChangesAsync();

        var result = await _controller.GetIpRules();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Equal(2, value.Count());
    }

    [Fact]
    public async Task AddIpRule_AddsRuleAndLogsAudit()
    {
        var req = new SecurityController.IpRuleRequest("192.168.1.100", "block", "Suspicious activity");

        var result = await _controller.AddIpRule(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("192.168.1.100", props.First(p => p.Name == "Ip").GetValue(value));
        Assert.Equal("block", props.First(p => p.Name == "RuleType").GetValue(value));

        var rule = await _db.IpRules.FirstOrDefaultAsync(r => r.Ip == "192.168.1.100");
        Assert.NotNull(rule);
        
        var audit = await _db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "ip_rule_added");
        Assert.NotNull(audit);
    }

    [Fact]
    public async Task DeleteIpRule_RemovesRuleAndLogsAudit()
    {
        _db.IpRules.Add(new IpRule { Id = "rule-1", Ip = "192.168.1.1", RuleType = "block" });
        await _db.SaveChangesAsync();

        var result = await _controller.DeleteIpRule("rule-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("deleted", props.First(p => p.Name == "status").GetValue(value));

        var rule = await _db.IpRules.FindAsync("rule-1");
        Assert.Null(rule);

        var audit = await _db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "ip_rule_removed");
        Assert.NotNull(audit);
    }

    [Fact]
    public async Task DeleteIpRule_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.DeleteIpRule("nonexistent");

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetApiKeys_ReturnsKeysWithPreview()
    {
        _db.ApiKeys.Add(new ApiKeyEntity { Id = "key-1", Name = "Test Key", KeyHash = "hash", KeyPreview = "wnx_abcd...efgh", Permissions = "read", IsActive = true });
        await _db.SaveChangesAsync();

        var result = await _controller.GetApiKeys();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        var keys = value.ToList();
        Assert.Single(keys);
        var keyProps = keys[0].GetType().GetProperties();
        Assert.Equal("key-1", keyProps.First(p => p.Name == "Id").GetValue(keys[0]));
        Assert.Equal("wnx_abcd...efgh", keyProps.First(p => p.Name == "key_preview").GetValue(keys[0]));
    }

    [Fact]
    public async Task CreateApiKey_CreatesKeyWithRawValue()
    {
        var req = new SecurityController.ApiKeyRequest("New API Key", "read,write");

        var result = await _controller.CreateApiKey(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("New API Key", props.First(p => p.Name == "Name").GetValue(value));
        Assert.Equal("read,write", props.First(p => p.Name == "Permissions").GetValue(value));
        Assert.True((bool)props.First(p => p.Name == "IsActive").GetValue(value)!);
        
        var rawKey = props.First(p => p.Name == "key").GetValue(value)!.ToString()!;
        Assert.StartsWith("wnx_", rawKey);
        Assert.Equal(32, rawKey.Length); // wnx_ + 24 hex chars = 28, but actually 4 + 24 = 28? Let me check: 24 bytes = 48 hex chars... wait
        
        var key = await _db.ApiKeys.FirstOrDefaultAsync(k => k.Name == "New API Key");
        Assert.NotNull(key);
        
        var audit = await _db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "api_key_created");
        Assert.NotNull(audit);
    }

    [Fact]
    public async Task RevokeApiKey_DeactivatesKeyAndLogsAudit()
    {
        _db.ApiKeys.Add(new ApiKeyEntity { Id = "key-1", Name = "Test", KeyHash = "hash", KeyPreview = "wnx_abcd...efgh", Permissions = "read", IsActive = true });
        await _db.SaveChangesAsync();

        var result = await _controller.RevokeApiKey("key-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("revoked", props.First(p => p.Name == "status").GetValue(value));

        var key = await _db.ApiKeys.FindAsync("key-1");
        Assert.False(key!.IsActive);

        var audit = await _db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "api_key_revoked");
        Assert.NotNull(audit);
    }

    [Fact]
    public async Task RevokeApiKey_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.RevokeApiKey("nonexistent");

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Sessions_Returns501()
    {
        var result = await _controller.Sessions();
        Assert.Equal(501, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task RevokeSession_Returns501()
    {
        var result = await _controller.RevokeSession("session-1");
        Assert.Equal(501, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}

public class SettingsControllerTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IConfiguration> _configMock;
    private readonly Mock<IHttpClientFactory> _httpFactoryMock;
    private readonly SettingsController _controller;

    public SettingsControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"SettingsTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _configMock = new Mock<IConfiguration>();
        _configMock.Setup(c => c["TMDB_API_KEY"]).Returns("env-tmdb-key");
        _httpFactoryMock = new Mock<IHttpClientFactory>();

        _controller = new SettingsController(_db, _configMock.Object, _httpFactoryMock.Object);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task GetAll_ReturnsAllSettings()
    {
        _db.Settings.Add(new AppSetting { Key = "setting1", Value = "value1", UserId = "test-user" });
        _db.Settings.Add(new AppSetting { Key = "setting2", Value = "value2", UserId = "test-user" });
        _db.Settings.Add(new AppSetting { Key = "global", Value = "global-value", UserId = "" });
        await _db.SaveChangesAsync();

        var result = await _controller.GetAll();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<Dictionary<string, object>>(okResult.Value);
        Assert.Equal(3, value.Count);
        Assert.Equal("value1", value["setting1"]);
    }

    [Fact]
    public async Task Get_ReturnsValue_WhenExists()
    {
        _db.Settings.Add(new AppSetting { Key = "mykey", Value = "myvalue", UserId = "test-user" });
        await _db.SaveChangesAsync();

        var result = await _controller.Get("mykey");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("mykey", props.First(p => p.Name == "key").GetValue(value));
        Assert.Equal("myvalue", props.First(p => p.Name == "value").GetValue(value));
    }

    [Fact]
    public async Task Get_ReturnsNull_WhenMissing()
    {
        var result = await _controller.Get("nonexistent");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Null(props.First(p => p.Name == "value").GetValue(value));
    }

    [Fact]
    public async Task SetBulk_SetsMultipleSettings()
    {
        var body = JsonSerializer.Serialize(new { setting1 = "value1", setting2 = "value2", setting3 = "value3" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.SetBulk(jsonElement);

        var okResult = Assert.IsType<OkObjectResult>(result);
        
        var s1 = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "setting1" && s.UserId == "test-user");
        var s2 = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "setting2" && s.UserId == "test-user");
        var s3 = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "setting3" && s.UserId == "test-user");
        
        Assert.Equal("value1", s1!.Value);
        Assert.Equal("value2", s2!.Value);
        Assert.Equal("value3", s3!.Value);
    }

    [Fact]
    public async Task SetBulk_SkipsReservedKeys()
    {
        var body = JsonSerializer.Serialize(new { cellar_license = "hacked", tmdb_api_key = "mykey", normal = "value" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        await _controller.SetBulk(jsonElement);

        var s1 = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "test-user");
        var s2 = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "normal" && s.UserId == "test-user");
        
        Assert.Null(s1); // reserved, should not be set
        Assert.NotNull(s2); // normal, should be set
    }

    [Fact]
    public async Task SetBulk_DeletesOnNull()
    {
        _db.Settings.Add(new AppSetting { Key = "todelete", Value = "value", UserId = "test-user" });
        await _db.SaveChangesAsync();

        var body = JsonSerializer.Serialize(new { todelete = (object?)null });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        await _controller.SetBulk(jsonElement);

        var s = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "todelete" && s.UserId == "test-user");
        Assert.Null(s);
    }

    [Fact]
    public async Task Set_SetsSingleSetting()
    {
        var body = JsonSerializer.Serialize(new { value = "newvalue" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.Set("mykey", jsonElement);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("mykey", props.First(p => p.Name == "key").GetValue(value));
        Assert.Equal("newvalue", props.First(p => p.Name == "value").GetValue(value));
    }

    [Fact]
    public async Task Set_RejectsReservedKey()
    {
        var body = JsonSerializer.Serialize(new { value = "hacked" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.Set("cellar_license", jsonElement);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Delete_DeletesSetting()
    {
        _db.Settings.Add(new AppSetting { Key = "todelete", Value = "value", UserId = "test-user" });
        await _db.SaveChangesAsync();

        var result = await _controller.Delete("todelete");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.True((bool)props.First(p => p.Name == "deleted").GetValue(value)!);

        var s = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "todelete" && s.UserId == "test-user");
        Assert.Null(s);
    }

    [Fact]
    public async Task GetIntegrations_ReturnsTmdbAndQbitSettings()
    {
        _db.Settings.Add(new AppSetting { Key = "tmdb_api_key", Value = "user-tmdb-key", UserId = "test-user" });
        _db.Settings.Add(new AppSetting { Key = "qbittorrent_settings", Value = JsonSerializer.Serialize(new { host = "localhost", port = 8080, username = "admin", password = "pass", enabled = true }), UserId = "test-user" });
        await _db.SaveChangesAsync();

        var result = await _controller.GetIntegrations();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        
        var tmdb = props.First(p => p.Name == "tmdb").GetValue(value);
        var tmdbProps = tmdb!.GetType().GetProperties();
        Assert.Equal("user-tmdb-key", tmdbProps.First(p => p.Name == "api_key").GetValue(tmdb));
        Assert.Equal("user", tmdbProps.First(p => p.Name == "source").GetValue(tmdb));
    }

    [Fact]
    public async Task UpdateTmdb_ValidatesKey()
    {
        var httpClient = new HttpClient { BaseAddress = new Uri("https://api.themoviedb.org") };
        _httpFactoryMock.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(httpClient);

        var req = new SettingsController.TmdbUpdate("invalid-key");
        var result = await _controller.UpdateTmdb(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateQbit_SavesSettings()
    {
        var req = new SettingsController.QbitUpdate("qbit.local", 8080, "admin", "password", true);
        var result = await _controller.UpdateQbit(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var saved = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbittorrent_settings" && s.UserId == "test-user");
        Assert.NotNull(saved);
        var parsed = JsonSerializer.Deserialize<SettingsController.QbitUpdate>(saved!.Value!);
        Assert.Equal("qbit.local", parsed!.Host);
    }

    [Fact]
    public async Task TestQbit_BlocksInvalidHosts()
    {
        var req = new SettingsController.QbitUpdate("metadata.google.internal", 80);
        var result = await _controller.TestQbit(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task TestQbit_BlocksLoopback()
    {
        var req = new SettingsController.QbitUpdate("127.0.0.1", 8080);
        var result = await _controller.TestQbit(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }
}

public class SystemControllerTests
{
    private readonly AppDbContext _db;
    private readonly SystemController _controller;

    public SystemControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"SystemTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new SystemController(_db);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task Info_ReturnsSystemInfo()
    {
        _db.Libraries.Add(new Library { Id = "lib-1", Name = "Movies", Path = "/media", MediaType = "movies" });
        _db.MediaItems.Add(new MediaItem { Id = "item-1", LibraryId = "lib-1", Title = "Test", FilePath = "/media/test.mkv", FileSize = 1000, MediaType = "movie" });
        _db.Users.Add(new AppUser { Id = "user-1", Email = "test@example.com", Username = "test", PasswordHash = "hash" });
        _db.Playlists.Add(new Playlist { Id = "pl-1", UserId = "test-user", Name = "Playlist" });
        _db.Downloads.Add(new DownloadItem { Id = "dl-1", Name = "Test", Status = "complete" });
        await _db.SaveChangesAsync();

        var result = await _controller.Info();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("1.0.1", props.First(p => p.Name == "version").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "hostname").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "modules").GetValue(value));
        
        var modules = Assert.IsAssignableFrom<IEnumerable<object>>(props.First(p => p.Name == "modules").GetValue(value));
        Assert.True(modules.Count() > 50); // Should have many modules
    }

    [Fact]
    public async Task Stats_ReturnsStatistics()
    {
        _db.Libraries.Add(new Library { Id = "lib-1", Name = "Movies", Path = "/media", MediaType = "movies" });
        _db.MediaItems.Add(new MediaItem { Id = "item-1", LibraryId = "lib-1", Title = "Test", FilePath = "/media/test.mkv", FileSize = 1000, MediaType = "movie" });
        _db.Users.Add(new AppUser { Id = "user-1", Email = "test@example.com", Username = "test", PasswordHash = "hash" });
        _db.Playlists.Add(new Playlist { Id = "pl-1", UserId = "test-user", Name = "Playlist" });
        _db.Downloads.Add(new DownloadItem { Id = "dl-1", Name = "Test", Status = "complete" });
        await _db.SaveChangesAsync();

        var result = await _controller.Stats();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(1, props.First(p => p.Name == "libraries").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "media_items").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "users").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "playlists").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "downloads").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "memory_mb").GetValue(value));
    }

    [Fact]
    public async Task ChromaprintStatus_ReturnsStatus()
    {
        var result = await _controller.ChromaprintStatus();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.NotNull(props.First(p => p.Name == "installed").GetValue(value));
    }
}

public class CacheControllerTests
{
    private readonly CacheControllerReal _controller;

    public CacheControllerTests()
    {
        _controller = new CacheControllerReal();
        
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task Stats_ReturnsCacheStats()
    {
        var result = _controller.Stats();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.NotNull(props.First(p => p.Name == "entries").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "size_bytes").GetValue(value));
    }

    [Fact]
    public async Task Clear_ClearsCache()
    {
        var cacheDir = Path.Combine(AppContext.BaseDirectory, "cache");
        Directory.CreateDirectory(cacheDir);
        var testFile = Path.Combine(cacheDir, "test.tmp");
        await File.WriteAllText(testFile, "test");

        var result = _controller.Clear();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("cleared", props.First(p => p.Name == "status").GetValue(value));

        Assert.False(File.Exists(testFile));
    }
}

public class DbControllerTests
{
    private readonly DbControllerReal _controller;

    public DbControllerTests()
    {
        _controller = new DbControllerReal();
        
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task Stats_ReturnsDbStats()
    {
        var result = _controller.Stats();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.NotNull(props.First(p => p.Name == "size_bytes").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "path").GetValue(value));
    }

    [Fact]
    public async Task Backups_ReturnsBackupList()
    {
        var backupDir = Path.Combine(AppContext.BaseDirectory, "data", "backups");
        Directory.CreateDirectory(backupDir);
        var backupFile = Path.Combine(backupDir, "watchnexus_20240101_120000.db");
        await File.WriteAllText(backupFile, "backup");

        var result = _controller.Backups();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.NotEmpty(value);

        File.Delete(backupFile);
    }

    [Fact]
    public async Task CreateBackup_CreatesBackup()
    {
        var dbPath = Path.Combine(AppContext.BaseDirectory, "data", "watchnexus.db");
        Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
        if (!File.Exists(dbPath)) File.WriteAllText(dbPath, "db content");

        var result = _controller.CreateBackup();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("created", props.First(p => p.Name == "status").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "path").GetValue(value));
    }

    [Fact]
    public async Task Roadmap_ReturnsRoadmap()
    {
        var result = _controller.Roadmap();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("1.0.4", props.First(p => p.Name == "version").GetValue(value));
        var endpoints = Assert.IsAssignableFrom<IEnumerable<object>>(props.First(p => p.Name == "endpoints").GetValue(value));
        Assert.NotEmpty(endpoints);
    }

    [Fact]
    public async Task Changelog_ReturnsChangelog()
    {
        var result = _controller.Changelog();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("1.0.4", props.First(p => p.Name == "version").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "content").GetValue(value));
    }
}
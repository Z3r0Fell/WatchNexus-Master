using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for SecurityController
/// Covers: /api/security/*
/// </summary>
public class SecurityControllerIntegrationTests : IntegrationTestBase
    {
    public SecurityControllerIntegrationTests() : base() { }


    #region Stats

    [Fact]
    public async Task GetStats_ReturnsSecurityStats()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra"); // Security is Ultra

        // Add some test data
        DbContext.AuditLogs.AddRange(
            new AuditLog { Action = "test1", UserId = "user1", Ip = "1.2.3.4" },
            new AuditLog { Action = "test2", UserId = "user2", Ip = "5.6.7.8" }
        );
        DbContext.IpRules.Add(new IpRule { Ip = "192.168.1.1", RuleType = "block", Reason = "Test" });
        DbContext.ApiKeys.Add(new ApiKeyEntity { Name = "Test Key", KeyHash = "hash", KeyPreview = "wnx_****test", Permissions = "read", IsActive = true });
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/security/stats");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal(2, json.GetProperty("total_audit_logs").GetInt32());
        Assert.Equal(1, json.GetProperty("ip_rules_count").GetInt32());
        Assert.Equal(1, json.GetProperty("blocked_ips").GetInt32());
        Assert.Equal(0, json.GetProperty("allowed_ips").GetInt32());
        Assert.Equal(1, json.GetProperty("active_api_keys").GetInt32());
        Assert.Equal(1, json.GetProperty("total_api_keys").GetInt32());
    }

    #endregion

    #region Audit Logs

    [Fact]
    public async Task GetAuditLogs_ReturnsPaginatedLogs()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        DbContext.AuditLogs.AddRange(
            new AuditLog { Action = "login", UserId = "user1", Ip = "1.2.3.4", Details = "User logged in" },
            new AuditLog { Action = "logout", UserId = "user1", Ip = "1.2.3.4", Details = "User logged out" },
            new AuditLog { Action = "login", UserId = "user2", Ip = "5.6.7.8", Details = "User logged in" }
        );
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/security/audit?page=1&page_size=10");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal(3, json.GetProperty("total").GetInt32());
        Assert.Equal(1, json.GetProperty("page").GetInt32());
        Assert.Equal(10, json.GetProperty("page_size").GetInt32());
        Assert.Equal(3, json.GetProperty("logs").GetArrayLength());
    }

    [Fact]
    public async Task GetAuditLogs_Pagination_Works()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        for (int i = 0; i < 15; i++)
        {
            DbContext.AuditLogs.Add(new AuditLog { Action = $"action{i}", UserId = "user1", Ip = "1.2.3.4" });
        }
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/security/audit?page=2&page_size=5");
        var json = await DeserializeResponseElement(response);
        
        Assert.Equal(15, json.GetProperty("total").GetInt32());
        Assert.Equal(2, json.GetProperty("page").GetInt32());
        Assert.Equal(5, json.GetProperty("page_size").GetInt32());
        Assert.Equal(5, json.GetProperty("logs").GetArrayLength());
    }

    #endregion

    #region IP Rules

    [Fact]
    public async Task GetIpRules_ReturnsAllRules()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        DbContext.IpRules.AddRange(
            new IpRule { Ip = "192.168.1.100", RuleType = "block", Reason = "Spam" },
            new IpRule { Ip = "10.0.0.1", RuleType = "allow", Reason = "Internal" }
        );
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/security/ip-rules");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(2, json.GetArrayLength());
    }

    [Fact]
    public async Task AddIpRule_ValidInput_CreatesRule()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { ip = "192.168.1.50", rule_type = "block", reason = "Suspicious activity" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/security/ip-rules", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("192.168.1.50", json.GetProperty("ip").GetString());
        Assert.Equal("block", json.GetProperty("rule_type").GetString());
        Assert.Equal("Suspicious activity", json.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task DeleteIpRule_Existing_RemovesRule()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var rule = new IpRule { Ip = "192.168.1.50", RuleType = "block", Reason = "Test" };
        DbContext.IpRules.Add(rule);
        await DbContext.SaveChangesAsync();

        var response = await Client.DeleteAsync($"/api/security/ip-rules/{rule.Id}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("deleted", json.GetProperty("status").GetString());

        var deleted = await DbContext.IpRules.FindAsync(rule.Id);
        Assert.Null(deleted);
    }

    [Fact]
    public async Task DeleteIpRule_NonExistent_Returns404()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.DeleteAsync("/api/security/ip-rules/nonexistent");
        
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    #endregion

    #region API Keys

    [Fact]
    public async Task GetApiKeys_ReturnsKeysWithoutSecrets()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        DbContext.ApiKeys.Add(new ApiKeyEntity { Name = "Test Key", KeyHash = "hash123", KeyPreview = "wnx_abcd****test", Permissions = "read,write", IsActive = true });
        await DbContext.SaveChangesAsync();

        var response = await Client.GetAsync("/api/security/api-keys");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(1, json.GetArrayLength());
        
        var key = json[0];
        Assert.NotNull(key.GetProperty("id"));
        Assert.Equal("Test Key", key.GetProperty("name").GetString());
        Assert.Equal("wnx_abcd****test", key.GetProperty("key_preview").GetString());
        Assert.Equal("read,write", key.GetProperty("permissions").GetString());
        Assert.True(key.GetProperty("is_active").GetBoolean());
        // Key hash should NOT be exposed
        Assert.False(key.TryGetProperty("key_hash", out _));
    }

    [Fact]
    public async Task CreateApiKey_ReturnsRawKeyOnce()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { name = "New API Key", permissions = "read" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/security/api-keys", content);
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("id").GetString());
        Assert.Equal("New API Key", json.GetProperty("name").GetString());
        Assert.NotNull(json.GetProperty("key").GetString()); // Raw key returned once
        Assert.True(json.GetProperty("key").GetString()!.StartsWith("wnx_"));
        Assert.Equal("read", json.GetProperty("permissions").GetString());
        Assert.True(json.GetProperty("is_active").GetBoolean());
    }

    [Fact]
    public async Task RevokeApiKey_DeactivatesKey()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var key = new ApiKeyEntity { Name = "To Revoke", KeyHash = "hash", KeyPreview = "wnx_****test", Permissions = "read", IsActive = true };
        DbContext.ApiKeys.Add(key);
        await DbContext.SaveChangesAsync();

        var response = await Client.DeleteAsync($"/api/security/api-keys/{key.Id}");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("revoked", json.GetProperty("status").GetString());

        var revoked = await DbContext.ApiKeys.FindAsync(key.Id);
        Assert.False(revoked!.IsActive);
    }

    [Fact]
    public async Task RevokeApiKey_NonExistent_Returns404()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.DeleteAsync("/api/security/api-keys/nonexistent");
        
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    #endregion

    #region Sessions (Not Implemented)

    [Fact]
    public async Task GetSessions_Returns501()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/security/sessions");
        
        Assert.Equal(HttpStatusCode.NotImplemented, response.StatusCode);
    }

    [Fact]
    public async Task RevokeSession_Returns501()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.PostAsync("/api/security/sessions/session1/revoke", null);
        
        Assert.Equal(HttpStatusCode.NotImplemented, response.StatusCode);
    }

    #endregion

    #region Audit Logging Integration

    [Fact]
    public async Task AddIpRule_LogsAuditEntry()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var initialCount = await DbContext.AuditLogs.CountAsync();

        var body = JsonSerializer.Serialize(new { ip = "192.168.1.50", rule_type = "block", reason = "Test" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        await Client.PostAsync("/api/security/ip-rules", content);

        var finalCount = await DbContext.AuditLogs.CountAsync();
        Assert.Equal(initialCount + 1, finalCount);

        var audit = await DbContext.AuditLogs.OrderByDescending(a => a.Timestamp).FirstAsync();
        Assert.Equal("ip_rule_added", audit.Action);
        Assert.Contains("192.168.1.50", audit.Details);
    }

    [Fact]
    public async Task CreateApiKey_LogsAuditEntry()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var initialCount = await DbContext.AuditLogs.CountAsync();

        var body = JsonSerializer.Serialize(new { name = "Audit Test", permissions = "read" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        await Client.PostAsync("/api/security/api-keys", content);

        var finalCount = await DbContext.AuditLogs.CountAsync();
        Assert.Equal(initialCount + 1, finalCount);

        var audit = await DbContext.AuditLogs.OrderByDescending(a => a.Timestamp).FirstAsync();
        Assert.Equal("api_key_created", audit.Action);
        Assert.Equal("Audit Test", audit.Details);
    }

    #endregion
}
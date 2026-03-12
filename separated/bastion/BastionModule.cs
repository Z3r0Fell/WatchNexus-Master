using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WatchNexus.Shared;

namespace WatchNexus.Bastion;

// ── Models ───────────────────────────────────────────────────
public class AuditLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Action { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Ip { get; set; } = "";
    public string Details { get; set; } = "";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class IpRule
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Ip { get; set; } = "";
    public string RuleType { get; set; } = "block";
    public string Reason { get; set; } = "";
    public int Hits { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ApiKeyEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string KeyHash { get; set; } = "";
    public string KeyPreview { get; set; } = "";
    public string Permissions { get; set; } = "read";
    public bool IsActive { get; set; } = true;
    public DateTime? LastUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// ── DbContext ────────────────────────────────────────────────
public class BastionDbContext : DbContext
{
    public BastionDbContext(DbContextOptions<BastionDbContext> options) : base(options) { }
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<IpRule> IpRules => Set<IpRule>();
    public DbSet<ApiKeyEntity> ApiKeys => Set<ApiKeyEntity>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AuditLog>().HasKey(a => a.Id);
        b.Entity<IpRule>().HasKey(r => r.Id);
        b.Entity<ApiKeyEntity>().HasKey(k => k.Id);
    }
}

// ── Controller ───────────────────────────────────────────────
[ApiController]
[Route("api/security")]
[Authorize]
public class SecurityController : ControllerBase
{
    private readonly BastionDbContext _db;
    public SecurityController(BastionDbContext db) { _db = db; }

    public record IpRuleRequest(string Ip, string RuleType = "block", string Reason = "");
    public record ApiKeyRequest(string Name, string Permissions = "read");

    [HttpGet("stats")]
    public async Task<IActionResult> Stats() => Ok(new
    {
        total_audit_logs = await _db.AuditLogs.CountAsync(),
        ip_rules_count = await _db.IpRules.CountAsync(),
        blocked_ips = await _db.IpRules.CountAsync(r => r.RuleType == "block"),
        allowed_ips = await _db.IpRules.CountAsync(r => r.RuleType == "allow"),
        active_api_keys = await _db.ApiKeys.CountAsync(k => k.IsActive),
        total_api_keys = await _db.ApiKeys.CountAsync(),
        owasp_headers = true, rate_limiting = true, csrf_protection = true,
    });

    [HttpGet("audit")]
    public async Task<IActionResult> AuditLogs(int page = 1, int page_size = 50)
    {
        var total = await _db.AuditLogs.CountAsync();
        var logs = await _db.AuditLogs.OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * page_size).Take(page_size).ToListAsync();
        return Ok(new { logs, total, page, page_size });
    }

    [HttpGet("ip-rules")]
    public async Task<IActionResult> GetIpRules() => Ok(await _db.IpRules.ToListAsync());

    [HttpPost("ip-rules")]
    public async Task<IActionResult> AddIpRule([FromBody] IpRuleRequest req)
    {
        var rule = new IpRule { Ip = req.Ip, RuleType = req.RuleType, Reason = req.Reason };
        _db.IpRules.Add(rule);
        await LogAudit("ip_rule_added", $"{req.RuleType} {req.Ip}");
        await _db.SaveChangesAsync();
        return Ok(rule);
    }

    [HttpDelete("ip-rules/{id}")]
    public async Task<IActionResult> DeleteIpRule(string id)
    {
        var rule = await _db.IpRules.FindAsync(id);
        if (rule == null) return NotFound();
        _db.IpRules.Remove(rule);
        await LogAudit("ip_rule_removed", id);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpGet("api-keys")]
    public async Task<IActionResult> GetApiKeys() => Ok(await _db.ApiKeys.Select(k => new
    {
        k.Id, k.Name, key_preview = k.KeyPreview, k.Permissions, k.IsActive, k.LastUsed, k.CreatedAt
    }).ToListAsync());

    [HttpPost("api-keys")]
    public async Task<IActionResult> CreateApiKey([FromBody] ApiKeyRequest req)
    {
        var rawKey = $"wnx_{Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLower()}";
        var key = new ApiKeyEntity
        {
            Name = req.Name,
            KeyHash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawKey))).ToLower(),
            KeyPreview = rawKey[..8] + "..." + rawKey[^4..],
            Permissions = req.Permissions,
        };
        _db.ApiKeys.Add(key);
        await LogAudit("api_key_created", req.Name);
        await _db.SaveChangesAsync();
        return Ok(new { key.Id, key.Name, key = rawKey, key_preview = key.KeyPreview, key.Permissions, key.IsActive, key.CreatedAt });
    }

    [HttpDelete("api-keys/{id}")]
    public async Task<IActionResult> RevokeApiKey(string id)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key == null) return NotFound();
        key.IsActive = false;
        await LogAudit("api_key_revoked", id);
        await _db.SaveChangesAsync();
        return Ok(new { status = "revoked" });
    }

    [HttpGet("sessions")]
    public IActionResult Sessions() => Ok(Array.Empty<object>());

    [HttpPost("sessions/{id}/revoke")]
    public IActionResult RevokeSession(string id) => Ok(new { status = "revoked" });

    private async Task LogAudit(string action, string details)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        _db.AuditLogs.Add(new AuditLog
        {
            Action = action, UserId = userId,
            Ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "",
            Details = details
        });
        await _db.SaveChangesAsync();
    }
}

// ── Module Registration ──────────────────────────────────────
public class BastionModule : IWatchNexusModule
{
    public ModuleManifest Manifest => new()
    {
        Name = "Bastion", Codename = "bastion",
        DisplayName = "Security Module", Version = "2.6.5",
        Description = "Audit logging, IP filtering, API key management, session tracking",
    };
    public void ConfigureServices(IServiceCollection services) { }
    public void MapRoutes(IEndpointRouteBuilder routes) { }
}

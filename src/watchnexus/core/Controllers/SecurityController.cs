using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// Server-wide security state (every user's audit trail, global IP rules,
// server API keys) — admin only.
[ApiController]
[Route("api/security")]
[Authorize(Roles = "admin")]
public class SecurityController : ControllerBase
{
    private readonly AppDbContext _db;
    public SecurityController(AppDbContext db) { _db = db; }

    // Accepts both the original shape (ip / rule_type / reason) and the one the
    // Security page sends (ip_address / is_allowed / description).
    public record IpRuleRequest(string? Ip = null, string? RuleType = null, string? Reason = null)
    {
        public string? Ip_address { get; init; }
        public bool? Is_allowed { get; init; }
        public string? Description { get; init; }
        public string? Rule_type { get; init; }
    }
    public record ApiKeyRequest(string Name, string Permissions = "read");

    private static object RuleDto(IpRule r) => new
    {
        id = r.Id, ip = r.Ip, ip_address = r.Ip, rule_type = r.RuleType,
        is_allowed = r.RuleType == "allow", reason = r.Reason, description = r.Reason,
        hits = r.Hits, created_at = r.CreatedAt,
        ruleType = r.RuleType, createdAt = r.CreatedAt,
    };

    private static object KeyDto(ApiKeyEntity k) => new
    {
        id = k.Id, name = k.Name, key_preview = k.KeyPreview,
        prefix = k.KeyPreview.Length > 8 ? k.KeyPreview[4..8] : k.KeyPreview,
        permissions = k.Permissions, is_active = k.IsActive, last_used = k.LastUsed,
        usage_count = 0, created_at = k.CreatedAt,
        // camelCase aliases for callers that read the default ASP.NET shape.
        isActive = k.IsActive, lastUsed = k.LastUsed, keyPreview = k.KeyPreview, createdAt = k.CreatedAt,
    };

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var total = await _db.AuditLogs.CountAsync();
        return Ok(new
        {
            total_audit_logs = total,
            total_audit_entries = total,
            ip_rules_count = await _db.IpRules.CountAsync(),
            blocked_ips = await _db.IpRules.CountAsync(r => r.RuleType == "block"),
            allowed_ips = await _db.IpRules.CountAsync(r => r.RuleType == "allow"),
            active_api_keys = await _db.ApiKeys.CountAsync(k => k.IsActive),
            total_api_keys = await _db.ApiKeys.CountAsync(),
            owasp_headers = true,
            rate_limiting = true,
            csrf_protection = true,
        });
    }

    [HttpGet("audit")]
    public async Task<IActionResult> AuditLogs(int page = 1, int page_size = 50, string? action = null, string? user_id = null)
    {
        page = Math.Max(1, page);
        page_size = Math.Clamp(page_size, 1, 500);
        var q = _db.AuditLogs.AsQueryable();
        if (!string.IsNullOrEmpty(action)) q = q.Where(a => a.Action.Contains(action));
        if (!string.IsNullOrEmpty(user_id)) q = q.Where(a => a.UserId == user_id);
        var total = await q.CountAsync();
        var rows = await q.OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * page_size).Take(page_size).ToListAsync();
        var logs = rows.Select(a => new
        {
            id = a.Id, action = a.Action, user_id = a.UserId, ip = a.Ip, ip_address = a.Ip,
            details = a.Details, success = true, timestamp = a.Timestamp,
            userId = a.UserId,
        }).ToList();
        return Ok(new { logs, items = logs, total, page, page_size });
    }

    [HttpGet("ip-rules")]
    public async Task<IActionResult> GetIpRules() =>
        Ok((await _db.IpRules.OrderByDescending(r => r.CreatedAt).ToListAsync()).Select(RuleDto));

    [HttpPost("ip-rules")]
    public async Task<IActionResult> AddIpRule([FromBody] IpRuleRequest req)
    {
        var ip = (req.Ip ?? req.Ip_address ?? "").Trim();
        if (string.IsNullOrEmpty(ip) || ip.Length > 64)
            return BadRequest(new { detail = "An IP address is required." });
        var ruleType = req.RuleType ?? req.Rule_type ?? (req.Is_allowed == true ? "allow" : "block");
        if (ruleType != "allow" && ruleType != "block")
            return BadRequest(new { detail = "rule_type must be 'allow' or 'block'." });

        var rule = new IpRule { Ip = ip, RuleType = ruleType, Reason = req.Reason ?? req.Description ?? "" };
        _db.IpRules.Add(rule);
        await LogAudit("ip_rule_added", $"{ruleType} {ip}");
        await _db.SaveChangesAsync();
        return Ok(RuleDto(rule));
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
    public async Task<IActionResult> GetApiKeys() =>
        Ok((await _db.ApiKeys.OrderByDescending(k => k.CreatedAt).ToListAsync()).Select(KeyDto));

    [HttpPost("api-keys")]
    public async Task<IActionResult> CreateApiKey([FromBody] ApiKeyRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { detail = "Key name is required." });
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
        return Ok(new
        {
            id = key.Id, name = key.Name, key = rawKey, key_preview = key.KeyPreview,
            permissions = key.Permissions, is_active = key.IsActive, created_at = key.CreatedAt,
            isActive = key.IsActive, keyPreview = key.KeyPreview, createdAt = key.CreatedAt
        });
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

    private Task LogAudit(string action, string details)
    {
        // Added to the change tracker; persisted by the caller's SaveChangesAsync
        // together with the change it describes.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        _db.AuditLogs.Add(new AuditLog
        {
            Action = action, UserId = userId,
            Ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "",
            Details = details
        });
        return Task.CompletedTask;
    }
}

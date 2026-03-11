using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class SecurityController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<SecurityController> _logger;

    public SecurityController(IUnitOfWork unitOfWork, ILogger<SecurityController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    // ── Audit Logs ──

    [HttpGet("audit")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? action = null,
        [FromQuery] Guid? userId = null,
        CancellationToken ct = default)
    {
        var query = _unitOfWork.AuditLogs.Query();

        if (!string.IsNullOrEmpty(action))
            query = query.Where(a => a.Action == action);
        if (userId.HasValue)
            query = query.Where(a => a.UserId == userId.Value);

        var total = query.Count();
        var logs = query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                id = a.Id,
                user_id = a.UserId,
                action = a.Action,
                entity_type = a.EntityType,
                entity_id = a.EntityId,
                ip_address = a.IpAddress,
                user_agent = a.UserAgent,
                details = a.Details,
                success = a.Success,
                timestamp = a.CreatedAt
            })
            .ToList();

        return Ok(new { items = logs, total, page, pageSize });
    }

    // ── IP Access Rules ──

    [HttpGet("ip-rules")]
    public async Task<IActionResult> GetIpRules(CancellationToken ct)
    {
        var rules = await _unitOfWork.IpAccessRules.GetAllAsync(ct);
        return Ok(rules.OrderBy(r => r.IpAddress).Select(r => new
        {
            id = r.Id,
            ip_address = r.IpAddress,
            subnet = r.Subnet,
            is_allowed = r.IsAllowed,
            description = r.Description,
            expires_at = r.ExpiresAt,
            failed_attempts = r.FailedAttempts,
            last_attempt = r.LastAttemptAt,
            created_at = r.CreatedAt
        }));
    }

    [HttpPost("ip-rules")]
    public async Task<IActionResult> AddIpRule([FromBody] CreateIpRuleRequest request, CancellationToken ct)
    {
        if (await _unitOfWork.IpAccessRules.ExistsAsync(r => r.IpAddress == request.IpAddress, ct))
            return BadRequest(new { message = "IP rule already exists" });

        var rule = new IpAccessRule
        {
            IpAddress = request.IpAddress,
            Subnet = request.Subnet,
            IsAllowed = request.IsAllowed,
            Description = request.Description,
            ExpiresAt = request.ExpiresAt
        };

        await _unitOfWork.IpAccessRules.AddAsync(rule, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { id = rule.Id, ip_address = rule.IpAddress, is_allowed = rule.IsAllowed });
    }

    [HttpDelete("ip-rules/{id}")]
    public async Task<IActionResult> DeleteIpRule(Guid id, CancellationToken ct)
    {
        var rule = await _unitOfWork.IpAccessRules.GetByIdAsync(id, ct);
        if (rule == null) return NotFound();

        await _unitOfWork.IpAccessRules.DeleteAsync(rule, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    // ── API Keys ──

    [HttpGet("api-keys")]
    public async Task<IActionResult> GetApiKeys(CancellationToken ct)
    {
        var keys = await _unitOfWork.ApiKeys.GetAllAsync(ct);
        return Ok(keys.Select(k => new
        {
            id = k.Id,
            name = k.Name,
            prefix = k.Prefix,
            user_id = k.UserId,
            permissions = k.Permissions,
            is_active = k.IsActive,
            expires_at = k.ExpiresAt,
            last_used = k.LastUsedAt,
            usage_count = k.UsageCount,
            created_at = k.CreatedAt
        }));
    }

    [HttpPost("api-keys")]
    public async Task<IActionResult> CreateApiKey([FromBody] CreateApiKeyRequest request, CancellationToken ct)
    {
        // Generate a random API key
        var rawKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var prefix = rawKey[..8];
        var keyHash = BCrypt.Net.BCrypt.HashPassword(rawKey);

        var apiKey = new ApiKey
        {
            Name = request.Name,
            KeyHash = keyHash,
            Prefix = prefix,
            UserId = request.UserId,
            Permissions = request.Permissions,
            IsActive = true,
            ExpiresAt = request.ExpiresAt
        };

        await _unitOfWork.ApiKeys.AddAsync(apiKey, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        // Return the raw key only once
        return Ok(new
        {
            id = apiKey.Id,
            name = apiKey.Name,
            key = $"wn_{prefix}_{rawKey}",
            prefix,
            message = "Store this key securely. It will not be shown again."
        });
    }

    [HttpDelete("api-keys/{id}")]
    public async Task<IActionResult> RevokeApiKey(Guid id, CancellationToken ct)
    {
        var key = await _unitOfWork.ApiKeys.GetByIdAsync(id, ct);
        if (key == null) return NotFound();

        key.IsActive = false;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { message = "API key revoked" });
    }

    // ── Sessions ──

    [HttpGet("sessions")]
    public async Task<IActionResult> GetActiveSessions(CancellationToken ct)
    {
        var sessions = await _unitOfWork.UserSessions.FindAsync(s => s.IsActive, ct);
        return Ok(sessions.OrderByDescending(s => s.LastActivityAt).Select(s => new
        {
            id = s.Id,
            user_id = s.UserId,
            ip_address = s.IpAddress,
            user_agent = s.UserAgent,
            device_fingerprint = s.DeviceFingerprint,
            last_activity = s.LastActivityAt,
            expires_at = s.ExpiresAt,
            created_at = s.CreatedAt
        }));
    }

    [HttpPost("sessions/{id}/revoke")]
    public async Task<IActionResult> RevokeSession(Guid id, CancellationToken ct)
    {
        var session = await _unitOfWork.UserSessions.GetByIdAsync(id, ct);
        if (session == null) return NotFound();

        session.IsActive = false;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { message = "Session revoked" });
    }

    // ── Security Stats ──

    [HttpGet("stats")]
    public async Task<IActionResult> GetSecurityStats(CancellationToken ct)
    {
        var recentLogs = _unitOfWork.AuditLogs.Query()
            .Where(a => a.CreatedAt > DateTime.UtcNow.AddHours(-24));

        var failedLogins = recentLogs.Count(a => a.Action == "login_failed");
        var successLogins = recentLogs.Count(a => a.Action == "login_success");
        var blockedIps = await _unitOfWork.IpAccessRules.CountAsync(r => !r.IsAllowed, ct);
        var activeSessions = await _unitOfWork.UserSessions.CountAsync(s => s.IsActive, ct);
        var activeApiKeys = await _unitOfWork.ApiKeys.CountAsync(k => k.IsActive, ct);

        return Ok(new
        {
            failed_logins_24h = failedLogins,
            successful_logins_24h = successLogins,
            blocked_ips = blockedIps,
            active_sessions = activeSessions,
            active_api_keys = activeApiKeys,
            total_audit_entries = _unitOfWork.AuditLogs.Query().Count()
        });
    }
}

public record CreateIpRuleRequest(string IpAddress, string? Subnet, bool IsAllowed, string? Description, DateTime? ExpiresAt);
public record CreateApiKeyRequest(string Name, Guid? UserId, string? Permissions, DateTime? ExpiresAt);

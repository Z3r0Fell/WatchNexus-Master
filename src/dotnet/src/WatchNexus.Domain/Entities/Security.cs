namespace WatchNexus.Domain.Entities;

/// <summary>
/// Audit log entry for security tracking
/// </summary>
public class AuditLog : BaseEntity
{
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Details { get; set; }
    public bool Success { get; set; } = true;
}

/// <summary>
/// IP access rule for firewall
/// </summary>
public class IpAccessRule : BaseEntity
{
    public string IpAddress { get; set; } = string.Empty;
    public string? Subnet { get; set; }
    public bool IsAllowed { get; set; } = true; // true = whitelist, false = blacklist
    public string? Description { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    public DateTime? LastAttemptAt { get; set; }
}

/// <summary>
/// API key for service-to-service auth
/// </summary>
public class ApiKey : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string KeyHash { get; set; } = string.Empty;
    public string? Prefix { get; set; } // first 8 chars for identification
    public Guid? UserId { get; set; }
    public string? Permissions { get; set; } // JSON array of allowed endpoints
    public bool IsActive { get; set; } = true;
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public int UsageCount { get; set; }
    
    public virtual User? User { get; set; }
}

/// <summary>
/// Active session tracking
/// </summary>
public class UserSession : BaseEntity
{
    public Guid UserId { get; set; }
    public string SessionToken { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? DeviceFingerprint { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }

    public virtual User User { get; set; } = null!;
}

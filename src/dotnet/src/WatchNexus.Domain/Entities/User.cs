using WatchNexus.Domain.Enums;

namespace WatchNexus.Domain.Entities;

/// <summary>
/// User entity - handles authentication and authorization
/// </summary>
public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.User;
    public bool IsActive { get; set; } = true;
    public string? AvatarUrl { get; set; }
    public DateTime? LastLoginAt { get; set; }
    
    // Settings
    public string? PreferredLanguage { get; set; } = "en";
    public string? Theme { get; set; } = "dark";
    public bool AutoPlayNext { get; set; } = true;
    public bool SkipIntros { get; set; } = false;
    public bool SkipCredits { get; set; } = false;
    
    // Navigation
    public virtual ICollection<WatchProgress> WatchProgress { get; set; } = new List<WatchProgress>();
    public virtual ICollection<Watchlist> Watchlist { get; set; } = new List<Watchlist>();
    public virtual ICollection<Playlist> Playlists { get; set; } = new List<Playlist>();
    public virtual ICollection<MediaRequest> MediaRequests { get; set; } = new List<MediaRequest>();
}

/// <summary>
/// Refresh token for JWT authentication
/// </summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public string? ReplacedByToken { get; set; }
    
    public virtual User User { get; set; } = null!;
}

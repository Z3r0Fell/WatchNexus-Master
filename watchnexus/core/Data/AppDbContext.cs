using Microsoft.EntityFrameworkCore;
using WatchNexus.Shared;

namespace WatchNexus.Core.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();

    // Module entities registered dynamically
    public DbSet<Library> Libraries => Set<Library>();
    public DbSet<MediaItem> MediaItems => Set<MediaItem>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<IpRule> IpRules => Set<IpRule>();
    public DbSet<ApiKeyEntity> ApiKeys => Set<ApiKeyEntity>();
    public DbSet<VpnPeer> VpnPeers => Set<VpnPeer>();
    public DbSet<VpnServerConfig> VpnServerConfigs => Set<VpnServerConfig>();
    public DbSet<DownloadItem> Downloads => Set<DownloadItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
        });
        b.Entity<AppSetting>().HasKey(s => new { s.Key, s.UserId });
        b.Entity<Library>().HasKey(l => l.Id);
        b.Entity<MediaItem>(e =>
        {
            e.HasKey(m => m.Id);
            e.HasIndex(m => m.LibraryId);
        });
        b.Entity<AuditLog>().HasKey(a => a.Id);
        b.Entity<IpRule>().HasKey(r => r.Id);
        b.Entity<ApiKeyEntity>().HasKey(k => k.Id);
        b.Entity<VpnPeer>().HasKey(p => p.Id);
        b.Entity<VpnServerConfig>().HasKey(c => c.Id);
        b.Entity<DownloadItem>().HasKey(d => d.Id);
    }
}

// Module entities
public class Library
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string MediaType { get; set; } = "movies";
    public int ItemCount { get; set; }
    public long TotalSize { get; set; }
    public string ScanStatus { get; set; } = "idle";
    public DateTime? LastScannedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class MediaItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string LibraryId { get; set; } = "";
    public string Title { get; set; } = "";
    public string? OriginalTitle { get; set; }
    public string? Overview { get; set; }
    public string FilePath { get; set; } = "";
    public long FileSize { get; set; }
    public string MediaType { get; set; } = "movie";
    public int? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public double? Rating { get; set; }
    public string? PosterUrl { get; set; }
    public string? BackdropUrl { get; set; }
    public string? Genres { get; set; }
    public int? Year { get; set; }
    public int? Runtime { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

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

public class VpnPeer
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string PublicKey { get; set; } = "";
    public string PrivateKey { get; set; } = "";
    public string PresharedKey { get; set; } = "";
    public string AllowedIps { get; set; } = "10.0.0.0/24";
    public string Address { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public long TransferRx { get; set; }
    public long TransferTx { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class VpnServerConfig
{
    public string Id { get; set; } = "default";
    public int ListenPort { get; set; } = 51820;
    public string Address { get; set; } = "10.0.0.1/24";
    public string Dns { get; set; } = "1.1.1.1";
    public string Endpoint { get; set; } = "";
    public string PublicKey { get; set; } = "";
    public string PrivateKey { get; set; } = "";
    public int Mtu { get; set; } = 1420;
    public bool IsActive { get; set; }
    public bool IsConfigured { get; set; }
}

public class DownloadItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string Status { get; set; } = "queued";
    public double Progress { get; set; }
    public long Size { get; set; }
    public long Downloaded { get; set; }
    public string? SavePath { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

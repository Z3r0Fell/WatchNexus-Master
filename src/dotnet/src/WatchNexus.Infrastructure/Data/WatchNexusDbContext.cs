using Microsoft.EntityFrameworkCore;
using WatchNexus.Domain.Entities;

namespace WatchNexus.Infrastructure.Data;

/// <summary>
/// WatchNexus Entity Framework DbContext
/// </summary>
public class WatchNexusDbContext : DbContext
{
    public WatchNexusDbContext(DbContextOptions<WatchNexusDbContext> options) : base(options)
    {
    }

    // Auth
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    
    // Media - Marmalade
    public DbSet<Library> Libraries => Set<Library>();
    public DbSet<MediaItem> MediaItems => Set<MediaItem>();
    public DbSet<WatchProgress> WatchProgress => Set<WatchProgress>();
    public DbSet<Watchlist> Watchlist => Set<Watchlist>();
    
    // Downloads - Fondue/Compote
    public DbSet<Download> Downloads => Set<Download>();
    public DbSet<Indexer> Indexers => Set<Indexer>();
    public DbSet<MediaRequest> MediaRequests => Set<MediaRequest>();
    public DbSet<QualityProfileEntity> QualityProfiles => Set<QualityProfileEntity>();
    
    // Content - Garnish/Relish/Drizzle
    public DbSet<Subtitle> Subtitles => Set<Subtitle>();
    public DbSet<IptvSource> IptvSources => Set<IptvSource>();
    public DbSet<IptvChannel> IptvChannels => Set<IptvChannel>();
    public DbSet<Playlist> Playlists => Set<Playlist>();
    public DbSet<PlaylistItem> PlaylistItems => Set<PlaylistItem>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    
    // Gadgets
    public DbSet<PodcastSubscription> PodcastSubscriptions => Set<PodcastSubscription>();
    public DbSet<PodcastEpisode> PodcastEpisodes => Set<PodcastEpisode>();
    public DbSet<RadioStation> RadioStations => Set<RadioStation>();
    public DbSet<PhotoLibrary> PhotoLibraries => Set<PhotoLibrary>();
    public DbSet<Photo> Photos => Set<Photo>();
    public DbSet<WebVideoBookmark> WebVideoBookmarks => Set<WebVideoBookmark>();
    
    // Security
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<IpAccessRule> IpAccessRules => Set<IpAccessRule>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    
    // VPN
    public DbSet<VpnPeer> VpnPeers => Set<VpnPeer>();
    public DbSet<VpnServerConfig> VpnServerConfigs => Set<VpnServerConfig>();
    public DbSet<VpnConnectionLog> VpnConnectionLogs => Set<VpnConnectionLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Apply all configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WatchNexusDbContext).Assembly);
        
        // User
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.Username).IsUnique();
        });
        
        // RefreshToken
        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.HasOne(rt => rt.User)
                .WithMany()
                .HasForeignKey(rt => rt.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Library
        modelBuilder.Entity<Library>(e =>
        {
            e.HasIndex(l => l.Path).IsUnique();
        });
        
        // MediaItem
        modelBuilder.Entity<MediaItem>(e =>
        {
            e.HasOne(m => m.Library)
                .WithMany(l => l.MediaItems)
                .HasForeignKey(m => m.LibraryId)
                .OnDelete(DeleteBehavior.Cascade);
            
            e.HasOne(m => m.Series)
                .WithMany(s => s.Episodes)
                .HasForeignKey(m => m.SeriesId)
                .OnDelete(DeleteBehavior.SetNull);
            
            e.HasIndex(m => m.TmdbId);
            e.HasIndex(m => m.ImdbId);
            e.HasIndex(m => new { m.LibraryId, m.FilePath }).IsUnique();
        });
        
        // WatchProgress
        modelBuilder.Entity<WatchProgress>(e =>
        {
            e.HasOne(wp => wp.User)
                .WithMany(u => u.WatchProgress)
                .HasForeignKey(wp => wp.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            e.HasOne(wp => wp.MediaItem)
                .WithMany(m => m.WatchProgress)
                .HasForeignKey(wp => wp.MediaItemId)
                .OnDelete(DeleteBehavior.Cascade);
            
            e.HasIndex(wp => new { wp.UserId, wp.MediaItemId }).IsUnique();
        });
        
        // Watchlist
        modelBuilder.Entity<Watchlist>(e =>
        {
            e.HasOne(w => w.User)
                .WithMany(u => u.Watchlist)
                .HasForeignKey(w => w.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            e.HasIndex(w => new { w.UserId, w.MediaItemId }).IsUnique();
        });
        
        // MediaRequest
        modelBuilder.Entity<MediaRequest>(e =>
        {
            e.HasOne(mr => mr.User)
                .WithMany(u => u.MediaRequests)
                .HasForeignKey(mr => mr.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Download
        modelBuilder.Entity<Download>(e =>
        {
            e.HasOne(d => d.MediaRequest)
                .WithMany(mr => mr.Downloads)
                .HasForeignKey(d => d.MediaRequestId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // Subtitle
        modelBuilder.Entity<Subtitle>(e =>
        {
            e.HasOne(s => s.MediaItem)
                .WithMany(m => m.Subtitles)
                .HasForeignKey(s => s.MediaItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // IPTV
        modelBuilder.Entity<IptvChannel>(e =>
        {
            e.HasOne(c => c.Source)
                .WithMany(s => s.Channels)
                .HasForeignKey(c => c.SourceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Playlists
        modelBuilder.Entity<Playlist>(e =>
        {
            e.HasOne(p => p.User)
                .WithMany(u => u.Playlists)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        modelBuilder.Entity<PlaylistItem>(e =>
        {
            e.HasOne(pi => pi.Playlist)
                .WithMany(p => p.Items)
                .HasForeignKey(pi => pi.PlaylistId)
                .OnDelete(DeleteBehavior.Cascade);
            
            e.HasIndex(pi => new { pi.PlaylistId, pi.MediaItemId }).IsUnique();
        });
        
        // Podcasts
        modelBuilder.Entity<PodcastSubscription>(e =>
        {
            e.HasIndex(ps => new { ps.UserId, ps.FeedUrl }).IsUnique();
        });
        
        modelBuilder.Entity<PodcastEpisode>(e =>
        {
            e.HasOne(pe => pe.Subscription)
                .WithMany(ps => ps.Episodes)
                .HasForeignKey(pe => pe.SubscriptionId)
                .OnDelete(DeleteBehavior.Cascade);
            
            e.HasIndex(pe => new { pe.SubscriptionId, pe.Guid }).IsUnique();
        });
        
        // Photos
        modelBuilder.Entity<Photo>(e =>
        {
            e.HasOne(p => p.Library)
                .WithMany(l => l.Photos)
                .HasForeignKey(p => p.LibraryId)
                .OnDelete(DeleteBehavior.Cascade);
            
            e.HasIndex(p => new { p.LibraryId, p.FilePath }).IsUnique();
        });
        
        // AppSettings
        modelBuilder.Entity<AppSetting>(e =>
        {
            e.HasIndex(s => new { s.Key, s.UserId }).IsUnique();
        });
        
        // Security - AuditLog
        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasIndex(a => a.UserId);
            e.HasIndex(a => a.Action);
            e.HasIndex(a => a.CreatedAt);
        });
        
        // Security - IpAccessRule
        modelBuilder.Entity<IpAccessRule>(e =>
        {
            e.HasIndex(r => r.IpAddress).IsUnique();
        });
        
        // Security - ApiKey
        modelBuilder.Entity<ApiKey>(e =>
        {
            e.HasIndex(k => k.Prefix);
            e.HasOne(k => k.User).WithMany().HasForeignKey(k => k.UserId).OnDelete(DeleteBehavior.SetNull);
        });
        
        // Security - UserSession
        modelBuilder.Entity<UserSession>(e =>
        {
            e.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.SessionToken).IsUnique();
            e.HasIndex(s => s.UserId);
        });
        
        // VPN - Peer
        modelBuilder.Entity<VpnPeer>(e =>
        {
            e.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => p.PublicKey).IsUnique();
            e.HasIndex(p => p.AssignedIp).IsUnique();
        });
        
        // VPN - ConnectionLog
        modelBuilder.Entity<VpnConnectionLog>(e =>
        {
            e.HasOne(l => l.Peer).WithMany().HasForeignKey(l => l.PeerId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(l => l.User).WithMany().HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(l => l.UserId);
        });
    }
    
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is BaseEntity && (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entry in entries)
        {
            var entity = (BaseEntity)entry.Entity;
            
            if (entry.State == EntityState.Added)
            {
                entity.CreatedAt = DateTime.UtcNow;
            }
            else
            {
                entity.UpdatedAt = DateTime.UtcNow;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}

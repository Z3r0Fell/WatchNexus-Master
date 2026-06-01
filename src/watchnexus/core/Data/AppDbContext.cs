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
    public DbSet<IptvSource> IptvSources => Set<IptvSource>();
    public DbSet<IptvChannel> IptvChannels => Set<IptvChannel>();
    public DbSet<PodcastSubscription> PodcastSubscriptions => Set<PodcastSubscription>();
    public DbSet<RadioFavorite> RadioFavorites => Set<RadioFavorite>();
    public DbSet<PhotoLibrary> PhotoLibraries => Set<PhotoLibrary>();
    public DbSet<Playlist> Playlists => Set<Playlist>();
    public DbSet<PlaylistItem> PlaylistItems => Set<PlaylistItem>();
    public DbSet<WebVideoBookmark> WebVideoBookmarks => Set<WebVideoBookmark>();
    public DbSet<WebVideoHistory> WebVideoHistories => Set<WebVideoHistory>();
    public DbSet<PlayEvent> PlayEvents => Set<PlayEvent>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();
    public DbSet<MediaRequest> MediaRequests => Set<MediaRequest>();
    public DbSet<TranscodeJob> TranscodeJobs => Set<TranscodeJob>();
    public DbSet<SpotdlDownload> SpotdlDownloads => Set<SpotdlDownload>();
    public DbSet<SpotdlKey> SpotdlKeys => Set<SpotdlKey>();

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
        b.Entity<IptvSource>().HasKey(s => s.Id);
        b.Entity<IptvChannel>(e => { e.HasKey(c => c.Id); e.HasIndex(c => c.SourceId); });
        b.Entity<PodcastSubscription>(e => { e.HasKey(p => p.Id); e.HasIndex(p => p.UserId); });
        b.Entity<RadioFavorite>(e => { e.HasKey(f => f.Id); e.HasIndex(f => f.UserId); });
        b.Entity<PhotoLibrary>(e => { e.HasKey(p => p.Id); e.HasIndex(p => p.UserId); });
        b.Entity<Playlist>(e => { e.HasKey(p => p.Id); e.HasIndex(p => p.UserId); });
        b.Entity<PlaylistItem>(e => { e.HasKey(i => i.Id); e.HasIndex(i => i.PlaylistId); });
        b.Entity<WebVideoBookmark>(e => { e.HasKey(b2 => b2.Id); e.HasIndex(b2 => b2.UserId); });
        b.Entity<WebVideoHistory>(e => { e.HasKey(h => h.Id); e.HasIndex(h => h.UserId); });
        b.Entity<PlayEvent>(e => { e.HasKey(p => p.Id); e.HasIndex(p => p.UserId); e.HasIndex(p => p.StartedAt); });
        b.Entity<NotificationLog>(e => { e.HasKey(n => n.Id); e.HasIndex(n => n.SentAt); });
        b.Entity<MediaRequest>(e => { e.HasKey(r => r.Id); e.HasIndex(r => r.UserId); e.HasIndex(r => r.Status); });
        b.Entity<TranscodeJob>(e => { e.HasKey(t => t.Id); e.HasIndex(t => t.Status); });

        // Spotdl — Spotify/YouTube Music Downloader
        b.Entity<SpotdlDownload>(e =>
        {
            e.HasKey(d => d.Id);
            e.HasIndex(d => d.UserId);
            e.HasIndex(d => d.Status);
        });
        b.Entity<SpotdlKey>(e =>
        {
            e.HasKey(k => k.Id);
            e.HasIndex(k => k.Service);
            e.HasIndex(k => k.IsActive);
        });
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

// IPTV
public class IptvSource
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Url { get; set; } = "";
    public string? EpgUrl { get; set; }
    public int ChannelCount { get; set; }
    public DateTime? LastRefreshed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class IptvChannel
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SourceId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? GroupTitle { get; set; }
    public string StreamUrl { get; set; } = "";
    public string? LogoUrl { get; set; }
    public string? TvgId { get; set; }
    public string? TvgName { get; set; }
    public int SortOrder { get; set; }
}

// Podcasts
public class PodcastSubscription
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Author { get; set; }
    public string FeedUrl { get; set; } = "";
    public string? ArtworkUrl { get; set; }
    public string? Description { get; set; }
    public DateTime? LastChecked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Radio
public class RadioFavorite
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string StationUuid { get; set; } = "";
    public string Name { get; set; } = "";
    public string? StreamUrl { get; set; }
    public string? Favicon { get; set; }
    public string? Country { get; set; }
    public string? Tags { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Photos
public class PhotoLibrary
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public int PhotoCount { get; set; }
    public DateTime? LastScanned { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Playlists
public class Playlist
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string MediaType { get; set; } = "mixed";
    public int ItemCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class PlaylistItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string PlaylistId { get; set; } = "";
    public string? MediaItemId { get; set; }
    public string? TmdbId { get; set; }
    public string Title { get; set; } = "";
    public string? PosterUrl { get; set; }
    public string MediaType { get; set; } = "movie";
    public int SortOrder { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

// Web Video Bookmarks
public class WebVideoBookmark
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Url { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Thumbnail { get; set; }
    public int? Duration { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class WebVideoHistory
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Url { get; set; } = "";
    public string Title { get; set; } = "";
    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;
}

// Truffle — Watch Analytics
public class PlayEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string MediaType { get; set; } = "movie";
    public string? TmdbId { get; set; }
    public string Title { get; set; } = "";
    public int DurationSeconds { get; set; }
    public string? DeviceType { get; set; }
    public string? Quality { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
}

// Pepper — Notification Hub
public class NotificationLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string EventType { get; set; } = "";
    public string Channel { get; set; } = "";
    public string Message { get; set; } = "";
    public string Status { get; set; } = "sent";
    public string? Error { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}

// Meringue — Media Requests
public class MediaRequest
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Username { get; set; } = "";
    public int TmdbId { get; set; }
    public string MediaType { get; set; } = "movie";
    public string Title { get; set; } = "";
    public string? PosterUrl { get; set; }
    public string? Overview { get; set; }
    public string Status { get; set; } = "pending";
    public string? AdminNotes { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
}

// Crucible — Media Processing
public class TranscodeJob
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string SourcePath { get; set; } = "";
    public string? OutputPath { get; set; }
    public string Profile { get; set; } = "h265-default";
    public string Status { get; set; } = "queued";
    public double Progress { get; set; }
    public long? SourceSize { get; set; }
    public long? OutputSize { get; set; }
    public string? Resolution { get; set; }
    public string? Codec { get; set; }
    public string? Error { get; set; }
    public string? SettingsJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

// Spotdl — Spotify/YouTube Music Downloader
public class SpotdlDownload
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Url { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Artist { get; set; }
    public string Status { get; set; } = "queued";
    public string Format { get; set; } = "mp3";
    public double Progress { get; set; }
    public string? OutputPath { get; set; }
    public string? ErrorMessage { get; set; }
    public string? KeyUsed { get; set; }
    public int RetryCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

public class SpotdlKey
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string KeyValue { get; set; } = "";
    public string Service { get; set; } = "spotify";
    public bool IsActive { get; set; } = true;
    public DateTime? LastUsedAt { get; set; }
    public int FailureCount { get; set; }
    public int MaxFailures { get; set; } = 5;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

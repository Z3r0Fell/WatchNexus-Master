using System.Linq.Expressions;
using WatchNexus.Domain.Entities;

namespace WatchNexus.Domain.Interfaces;

/// <summary>
/// Generic repository interface
/// </summary>
public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default);
    Task<T> AddAsync(T entity, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default);
    Task UpdateAsync(T entity, CancellationToken ct = default);
    Task DeleteAsync(T entity, CancellationToken ct = default);
    Task DeleteRangeAsync(IEnumerable<T> entities, CancellationToken ct = default);
    IQueryable<T> Query();
}

/// <summary>
/// Unit of Work pattern
/// </summary>
public interface IUnitOfWork : IDisposable
{
    IRepository<User> Users { get; }
    IRepository<RefreshToken> RefreshTokens { get; }
    IRepository<Library> Libraries { get; }
    IRepository<MediaItem> MediaItems { get; }
    IRepository<WatchProgress> WatchProgress { get; }
    IRepository<Watchlist> Watchlist { get; }
    IRepository<Download> Downloads { get; }
    IRepository<Indexer> Indexers { get; }
    IRepository<MediaRequest> MediaRequests { get; }
    IRepository<QualityProfileEntity> QualityProfiles { get; }
    IRepository<Subtitle> Subtitles { get; }
    IRepository<IptvSource> IptvSources { get; }
    IRepository<IptvChannel> IptvChannels { get; }
    IRepository<Playlist> Playlists { get; }
    IRepository<PlaylistItem> PlaylistItems { get; }
    IRepository<AppSetting> AppSettings { get; }
    IRepository<PodcastSubscription> PodcastSubscriptions { get; }
    IRepository<PodcastEpisode> PodcastEpisodes { get; }
    IRepository<RadioStation> RadioStations { get; }
    IRepository<PhotoLibrary> PhotoLibraries { get; }
    IRepository<Photo> Photos { get; }
    IRepository<WebVideoBookmark> WebVideoBookmarks { get; }
    
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task BeginTransactionAsync(CancellationToken ct = default);
    Task CommitAsync(CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct = default);
}

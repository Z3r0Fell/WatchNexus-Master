using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;
using WatchNexus.Infrastructure.Data;

namespace WatchNexus.Infrastructure.Repositories;

/// <summary>
/// Generic repository implementation
/// </summary>
public class Repository<T> : IRepository<T> where T : BaseEntity
{
    protected readonly WatchNexusDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(WatchNexusDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _dbSet.FindAsync(new object[] { id }, ct);
    }

    public virtual async Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default)
    {
        return await _dbSet.ToListAsync(ct);
    }

    public virtual async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
    {
        return await _dbSet.Where(predicate).ToListAsync(ct);
    }

    public virtual async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
    {
        return await _dbSet.FirstOrDefaultAsync(predicate, ct);
    }

    public virtual async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
    {
        return await _dbSet.AnyAsync(predicate, ct);
    }

    public virtual async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default)
    {
        return predicate == null 
            ? await _dbSet.CountAsync(ct) 
            : await _dbSet.CountAsync(predicate, ct);
    }

    public virtual async Task<T> AddAsync(T entity, CancellationToken ct = default)
    {
        await _dbSet.AddAsync(entity, ct);
        return entity;
    }

    public virtual async Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default)
    {
        await _dbSet.AddRangeAsync(entities, ct);
    }

    public virtual Task UpdateAsync(T entity, CancellationToken ct = default)
    {
        _dbSet.Update(entity);
        return Task.CompletedTask;
    }

    public virtual Task DeleteAsync(T entity, CancellationToken ct = default)
    {
        _dbSet.Remove(entity);
        return Task.CompletedTask;
    }

    public virtual Task DeleteRangeAsync(IEnumerable<T> entities, CancellationToken ct = default)
    {
        _dbSet.RemoveRange(entities);
        return Task.CompletedTask;
    }

    public virtual IQueryable<T> Query()
    {
        return _dbSet.AsQueryable();
    }
}

/// <summary>
/// Unit of Work implementation
/// </summary>
public class UnitOfWork : IUnitOfWork
{
    private readonly WatchNexusDbContext _context;
    private Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? _transaction;

    // Lazy-loaded repositories
    private IRepository<User>? _users;
    private IRepository<RefreshToken>? _refreshTokens;
    private IRepository<Library>? _libraries;
    private IRepository<MediaItem>? _mediaItems;
    private IRepository<WatchProgress>? _watchProgress;
    private IRepository<Watchlist>? _watchlist;
    private IRepository<Download>? _downloads;
    private IRepository<Indexer>? _indexers;
    private IRepository<MediaRequest>? _mediaRequests;
    private IRepository<QualityProfileEntity>? _qualityProfiles;
    private IRepository<Subtitle>? _subtitles;
    private IRepository<IptvSource>? _iptvSources;
    private IRepository<IptvChannel>? _iptvChannels;
    private IRepository<Playlist>? _playlists;
    private IRepository<PlaylistItem>? _playlistItems;
    private IRepository<AppSetting>? _appSettings;
    private IRepository<PodcastSubscription>? _podcastSubscriptions;
    private IRepository<PodcastEpisode>? _podcastEpisodes;
    private IRepository<RadioStation>? _radioStations;
    private IRepository<PhotoLibrary>? _photoLibraries;
    private IRepository<Photo>? _photos;
    private IRepository<WebVideoBookmark>? _webVideoBookmarks;
    private IRepository<AuditLog>? _auditLogs;
    private IRepository<IpAccessRule>? _ipAccessRules;
    private IRepository<ApiKey>? _apiKeys;
    private IRepository<UserSession>? _userSessions;
    private IRepository<VpnPeer>? _vpnPeers;
    private IRepository<VpnServerConfig>? _vpnServerConfigs;
    private IRepository<VpnConnectionLog>? _vpnConnectionLogs;

    public UnitOfWork(WatchNexusDbContext context)
    {
        _context = context;
    }

    public IRepository<User> Users => _users ??= new Repository<User>(_context);
    public IRepository<RefreshToken> RefreshTokens => _refreshTokens ??= new Repository<RefreshToken>(_context);
    public IRepository<Library> Libraries => _libraries ??= new Repository<Library>(_context);
    public IRepository<MediaItem> MediaItems => _mediaItems ??= new Repository<MediaItem>(_context);
    public IRepository<WatchProgress> WatchProgress => _watchProgress ??= new Repository<WatchProgress>(_context);
    public IRepository<Watchlist> Watchlist => _watchlist ??= new Repository<Watchlist>(_context);
    public IRepository<Download> Downloads => _downloads ??= new Repository<Download>(_context);
    public IRepository<Indexer> Indexers => _indexers ??= new Repository<Indexer>(_context);
    public IRepository<MediaRequest> MediaRequests => _mediaRequests ??= new Repository<MediaRequest>(_context);
    public IRepository<QualityProfileEntity> QualityProfiles => _qualityProfiles ??= new Repository<QualityProfileEntity>(_context);
    public IRepository<Subtitle> Subtitles => _subtitles ??= new Repository<Subtitle>(_context);
    public IRepository<IptvSource> IptvSources => _iptvSources ??= new Repository<IptvSource>(_context);
    public IRepository<IptvChannel> IptvChannels => _iptvChannels ??= new Repository<IptvChannel>(_context);
    public IRepository<Playlist> Playlists => _playlists ??= new Repository<Playlist>(_context);
    public IRepository<PlaylistItem> PlaylistItems => _playlistItems ??= new Repository<PlaylistItem>(_context);
    public IRepository<AppSetting> AppSettings => _appSettings ??= new Repository<AppSetting>(_context);
    public IRepository<PodcastSubscription> PodcastSubscriptions => _podcastSubscriptions ??= new Repository<PodcastSubscription>(_context);
    public IRepository<PodcastEpisode> PodcastEpisodes => _podcastEpisodes ??= new Repository<PodcastEpisode>(_context);
    public IRepository<RadioStation> RadioStations => _radioStations ??= new Repository<RadioStation>(_context);
    public IRepository<PhotoLibrary> PhotoLibraries => _photoLibraries ??= new Repository<PhotoLibrary>(_context);
    public IRepository<Photo> Photos => _photos ??= new Repository<Photo>(_context);
    public IRepository<WebVideoBookmark> WebVideoBookmarks => _webVideoBookmarks ??= new Repository<WebVideoBookmark>(_context);
    public IRepository<AuditLog> AuditLogs => _auditLogs ??= new Repository<AuditLog>(_context);
    public IRepository<IpAccessRule> IpAccessRules => _ipAccessRules ??= new Repository<IpAccessRule>(_context);
    public IRepository<ApiKey> ApiKeys => _apiKeys ??= new Repository<ApiKey>(_context);
    public IRepository<UserSession> UserSessions => _userSessions ??= new Repository<UserSession>(_context);
    public IRepository<VpnPeer> VpnPeers => _vpnPeers ??= new Repository<VpnPeer>(_context);
    public IRepository<VpnServerConfig> VpnServerConfigs => _vpnServerConfigs ??= new Repository<VpnServerConfig>(_context);
    public IRepository<VpnConnectionLog> VpnConnectionLogs => _vpnConnectionLogs ??= new Repository<VpnConnectionLog>(_context);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return await _context.SaveChangesAsync(ct);
    }

    public async Task BeginTransactionAsync(CancellationToken ct = default)
    {
        _transaction = await _context.Database.BeginTransactionAsync(ct);
    }

    public async Task CommitAsync(CancellationToken ct = default)
    {
        if (_transaction != null)
        {
            await _transaction.CommitAsync(ct);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackAsync(CancellationToken ct = default)
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync(ct);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
    }
}

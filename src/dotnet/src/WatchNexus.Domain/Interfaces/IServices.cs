using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Enums;

namespace WatchNexus.Domain.Interfaces;

/// <summary>
/// Authentication service interface
/// </summary>
public interface IAuthService
{
    Task<(User User, string AccessToken, string RefreshToken)> LoginAsync(string email, string password, CancellationToken ct = default);
    Task<(User User, string AccessToken, string RefreshToken)> RegisterAsync(string email, string username, string password, CancellationToken ct = default);
    Task<(string AccessToken, string RefreshToken)> RefreshTokenAsync(string refreshToken, CancellationToken ct = default);
    Task RevokeTokenAsync(string refreshToken, CancellationToken ct = default);
    Task<bool> ValidateTokenAsync(string token, CancellationToken ct = default);
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
}

/// <summary>
/// JWT token service interface
/// </summary>
public interface IJwtService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    Guid? ValidateAccessToken(string token);
}

/// <summary>
/// Library scanner service - Marmalade
/// </summary>
public interface ILibraryScannerService
{
    Task ScanLibraryAsync(Guid libraryId, CancellationToken ct = default);
    Task<int> GetMediaFilesCountAsync(string path, CancellationToken ct = default);
    Task<IEnumerable<string>> GetMediaFilesAsync(string path, bool recursive = true, CancellationToken ct = default);
}

/// <summary>
/// Metadata provider service
/// </summary>
public interface IMetadataService
{
    Task<MediaItem?> FetchMovieMetadataAsync(string title, int? year = null, CancellationToken ct = default);
    Task<MediaItem?> FetchTvShowMetadataAsync(string title, int? year = null, CancellationToken ct = default);
    Task<MediaItem?> FetchEpisodeMetadataAsync(string tmdbId, int season, int episode, CancellationToken ct = default);
    Task<byte[]?> DownloadImageAsync(string path, CancellationToken ct = default);
}

/// <summary>
/// Download client service - Fondue
/// </summary>
public interface IDownloadService
{
    Task<Download> AddDownloadAsync(string magnetUri, string savePath, CancellationToken ct = default);
    Task<Download> AddTorrentFileAsync(byte[] torrentFile, string savePath, CancellationToken ct = default);
    Task PauseAsync(Guid downloadId, CancellationToken ct = default);
    Task ResumeAsync(Guid downloadId, CancellationToken ct = default);
    Task DeleteAsync(Guid downloadId, bool deleteFiles = false, CancellationToken ct = default);
    Task<IEnumerable<Download>> GetAllDownloadsAsync(CancellationToken ct = default);
}

/// <summary>
/// Indexer search service - Compote
/// </summary>
public interface IIndexerService
{
    Task<IEnumerable<SearchResult>> SearchAsync(string query, CancellationToken ct = default);
    Task<IEnumerable<SearchResult>> SearchMovieAsync(string title, int? year = null, CancellationToken ct = default);
    Task<IEnumerable<SearchResult>> SearchTvAsync(string title, int? season = null, int? episode = null, CancellationToken ct = default);
    Task TestIndexerAsync(Guid indexerId, CancellationToken ct = default);
}

/// <summary>
/// Subtitle service - Garnish
/// </summary>
public interface ISubtitleService
{
    Task<IEnumerable<SubtitleSearchResult>> SearchAsync(string title, string? imdbId = null, int? season = null, int? episode = null, CancellationToken ct = default);
    Task<Subtitle> DownloadAsync(string externalId, SubtitleProvider provider, Guid mediaItemId, CancellationToken ct = default);
}

/// <summary>
/// Transcoding service - Gelatin
/// </summary>
public interface ITranscodingService
{
    Task<string> TranscodeAsync(string inputPath, string outputPath, TranscodeOptions options, CancellationToken ct = default);
    Task<string> GenerateThumbnailAsync(string videoPath, int timeSeconds, CancellationToken ct = default);
    Task<MediaInfo> GetMediaInfoAsync(string filePath, CancellationToken ct = default);
}

/// <summary>
/// File browser service
/// </summary>
public interface IFileBrowserService
{
    Task<BrowseResult> BrowseAsync(string path, CancellationToken ct = default);
    Task<IEnumerable<DriveInfo>> GetDrivesAsync(CancellationToken ct = default);
    bool PathExists(string path);
    bool IsDirectory(string path);
}

// Supporting DTOs
public record SearchResult(
    string Title,
    string? InfoHash,
    string? MagnetUri,
    string? TorrentUrl,
    long Size,
    int Seeds,
    int Peers,
    string Indexer,
    DateTime PublishedAt
);

public record SubtitleSearchResult(
    string ExternalId,
    string Title,
    string Language,
    string Format,
    int Downloads,
    SubtitleProvider Provider
);

public record TranscodeOptions(
    string VideoCodec = "libx264",
    string AudioCodec = "aac",
    int? Width = null,
    int? Height = null,
    int? Bitrate = null,
    string OutputFormat = "mp4"
);

public record MediaInfo(
    int? DurationSeconds,
    int? Width,
    int? Height,
    string? VideoCodec,
    string? AudioCodec,
    int? Bitrate,
    string? Container
);

public record BrowseResult(
    string CurrentPath,
    string? ParentPath,
    bool IsRoot,
    string OsType,
    IEnumerable<BrowseItem> Items,
    IEnumerable<DriveInfo> Drives
);

public record BrowseItem(
    string Name,
    string Path,
    bool IsDirectory,
    long Size,
    int ItemCount,
    bool PermissionDenied,
    bool IsSymlink
);

public record DriveInfo(
    string Name,
    string Path,
    long TotalSize,
    long FreeSpace
);

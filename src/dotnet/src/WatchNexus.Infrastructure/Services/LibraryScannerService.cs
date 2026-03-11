using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Enums;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.Infrastructure.Services;

/// <summary>
/// Library scanner service - Marmalade implementation
/// </summary>
public class LibraryScannerService : ILibraryScannerService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMetadataService _metadataService;
    private readonly ILogger<LibraryScannerService> _logger;

    private static readonly string[] VideoExtensions = { ".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".ts" };
    private static readonly string[] AudioExtensions = { ".mp3", ".flac", ".m4a", ".aac", ".ogg", ".wav", ".wma", ".opus" };

    private static readonly Regex MoviePattern = new(@"^(.+?)[\.\s_-]*\(?(\d{4})\)?", RegexOptions.Compiled);
    private static readonly Regex TvPattern = new(@"^(.+?)[\.\s_-]*[Ss](\d{1,2})[Ee](\d{1,2})", RegexOptions.Compiled);
    private static readonly Regex TvPatternAlt = new(@"^(.+?)[\.\s_-]*(\d{1,2})x(\d{1,2})", RegexOptions.Compiled);

    public LibraryScannerService(IUnitOfWork unitOfWork, IMetadataService metadataService, ILogger<LibraryScannerService> logger)
    {
        _unitOfWork = unitOfWork;
        _metadataService = metadataService;
        _logger = logger;
    }

    public async Task ScanLibraryAsync(Guid libraryId, CancellationToken ct = default)
    {
        var library = await _unitOfWork.Libraries.GetByIdAsync(libraryId, ct);
        if (library == null)
        {
            _logger.LogWarning("Library not found: {LibraryId}", libraryId);
            return;
        }

        _logger.LogInformation("Starting scan of library: {LibraryName} at {Path}", library.Name, library.Path);

        library.ScanStatus = LibraryScanStatus.Scanning;
        await _unitOfWork.SaveChangesAsync(ct);

        try
        {
            var files = await GetMediaFilesAsync(library.Path, library.ScanRecursively, ct);
            var existingPaths = (await _unitOfWork.MediaItems.FindAsync(m => m.LibraryId == libraryId, ct))
                .Select(m => m.FilePath)
                .ToHashSet();

            var newCount = 0;
            long totalSize = 0;

            foreach (var file in files)
            {
                if (ct.IsCancellationRequested) break;
                if (existingPaths.Contains(file)) continue;

                var mediaItem = await CreateMediaItemAsync(file, library, ct);
                if (mediaItem != null)
                {
                    await _unitOfWork.MediaItems.AddAsync(mediaItem, ct);
                    newCount++;
                    totalSize += mediaItem.FileSize;

                    if (newCount % 50 == 0)
                    {
                        await _unitOfWork.SaveChangesAsync(ct);
                        _logger.LogInformation("Scanned {Count} new items...", newCount);
                    }
                }
            }

            await _unitOfWork.SaveChangesAsync(ct);

            library.ScanStatus = LibraryScanStatus.Completed;
            library.LastScannedAt = DateTime.UtcNow;
            library.ItemCount = await _unitOfWork.MediaItems.CountAsync(m => m.LibraryId == libraryId, ct);
            library.TotalSize = totalSize;
            await _unitOfWork.SaveChangesAsync(ct);

            _logger.LogInformation("Library scan complete: {LibraryName}, {NewCount} new items", library.Name, newCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Library scan failed: {LibraryName}", library.Name);
            library.ScanStatus = LibraryScanStatus.Failed;
            await _unitOfWork.SaveChangesAsync(ct);
        }
    }

    public Task<int> GetMediaFilesCountAsync(string path, CancellationToken ct = default)
    {
        if (!Directory.Exists(path)) return Task.FromResult(0);

        var count = Directory.EnumerateFiles(path, "*.*", SearchOption.AllDirectories)
            .Count(f => IsMediaFile(f));

        return Task.FromResult(count);
    }

    public Task<IEnumerable<string>> GetMediaFilesAsync(string path, bool recursive = true, CancellationToken ct = default)
    {
        if (!Directory.Exists(path))
            return Task.FromResult<IEnumerable<string>>(Array.Empty<string>());

        var option = recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
        var files = Directory.EnumerateFiles(path, "*.*", option)
            .Where(IsMediaFile);

        return Task.FromResult(files);
    }

    private async Task<MediaItem?> CreateMediaItemAsync(string filePath, Library library, CancellationToken ct)
    {
        try
        {
            var fileName = Path.GetFileNameWithoutExtension(filePath);
            var fileInfo = new FileInfo(filePath);

            var mediaItem = new MediaItem
            {
                LibraryId = library.Id,
                FilePath = filePath,
                FileSize = fileInfo.Length,
                MediaType = library.MediaType,
                Container = Path.GetExtension(filePath).TrimStart('.').ToLower()
            };

            // Parse filename for metadata
            if (library.MediaType == MediaType.Movie)
            {
                var match = MoviePattern.Match(fileName);
                if (match.Success)
                {
                    mediaItem.Title = CleanTitle(match.Groups[1].Value);
                    mediaItem.Year = int.TryParse(match.Groups[2].Value, out var y) ? y : null;
                }
                else
                {
                    mediaItem.Title = CleanTitle(fileName);
                }

                // Fetch metadata
                if (library.FetchMetadata)
                {
                    var metadata = await _metadataService.FetchMovieMetadataAsync(mediaItem.Title, mediaItem.Year, ct);
                    if (metadata != null)
                    {
                        CopyMetadata(metadata, mediaItem);
                    }
                }
            }
            else if (library.MediaType == MediaType.TvShow)
            {
                var match = TvPattern.Match(fileName);
                if (!match.Success) match = TvPatternAlt.Match(fileName);

                if (match.Success)
                {
                    mediaItem.Title = CleanTitle(match.Groups[1].Value);
                    mediaItem.SeasonNumber = int.TryParse(match.Groups[2].Value, out var s) ? s : null;
                    mediaItem.EpisodeNumber = int.TryParse(match.Groups[3].Value, out var e) ? e : null;
                }
                else
                {
                    mediaItem.Title = CleanTitle(fileName);
                }
            }
            else if (library.MediaType == MediaType.Music)
            {
                // Basic music parsing - could be enhanced with tag reading
                mediaItem.Title = CleanTitle(fileName);
            }

            mediaItem.SortTitle = mediaItem.Title.TrimStart("The ", "A ", "An ");
            return mediaItem;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create media item for {FilePath}", filePath);
            return null;
        }
    }

    private static bool IsMediaFile(string path)
    {
        var ext = Path.GetExtension(path).ToLower();
        return VideoExtensions.Contains(ext) || AudioExtensions.Contains(ext);
    }

    private static string CleanTitle(string title)
    {
        // Replace dots, underscores with spaces
        title = Regex.Replace(title, @"[\._]", " ");
        // Remove quality tags
        title = Regex.Replace(title, @"\b(720p|1080p|2160p|4k|bluray|bdrip|webrip|hdtv|x264|x265|hevc)\b", "", RegexOptions.IgnoreCase);
        // Clean up whitespace
        title = Regex.Replace(title, @"\s+", " ").Trim();
        return title;
    }

    private static void CopyMetadata(MediaItem source, MediaItem target)
    {
        target.OriginalTitle = source.OriginalTitle;
        target.Overview = source.Overview;
        target.Tagline = source.Tagline;
        target.Year = source.Year ?? target.Year;
        target.ReleaseDate = source.ReleaseDate;
        target.RuntimeMinutes = source.RuntimeMinutes;
        target.Rating = source.Rating;
        target.VoteCount = source.VoteCount;
        target.ContentRating = source.ContentRating;
        target.Genres = source.Genres;
        target.Cast = source.Cast;
        target.Crew = source.Crew;
        target.Studios = source.Studios;
        target.TmdbId = source.TmdbId;
        target.ImdbId = source.ImdbId;
        target.PosterPath = source.PosterPath;
        target.BackdropPath = source.BackdropPath;
    }
}

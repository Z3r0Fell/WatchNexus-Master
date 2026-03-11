using WatchNexus.Domain.Enums;

namespace WatchNexus.Domain.Entities;

/// <summary>
/// Media library - Marmalade module
/// </summary>
public class Library : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public MediaType MediaType { get; set; }
    public bool IsEnabled { get; set; } = true;
    public LibraryScanStatus ScanStatus { get; set; } = LibraryScanStatus.Idle;
    public DateTime? LastScannedAt { get; set; }
    public int ItemCount { get; set; }
    public long TotalSize { get; set; }
    
    // Scanning options
    public bool ScanRecursively { get; set; } = true;
    public bool FetchMetadata { get; set; } = true;
    public bool GenerateThumbnails { get; set; } = true;
    public string? IncludePatterns { get; set; }
    public string? ExcludePatterns { get; set; }
    
    // Navigation
    public virtual ICollection<MediaItem> MediaItems { get; set; } = new List<MediaItem>();
}

/// <summary>
/// Individual media item (movie, episode, track, etc.)
/// </summary>
public class MediaItem : BaseEntity
{
    public Guid LibraryId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? OriginalTitle { get; set; }
    public string? SortTitle { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public MediaType MediaType { get; set; }
    
    // Metadata
    public string? Overview { get; set; }
    public string? Tagline { get; set; }
    public int? Year { get; set; }
    public DateTime? ReleaseDate { get; set; }
    public int? RuntimeMinutes { get; set; }
    public double? Rating { get; set; }
    public int? VoteCount { get; set; }
    public string? ContentRating { get; set; }
    public string? Genres { get; set; } // Comma-separated
    public string? Cast { get; set; } // JSON
    public string? Crew { get; set; } // JSON
    public string? Studios { get; set; }
    
    // External IDs
    public string? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public string? TvdbId { get; set; }
    
    // Images
    public string? PosterPath { get; set; }
    public string? BackdropPath { get; set; }
    public string? ThumbnailPath { get; set; }
    
    // File info
    public long FileSize { get; set; }
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
    public string? Resolution { get; set; }
    public int? Bitrate { get; set; }
    public string? Container { get; set; }
    
    // TV Show specific
    public Guid? SeriesId { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public int? AbsoluteNumber { get; set; }
    
    // Music specific
    public string? Artist { get; set; }
    public string? Album { get; set; }
    public int? TrackNumber { get; set; }
    public int? DiscNumber { get; set; }
    
    // Intro/Outro detection (Fprint module)
    public int? IntroStartSeconds { get; set; }
    public int? IntroEndSeconds { get; set; }
    public int? CreditsStartSeconds { get; set; }
    
    // Navigation
    public virtual Library Library { get; set; } = null!;
    public virtual MediaItem? Series { get; set; }
    public virtual ICollection<MediaItem> Episodes { get; set; } = new List<MediaItem>();
    public virtual ICollection<Subtitle> Subtitles { get; set; } = new List<Subtitle>();
    public virtual ICollection<WatchProgress> WatchProgress { get; set; } = new List<WatchProgress>();
}

/// <summary>
/// User watch progress tracking
/// </summary>
public class WatchProgress : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid MediaItemId { get; set; }
    public int PositionSeconds { get; set; }
    public int DurationSeconds { get; set; }
    public bool IsCompleted { get; set; }
    public int PlayCount { get; set; }
    public DateTime LastWatchedAt { get; set; } = DateTime.UtcNow;
    
    public virtual User User { get; set; } = null!;
    public virtual MediaItem MediaItem { get; set; } = null!;
}

/// <summary>
/// User watchlist
/// </summary>
public class Watchlist : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid MediaItemId { get; set; }
    public int SortOrder { get; set; }
    
    public virtual User User { get; set; } = null!;
    public virtual MediaItem MediaItem { get; set; } = null!;
}

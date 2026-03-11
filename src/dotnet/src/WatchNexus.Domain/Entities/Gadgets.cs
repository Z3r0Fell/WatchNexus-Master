namespace WatchNexus.Domain.Entities;

/// <summary>
/// Podcast subscription - Gadgets module
/// </summary>
public class PodcastSubscription : BaseEntity
{
    public Guid UserId { get; set; }
    public string FeedUrl { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? Author { get; set; }
    public int EpisodeCount { get; set; }
    public DateTime? LastUpdatedAt { get; set; }
    
    public virtual User User { get; set; } = null!;
    public virtual ICollection<PodcastEpisode> Episodes { get; set; } = new List<PodcastEpisode>();
}

/// <summary>
/// Podcast episode
/// </summary>
public class PodcastEpisode : BaseEntity
{
    public Guid SubscriptionId { get; set; }
    public string Guid { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string AudioUrl { get; set; } = string.Empty;
    public int? DurationSeconds { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsPlayed { get; set; }
    public int PlaybackPosition { get; set; }
    
    public virtual PodcastSubscription Subscription { get; set; } = null!;
}

/// <summary>
/// Radio station - Gadgets module
/// </summary>
public class RadioStation : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string StreamUrl { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? Country { get; set; }
    public string? Language { get; set; }
    public string? Genre { get; set; }
    public string? Codec { get; set; }
    public int? Bitrate { get; set; }
    public bool IsFavorite { get; set; }
    public Guid? UserId { get; set; } // Null for global stations
    
    public virtual User? User { get; set; }
}

/// <summary>
/// Photo library - Gadgets module
/// </summary>
public class PhotoLibrary : BaseEntity
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public int PhotoCount { get; set; }
    public DateTime? LastScannedAt { get; set; }
    
    public virtual User User { get; set; } = null!;
    public virtual ICollection<Photo> Photos { get; set; } = new List<Photo>();
}

/// <summary>
/// Photo
/// </summary>
public class Photo : BaseEntity
{
    public Guid LibraryId { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public DateTime? TakenAt { get; set; }
    public string? CameraMake { get; set; }
    public string? CameraModel { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? ThumbnailPath { get; set; }
    
    public virtual PhotoLibrary Library { get; set; } = null!;
}

/// <summary>
/// Web video bookmark - Gadgets module
/// </summary>
public class WebVideoBookmark : BaseEntity
{
    public Guid UserId { get; set; }
    public string Url { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public int? DurationSeconds { get; set; }
    public string? Platform { get; set; } // youtube, vimeo, etc.
    
    public virtual User User { get; set; } = null!;
}

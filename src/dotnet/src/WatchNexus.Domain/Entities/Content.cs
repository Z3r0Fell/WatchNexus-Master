using WatchNexus.Domain.Enums;

namespace WatchNexus.Domain.Entities;

/// <summary>
/// Subtitle file - Garnish module
/// </summary>
public class Subtitle : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public string Language { get; set; } = "en";
    public string LanguageCode { get; set; } = "eng";
    public string FilePath { get; set; } = string.Empty;
    public string Format { get; set; } = "srt"; // srt, vtt, ass, sub
    public bool IsForced { get; set; }
    public bool IsHearingImpaired { get; set; }
    public SubtitleProvider? Provider { get; set; }
    public string? ExternalId { get; set; }
    
    public virtual MediaItem MediaItem { get; set; } = null!;
}

/// <summary>
/// IPTV Source - Relish module
/// </summary>
public class IptvSource : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string M3uUrl { get; set; } = string.Empty;
    public string? EpgUrl { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastUpdatedAt { get; set; }
    public int ChannelCount { get; set; }
    
    public virtual ICollection<IptvChannel> Channels { get; set; } = new List<IptvChannel>();
}

/// <summary>
/// IPTV Channel
/// </summary>
public class IptvChannel : BaseEntity
{
    public Guid SourceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string StreamUrl { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? Group { get; set; }
    public string? TvgId { get; set; }
    public string? TvgName { get; set; }
    public int? ChannelNumber { get; set; }
    public bool IsFavorite { get; set; }
    
    public virtual IptvSource Source { get; set; } = null!;
}

/// <summary>
/// Playlist - Drizzle module
/// </summary>
public class Playlist : BaseEntity
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public string? CoverImage { get; set; }
    
    public virtual User User { get; set; } = null!;
    public virtual ICollection<PlaylistItem> Items { get; set; } = new List<PlaylistItem>();
}

/// <summary>
/// Playlist item
/// </summary>
public class PlaylistItem : BaseEntity
{
    public Guid PlaylistId { get; set; }
    public Guid MediaItemId { get; set; }
    public int SortOrder { get; set; }
    
    public virtual Playlist Playlist { get; set; } = null!;
    public virtual MediaItem MediaItem { get; set; } = null!;
}

/// <summary>
/// App settings key-value store
/// </summary>
public class AppSetting : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Category { get; set; }
    public Guid? UserId { get; set; } // Null for global settings
    
    public virtual User? User { get; set; }
}

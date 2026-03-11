using WatchNexus.Domain.Enums;

namespace WatchNexus.Domain.Entities;

/// <summary>
/// Download task - Fondue module
/// </summary>
public class Download : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? InfoHash { get; set; }
    public string? MagnetUri { get; set; }
    public string? TorrentFile { get; set; }
    public string SavePath { get; set; } = string.Empty;
    public DownloadStatus Status { get; set; } = DownloadStatus.Queued;
    public double Progress { get; set; }
    public long TotalSize { get; set; }
    public long DownloadedSize { get; set; }
    public long UploadedSize { get; set; }
    public int DownloadSpeed { get; set; }
    public int UploadSpeed { get; set; }
    public int Seeds { get; set; }
    public int Peers { get; set; }
    public double Ratio { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? CompletedAt { get; set; }
    
    // Link to requested media
    public Guid? MediaRequestId { get; set; }
    public virtual MediaRequest? MediaRequest { get; set; }
}

/// <summary>
/// Indexer configuration - Compote module
/// </summary>
public class Indexer : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public IndexerType Type { get; set; }
    public string Url { get; set; } = string.Empty;
    public string? ApiKey { get; set; }
    public bool IsEnabled { get; set; } = true;
    public int Priority { get; set; } = 50;
    public bool SupportsTvSearch { get; set; } = true;
    public bool SupportsMovieSearch { get; set; } = true;
    public bool SupportsMusicSearch { get; set; } = false;
    public bool SupportsBookSearch { get; set; } = false;
    public string? Categories { get; set; } // JSON array
    public DateTime? LastSuccessAt { get; set; }
    public DateTime? LastErrorAt { get; set; }
    public string? LastError { get; set; }
}

/// <summary>
/// Media request from users - Potluck module
/// </summary>
public class MediaRequest : BaseEntity
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public MediaType MediaType { get; set; }
    public string? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public int? Year { get; set; }
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public bool IsApproved { get; set; }
    public bool IsCompleted { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? Notes { get; set; }
    
    public virtual User User { get; set; } = null!;
    public virtual ICollection<Download> Downloads { get; set; } = new List<Download>();
}

/// <summary>
/// Quality profile for downloads - Sieve module
/// </summary>
public class QualityProfileEntity : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public QualityProfile MinQuality { get; set; } = QualityProfile.SD;
    public QualityProfile PreferredQuality { get; set; } = QualityProfile.HD1080p;
    public bool AllowUpgrades { get; set; } = true;
    public string? PreferredCodecs { get; set; } // JSON array
    public string? BlockedTerms { get; set; } // JSON array
    public string? RequiredTerms { get; set; } // JSON array
    public long MaxSizeBytes { get; set; }
}

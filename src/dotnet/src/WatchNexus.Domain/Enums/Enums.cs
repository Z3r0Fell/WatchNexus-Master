namespace WatchNexus.Domain.Enums;

public enum UserRole
{
    User = 0,
    Admin = 1,
    SuperAdmin = 2
}

public enum MediaType
{
    Movie,
    TvShow,
    Anime,
    Music,
    Podcast,
    Photo
}

public enum LibraryScanStatus
{
    Idle,
    Scanning,
    Completed,
    Failed
}

public enum DownloadStatus
{
    Queued,
    Downloading,
    Paused,
    Completed,
    Failed,
    Seeding
}

public enum QualityProfile
{
    SD,
    HD720p,
    HD1080p,
    UHD4K,
    Any
}

public enum IndexerType
{
    Torznab,
    Newznab,
    RSS
}

public enum SubtitleProvider
{
    OpenSubtitles,
    Addic7ed,
    Subscene,
    Podnapisi
}

public enum DatabaseProvider
{
    Sqlite,
    PostgreSQL,
    SqlServer
}

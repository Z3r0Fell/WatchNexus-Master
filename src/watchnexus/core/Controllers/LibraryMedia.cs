using System.Text.Json;
using System.Text.RegularExpressions;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Shared helpers for local library media: per-user scoping, TMDB matching
/// rules per library type, and SxxEyy episode parsing.
/// </summary>
internal static class LibraryMedia
{
    /// <summary>
    /// Media items visible to <paramref name="userId"/>. Libraries are strictly
    /// per-user (Library.UserId is required; there is no shared/global library
    /// concept — legacy unowned rows are handed to the first admin at startup),
    /// so an item is visible only if its library belongs to the caller.
    /// </summary>
    public static IQueryable<MediaItem> ForUser(AppDbContext db, string userId)
    {
        var libraryIds = db.Libraries.Where(l => l.UserId == userId).Select(l => l.Id);
        return db.MediaItems.Where(m => libraryIds.Contains(m.LibraryId));
    }

    /// <summary>
    /// TMDB search endpoints to try, in order, for a library media type. Anime
    /// is overwhelmingly series, so it searches TV first and falls back to
    /// movies (anime films). The matched kind is stored on MediaItem.TmdbKind.
    /// </summary>
    public static string[] TmdbSearchKinds(string? libraryMediaType) => (libraryMediaType ?? "").Trim().ToLowerInvariant() switch
    {
        "tv" or "episode" or "tv_shows" => new[] { "tv" },
        "anime" => new[] { "tv", "movie" },
        _ => new[] { "movie" },
    };

    public static string TmdbSearchUrl(string kind, string apiKey, string query, int? year)
    {
        var url = $"https://api.themoviedb.org/3/search/{kind}?api_key={apiKey}&query={Uri.EscapeDataString(query)}";
        if (year.HasValue) url += kind == "tv" ? $"&first_air_date_year={year}" : $"&year={year}";
        return url;
    }

    /// <summary>Searches TMDB in kind order and returns the first hit plus the kind it came from.</summary>
    public static async Task<(JsonElement first, string kind)?> SearchTmdbAsync(
        HttpClient http, string apiKey, string query, int? year, string? libraryMediaType)
    {
        foreach (var kind in TmdbSearchKinds(libraryMediaType))
        {
            try
            {
                using var resp = await http.GetAsync(TmdbSearchUrl(kind, apiKey, query, year));
                if (!resp.IsSuccessStatusCode) continue;
                using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
                if (doc.RootElement.TryGetProperty("results", out var results)
                    && results.ValueKind == JsonValueKind.Array && results.GetArrayLength() > 0)
                    return (results[0].Clone(), kind);
            }
            catch (HttpRequestException) { }
            catch (JsonException) { }
        }
        return null;
    }

    private static readonly Regex EpisodeRegex = new(@"[Ss](\d{1,2})[Ee](\d{1,3})", RegexOptions.Compiled);
    private static readonly Regex SeasonFolderRegex = new(@"^(season|series|s)\s*\d+$|^specials$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Parses SxxEyy from a file path (or title). Null if the item isn't an episode.</summary>
    public static (int season, int episode)? ParseEpisode(string? pathOrTitle)
    {
        var m = EpisodeRegex.Match(pathOrTitle ?? "");
        return m.Success ? (int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value)) : null;
    }

    /// <summary>The series folder of an episode file: its parent directory, skipping "Season N" folders.</summary>
    public static string SeriesFolder(string? filePath)
    {
        var dir = Path.GetDirectoryName(filePath ?? "") ?? "";
        var name = Path.GetFileName(dir);
        if (SeasonFolderRegex.IsMatch(name.Trim()))
            dir = Path.GetDirectoryName(dir) ?? dir;
        return dir;
    }
}

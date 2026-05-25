using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Saffron (Subtitles) ─────────────────────────────────────
[Route("api/subtitles")]
[ApiController]
[Authorize]
public class SubtitlesController : ControllerBase
{
    private readonly AppDbContext _db;
    public SubtitlesController(AppDbContext db) => _db = db;

    public record SubtitleResult(string Provider, string Title, string Language, string? DownloadUrl,
        string? FileFormat, int? Downloads, double? Rating, string? ReleaseInfo);

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var userId = this.UserId();
        var providers = new[] { "opensubtitles", "addic7ed", "subscene", "podnapisi", "yifysubtitles" };
        var result = new Dictionary<string, object>();
        foreach (var provider in providers)
        {
            var cfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == $"subtitle_{provider}");
            result[provider] = cfg?.Value != null ? JsonSerializer.Deserialize<object>(cfg.Value)! : new { enabled = false };
        }
        var langSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_languages");
        result["languages"] = langSetting?.Value != null ? JsonSerializer.Deserialize<string[]>(langSetting.Value)! : new[] { "en" };
        var autoSetting = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_auto_download");
        result["auto_download"] = autoSetting?.Value == "true";
        return Ok(result);
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        foreach (var prop in body.EnumerateObject())
        {
            var key = prop.Name == "languages" ? "subtitle_languages" :
                prop.Name == "auto_download" ? "subtitle_auto_download" : $"subtitle_{prop.Name}";
            var value = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString()! : prop.Value.GetRawText();
            var existing = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == key);
            if (existing != null) existing.Value = value;
            else _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, Value = value, UserId = userId });
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    // Generic search endpoint — delegates to movie or tv based on media_type
    [HttpGet("search")]
    public Task<IActionResult> Search(
        [FromQuery] string? query = null,
        [FromQuery] string? media_type = "movie",
        [FromQuery] int? year = null,
        [FromQuery] string? imdb_id = null,
        [FromQuery] string languages = "en")
    {
        if (media_type == "tv")
            return SearchTv(show_name: query ?? "", languages: languages);
        return SearchMovie(movie_name: query ?? "", year: year, imdb_id: imdb_id, languages: languages);
    }


    [HttpGet("search/movie")]
    public async Task<IActionResult> SearchMovie([FromQuery] string movie_name = "",
        [FromQuery] int? year = null, [FromQuery] string? imdb_id = null, [FromQuery] string languages = "en")
    {
        var results = new List<SubtitleResult>();
        var userId = this.UserId();
        var osCfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_opensubtitles");
        if (osCfg?.Value != null)
        {
            try
            {
                var cfg = JsonDocument.Parse(osCfg.Value).RootElement;
                if (cfg.TryGetProperty("enabled", out var en) && en.GetBoolean())
                {
                    var apiKey = cfg.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
                    if (!string.IsNullOrEmpty(apiKey))
                        results.AddRange(await SearchOpenSubtitles(apiKey, movie_name, null, null, null, imdb_id, languages));
                }
            }
            catch { }
        }
        try { results.AddRange(await SearchPodnapisi(movie_name, year, null, null, languages)); } catch { }
        return Ok(results.Select(r => new
        {
            r.Provider, r.Title, r.Language, download_url = r.DownloadUrl,
            file_format = r.FileFormat, r.Downloads, r.Rating, release_info = r.ReleaseInfo
        }));
    }

    [HttpGet("search/tv")]
    public async Task<IActionResult> SearchTv([FromQuery] string show_name = "",
        [FromQuery] int season = 1, [FromQuery] int episode = 1, [FromQuery] string languages = "en")
    {
        var results = new List<SubtitleResult>();
        var userId = this.UserId();
        var osCfg = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "subtitle_opensubtitles");
        if (osCfg?.Value != null)
        {
            try
            {
                var cfg = JsonDocument.Parse(osCfg.Value).RootElement;
                if (cfg.TryGetProperty("enabled", out var en) && en.GetBoolean())
                {
                    var apiKey = cfg.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
                    if (!string.IsNullOrEmpty(apiKey))
                        results.AddRange(await SearchOpenSubtitles(apiKey, show_name, season, episode, null, null, languages));
                }
            }
            catch { }
        }
        try { results.AddRange(await SearchPodnapisi(show_name, null, season, episode, languages)); } catch { }
        return Ok(results);
    }

    [HttpPost("download")]
    public async Task<IActionResult> DownloadSubtitle(
        [FromQuery] string? download_url,
        [FromQuery] string? source,
        [FromQuery] string? media_id,
        [FromQuery] string? media_path)
    {
        if (string.IsNullOrEmpty(download_url)) return BadRequest(new { detail = "download_url required" });
        try
        {
            var http = this.Http();
            var data = await http.GetByteArrayAsync(download_url);
            if (!string.IsNullOrEmpty(media_path))
            {
                var srtPath = Path.ChangeExtension(media_path, ".srt");
                await System.IO.File.WriteAllBytesAsync(srtPath, data);
                return Ok(new { status = "downloaded", path = srtPath, size = data.Length, source, media_id });
            }
            return Ok(new { status = "downloaded", size = data.Length, source, media_id, data_base64 = Convert.ToBase64String(data) });
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("file/{*filePath}")]
    public IActionResult ServeSubtitle(string filePath)
    {
        var full = "/" + filePath;
        if (!System.IO.File.Exists(full)) return NotFound();
        return PhysicalFile(full, "text/plain");
    }

    private async Task<List<SubtitleResult>> SearchOpenSubtitles(string apiKey, string query,
        int? season, int? episode, int? year, string? imdbId, string languages)
    {
        var results = new List<SubtitleResult>();
        var http = this.Http();
        http.DefaultRequestHeaders.Add("Api-Key", apiKey);
        http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus v1.0.0");
        var url = $"https://api.opensubtitles.com/api/v1/subtitles?query={Uri.EscapeDataString(query)}&languages={languages}";
        if (season.HasValue) url += $"&season_number={season}";
        if (episode.HasValue) url += $"&episode_number={episode}";
        if (!string.IsNullOrEmpty(imdbId)) url += $"&imdb_id={imdbId}";
        try
        {
            var resp = await http.GetStringAsync(url);
            var doc = JsonDocument.Parse(resp);
            if (doc.RootElement.TryGetProperty("data", out var data))
            {
                foreach (var item in data.EnumerateArray().Take(25))
                {
                    var attrs = item.GetProperty("attributes");
                    results.Add(new SubtitleResult(
                        "OpenSubtitles",
                        attrs.TryGetProperty("feature_details", out var fd) && fd.TryGetProperty("title", out var t) ? t.GetString() ?? query : query,
                        attrs.TryGetProperty("language", out var l) ? l.GetString() ?? "en" : "en",
                        attrs.TryGetProperty("url", out var u) ? u.GetString() : null,
                        attrs.TryGetProperty("format", out var f) ? f.GetString() : "srt",
                        attrs.TryGetProperty("download_count", out var dc) ? dc.GetInt32() : 0,
                        attrs.TryGetProperty("ratings", out var r) ? r.GetDouble() : null,
                        attrs.TryGetProperty("release", out var rel) ? rel.GetString() : null
                    ));
                }
            }
        }
        catch { }
        return results;
    }

    private async Task<List<SubtitleResult>> SearchPodnapisi(string query, int? year, int? season, int? episode, string languages)
    {
        var results = new List<SubtitleResult>();
        var http = this.Http();
        var url = $"https://www.podnapisi.net/subtitles/search/old?sXML=1&sK={Uri.EscapeDataString(query)}&sJ={MapLanguageCode(languages)}";
        if (year.HasValue) url += $"&sY={year}";
        if (season.HasValue) url += $"&sTS={season}";
        if (episode.HasValue) url += $"&sTE={episode}";
        try
        {
            var resp = await http.GetStringAsync(url);
            var xdoc = System.Xml.Linq.XDocument.Parse(resp);
            foreach (var sub in xdoc.Descendants("subtitle").Take(15))
            {
                results.Add(new SubtitleResult(
                    "Podnapisi",
                    sub.Element("title")?.Value ?? query,
                    sub.Element("language")?.Value ?? "en",
                    sub.Element("url")?.Value,
                    "srt",
                    int.TryParse(sub.Element("downloads")?.Value, out var dc) ? dc : 0,
                    double.TryParse(sub.Element("rating")?.Value, out var r) ? r : null,
                    sub.Element("release")?.Value
                ));
            }
        }
        catch { }
        return results;
    }

    private static string MapLanguageCode(string lang) => lang switch
    {
        "en" => "2", "es" => "28", "fr" => "8", "de" => "5",
        "it" => "9", "pt" => "26", "nl" => "13", "pl" => "23",
        "ru" => "27", "ja" => "11", "ko" => "4", "zh" => "17",
        "ar" => "29", "tr" => "30", _ => "2"
    };
}

using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Enums;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.Infrastructure.Services;

/// <summary>
/// TMDB Metadata service implementation
/// </summary>
public class TmdbMetadataService : IMetadataService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<TmdbMetadataService> _logger;
    private readonly string _apiKey;
    private const string BaseUrl = "https://api.themoviedb.org/3";
    private const string ImageBaseUrl = "https://image.tmdb.org/t/p";

    public TmdbMetadataService(HttpClient httpClient, IConfiguration config, ILogger<TmdbMetadataService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = config["Tmdb:ApiKey"] ?? "";
    }

    public async Task<MediaItem?> FetchMovieMetadataAsync(string title, int? year = null, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey)) return null;

        try
        {
            var query = Uri.EscapeDataString(title);
            var yearParam = year.HasValue ? $"&year={year}" : "";
            var url = $"{BaseUrl}/search/movie?api_key={_apiKey}&query={query}{yearParam}";

            var response = await _httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            var doc = JsonDocument.Parse(json);
            var results = doc.RootElement.GetProperty("results");

            if (results.GetArrayLength() == 0) return null;

            var movie = results[0];
            var tmdbId = movie.GetProperty("id").GetInt32().ToString();

            // Get detailed info
            var detailUrl = $"{BaseUrl}/movie/{tmdbId}?api_key={_apiKey}&append_to_response=credits";
            var detailResponse = await _httpClient.GetAsync(detailUrl, ct);
            if (!detailResponse.IsSuccessStatusCode) return null;

            var detailJson = await detailResponse.Content.ReadAsStringAsync(ct);
            var detail = JsonDocument.Parse(detailJson).RootElement;

            return new MediaItem
            {
                Title = detail.GetProperty("title").GetString() ?? title,
                OriginalTitle = detail.TryGetProperty("original_title", out var ot) ? ot.GetString() : null,
                Overview = detail.TryGetProperty("overview", out var o) ? o.GetString() : null,
                Tagline = detail.TryGetProperty("tagline", out var t) ? t.GetString() : null,
                Year = detail.TryGetProperty("release_date", out var rd) && !string.IsNullOrEmpty(rd.GetString()) 
                    ? int.Parse(rd.GetString()![..4]) : null,
                ReleaseDate = detail.TryGetProperty("release_date", out var rdd) && DateTime.TryParse(rdd.GetString(), out var dt) 
                    ? dt : null,
                RuntimeMinutes = detail.TryGetProperty("runtime", out var rt) ? rt.GetInt32() : null,
                Rating = detail.TryGetProperty("vote_average", out var va) ? va.GetDouble() : null,
                VoteCount = detail.TryGetProperty("vote_count", out var vc) ? vc.GetInt32() : null,
                TmdbId = tmdbId,
                ImdbId = detail.TryGetProperty("imdb_id", out var imdb) ? imdb.GetString() : null,
                PosterPath = detail.TryGetProperty("poster_path", out var pp) && pp.GetString() != null 
                    ? $"{ImageBaseUrl}/w500{pp.GetString()}" : null,
                BackdropPath = detail.TryGetProperty("backdrop_path", out var bp) && bp.GetString() != null 
                    ? $"{ImageBaseUrl}/original{bp.GetString()}" : null,
                Genres = detail.TryGetProperty("genres", out var g) 
                    ? string.Join(", ", g.EnumerateArray().Select(x => x.GetProperty("name").GetString())) : null,
                MediaType = MediaType.Movie
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch movie metadata for {Title}", title);
            return null;
        }
    }

    public async Task<MediaItem?> FetchTvShowMetadataAsync(string title, int? year = null, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey)) return null;

        try
        {
            var query = Uri.EscapeDataString(title);
            var yearParam = year.HasValue ? $"&first_air_date_year={year}" : "";
            var url = $"{BaseUrl}/search/tv?api_key={_apiKey}&query={query}{yearParam}";

            var response = await _httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            var doc = JsonDocument.Parse(json);
            var results = doc.RootElement.GetProperty("results");

            if (results.GetArrayLength() == 0) return null;

            var show = results[0];
            var tmdbId = show.GetProperty("id").GetInt32().ToString();

            var detailUrl = $"{BaseUrl}/tv/{tmdbId}?api_key={_apiKey}";
            var detailResponse = await _httpClient.GetAsync(detailUrl, ct);
            if (!detailResponse.IsSuccessStatusCode) return null;

            var detailJson = await detailResponse.Content.ReadAsStringAsync(ct);
            var detail = JsonDocument.Parse(detailJson).RootElement;

            return new MediaItem
            {
                Title = detail.GetProperty("name").GetString() ?? title,
                OriginalTitle = detail.TryGetProperty("original_name", out var on) ? on.GetString() : null,
                Overview = detail.TryGetProperty("overview", out var o) ? o.GetString() : null,
                Year = detail.TryGetProperty("first_air_date", out var fad) && !string.IsNullOrEmpty(fad.GetString()) 
                    ? int.Parse(fad.GetString()![..4]) : null,
                Rating = detail.TryGetProperty("vote_average", out var va) ? va.GetDouble() : null,
                VoteCount = detail.TryGetProperty("vote_count", out var vc) ? vc.GetInt32() : null,
                TmdbId = tmdbId,
                PosterPath = detail.TryGetProperty("poster_path", out var pp) && pp.GetString() != null 
                    ? $"{ImageBaseUrl}/w500{pp.GetString()}" : null,
                BackdropPath = detail.TryGetProperty("backdrop_path", out var bp) && bp.GetString() != null 
                    ? $"{ImageBaseUrl}/original{bp.GetString()}" : null,
                Genres = detail.TryGetProperty("genres", out var g) 
                    ? string.Join(", ", g.EnumerateArray().Select(x => x.GetProperty("name").GetString())) : null,
                MediaType = MediaType.TvShow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch TV show metadata for {Title}", title);
            return null;
        }
    }

    public async Task<MediaItem?> FetchEpisodeMetadataAsync(string tmdbId, int season, int episode, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey)) return null;

        try
        {
            var url = $"{BaseUrl}/tv/{tmdbId}/season/{season}/episode/{episode}?api_key={_apiKey}";
            var response = await _httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            var ep = JsonDocument.Parse(json).RootElement;

            return new MediaItem
            {
                Title = ep.GetProperty("name").GetString() ?? $"Episode {episode}",
                Overview = ep.TryGetProperty("overview", out var o) ? o.GetString() : null,
                SeasonNumber = season,
                EpisodeNumber = episode,
                RuntimeMinutes = ep.TryGetProperty("runtime", out var rt) ? rt.GetInt32() : null,
                Rating = ep.TryGetProperty("vote_average", out var va) ? va.GetDouble() : null,
                PosterPath = ep.TryGetProperty("still_path", out var sp) && sp.GetString() != null 
                    ? $"{ImageBaseUrl}/w500{sp.GetString()}" : null,
                MediaType = MediaType.TvShow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch episode metadata for {TmdbId} S{Season}E{Episode}", tmdbId, season, episode);
            return null;
        }
    }

    public async Task<byte[]?> DownloadImageAsync(string path, CancellationToken ct = default)
    {
        try
        {
            var response = await _httpClient.GetAsync(path, ct);
            if (!response.IsSuccessStatusCode) return null;
            return await response.Content.ReadAsByteArrayAsync(ct);
        }
        catch
        {
            return null;
        }
    }
}

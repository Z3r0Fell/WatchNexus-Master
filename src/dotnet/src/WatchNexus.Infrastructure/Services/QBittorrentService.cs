using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.Infrastructure.Services;

/// <summary>
/// qBittorrent download client - Fondue implementation
/// </summary>
public class QBittorrentService : IDownloadService
{
    private readonly HttpClient _httpClient;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<QBittorrentService> _logger;
    private readonly string _host;
    private readonly int _port;
    private readonly string _username;
    private readonly string _password;
    private string? _sid;

    public QBittorrentService(HttpClient httpClient, IUnitOfWork unitOfWork, IConfiguration config, ILogger<QBittorrentService> logger)
    {
        _httpClient = httpClient;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _host = config["QBittorrent:Host"] ?? "localhost";
        _port = int.Parse(config["QBittorrent:Port"] ?? "8080");
        _username = config["QBittorrent:Username"] ?? "admin";
        _password = config["QBittorrent:Password"] ?? "adminadmin";
    }

    private string BaseUrl => $"http://{_host}:{_port}/api/v2";

    public async Task<Download> AddDownloadAsync(string magnetUri, string savePath, CancellationToken ct = default)
    {
        await EnsureAuthenticatedAsync(ct);

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("urls", magnetUri),
            new KeyValuePair<string, string>("savepath", savePath)
        });

        var response = await _httpClient.PostAsync($"{BaseUrl}/torrents/add", content, ct);
        response.EnsureSuccessStatusCode();

        // Extract hash from magnet
        var hash = ExtractHashFromMagnet(magnetUri);

        var download = new Download
        {
            Name = magnetUri,
            MagnetUri = magnetUri,
            InfoHash = hash,
            SavePath = savePath,
            Status = Domain.Enums.DownloadStatus.Queued
        };

        await _unitOfWork.Downloads.AddAsync(download, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return download;
    }

    public async Task<Download> AddTorrentFileAsync(byte[] torrentFile, string savePath, CancellationToken ct = default)
    {
        await EnsureAuthenticatedAsync(ct);

        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(torrentFile), "torrents", "file.torrent");
        content.Add(new StringContent(savePath), "savepath");

        var response = await _httpClient.PostAsync($"{BaseUrl}/torrents/add", content, ct);
        response.EnsureSuccessStatusCode();

        var download = new Download
        {
            Name = "Torrent file",
            SavePath = savePath,
            Status = Domain.Enums.DownloadStatus.Queued
        };

        await _unitOfWork.Downloads.AddAsync(download, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return download;
    }

    public async Task PauseAsync(Guid downloadId, CancellationToken ct = default)
    {
        var download = await _unitOfWork.Downloads.GetByIdAsync(downloadId, ct);
        if (download?.InfoHash == null) return;

        await EnsureAuthenticatedAsync(ct);

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("hashes", download.InfoHash)
        });

        await _httpClient.PostAsync($"{BaseUrl}/torrents/pause", content, ct);

        download.Status = Domain.Enums.DownloadStatus.Paused;
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task ResumeAsync(Guid downloadId, CancellationToken ct = default)
    {
        var download = await _unitOfWork.Downloads.GetByIdAsync(downloadId, ct);
        if (download?.InfoHash == null) return;

        await EnsureAuthenticatedAsync(ct);

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("hashes", download.InfoHash)
        });

        await _httpClient.PostAsync($"{BaseUrl}/torrents/resume", content, ct);

        download.Status = Domain.Enums.DownloadStatus.Downloading;
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid downloadId, bool deleteFiles = false, CancellationToken ct = default)
    {
        var download = await _unitOfWork.Downloads.GetByIdAsync(downloadId, ct);
        if (download == null) return;

        if (download.InfoHash != null)
        {
            await EnsureAuthenticatedAsync(ct);

            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("hashes", download.InfoHash),
                new KeyValuePair<string, string>("deleteFiles", deleteFiles.ToString().ToLower())
            });

            await _httpClient.PostAsync($"{BaseUrl}/torrents/delete", content, ct);
        }

        await _unitOfWork.Downloads.DeleteAsync(download, ct);
        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<IEnumerable<Download>> GetAllDownloadsAsync(CancellationToken ct = default)
    {
        await EnsureAuthenticatedAsync(ct);
        await SyncDownloadsAsync(ct);
        return await _unitOfWork.Downloads.GetAllAsync(ct);
    }

    private async Task SyncDownloadsAsync(CancellationToken ct)
    {
        try
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/torrents/info", ct);
            if (!response.IsSuccessStatusCode) return;

            var json = await response.Content.ReadAsStringAsync(ct);
            var torrents = JsonDocument.Parse(json).RootElement;

            foreach (var torrent in torrents.EnumerateArray())
            {
                var hash = torrent.GetProperty("hash").GetString();
                if (string.IsNullOrEmpty(hash)) continue;

                var download = await _unitOfWork.Downloads.FirstOrDefaultAsync(d => d.InfoHash == hash, ct);
                if (download == null) continue;

                download.Name = torrent.GetProperty("name").GetString() ?? download.Name;
                download.Progress = torrent.GetProperty("progress").GetDouble() * 100;
                download.TotalSize = torrent.GetProperty("size").GetInt64();
                download.DownloadedSize = (long)(download.TotalSize * torrent.GetProperty("progress").GetDouble());
                download.DownloadSpeed = torrent.GetProperty("dlspeed").GetInt32();
                download.UploadSpeed = torrent.GetProperty("upspeed").GetInt32();
                download.Seeds = torrent.GetProperty("num_seeds").GetInt32();
                download.Peers = torrent.GetProperty("num_leechs").GetInt32();
                download.Ratio = torrent.GetProperty("ratio").GetDouble();

                var state = torrent.GetProperty("state").GetString();
                download.Status = state switch
                {
                    "downloading" or "stalledDL" or "metaDL" => Domain.Enums.DownloadStatus.Downloading,
                    "uploading" or "stalledUP" => Domain.Enums.DownloadStatus.Seeding,
                    "pausedDL" or "pausedUP" => Domain.Enums.DownloadStatus.Paused,
                    "checkingDL" or "checkingUP" or "checkingResumeData" => Domain.Enums.DownloadStatus.Downloading,
                    "queuedDL" or "queuedUP" => Domain.Enums.DownloadStatus.Queued,
                    "error" or "missingFiles" => Domain.Enums.DownloadStatus.Failed,
                    _ => download.Status
                };

                if (download.Progress >= 100 && download.Status != Domain.Enums.DownloadStatus.Failed)
                {
                    download.Status = Domain.Enums.DownloadStatus.Completed;
                    download.CompletedAt ??= DateTime.UtcNow;
                }
            }

            await _unitOfWork.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sync downloads from qBittorrent");
        }
    }

    private async Task EnsureAuthenticatedAsync(CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(_sid)) return;

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("username", _username),
            new KeyValuePair<string, string>("password", _password)
        });

        var response = await _httpClient.PostAsync($"{BaseUrl}/auth/login", content, ct);
        response.EnsureSuccessStatusCode();

        // qBittorrent sets a cookie
        if (response.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            foreach (var cookie in cookies)
            {
                if (cookie.StartsWith("SID="))
                {
                    _sid = cookie.Split(';')[0].Substring(4);
                    _httpClient.DefaultRequestHeaders.Add("Cookie", $"SID={_sid}");
                    break;
                }
            }
        }
    }

    private static string? ExtractHashFromMagnet(string magnetUri)
    {
        var match = System.Text.RegularExpressions.Regex.Match(magnetUri, @"xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})");
        return match.Success ? match.Groups[1].Value.ToLower() : null;
    }
}

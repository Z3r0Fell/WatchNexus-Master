using System.Net;
using System.Text.Json;
using WatchNexus.Core.Auth;

namespace WatchNexus.Core.Services;

/// <summary>
/// Thin qBittorrent Web API (v2) client used by the download-engine facade
/// (<c>/api/downloads/engine/*</c>). Reads the same per-user <c>qbit_config</c>
/// row that <c>QBittorrentController</c> writes, so there is a single source of
/// truth for the configured download client.
/// </summary>
public sealed class QBittorrentClient
{
    public sealed record Config(string Host, int Port, string Username, string Password);

    private readonly HttpClient _http;
    private readonly Config _cfg;
    private string? _cookie;

    public QBittorrentClient(HttpClient http, Config cfg)
    {
        _http = http;
        _cfg = cfg;
    }

    public string BaseUrl => $"http://{_cfg.Host}:{_cfg.Port}/api/v2";
    public bool HostBlocked => SsrfGuard.IsBlocked(_cfg.Host);

    /// <summary>Parses the stored <c>qbit_config</c> JSON; returns null when absent/invalid.</summary>
    public static Config? ParseConfig(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var doc = JsonDocument.Parse(json).RootElement;
            var host = doc.TryGetProperty("host", out var h) ? h.GetString() : null;
            var port = doc.TryGetProperty("port", out var p) && p.TryGetInt32(out var pi) ? pi : 8080;
            var user = doc.TryGetProperty("username", out var u) ? u.GetString() : "";
            var pass = doc.TryGetProperty("password", out var pw) ? pw.GetString() : "";
            return new Config(string.IsNullOrWhiteSpace(host) ? "localhost" : host!, port, user ?? "", pass ?? "");
        }
        // InvalidOperationException: a field of the wrong JSON type (e.g. "host": 123)
        // — GetString() throws, which previously escaped as a 500.
        catch (Exception ex) when (ex is JsonException or InvalidOperationException) { return null; }
    }

    public async Task<string?> GetVersionAsync(CancellationToken ct = default)
    {
        var resp = await SendAsync(HttpMethod.Get, "app/version", null, ct);
        return resp.IsSuccessStatusCode ? (await resp.Content.ReadAsStringAsync(ct)).Trim() : null;
    }

    /// <summary>Logs in and caches the SID cookie. Returns false on bad credentials.</summary>
    public async Task<bool> LoginAsync(CancellationToken ct = default)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/auth/login")
        {
            Content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("username", _cfg.Username),
                new KeyValuePair<string, string>("password", _cfg.Password),
            })
        };
        var resp = await _http.SendAsync(req, ct);
        if (resp.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            var sid = cookies.FirstOrDefault();
            if (!string.IsNullOrEmpty(sid))
            {
                _cookie = sid.Split(';')[0];
                return true;
            }
        }
        return false;
    }

    public async Task<JsonElement> GetJsonAsync(string path, CancellationToken ct = default)
    {
        var resp = await SendAsync(HttpMethod.Get, path, null, ct);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadAsStringAsync(ct);
        return JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "[]" : body).RootElement.Clone();
    }

    public Task<HttpResponseMessage> PostFormAsync(string path, IEnumerable<KeyValuePair<string, string>> form, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, path, new FormUrlEncodedContent(form), ct);

    public Task<HttpResponseMessage> PostMultipartAsync(string path, MultipartFormDataContent content, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, path, content, ct);

    /// <summary>
    /// qBittorrent 5.x renamed torrents/pause|resume to torrents/stop|start.
    /// Try the legacy name first and fall back on 404 so both versions work.
    /// </summary>
    public async Task<HttpResponseMessage> PauseOrResumeAsync(bool pause, string hashes, CancellationToken ct = default)
    {
        var form = new[] { new KeyValuePair<string, string>("hashes", hashes) };
        var resp = await PostFormAsync(pause ? "torrents/pause" : "torrents/resume", form, ct);
        if (resp.StatusCode == HttpStatusCode.NotFound)
            resp = await PostFormAsync(pause ? "torrents/stop" : "torrents/start", form, ct);
        return resp;
    }

    private Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, HttpContent? content, CancellationToken ct)
    {
        var req = new HttpRequestMessage(method, $"{BaseUrl}/{path}") { Content = content };
        if (_cookie != null) req.Headers.Add("Cookie", _cookie);
        return _http.SendAsync(req, ct);
    }

    // ── Shape mapping (qBittorrent → engine shape the Downloads UI renders) ──

    public static string MapState(string? qbitState) => qbitState switch
    {
        "downloading" or "stalledDL" or "forcedDL" => "downloading",
        "metaDL" or "forcedMetaDL" => "downloading_metadata",
        "pausedDL" or "stoppedDL" or "pausedUP" or "stoppedUP" => "paused",
        "uploading" or "stalledUP" or "forcedUP" => "seeding",
        "queuedDL" or "queuedUP" => "queued",
        "checkingDL" or "checkingUP" or "checkingResumeData" or "moving" => "checking",
        "allocating" => "allocating",
        "error" or "missingFiles" => "error",
        null or "" => "unknown",
        _ => qbitState,
    };

    public static Dictionary<string, object?> MapTorrent(JsonElement t)
    {
        string? Str(string n) => t.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        long Long(string n) => t.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var l) ? l : 0;
        double Dbl(string n) => t.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : 0;
        bool Bool(string n) => t.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.True;

        var hash = Str("hash") ?? "";
        var raw = Str("state");
        var dl = Long("dlspeed");
        var up = Long("upspeed");
        var size = Long("size") > 0 ? Long("size") : Long("total_size");
        var eta = Long("eta");
        return new Dictionary<string, object?>
        {
            ["id"] = hash,
            ["info_hash"] = hash,
            ["name"] = Str("name") ?? "Unknown",
            ["state"] = MapState(raw),
            ["raw_state"] = raw,
            ["progress"] = Math.Round(Dbl("progress") * 100, 1),
            ["download_rate"] = dl,
            ["upload_rate"] = up,
            ["download_rate_formatted"] = FormatBytes(dl) + "/s",
            ["upload_rate_formatted"] = FormatBytes(up) + "/s",
            ["total_size"] = size,
            ["total_size_formatted"] = FormatBytes(size),
            ["eta"] = eta,
            ["eta_formatted"] = FormatEta(eta),
            ["num_seeds"] = Long("num_seeds"),
            ["num_peers"] = Long("num_leechs"),
            ["sequential"] = Bool("seq_dl"),
            ["save_path"] = Str("save_path"),
            ["category"] = Str("category"),
            ["added_on"] = Long("added_on"),
        };
    }

    public static Dictionary<string, object?> MapFile(JsonElement f, int fallbackIndex)
    {
        var size = f.TryGetProperty("size", out var s) && s.TryGetInt64(out var sl) ? sl : 0;
        var progress = f.TryGetProperty("progress", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetDouble() : 0;
        return new Dictionary<string, object?>
        {
            ["index"] = f.TryGetProperty("index", out var i) && i.TryGetInt32(out var ii) ? ii : fallbackIndex,
            ["path"] = f.TryGetProperty("name", out var n) ? n.GetString() : null,
            ["size"] = size,
            ["size_formatted"] = FormatBytes(size),
            ["progress"] = Math.Round(progress * 100, 1),
        };
    }

    public static string FormatBytes(long bytes)
    {
        if (bytes <= 0) return "0 B";
        string[] units = { "B", "KB", "MB", "GB", "TB" };
        double v = bytes;
        var u = 0;
        while (v >= 1024 && u < units.Length - 1) { v /= 1024; u++; }
        return u == 0 ? $"{bytes} B" : v.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + " " + units[u];
    }

    public static string FormatEta(long seconds)
    {
        // qBittorrent reports 8640000 (100 days) for "infinite".
        if (seconds <= 0 || seconds >= 8640000) return "∞";
        var ts = TimeSpan.FromSeconds(seconds);
        if (ts.TotalDays >= 1) return $"{(int)ts.TotalDays}d {ts.Hours}h";
        if (ts.TotalHours >= 1) return $"{(int)ts.TotalHours}h {ts.Minutes}m";
        if (ts.TotalMinutes >= 1) return $"{ts.Minutes}m {ts.Seconds}s";
        return $"{ts.Seconds}s";
    }
}

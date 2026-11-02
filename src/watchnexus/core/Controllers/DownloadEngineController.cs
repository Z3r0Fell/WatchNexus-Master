using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;
using WatchNexus.Core.Services;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Download engine facade backing the Downloads page and Download settings
/// (<c>torrentEngineApi</c> / <c>downloadApi</c> in the frontend).
///
/// WatchNexus does not ship a built-in torrent engine. Instead this controller
/// adapts the engine API onto the configured download client (qBittorrent, via
/// the per-user <c>qbit_config</c> row). Capabilities with no backing
/// implementation return <c>501 {error, code:"not_supported"}</c> rather than a
/// bare 404, and <c>GET status</c> always answers 200 with <c>configured</c> /
/// <c>status</c> so the UI can render a "configure a download client" state.
///
/// Because qBittorrent is an Ultra-tier module (FortressFilter gates
/// <c>/api/qbittorrent/*</c>), delegation enforces the same tier here so this
/// route can't be used to bypass the license gate.
/// </summary>
[Route("api/downloads/engine")]
[ApiController]
[Authorize]
public class DownloadEngineController : ControllerBase
{
    private const string ClientName = "qbittorrent";
    private static readonly Regex HashPattern = new("^([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$", RegexOptions.Compiled);
    private static readonly Dictionary<string, int> TierRank = new() { ["standard"] = 0, ["pro"] = 1, ["ultra"] = 2 };

    private readonly AppDbContext _db;
    public DownloadEngineController(AppDbContext db) => _db = db;

    // ── Status ─────────────────────────────────────────────

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var (locked, required, current) = await CheckTierAsync();
        var cfg = await LoadConfigAsync(ct);

        object Result(string status, bool configured, bool connected, string message, string? version = null) => new
        {
            success = connected,
            status,
            configured,
            connected,
            client = configured ? ClientName : null,
            engine = configured ? "qBittorrent" : null,
            version,
            builtin_available = false,
            required_tier = locked ? required : null,
            current_tier = locked ? current : null,
            message,
        };

        if (locked)
            return Ok(Result("tier_locked", cfg != null, false, $"Download clients require a {required} license."));
        if (cfg == null)
            return Ok(Result("not_configured", false, false, "No download client is configured. Connect qBittorrent in Settings → Downloads."));

        var client = new QBittorrentClient(this.Http(), cfg);
        if (client.HostBlocked)
            return Ok(Result("blocked", true, false, "The configured qBittorrent host is not allowed."));
        try
        {
            if (!await client.LoginAsync(ct))
                return Ok(Result("auth_failed", true, false, "qBittorrent rejected the saved credentials."));
            var version = await client.GetVersionAsync(ct);
            return version != null
                ? Ok(Result("connected", true, true, $"Connected to qBittorrent {version}", version))
                : Ok(Result("unreachable", true, false, "qBittorrent did not respond."));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return Ok(Result("unreachable", true, false, $"Could not reach qBittorrent: {ex.Message}"));
        }
    }

    // ── Torrents ───────────────────────────────────────────

    [HttpGet("torrents")]
    public Task<IActionResult> Torrents(CancellationToken ct) => WithClient(async client =>
    {
        var list = await client.GetJsonAsync("torrents/info", ct);
        return Ok(Items(list).Select(QBittorrentClient.MapTorrent).ToList());
    }, ct);

    [HttpGet("{id}")]
    public Task<IActionResult> GetTorrent(string id, CancellationToken ct) => WithHash(id, ct, async client =>
    {
        var list = await client.GetJsonAsync($"torrents/info?hashes={id}", ct);
        var first = Items(list).FirstOrDefault();
        return first.ValueKind == JsonValueKind.Undefined
            ? NotFound(new { error = "Torrent not found", code = "not_found" })
            : Ok(QBittorrentClient.MapTorrent(first));
    });

    [HttpGet("{id}/files")]
    public Task<IActionResult> Files(string id, CancellationToken ct) => WithHash(id, ct, async client =>
    {
        var list = await client.GetJsonAsync($"torrents/files?hash={id}", ct);
        return Ok(Items(list).Select((f, i) => QBittorrentClient.MapFile(f, i)).ToList());
    });

    [HttpPost("add")]
    public Task<IActionResult> Add(
        [FromQuery] string? magnet,
        [FromQuery(Name = "save_path")] string? savePath,
        [FromQuery] bool sequential = false,
        [FromQuery] string? category = "watchnexus",
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(magnet) ||
            !(magnet.StartsWith("magnet:", StringComparison.OrdinalIgnoreCase) ||
              magnet.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
              magnet.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
            return Task.FromResult<IActionResult>(BadRequest(new { error = "A magnet link or torrent URL is required", code = "invalid_request" }));

        return WithClient(async client =>
        {
            var content = new MultipartFormDataContent { { new StringContent(magnet), "urls" } };
            if (!string.IsNullOrWhiteSpace(savePath)) content.Add(new StringContent(savePath), "savepath");
            if (!string.IsNullOrWhiteSpace(category)) content.Add(new StringContent(category), "category");
            if (sequential) content.Add(new StringContent("true"), "sequentialDownload");
            var resp = await client.PostMultipartAsync("torrents/add", content, ct);
            return Upstream(resp, new { status = "added" });
        }, ct);
    }

    [HttpPost("{id}/pause")]
    public Task<IActionResult> Pause(string id, CancellationToken ct) => WithHash(id, ct, async client =>
        Upstream(await client.PauseOrResumeAsync(true, id, ct), new { status = "paused" }));

    [HttpPost("{id}/resume")]
    public Task<IActionResult> Resume(string id, CancellationToken ct) => WithHash(id, ct, async client =>
        Upstream(await client.PauseOrResumeAsync(false, id, ct), new { status = "resumed" }));

    [HttpDelete("{id}")]
    public Task<IActionResult> Remove(string id, [FromQuery(Name = "delete_files")] bool deleteFiles = false, CancellationToken ct = default) =>
        WithHash(id, ct, async client => Upstream(await client.PostFormAsync("torrents/delete", new[]
        {
            new KeyValuePair<string, string>("hashes", id),
            new KeyValuePair<string, string>("deleteFiles", deleteFiles ? "true" : "false"),
        }, ct), new { status = "removed" }));

    [HttpPost("{id}/sequential")]
    public Task<IActionResult> Sequential(string id, [FromQuery] bool enabled = true, CancellationToken ct = default) =>
        WithHash(id, ct, async client =>
        {
            // qBittorrent only exposes a toggle, so read the current flag first.
            var list = await client.GetJsonAsync($"torrents/info?hashes={id}", ct);
            var t = Items(list).FirstOrDefault();
            if (t.ValueKind == JsonValueKind.Undefined)
                return NotFound(new { error = "Torrent not found", code = "not_found" });
            var current = t.TryGetProperty("seq_dl", out var s) && s.ValueKind == JsonValueKind.True;
            if (current == enabled) return Ok(new { sequential = enabled });
            var resp = await client.PostFormAsync("torrents/toggleSequentialDownload",
                new[] { new KeyValuePair<string, string>("hashes", id) }, ct);
            return Upstream(resp, new { sequential = enabled });
        });

    // ── Bulk ───────────────────────────────────────────────

    [HttpPost("pause-all")]
    public Task<IActionResult> PauseAll(CancellationToken ct) => WithClient(async client =>
        Upstream(await client.PauseOrResumeAsync(true, "all", ct), new { status = "paused" }), ct);

    [HttpPost("resume-all")]
    public Task<IActionResult> ResumeAll(CancellationToken ct) => WithClient(async client =>
        Upstream(await client.PauseOrResumeAsync(false, "all", ct), new { status = "resumed" }), ct);

    [HttpPost("remove-completed")]
    public Task<IActionResult> RemoveCompleted([FromQuery(Name = "delete_files")] bool deleteFiles = false, CancellationToken ct = default) =>
        WithClient(async client =>
        {
            var list = await client.GetJsonAsync("torrents/info?filter=completed", ct);
            var hashes = Items(list)
                .Select(t => t.TryGetProperty("hash", out var h) ? h.GetString() : null)
                .Where(h => !string.IsNullOrEmpty(h) && HashPattern.IsMatch(h!))
                .ToList();
            if (hashes.Count == 0) return Ok(new { status = "removed", removed = 0 });
            var resp = await client.PostFormAsync("torrents/delete", new[]
            {
                new KeyValuePair<string, string>("hashes", string.Join('|', hashes)),
                new KeyValuePair<string, string>("deleteFiles", deleteFiles ? "true" : "false"),
            }, ct);
            return Upstream(resp, new { status = "removed", removed = hashes.Count });
        }, ct);

    // ── Settings (no backing implementation) ───────────────

    [HttpGet("settings")]
    public IActionResult GetSettings() => NotSupported(
        "Engine tuning is not available — WatchNexus has no built-in torrent engine. Configure limits in qBittorrent's own Web UI.");

    [HttpPut("settings")]
    public IActionResult UpdateSettings() => NotSupported(
        "Engine tuning is not available — WatchNexus has no built-in torrent engine. Configure limits in qBittorrent's own Web UI.");

    // ── Helpers ────────────────────────────────────────────

    private ObjectResult NotSupported(string message) =>
        StatusCode(StatusCodes.Status501NotImplemented, new { error = message, code = "not_supported" });

    private static IEnumerable<JsonElement> Items(JsonElement list) =>
        list.ValueKind == JsonValueKind.Array ? list.EnumerateArray() : Enumerable.Empty<JsonElement>();

    private IActionResult Upstream(HttpResponseMessage resp, object ok) => resp.IsSuccessStatusCode
        ? Ok(ok)
        : StatusCode(StatusCodes.Status502BadGateway, new
        {
            error = $"qBittorrent returned HTTP {(int)resp.StatusCode}",
            code = "client_error",
        });

    private Task<IActionResult> WithHash(string id, CancellationToken ct, Func<QBittorrentClient, Task<IActionResult>> action) =>
        HashPattern.IsMatch(id ?? "")
            ? WithClient(action, ct)
            : Task.FromResult<IActionResult>(BadRequest(new { error = "Invalid torrent id", code = "invalid_request" }));

    private async Task<IActionResult> WithClient(Func<QBittorrentClient, Task<IActionResult>> action, CancellationToken ct)
    {
        var (locked, required, current) = await CheckTierAsync();
        if (locked)
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = $"Download clients require a {required} license.",
                code = "tier_locked",
                required_tier = required,
                current_tier = current,
            });

        var cfg = await LoadConfigAsync(ct);
        if (cfg == null)
            return Conflict(new { error = "No download client is configured. Connect qBittorrent in Settings → Downloads.", code = "not_configured" });

        var client = new QBittorrentClient(this.Http(), cfg);
        if (client.HostBlocked)
            return BadRequest(new { error = "The configured qBittorrent host is not allowed.", code = "host_blocked" });

        try
        {
            if (!await client.LoginAsync(ct))
                return StatusCode(StatusCodes.Status502BadGateway, new { error = "qBittorrent rejected the saved credentials.", code = "auth_failed" });
            return await action(client);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { error = $"Could not reach qBittorrent: {ex.Message}", code = "client_unreachable" });
        }
    }

    private async Task<QBittorrentClient.Config?> LoadConfigAsync(CancellationToken ct)
    {
        var uid = this.UserId();
        var row = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "qbit_config" && s.UserId == uid, ct);
        return QBittorrentClient.ParseConfig(row?.Value);
    }

    private async Task<(bool locked, string? required, string current)> CheckTierAsync()
    {
        var required = FortressFilter.GetRequiredTier(ClientName);
        if (required == null) return (false, null, "standard");
        var current = await FortressFilter.GetCurrentTier(_db);
        var locked = TierRank.GetValueOrDefault(current, 0) < TierRank.GetValueOrDefault(required, 0);
        return (locked, required, current);
    }
}

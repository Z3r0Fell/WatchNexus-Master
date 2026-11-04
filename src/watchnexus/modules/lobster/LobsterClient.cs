using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace WatchNexus.Module.Lobster;

/// <summary>Result of a sidecar control API call: HTTP status plus JSON body.</summary>
public readonly record struct SidecarResponse(int StatusCode, JsonElement Body)
{
    public bool IsSuccess => StatusCode is >= 200 and < 300;
}

/// <summary>
/// Client for the sidecar's loopback control API (lobster-sidecar/control.go).
/// Every call carries the per-install control key from <see cref="LobsterSettings"/>.
/// </summary>
public class LobsterClient
{
    private readonly ILogger<LobsterClient>? _logger;
    private readonly LobsterSettings _settings;
    private readonly HttpClient _http;

    public LobsterClient(LobsterSettings settings, ILogger<LobsterClient>? logger = null, HttpMessageHandler? handler = null)
    {
        _settings = settings;
        _logger = logger;
        _http = handler == null ? new HttpClient() : new HttpClient(handler);
        _http.BaseAddress = new Uri(settings.SidecarBaseUrl);
        // /api/start waits up to ~8s for the node to reach a reportable state.
        _http.Timeout = TimeSpan.FromSeconds(15);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public Task<SidecarResponse> GetStatusAsync(CancellationToken ct = default) => SendAsync(HttpMethod.Get, "/api/status", ct);
    public Task<SidecarResponse> StartAsync(CancellationToken ct = default) => SendAsync(HttpMethod.Post, "/api/start", ct);
    public Task<SidecarResponse> StopAsync(CancellationToken ct = default) => SendAsync(HttpMethod.Post, "/api/stop", ct);
    public Task<SidecarResponse> GetPeersAsync(CancellationToken ct = default) => SendAsync(HttpMethod.Get, "/api/peers", ct);
    public Task<SidecarResponse> PairAsync(CancellationToken ct = default) => SendAsync(HttpMethod.Post, "/api/pair", ct);

    private async Task<SidecarResponse> SendAsync(HttpMethod method, string path, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(method, path);
        req.Headers.Add("X-Control-Key", _settings.ControlKey);
        using var resp = await _http.SendAsync(req, ct);
        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        var body = await JsonSerializer.DeserializeAsync<JsonElement>(stream, cancellationToken: ct);
        if (!resp.IsSuccessStatusCode)
            _logger?.LogDebug("[Lobster] sidecar {Method} {Path} -> {Status}", method, path, (int)resp.StatusCode);
        return new SidecarResponse((int)resp.StatusCode, body);
    }

    /// <summary>Waits until the sidecar answers an authenticated status call.</summary>
    public async Task WaitForReadyAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                var resp = await GetStatusAsync(ct);
                if (resp.IsSuccess) return;
                if (resp.StatusCode == 401)
                    throw new InvalidOperationException("Lobster sidecar rejected the control key");
            }
            catch (Exception ex) when ((ex is HttpRequestException or TaskCanceledException or JsonException) && !ct.IsCancellationRequested)
            {
                // not listening yet
            }
            await Task.Delay(500, ct);
        }
        throw new TimeoutException($"Lobster sidecar did not become ready within {timeout.TotalSeconds}s");
    }
}

using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace WatchNexus.Module.Lobster;

public class LobsterClient
{
    private readonly ILogger<LobsterClient>? _logger;
    private readonly HttpClient _http;
    private const string ControlUrlEnv = "LOBSTER_CONTROL_URL";
    private const int DefaultControlPort = 19091;

    public LobsterClient(ILogger<LobsterClient>? logger = null)
    {
        _logger = logger;
        _http = new HttpClient { BaseAddress = new Uri(ResolveControlUrl()), Timeout = TimeSpan.FromSeconds(10) };
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<JsonElement> GetStatusAsync(CancellationToken ct = default)
    {
        var resp = await _http.GetAsync("/api/status", ct);
        resp.EnsureSuccessStatusCode();
        return await JsonSerializer.DeserializeAsync<JsonElement>(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
    }

    public async Task<JsonElement> StartAsync(CancellationToken ct = default)
    {
        var resp = await _http.PostAsync("/api/start", null, ct);
        resp.EnsureSuccessStatusCode();
        return await JsonSerializer.DeserializeAsync<JsonElement>(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
    }

    public async Task<JsonElement> StopAsync(CancellationToken ct = default)
    {
        var resp = await _http.PostAsync("/api/stop", null, ct);
        resp.EnsureSuccessStatusCode();
        return await JsonSerializer.DeserializeAsync<JsonElement>(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
    }

    public async Task<JsonElement> GetPeersAsync(CancellationToken ct = default)
    {
        var resp = await _http.GetAsync("/api/peers", ct);
        resp.EnsureSuccessStatusCode();
        return await JsonSerializer.DeserializeAsync<JsonElement>(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
    }

    public async Task<JsonElement> PairAsync(CancellationToken ct = default)
    {
        var resp = await _http.PostAsync("/api/pair", null, ct);
        resp.EnsureSuccessStatusCode();
        return await JsonSerializer.DeserializeAsync<JsonElement>(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
    }

    public async Task WaitForReadyAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var resp = await _http.GetAsync("/api/status", ct);
                if (resp.IsSuccessStatusCode) return;
            }
            catch
            {
                // ignore until deadline
            }
            await Task.Delay(500, ct);
        }
        throw new TimeoutException($"Lobster sidecar did not become ready within {timeout.TotalSeconds}s");
    }

    private string ResolveControlUrl()
    {
        var env = Environment.GetEnvironmentVariable(ControlUrlEnv);
        if (!string.IsNullOrWhiteSpace(env)) return env.TrimEnd('/');

        return $"http://127.0.0.1:{DefaultControlPort}";
    }
}

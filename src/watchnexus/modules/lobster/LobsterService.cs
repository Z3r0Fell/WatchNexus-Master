using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace WatchNexus.Module.Lobster;

public class LobsterService : BackgroundService
{
    private readonly ILogger<LobsterService> _logger;
    private readonly LobsterClient _client;
    private Process? _sidecarProcess;
    private string? _sidecarPath;

    public LobsterService(ILogger<LobsterService> logger, LobsterClient client)
    {
        _logger = logger;
        _client = client;
    }

    public async Task<(bool Started, string? Error)> StartSidecarAsync(CancellationToken ct = default)
    {
        if (_sidecarProcess != null && !_sidecarProcess.HasExited)
            return (true, null);

        _sidecarPath = ResolveSidecarPath();
        if (string.IsNullOrEmpty(_sidecarPath) || !File.Exists(_sidecarPath))
        {
            var error = $"Lobster sidecar binary not found at: {_sidecarPath ?? "(not resolved)"}";
            _logger.LogError(error);
            return (false, error);
        }

        _logger.LogInformation("[Lobster] Starting sidecar: {Path}", _sidecarPath);

        var psi = new ProcessStartInfo
        {
            FileName = _sidecarPath,
            WorkingDirectory = Path.GetDirectoryName(_sidecarPath)!,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        _sidecarProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
        _sidecarProcess.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) _logger.LogDebug("[Lobster-sidecar] {Line}", e.Data);
        };
        _sidecarProcess.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) _logger.LogWarning("[Lobster-sidecar] {Line}", e.Data);
        };
        _sidecarProcess.Exited += (_, _) =>
        {
            _logger.LogInformation("[Lobster] Sidecar exited with code {Code}", _sidecarProcess.ExitCode);
            _sidecarProcess = null;
        };

        if (!_sidecarProcess.Start())
            return (false, "Failed to start sidecar process");

        _sidecarProcess.BeginOutputReadLine();
        _sidecarProcess.BeginErrorReadLine();

        try
        {
            await _client.WaitForReadyAsync(TimeSpan.FromSeconds(30), ct);
            _logger.LogInformation("[Lobster] Sidecar is ready");
            return (true, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Lobster] Sidecar failed to become ready");
            StopSidecar();
            return (false, $"Sidecar did not become ready: {ex.Message}");
        }
    }

    public void StopSidecar()
    {
        if (_sidecarProcess == null || _sidecarProcess.HasExited)
            return;

        try
        {
            _sidecarProcess.Kill(entireProcessTree: true);
            _sidecarProcess.WaitForExit(5000);
        }
        catch { /* best effort */ }
        finally
        {
            _sidecarProcess.Dispose();
            _sidecarProcess = null;
            _logger.LogInformation("[Lobster] Sidecar stopped");
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[Lobster] Background service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_sidecarProcess == null || _sidecarProcess.HasExited)
                {
                    var (started, error) = await StartSidecarAsync(stoppingToken);
                    if (!started)
                    {
                        _logger.LogWarning("[Lobster] Will retry sidecar start in 15s: {Error}", error);
                        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                        continue;
                    }
                }

                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Lobster] Background loop error");
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
        }

        StopSidecar();
        _logger.LogInformation("[Lobster] Background service stopped");
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        StopSidecar();
        await base.StopAsync(cancellationToken);
    }

    private string? ResolveSidecarPath()
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "lobster-sidecar", "watchnexus-lobster"),
            Path.Combine(AppContext.BaseDirectory, "watchnexus-lobster"),
            Path.Combine(AppContext.BaseDirectory, "..", "lobster-sidecar", "watchnexus-lobster"),
            "/opt/watchnexus/lobster-sidecar/watchnexus-lobster",
        };

        foreach (var candidate in candidates)
        {
            var full = Path.GetFullPath(candidate);
            if (File.Exists(full)) return full;
        }

        return null;
    }
}

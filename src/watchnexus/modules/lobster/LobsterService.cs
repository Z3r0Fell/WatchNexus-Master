using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace WatchNexus.Module.Lobster;

public class LobsterService : BackgroundService
{
    private readonly ILogger<LobsterService> _logger;
    private readonly LobsterClient _client;
    private const string SidecarMissing = "Lobster sidecar binary not found";
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
            return (false, SidecarMissing);

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

        var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
        _sidecarProcess = proc;
        _sidecarProcess.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) _logger.LogDebug("[Lobster-sidecar] {Line}", e.Data);
        };
        _sidecarProcess.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) _logger.LogWarning("[Lobster-sidecar] {Line}", e.Data);
        };
        // Use the captured local: StopSidecar() nulls/disposes _sidecarProcess,
        // and an exception thrown from this thread-pool callback (NRE on the
        // field, or InvalidOperationException on a disposed Process) would
        // crash the whole server.
        _sidecarProcess.Exited += (_, _) =>
        {
            int? code = null;
            try { code = proc.ExitCode; } catch { /* disposed */ }
            _logger.LogInformation("[Lobster] Sidecar exited with code {Code}", code);
            if (ReferenceEquals(_sidecarProcess, proc)) _sidecarProcess = null;
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
        // Capture locally: the Exited handler may null the field concurrently.
        var proc = _sidecarProcess;
        if (proc == null || proc.HasExited)
            return;

        try
        {
            proc.Kill(entireProcessTree: true);
            proc.WaitForExit(5000);
        }
        catch { /* best effort */ }
        finally
        {
            proc.Dispose();
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
                    if (!started && error == SidecarMissing)
                    {
                        // The sidecar binary is not shipped in this install (e.g. the
                        // Docker image). It cannot appear at runtime, so log once and
                        // stop polling instead of logging an error every 15s forever.
                        _logger.LogInformation("[Lobster] Sidecar binary not installed; mesh networking disabled. /api/lobster/* will report 503.");
                        return;
                    }
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

using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace WatchNexus.Module.Lobster;

public enum LobsterAvailability
{
    /// <summary>LOBSTER_CONTROL_URL is missing or invalid.</summary>
    NotConfigured,
    /// <summary>The sidecar binary is not present in this install.</summary>
    NotInstalled,
    /// <summary>The sidecar process is starting or being restarted.</summary>
    Starting,
    /// <summary>The sidecar is running and answering its control API.</summary>
    Ready,
}

/// <summary>
/// Launches and supervises the Lobster sidecar (lobster-sidecar/), restarting
/// it with exponential backoff if it crashes.
/// </summary>
public class LobsterService : BackgroundService
{
    private static readonly TimeSpan MinBackoff = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan StableRun = TimeSpan.FromSeconds(60);

    private readonly ILogger<LobsterService> _logger;
    private readonly LobsterClient _client;
    private readonly LobsterSettings _settings;
    private readonly Func<string?> _resolveSidecarPath;
    private volatile Process? _sidecarProcess;
    private volatile string? _message;
    private volatile LobsterAvailability _availability = LobsterAvailability.Starting;

    public LobsterService(ILogger<LobsterService> logger, LobsterClient client, LobsterSettings settings)
        : this(logger, client, settings, ResolveSidecarPath) { }

    internal LobsterService(ILogger<LobsterService> logger, LobsterClient client, LobsterSettings settings, Func<string?> resolveSidecarPath)
    {
        _logger = logger;
        _client = client;
        _settings = settings;
        _resolveSidecarPath = resolveSidecarPath;
        if (!settings.IsConfigured)
        {
            _availability = LobsterAvailability.NotConfigured;
            _message = settings.ConfigError;
        }
    }

    public LobsterAvailability Availability => _availability;

    /// <summary>Human-readable reason when the sidecar is not <see cref="LobsterAvailability.Ready"/>.</summary>
    public string? Message => _message;

    private void SetState(LobsterAvailability state, string? message)
    {
        _message = message;
        _availability = state;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_settings.IsConfigured)
        {
            _logger.LogInformation("[Lobster] {Message} Mesh networking is disabled.", _settings.ConfigError);
            return;
        }

        var path = _resolveSidecarPath();
        if (path == null)
        {
            SetState(LobsterAvailability.NotInstalled, "The Lobster sidecar is not installed in this build.");
            _logger.LogWarning("[Lobster] Sidecar binary not found; mesh networking is disabled.");
            return;
        }

        var backoff = MinBackoff;
        while (!stoppingToken.IsCancellationRequested)
        {
            var startedAt = DateTime.UtcNow;
            try
            {
                SetState(LobsterAvailability.Starting, "The Lobster sidecar is starting.");
                using var proc = StartProcess(path);
                _sidecarProcess = proc;
                try
                {
                    await _client.WaitForReadyAsync(TimeSpan.FromSeconds(30), stoppingToken);
                    SetState(LobsterAvailability.Ready, null);
                    _logger.LogInformation("[Lobster] Sidecar is ready (pid {Pid})", proc.Id);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError("[Lobster] Sidecar failed to become ready: {Error}", ex.Message);
                    TerminateProcess(proc);
                }

                await proc.WaitForExitAsync(stoppingToken);
                _sidecarProcess = null;
                _logger.LogWarning("[Lobster] Sidecar exited with code {Code}", proc.ExitCode);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _sidecarProcess = null;
                _logger.LogError(ex, "[Lobster] Failed to run sidecar");
            }

            if (DateTime.UtcNow - startedAt >= StableRun) backoff = MinBackoff;
            SetState(LobsterAvailability.Starting, $"The Lobster sidecar stopped unexpectedly; restarting in {backoff.TotalSeconds:0}s.");
            _logger.LogWarning("[Lobster] Restarting sidecar in {Delay}s", backoff.TotalSeconds);
            try
            {
                await Task.Delay(backoff, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            backoff = TimeSpan.FromTicks(Math.Min(backoff.Ticks * 2, MaxBackoff.Ticks));
        }

        StopSidecar();
    }

    internal ProcessStartInfo BuildStartInfo(string path)
    {
        var psi = new ProcessStartInfo
        {
            FileName = path,
            WorkingDirectory = _settings.StateDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        psi.ArgumentList.Add("-state-dir");
        psi.ArgumentList.Add(_settings.StateDir);
        psi.ArgumentList.Add("-app-port");
        psi.ArgumentList.Add(_settings.AppPort.ToString());
        psi.ArgumentList.Add("-control-port");
        psi.ArgumentList.Add(_settings.SidecarPort.ToString());

        // Secrets go through the environment, not argv (visible in ps).
        psi.Environment[LobsterSettings.ControlUrlKey] = _settings.CoordinationUrl;
        psi.Environment["LOBSTER_CONTROL_KEY"] = _settings.ControlKey;
        SetOrRemove(psi, LobsterSettings.AuthKeyKey, _settings.AuthKey);
        SetOrRemove(psi, LobsterSettings.HostnameKey, _settings.Hostname);
        SetOrRemove(psi, LobsterSettings.UpstreamHostKey, _settings.UpstreamHost);
        return psi;
    }

    private static void SetOrRemove(ProcessStartInfo psi, string key, string? value)
    {
        if (value == null) psi.Environment.Remove(key);
        else psi.Environment[key] = value;
    }

    private Process StartProcess(string path)
    {
        Directory.CreateDirectory(_settings.StateDir);
        var psi = BuildStartInfo(path);
        _logger.LogInformation("[Lobster] Starting sidecar {Path} (coordination server {Url})", path, _settings.CoordinationUrl);

        var proc = new Process { StartInfo = psi };
        proc.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) _logger.LogInformation("[Lobster-sidecar] {Line}", e.Data);
        };
        proc.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) _logger.LogWarning("[Lobster-sidecar] {Line}", e.Data);
        };
        if (!proc.Start())
        {
            proc.Dispose();
            throw new InvalidOperationException("Failed to start the Lobster sidecar process");
        }
        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();
        return proc;
    }

    public void StopSidecar()
    {
        var proc = _sidecarProcess;
        _sidecarProcess = null;
        if (proc != null) TerminateProcess(proc);
    }

    [DllImport("libc", SetLastError = true, EntryPoint = "kill")]
    private static extern int SysKill(int pid, int sig);

    // SIGTERM first so the sidecar can leave the tailnet cleanly and flush
    // its state; SIGKILL if it does not exit in time.
    private void TerminateProcess(Process proc)
    {
        try
        {
            if (proc.HasExited) return;
            if (!OperatingSystem.IsWindows())
            {
                _ = SysKill(proc.Id, 15);
                if (proc.WaitForExit(5000)) return;
            }
            proc.Kill(entireProcessTree: true);
            proc.WaitForExit(5000);
        }
        catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception or DllNotFoundException or EntryPointNotFoundException)
        {
            // already gone, or no libc: fall through
            try { if (!proc.HasExited) proc.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        StopSidecar();
        await base.StopAsync(cancellationToken);
    }

    private static string? ResolveSidecarPath()
    {
        var name = OperatingSystem.IsWindows() ? "watchnexus-lobster.exe" : "watchnexus-lobster";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "lobster-sidecar", name),
            Path.Combine(AppContext.BaseDirectory, name),
            Path.Combine(AppContext.BaseDirectory, "..", "lobster-sidecar", name),
            Path.Combine("/opt/watchnexus/lobster-sidecar", name),
        };
        foreach (var candidate in candidates)
        {
            var full = Path.GetFullPath(candidate);
            if (File.Exists(full)) return full;
        }
        return null;
    }
}

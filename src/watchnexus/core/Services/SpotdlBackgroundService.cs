using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Services;

/// <summary>
/// Crash-safe background service that processes spotdl download queue.
/// 
/// Crash Safety:
///   - On startup, all "downloading" records are reset to "queued"
///   - Each download runs in isolation — if spotdl crashes, the record stays "queued" for retry
///
/// Key Rotation:
///   - Before each download attempt, picks the next active key via SpotdlKeyManager
///   - On rate-limit/403, marks the key as failed and cycles to the next
///   - Retries with exponential backoff (2^retry * 5s, max 5 min)
///   - After all keys exhausted, marks download as failed
///
/// No Timeouts:
///   - spotdl subprocess has NO timeout (infinite wait)
///   - CancellationToken only for service shutdown — not for download timeout
/// </summary>
public class SpotdlBackgroundService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<SpotdlBackgroundService> _logger;
    private readonly SpotdlKeyManager _keyManager;
    private readonly string _outputDir;
    private const string SpotdlPath = "/usr/bin/spotdl";

    // Regex to parse progress from spotdl output
    // Matches patterns like: "  45%|████▌     | 1.55M/3.45M [00:02<00:03, 634kB/s]"
    private static readonly Regex ProgressRegex = new(
        @"\s+(\d+)%\|",
        RegexOptions.Compiled);

    public SpotdlBackgroundService(
        IServiceProvider services,
        ILogger<SpotdlBackgroundService> logger,
        SpotdlKeyManager keyManager)
    {
        _services = services;
        _logger = logger;
        _keyManager = keyManager;

        var dataDir = Environment.GetEnvironmentVariable("WATCHNEXUS_DATA_DIR")
            ?? (Directory.Exists("/var/lib/watchnexus") ? "/var/lib/watchnexus" : Path.Combine(AppContext.BaseDirectory, "data"));
        _outputDir = Environment.GetEnvironmentVariable("SPOTDL_OUTPUT_DIR")
            ?? Path.Combine(dataDir, "spotdl");
        Directory.CreateDirectory(_outputDir);

        // Ensure spotdl binary exists
        if (!File.Exists(SpotdlPath))
        {
            Warn($"[SpotdlService] spotdl binary not found at {SpotdlPath} — downloads will fail until installed");
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[SpotdlService] Background service started. Output dir: {Dir}", _outputDir);

        // ── CRASH SAFETY: Reset stuck "downloading" records ──
        await ResetStuckDownloads();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessNextDownload(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "[SpotdlService] Error in main loop");
            }

            // Poll every 5 seconds for new queued items
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    /// <summary>
    /// On startup, reset any "downloading" records back to "queued".
    /// This handles crash recovery — if the service died mid-download,
    /// the download will be retried.
    /// </summary>
    private async Task ResetStuckDownloads()
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stuck = await db.SpotdlDownloads
                .Where(d => d.Status == "downloading")
                .ToListAsync();

            foreach (var d in stuck)
            {
                d.Status = "queued";
                d.Progress = 0;
                _logger.LogInformation("[SpotdlService] Reset stuck download {Id}: {Url}", d.Id, d.Url);
            }

            if (stuck.Count > 0)
                await db.SaveChangesAsync();

            _logger.LogInformation("[SpotdlService] Reset {Count} stuck downloads", stuck.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SpotdlService] Failed to reset stuck downloads");
        }
    }

    /// <summary>
    /// Pick up the next queued download and process it.
    /// Retries with exponential backoff and key rotation on failure.
    /// </summary>
    private async Task ProcessNextDownload(CancellationToken ct)
    {
        SpotdlDownload? download;

        using (var scope = _services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            download = await db.SpotdlDownloads
                .Where(d => d.Status == "queued")
                .OrderBy(d => d.CreatedAt)
                .FirstOrDefaultAsync(ct);
        }

        if (download == null) return;

        _logger.LogInformation("[SpotdlService] Processing download {Id}: {Url}", download.Id, download.Url);

        // Get the download with a fresh DB context for each attempt
        download = await ReloadDownload(download.Id);
        if (download == null) return;

        download.Status = "downloading";
        download.Progress = 0;
        await SaveDownload(download);

        // ── Attempt download with retry + key rotation ──
        var maxRetries = 10; // effectively unlimited with key rotation
        var retryDelay = TimeSpan.FromSeconds(5);
        var attemptedKeys = new HashSet<string>();

        for (var attempt = 0; attempt < maxRetries; attempt++)
        {
            if (ct.IsCancellationRequested) return;

            // Reload to get latest state
            download = await ReloadDownload(download.Id);
            if (download == null) return;

            // Get next active key
            var key = await _keyManager.GetNextActiveKey("spotify");
            if (key == null)
            {
                // No keys available — fail
                download.Status = "failed";
                download.ErrorMessage = "No active Spotify API keys available";
                download.CompletedAt = DateTime.UtcNow;
                await SaveDownload(download);
                _logger.LogWarning("[SpotdlService] No keys available for download {Id}", download.Id);
                return;
            }

            // Record which key we're using
            download.KeyUsed = key.Id;
            download.RetryCount = attempt;

            // Build spotdl arguments
            var args = BuildSpotdlArgs(download.Url, download.Format, key);

            _logger.LogInformation("[SpotdlService] Download {Id} attempt {Attempt}/{MaxRetries} with key {Key}",
                download.Id, attempt + 1, maxRetries, key.Id);

            var (success, errorMessage, outputFile) = await RunSpotdlProcess(download, args, ct);

            if (success)
            {
                // ── SUCCESS ──
                download = await ReloadDownload(download.Id);
                if (download == null) return;

                download.Status = "completed";
                download.Progress = 100;
                download.OutputPath = outputFile;
                download.ErrorMessage = null;
                download.CompletedAt = DateTime.UtcNow;
                await SaveDownload(download);

                // Reset key failure count (it worked!)
                await _keyManager.ResetKeyFailure(key.Id);

                _logger.LogInformation("[SpotdlService] Download {Id} completed: {File}", download.Id, outputFile);
                return;
            }

            // ── FAILURE — check if rate-limit related ──
            var isRateLimit = IsRateLimitError(errorMessage);

            if (isRateLimit && !key.IsEnvKey)
            {
                // Mark key as failed and cycle
                await _keyManager.MarkKeyFailed(key.Id);
                attemptedKeys.Add(key.Id);
                _logger.LogWarning("[SpotdlService] Rate limit on key {Key}, cycling. Attempt {Attempt}", key.Id, attempt + 1);
            }
            else if (isRateLimit && key.IsEnvKey)
            {
                // Env key failed — mark it failed (will clear env vars)
                await _keyManager.MarkKeyFailed(key.Id);
                _logger.LogWarning("[SpotdlService] Rate limit on env key, falling back to DB keys");
            }

            // ── Exponential Backoff ──
            download = await ReloadDownload(download.Id);
            if (download == null) return;

            var delay = TimeSpan.FromSeconds(Math.Min(Math.Pow(2, attempt) * 5, 300)); // max 5 min
            download.Status = "queued";
            download.ErrorMessage = $"Retry {attempt + 1}: {errorMessage}";
            download.Progress = 0;
            await SaveDownload(download);

            _logger.LogInformation("[SpotdlService] Download {Id} will retry in {Delay}s (attempt {Attempt})",
                download.Id, delay.TotalSeconds, attempt + 1);

            try { await Task.Delay(delay, ct); }
            catch (OperationCanceledException) { return; }
        }

        // ── All retries exhausted ──
        download = await ReloadDownload(download.Id);
        if (download == null) return;

        download.Status = "failed";
        download.ErrorMessage = "All retries exhausted";
        download.CompletedAt = DateTime.UtcNow;
        await SaveDownload(download);
        _logger.LogWarning("[SpotdlService] Download {Id} failed after all retries", download.Id);
    }

    /// <summary>
    /// Build spotdl command-line arguments for a download.
    /// </summary>
    private string BuildSpotdlArgs(string url, string format, SpotdlKeyResult key)
    {
        var outputTemplate = Path.Combine(_outputDir, "{artist} - {title}.{output-ext}");
        var args = $"\"{url}\" --format {format} --output \"{outputTemplate}\" --log-level INFO --print-errors";

        // Add Spotify API credentials if available
        if (!string.IsNullOrEmpty(key.ClientId) && !string.IsNullOrEmpty(key.ClientSecret))
        {
            args += $" --client-id \"{key.ClientId}\" --client-secret \"{key.ClientSecret}\"";
        }
        else if (!string.IsNullOrEmpty(key.RawValue))
        {
            // RawValue could be "client_id:client_secret" format
            var parts = key.RawValue.Split(':');
            if (parts.Length == 2)
            {
                args += $" --client-id \"{parts[0]}\" --client-secret \"{parts[1]}\"";
            }
        }

        return args;
    }

    /// <summary>
    /// Run the spotdl process and track progress.
    /// No timeout is set — downloads run until completion or cancellation.
    /// </summary>
    private async Task<(bool Success, string? Error, string? OutputFile)> RunSpotdlProcess(
        SpotdlDownload download, string args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = SpotdlPath,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            // NO timeout — downloads can run for hours
        };

        _logger.LogInformation("[SpotdlService] Running: {Path} {Args}", SpotdlPath, args);

        using var process = new Process { StartInfo = psi };

        var stdoutBuilder = new StringBuilder();
        var stderrBuilder = new StringBuilder();
        string? outputFile = null;

        try
        {
            process.Start();

            // Read stdout and stderr concurrently to prevent deadlocks
            var stdoutTask = ReadStreamAsync(process.StandardOutput, stdoutBuilder, ct);
            var stderrTask = ReadStreamAsync(process.StandardError, stderrBuilder, ct, true, download);

            // Wait for process to complete — NO TIMEOUT
            await process.WaitForExitAsync(ct);

            await Task.WhenAll(stdoutTask, stderrTask);

            var stdout = stdoutBuilder.ToString();
            var stderr = stderrBuilder.ToString();

            // Try to extract output file path from stdout
            outputFile = ExtractOutputPath(stdout, stderr);

            if (process.ExitCode == 0)
            {
                _logger.LogInformation("[SpotdlService] Download {Id} exit code 0", download.Id);
                return (true, null, outputFile);
            }

            var error = string.IsNullOrWhiteSpace(stderr) ? stdout : stderr;
            _logger.LogWarning("[SpotdlService] Download {Id} exit code {Code}: {Error}",
                download.Id, process.ExitCode, Truncate(error, 500));

            return (false, error, outputFile);
        }
        catch (OperationCanceledException)
        {
            // Service shutting down — kill the process gracefully
            try { process.Kill(entireProcessTree: true); } catch { /* best effort */ }
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SpotdlService] Process error for download {Id}", download.Id);
            return (false, ex.Message, null);
        }
    }

    /// <summary>
    /// Read a stream line by line, optionally parsing progress.
    /// </summary>
    private async Task ReadStreamAsync(
        StreamReader reader, StringBuilder builder, CancellationToken ct,
        bool trackProgress = false, SpotdlDownload? download = null)
    {
        string? line;
        while ((line = await reader.ReadLineAsync(ct)) != null)
        {
            builder.AppendLine(line);

            if (trackProgress && download != null)
            {
                UpdateProgress(line, download);
            }
        }
    }

    /// <summary>
    /// Parse progress from a spotdl output line and update the database.
    /// </summary>
    private void UpdateProgress(string line, SpotdlDownload download)
    {
        try
        {
            // Parse percentage from progress bar pattern: " 45%|████▌"
            var match = ProgressRegex.Match(line);
            if (match.Success && int.TryParse(match.Groups[1].Value, out var pct))
            {
                download.Progress = pct;
                // Fire-and-forget DB update — non-blocking
                _ = UpdateDownloadProgressAsync(download.Id, pct);
            }

            // Parse "Downloaded" completion from spotdl output
            if (line.Contains("Downloaded") && line.Contains(".mp3") || line.Contains(".flac") || line.Contains(".m4a") || line.Contains(".ogg") || line.Contains(".opus") || line.Contains(".wav"))
            {
                download.Progress = 100;
                _ = UpdateDownloadProgressAsync(download.Id, 100);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "[SpotdlService] Progress parse error");
        }
    }

    /// <summary>
    /// Fire-and-forget DB progress update.
    /// </summary>
    private async Task UpdateDownloadProgressAsync(string downloadId, double progress)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var d = await db.SpotdlDownloads.FindAsync(downloadId);
            if (d != null)
            {
                d.Progress = progress;
                await db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "[SpotdlService] Progress update failed");
        }
    }

    /// <summary>
    /// Check if an error message indicates a rate limit or auth failure.
    /// </summary>
    private static bool IsRateLimitError(string? error)
    {
        if (string.IsNullOrEmpty(error)) return false;

        var lower = error.ToLowerInvariant();
        return lower.Contains("rate limit")
            || lower.Contains("rate_limit")
            || lower.Contains("too many requests")
            || lower.Contains("429")
            || lower.Contains("403")
            || lower.Contains("oauth")
            || lower.Contains("unauthorized")
            || lower.Contains("invalid client")
            || lower.Contains("access denied");
    }

    /// <summary>
    /// Extract the output file path from spotdl output.
    /// </summary>
    private static string? ExtractOutputPath(string stdout, string stderr)
    {
        // Look for file path in output — spotdl prints something like:
        // "INFO      Downloaded <path>"
        var combined = stdout + "\n" + stderr;
        var match = Regex.Match(combined, @"Downloaded\s+(.+\.\w+)");
        if (match.Success)
            return match.Groups[1].Value.Trim();

        return null;
    }

    /// <summary>
    /// Reload a download from the database.
    /// </summary>
    private async Task<SpotdlDownload?> ReloadDownload(string id)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.SpotdlDownloads.FindAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SpotdlService] Failed to reload download {Id}", id);
            return null;
        }
    }

    /// <summary>
    /// Save download state to the database.
    /// </summary>
    private async Task SaveDownload(SpotdlDownload download)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var existing = await db.SpotdlDownloads.FindAsync(download.Id);
            if (existing != null)
            {
                existing.Status = download.Status;
                existing.Progress = download.Progress;
                existing.ErrorMessage = download.ErrorMessage;
                existing.OutputPath = download.OutputPath;
                existing.KeyUsed = download.KeyUsed;
                existing.RetryCount = download.RetryCount;
                existing.CompletedAt = download.CompletedAt;
            }
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SpotdlService] Failed to save download {Id}", download.Id);
        }
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength] + "...";
}

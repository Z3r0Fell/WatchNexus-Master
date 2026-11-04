using System.Text;
using System.Text.RegularExpressions;

namespace WatchNexus.Core.Services;

// ══════════════════════════════════════════════════════════════════════
//  Lightweight rolling file logger (no third-party deps).
//
//  Line format (one entry per line; extra lines of a multi-line message or
//  exception are indented by two spaces so they can never be mistaken for a
//  new entry — this also blocks log-forging via embedded newlines):
//
//    2026-11-01T12:00:00.000Z [INFO] Category: message
//      System.InvalidOperationException: boom
//         at ...
//
//  Files: watchnexus-yyyyMMdd.log, rolling daily (UTC) and on size
//  (watchnexus-yyyyMMdd_1.log, _2 ...). Old watchnexus-*.log files beyond the
//  retention window are pruned on roll.
// ══════════════════════════════════════════════════════════════════════

public static class LogPaths
{
    /// <summary>
    /// Resolve the log directory:
    ///   1. $WATCHNEXUS_LOG_DIR (explicit override)
    ///   2. $WATCHNEXUS_DATA_DIR/logs (Docker: the persistent /app/data volume —
    ///      the root FS is read-only in docker-compose)
    ///   3. %PROGRAMDATA%\WatchNexus\logs on Windows
    ///   4. &lt;app&gt;/logs
    /// </summary>
    public static string ResolveLogDir()
    {
        var explicitDir = Environment.GetEnvironmentVariable("WATCHNEXUS_LOG_DIR");
        if (!string.IsNullOrWhiteSpace(explicitDir))
            return explicitDir;

        var dataDir = Environment.GetEnvironmentVariable("WATCHNEXUS_DATA_DIR");
        if (!string.IsNullOrWhiteSpace(dataDir))
            return Path.Combine(dataDir, "logs");

        if (OperatingSystem.IsWindows())
        {
            var pd = Environment.GetEnvironmentVariable("PROGRAMDATA") ?? @"C:\ProgramData";
            return Path.Combine(pd, "WatchNexus", "logs");
        }

        return Path.Combine(AppContext.BaseDirectory, "logs");
    }
}

/// <summary>
/// Owns the on-disk log files: writing (thread-safe), rolling, retention and
/// the mutating operations the API exposes (truncate/delete), so those never
/// race with an open writer.
/// </summary>
public sealed class FileLogSink : IDisposable
{
    public const string FilePrefix = "watchnexus-";
    public const long DefaultMaxFileBytes = 20L * 1024 * 1024;
    public const int DefaultRetentionDays = 14;

    private readonly object _lock = new();
    private readonly long _maxFileBytes;
    private readonly int _retentionDays;
    private StreamWriter? _writer;
    private string? _currentPath;
    private DateTime _currentDay;
    private DateTime _lastExistsCheck;
    private bool _disposed;

    public string Directory { get; }

    public FileLogSink(string directory, long maxFileBytes = DefaultMaxFileBytes, int retentionDays = DefaultRetentionDays)
    {
        Directory = Path.GetFullPath(directory);
        _maxFileBytes = maxFileBytes;
        _retentionDays = retentionDays;
    }

    /// <summary>Full path of the file currently being written (null until the first write).</summary>
    public string? CurrentFilePath { get { lock (_lock) return _currentPath; } }

    public void Write(string entry)
    {
        lock (_lock)
        {
            if (_disposed) return;
            try
            {
                EnsureWriter();
                _writer!.Write(entry);
                _writer.Flush();
            }
            catch
            {
                // Never let logging take the app down; drop the writer and retry next time.
                CloseWriter();
            }
        }
    }

    private void EnsureWriter()
    {
        var now = DateTime.UtcNow;
        var today = now.Date;

        if (_writer != null)
        {
            var roll = today != _currentDay || _writer.BaseStream.Length >= _maxFileBytes;
            // Someone deleted the file underneath us (e.g. manually): reopen so
            // new entries land in a visible file. Checked at most every 5s.
            if (!roll && (now - _lastExistsCheck).TotalSeconds >= 5)
            {
                _lastExistsCheck = now;
                roll = !File.Exists(_currentPath);
            }
            if (!roll) return;
            CloseWriter();
        }

        System.IO.Directory.CreateDirectory(Directory);
        var path = PickPath(today);
        var fs = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete);
        _writer = new StreamWriter(fs, new UTF8Encoding(false));
        _currentPath = path;
        _currentDay = today;
        _lastExistsCheck = now;
        Prune();
    }

    private string PickPath(DateTime day)
    {
        var stem = FilePrefix + day.ToString("yyyyMMdd");
        for (var i = 0; ; i++)
        {
            var candidate = Path.Combine(Directory, i == 0 ? $"{stem}.log" : $"{stem}_{i}.log");
            if (!File.Exists(candidate) || new FileInfo(candidate).Length < _maxFileBytes)
                return candidate;
        }
    }

    private void Prune()
    {
        try
        {
            var cutoff = DateTime.UtcNow.AddDays(-_retentionDays);
            foreach (var f in System.IO.Directory.EnumerateFiles(Directory, FilePrefix + "*.log"))
            {
                if (f == _currentPath) continue;
                if (File.GetLastWriteTimeUtc(f) < cutoff) File.Delete(f);
            }
        }
        catch { /* best effort */ }
    }

    private void CloseWriter()
    {
        try { _writer?.Dispose(); } catch { }
        _writer = null;
    }

    /// <summary>Empty a log file (closing the writer first if it is the active one).</summary>
    public void Truncate(string fullPath)
    {
        lock (_lock)
        {
            if (string.Equals(fullPath, _currentPath, StringComparison.Ordinal)) CloseWriter();
            if (File.Exists(fullPath))
            {
                using var fs = new FileStream(fullPath, FileMode.Truncate, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete);
            }
        }
    }

    /// <summary>Delete a log file (closing the writer first if it is the active one).</summary>
    public void Delete(string fullPath)
    {
        lock (_lock)
        {
            if (string.Equals(fullPath, _currentPath, StringComparison.Ordinal)) CloseWriter();
            if (File.Exists(fullPath)) File.Delete(fullPath);
        }
    }

    public void Dispose()
    {
        lock (_lock)
        {
            _disposed = true;
            CloseWriter();
        }
    }

    // ── Formatting / parsing helpers (shared by the provider and the API) ──

    public static string LevelName(LogLevel level) => level switch
    {
        LogLevel.Trace => "TRACE",
        LogLevel.Debug => "DEBUG",
        LogLevel.Information => "INFO",
        LogLevel.Warning => "WARNING",
        LogLevel.Error => "ERROR",
        LogLevel.Critical => "FATAL",
        _ => "INFO",
    };

    public static string FormatEntry(DateTime utc, LogLevel level, string category, string message, Exception? exception)
    {
        var sb = new StringBuilder(128 + message.Length);
        sb.Append(utc.ToString("yyyy-MM-ddTHH:mm:ss.fff'Z'"))
          .Append(" [").Append(LevelName(level)).Append("] ")
          .Append(category).Append(": ");
        AppendIndented(sb, message, first: true);
        if (exception != null) AppendIndented(sb, exception.ToString(), first: false);
        return sb.ToString();
    }

    private static void AppendIndented(StringBuilder sb, string text, bool first)
    {
        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            if (i == 0 && first) sb.Append(lines[i]).Append('\n');
            else sb.Append("  ").Append(lines[i]).Append('\n');
        }
    }

    private static readonly Regex LevelToken = new(
        @"\[(TRACE|DEBUG|INFO|INFORMATION|WARN|WARNING|ERROR|FATAL|CRITICAL|CRIT)\]",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>
    /// Level of a log line, normalised to the UI's set (DEBUG/INFO/WARNING/ERROR/FATAL).
    /// Indented lines are continuations and inherit <paramref name="previous"/>.
    /// Lines without a token (e.g. boot-log lines) default to INFO.
    /// </summary>
    public static string ParseLevel(string line, string? previous)
    {
        if (line.Length > 0 && char.IsWhiteSpace(line[0]) && previous != null) return previous;
        var m = LevelToken.Match(line.Length > 120 ? line[..120] : line);
        if (!m.Success) return previous != null && line.Length == 0 ? previous : "INFO";
        return m.Groups[1].Value.ToUpperInvariant() switch
        {
            "TRACE" or "DEBUG" => "DEBUG",
            "INFO" or "INFORMATION" => "INFO",
            "WARN" or "WARNING" => "WARNING",
            "ERROR" => "ERROR",
            _ => "FATAL",
        };
    }

    public static string? NormalizeLevelFilter(string? level)
    {
        if (string.IsNullOrWhiteSpace(level)) return null;
        var l = level.Trim().ToUpperInvariant();
        return l switch
        {
            "ALL" => null,
            "TRACE" => "DEBUG",
            "INFORMATION" => "INFO",
            "WARN" => "WARNING",
            "CRITICAL" or "CRIT" => "FATAL",
            _ => l,
        };
    }
}

[ProviderAlias("File")]
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly FileLogSink _sink;
    public FileLoggerProvider(FileLogSink sink) => _sink = sink;
    public ILogger CreateLogger(string categoryName) => new FileLogger(categoryName, _sink);
    public void Dispose() { /* sink lifetime is owned by DI */ }

    private sealed class FileLogger : ILogger
    {
        private readonly string _category;
        private readonly FileLogSink _sink;
        public FileLogger(string category, FileLogSink sink) { _category = category; _sink = sink; }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;
            var message = formatter(state, exception) ?? "";
            if (message.Length == 0 && exception == null) return;
            _sink.Write(FileLogSink.FormatEntry(DateTime.UtcNow, logLevel, _category, message, exception));
        }
    }
}

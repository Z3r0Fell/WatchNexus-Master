using System.Diagnostics;
using System.Runtime.InteropServices;

namespace WatchNexus.Core.Services;

/// <summary>
/// Cross-platform FFmpeg / FFprobe locator + spawner.
///
/// Lookup order (first hit wins):
///   1. Explicit override:  WATCHNEXUS_FFMPEG_PATH / WATCHNEXUS_FFPROBE_PATH env var.
///   2. Bundled tools:      &lt;appdir&gt;/tools/ffmpeg(.exe), &lt;appdir&gt;/ffmpeg/bin/ffmpeg(.exe).
///   3. OS PATH:            `where` (Windows) or `which` (Linux/macOS).
///   4. Common install dirs (per-OS).
///
/// Results are cached per process for performance.
/// </summary>
public static class FfmpegLocator
{
    private static string? _cachedFfmpeg;
    private static string? _cachedFfprobe;
    private static readonly object _lock = new();

    public static string? Ffmpeg => _cachedFfmpeg ?? (_cachedFfmpeg = Find("ffmpeg"));
    public static string? Ffprobe => _cachedFfprobe ?? (_cachedFfprobe = Find("ffprobe"));

    public static bool IsAvailable => Ffmpeg != null && Ffprobe != null;

    /// <summary>Force a re-scan. Useful for the settings UI after a manual install.</summary>
    public static void ResetCache()
    {
        lock (_lock) { _cachedFfmpeg = null; _cachedFfprobe = null; }
    }

    public static string? Find(string name)
    {
        // 1. Env override
        var envKey = name.Equals("ffprobe", StringComparison.OrdinalIgnoreCase)
            ? "WATCHNEXUS_FFPROBE_PATH" : "WATCHNEXUS_FFMPEG_PATH";
        var envPath = Environment.GetEnvironmentVariable(envKey);
        if (!string.IsNullOrWhiteSpace(envPath) && File.Exists(envPath))
            return envPath;

        var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
        var exe = isWindows ? $"{name}.exe" : name;

        // 2. Bundled next to the binaries (installers can ship ffmpeg here).
        var bundled = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "tools", exe),
            Path.Combine(AppContext.BaseDirectory, "ffmpeg", "bin", exe),
            Path.Combine(AppContext.BaseDirectory, exe),
        };
        foreach (var p in bundled) if (File.Exists(p)) return p;

        // 3. OS PATH
        var pathLookup = WhichWhere(name, isWindows);
        if (pathLookup != null) return pathLookup;

        // 4. Common install locations
        var common = isWindows
            ? new[]
              {
                  @"C:\Program Files\ffmpeg\bin\" + exe,
                  @"C:\ffmpeg\bin\" + exe,
                  @"C:\ProgramData\chocolatey\bin\" + exe,
                  Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                               "Microsoft", "WinGet", "Links", exe),
              }
            : new[]
              {
                  $"/usr/bin/{exe}",
                  $"/usr/local/bin/{exe}",
                  $"/opt/ffmpeg/bin/{exe}",
                  $"/opt/homebrew/bin/{exe}",
                  $"/snap/bin/{exe}",
              };
        foreach (var p in common) if (File.Exists(p)) return p;

        return null;
    }

    private static string? WhichWhere(string name, bool isWindows)
    {
        try
        {
            var tool = isWindows ? "where.exe" : "which";
            var psi = new ProcessStartInfo(tool, name)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var proc = Process.Start(psi);
            if (proc == null) return null;
            var output = proc.StandardOutput.ReadToEnd();
            proc.WaitForExit(2000);
            if (proc.ExitCode != 0) return null;
            // `where` can return multiple lines on Windows; take the first existing one.
            foreach (var line in output.Split('\n'))
            {
                var trimmed = line.Trim();
                if (!string.IsNullOrEmpty(trimmed) && File.Exists(trimmed))
                    return trimmed;
            }
        }
        catch { /* fall through */ }
        return null;
    }

    /// <summary>
    /// Quick version probe — `ffmpeg -version` first line. Returns null if missing.
    /// </summary>
    public static string? Version()
    {
        var ff = Ffmpeg;
        if (ff == null) return null;
        try
        {
            var psi = new ProcessStartInfo(ff, "-version")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var proc = Process.Start(psi);
            if (proc == null) return null;
            var line = proc.StandardOutput.ReadLine();
            proc.WaitForExit(2000);
            return line;
        }
        catch { return null; }
    }

    public static string InstallHint()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return "winget install Gyan.FFmpeg  (or download a static build from https://www.gyan.dev/ffmpeg/builds/)";
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            return "brew install ffmpeg";
        // Linux family detection
        if (File.Exists("/etc/arch-release"))   return "sudo pacman -S ffmpeg";
        if (File.Exists("/etc/debian_version")) return "sudo apt install ffmpeg";
        if (File.Exists("/etc/fedora-release") || File.Exists("/etc/redhat-release"))
            return "sudo dnf install ffmpeg  (or RPM Fusion if it's missing from your repos)";
        return "Install ffmpeg from your distro's package manager.";
    }
}

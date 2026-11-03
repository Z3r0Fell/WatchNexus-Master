using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace WatchNexus.Module.Lobster;

/// <summary>
/// Resolved Lobster configuration shared by <see cref="LobsterService"/> (which
/// launches the sidecar) and <see cref="LobsterClient"/> (which calls it).
/// </summary>
public class LobsterSettings
{
    public const string ControlUrlKey = "LOBSTER_CONTROL_URL";
    public const string AuthKeyKey = "LOBSTER_AUTH_KEY";
    public const string SidecarPortKey = "LOBSTER_SIDECAR_PORT";
    public const string HostnameKey = "LOBSTER_HOSTNAME";
    public const string UpstreamHostKey = "LOBSTER_UPSTREAM_HOST";
    public const int DefaultSidecarPort = 19091;

    private readonly object _keyLock = new();
    private string? _controlKey;

    /// <summary>Headscale coordination URL, or null when not (validly) configured.</summary>
    public string? CoordinationUrl { get; }
    /// <summary>Why Lobster is not configured (null when it is).</summary>
    public string? ConfigError { get; }
    public string? AuthKey { get; }
    public string? Hostname { get; }
    public string? UpstreamHost { get; }
    public string DataDir { get; }
    public string StateDir { get; }
    public int AppPort { get; }
    public int SidecarPort { get; }
    public string SidecarBaseUrl => $"http://127.0.0.1:{SidecarPort}";

    public LobsterSettings(IConfiguration? config = null)
    {
        string? Get(string key)
        {
            var v = config?[key] ?? Environment.GetEnvironmentVariable(key);
            return string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        }

        var url = Get(ControlUrlKey);
        if (url == null)
        {
            ConfigError = $"Lobster is not configured: set {ControlUrlKey} to your coordination (Headscale) server URL.";
        }
        else if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
                 || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            ConfigError = $"Lobster is not configured: {ControlUrlKey} must be an absolute http(s) URL.";
        }
        else
        {
            CoordinationUrl = url.TrimEnd('/');
        }

        AuthKey = Get(AuthKeyKey);
        Hostname = Get(HostnameKey);
        UpstreamHost = Get(UpstreamHostKey);
        AppPort = ParsePort(Get("WATCHNEXUS_PORT"), 8001);
        SidecarPort = ParsePort(Get(SidecarPortKey), DefaultSidecarPort);
        DataDir = ResolveDataDir(Get("WATCHNEXUS_DATA_DIR"));
        StateDir = Path.Combine(DataDir, "lobster");
    }

    public bool IsConfigured => CoordinationUrl != null;

    private static int ParsePort(string? v, int fallback) =>
        int.TryParse(v, out var p) && p is > 0 and < 65536 ? p : fallback;

    // Mirrors the data-dir resolution in core Program.cs so the sidecar state
    // lands in the same writable volume as the database.
    private static string ResolveDataDir(string? env)
    {
        if (env != null) return env;
        if (OperatingSystem.IsWindows())
        {
            var pd = Environment.GetEnvironmentVariable("PROGRAMDATA") ?? @"C:\ProgramData";
            return Path.Combine(pd, "WatchNexus");
        }
        return Directory.Exists("/var/lib/watchnexus")
            ? "/var/lib/watchnexus"
            : Path.Combine(AppContext.BaseDirectory, "data");
    }

    /// <summary>
    /// Per-install random key that authenticates calls to the sidecar control
    /// API. Generated once, persisted owner-only (0600) under the state dir,
    /// and handed to the sidecar via its environment.
    /// </summary>
    public string ControlKey
    {
        get
        {
            lock (_keyLock)
            {
                return _controlKey ??= LoadOrCreateControlKey(Path.Combine(StateDir, "control.key"));
            }
        }
    }

    internal static string LoadOrCreateControlKey(string path)
    {
        if (File.Exists(path))
        {
            var existing = File.ReadAllText(path).Trim();
            if (existing.Length >= 32)
            {
                if (!OperatingSystem.IsWindows())
                    File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
                return existing;
            }
        }

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(Path.GetDirectoryName(path)!,
                UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }

        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var tmp = path + ".tmp";
        var options = new FileStreamOptions { Mode = FileMode.Create, Access = FileAccess.Write };
        if (!OperatingSystem.IsWindows())
            options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
        using (var fs = new FileStream(tmp, options))
        using (var w = new StreamWriter(fs))
        {
            w.Write(key);
        }
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(tmp, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        File.Move(tmp, path, overwrite: true);
        return key;
    }
}

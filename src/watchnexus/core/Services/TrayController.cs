using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Services;

/// <summary>
/// Standalone user-session controller. Reached by launching
/// <c>WatchNexus.Core.exe --tray</c> from the Windows logon Run key or
/// the Linux <c>xdg/autostart</c> entry. Shows a system tray icon that
/// talks to the running WatchNexus service over <c>http://localhost</c>.
///
/// We deliberately keep the public surface to a single static
/// <see cref="Run"/> method so <c>Program.cs</c> can dispatch into it
/// without booting Kestrel / EF Core / module loading.
/// </summary>
public static class TrayController
{
    public const string AppVersion = "1.0.0";

    public static int Run(int port, Action<string> log)
    {
        log($"[Tray] Port  : {port}");
        log($"[Tray] Base  : {AppContext.BaseDirectory}");

        try
        {
            if (OperatingSystem.IsWindows())
                return RunWindows(port, log);
            if (OperatingSystem.IsLinux())
                return RunLinux(port, log);

            log("[Tray] Unsupported OS for tray controller.");
            return 0;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "[TrayController] Run failed");

            log($"[Tray] [FATAL] {ex.GetType().Name}: {ex.Message}");
            log(ex.StackTrace ?? "");
            return 1;
        }
    }

    // ── Shared helpers ────────────────────────────────────────────

    private static string? ResolveIcon()
    {
        // Search the same locations the installer ships the .ico to.
        var candidates = new[]
        {
            // Windows installer drops the .ico next to bin\ at $INSTDIR\.
            Path.Combine(AppContext.BaseDirectory, "..", "watchnexus.ico"),
            // Linux fpm packaging puts it at /opt/watchnexus/watchnexus.ico.
            Path.Combine(AppContext.BaseDirectory, "..", "watchnexus.ico"),
            Path.Combine(AppContext.BaseDirectory, "watchnexus.ico"),
            // Dev fallback
            Path.Combine(AppContext.BaseDirectory, "web", "build", "favicon.png"),
        };
        foreach (var c in candidates)
        {
            var full = Path.GetFullPath(c);
            if (File.Exists(full)) return full;
        }
        return null;
    }

    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(3) };

    public static async Task<bool> PingAsync(int port)
    {
        try
        {
            using var resp = await _http.GetAsync($"http://localhost:{port}/api/health");
            return resp.IsSuccessStatusCode;
        }
        catch { Log.Error("[TrayController] PingAsync failed"); return false; }
    }

    public static void OpenUrl(string url)
    {
        try
        {
            if (OperatingSystem.IsWindows())
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            else if (OperatingSystem.IsLinux())
                Process.Start("xdg-open", url);
            else if (OperatingSystem.IsMacOS())
                Process.Start("open", url);
        }
        catch { Log.Error("[TrayController] OpenUrl failed"); }
    }

    public static void OpenPath(string path)
    {
        try
        {
            Directory.CreateDirectory(path);
            if (OperatingSystem.IsWindows())
                Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
            else if (OperatingSystem.IsLinux())
                Process.Start("xdg-open", path);
            else if (OperatingSystem.IsMacOS())
                Process.Start("open", path);
        }
        catch { Log.Error("[TrayController] OpenPath failed"); }
    }

    // ── WINDOWS ───────────────────────────────────────────────────

    private static int RunWindows(int port, Action<string> log)
    {
#if WINDOWS_BUILD
        // STA thread is required for WinForms + NotifyIcon.
        System.Windows.Forms.Application.EnableVisualStyles();
        System.Windows.Forms.Application.SetCompatibleTextRenderingDefault(false);

        var iconPath = ResolveIcon();
        log($"[Tray] Icon  : {iconPath ?? "(fallback)"}");

        System.Drawing.Icon icon;
        try
        {
            icon = iconPath != null && iconPath.EndsWith(".ico", StringComparison.OrdinalIgnoreCase)
                ? new System.Drawing.Icon(iconPath)
                : System.Drawing.SystemIcons.Application;
        }
        catch { Log.Error("[TrayController] operation failed"); icon = System.Drawing.SystemIcons.Application; }

        var tray = new System.Windows.Forms.NotifyIcon
        {
            Icon = icon,
            Text = $"WatchNexus v{AppVersion}",
            Visible = true,
            ContextMenuStrip = BuildWindowsMenu(port, log),
        };
        tray.DoubleClick += (_, _) => OpenUrl($"http://localhost:{port}");

        System.Windows.Forms.Application.ApplicationExit += (_, _) =>
        {
            try { tray.Visible = false; tray.Dispose(); } catch { Log.Error("[TrayController] operation failed"); }
        };

        log("[Tray] System tray icon active. Right-click for menu.");
        System.Windows.Forms.Application.Run();
        return 0;
#else
        log("[Tray] WINDOWS_BUILD not defined — tray unavailable in this build.");
        return 1;
#endif
    }

#if WINDOWS_BUILD
    private static System.Windows.Forms.ContextMenuStrip BuildWindowsMenu(int port, Action<string> log)
    {
        var menu = new System.Windows.Forms.ContextMenuStrip();

        menu.Items.Add(new System.Windows.Forms.ToolStripLabel($"WatchNexus v{AppVersion}")
        {
            ForeColor = System.Drawing.Color.Gray,
            Font = new System.Drawing.Font("Segoe UI", 9, System.Drawing.FontStyle.Italic),
        });
        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        var open = new System.Windows.Forms.ToolStripMenuItem("Open WatchNexus")
        {
            Font = new System.Drawing.Font("Segoe UI", 9, System.Drawing.FontStyle.Bold),
        };
        open.Click += (_, _) => OpenUrl($"http://localhost:{port}");
        menu.Items.Add(open);

        var settings = new System.Windows.Forms.ToolStripMenuItem("Open Settings");
        settings.Click += (_, _) => OpenUrl($"http://localhost:{port}/settings");
        menu.Items.Add(settings);

        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        // ── Service control (sc.exe) ──
        var svcLabel = new System.Windows.Forms.ToolStripLabel("Service")
        {
            ForeColor = System.Drawing.Color.DimGray,
            Font = new System.Drawing.Font("Segoe UI", 8, System.Drawing.FontStyle.Bold),
        };
        menu.Items.Add(svcLabel);

        var stopSvc = new System.Windows.Forms.ToolStripMenuItem("Stop Service");
        stopSvc.Click += (_, _) => RunSc("stop");
        menu.Items.Add(stopSvc);

        var startSvc = new System.Windows.Forms.ToolStripMenuItem("Start Service");
        startSvc.Click += (_, _) => RunSc("start");
        menu.Items.Add(startSvc);

        var restartSvc = new System.Windows.Forms.ToolStripMenuItem("Restart Service");
        restartSvc.Click += (_, _) =>
        {
            RunSc("stop");
            System.Threading.Thread.Sleep(1500);
            RunSc("start");
        };
        menu.Items.Add(restartSvc);

        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        // ── Folders ──
        var logs = new System.Windows.Forms.ToolStripMenuItem("Open Log Folder");
        logs.Click += (_, _) =>
        {
            var pd = Environment.GetEnvironmentVariable("PROGRAMDATA") ?? @"C:\ProgramData";
            OpenPath(Path.Combine(pd, "WatchNexus", "logs"));
        };
        menu.Items.Add(logs);

        var data = new System.Windows.Forms.ToolStripMenuItem("Open Data Folder");
        data.Click += (_, _) =>
        {
            var pd = Environment.GetEnvironmentVariable("PROGRAMDATA") ?? @"C:\ProgramData";
            OpenPath(Path.Combine(pd, "WatchNexus"));
        };
        menu.Items.Add(data);

        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        // ── About / Quit ──
        var about = new System.Windows.Forms.ToolStripMenuItem("About WatchNexus");
        about.Click += (_, _) =>
        {
            System.Windows.Forms.MessageBox.Show(
                $"WatchNexus v{AppVersion}\n\nSelf-hosted modular media server.\n\nhttps://watchnexus.ca",
                "About WatchNexus",
                System.Windows.Forms.MessageBoxButtons.OK,
                System.Windows.Forms.MessageBoxIcon.Information);
        };
        menu.Items.Add(about);

        var quit = new System.Windows.Forms.ToolStripMenuItem("Quit Tray Icon");
        quit.Click += (_, _) => System.Windows.Forms.Application.Exit();
        menu.Items.Add(quit);

        return menu;
    }

    private static void RunSc(string verb)
    {
        try
        {
            // The NSIS installer creates a service called "WatchNexusCore".
            var psi = new ProcessStartInfo("sc.exe", $"{verb} WatchNexusCore")
            {
                UseShellExecute = true,           // triggers UAC if needed
                Verb = "runas",
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };
            Process.Start(psi);
        }
        catch { Log.Error("[TrayController] The NSIS installer creates a service called 'WatchNexusCore'"); }
    }
#endif

    // ── LINUX ─────────────────────────────────────────────────────

    private static int RunLinux(int port, Action<string> log)
    {
        // Skip on headless (no DISPLAY / WAYLAND_DISPLAY).
        var disp = Environment.GetEnvironmentVariable("DISPLAY")
                ?? Environment.GetEnvironmentVariable("WAYLAND_DISPLAY");
        if (string.IsNullOrEmpty(disp))
        {
            log("[Tray] No display server detected — exiting.");
            return 0;
        }

        // We bundle a Python AppIndicator3 helper that we drop next to
        // the binary and exec. It blocks until the user picks "Quit".
        var iconPath = ResolveIcon() ?? "";
        var scriptPath = Path.Combine(Path.GetTempPath(), "watchnexus-tray.py");
        File.WriteAllText(scriptPath, GetLinuxTrayScript(port, iconPath));

        var psi = new ProcessStartInfo
        {
            FileName = "python3",
            ArgumentList = { scriptPath, port.ToString(), iconPath },
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        log($"[Tray] Launching Linux tray helper: python3 {scriptPath}");
        try
        {
            using var p = Process.Start(psi)!;
            p.WaitForExit();
            log($"[Tray] Helper exited with code {p.ExitCode}");
            return p.ExitCode;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "[TrayController] operation failed");

            log($"[Tray] Could not launch Python helper: {ex.Message}");
            log("[Tray] Install:  sudo apt install gir1.2-ayatanaappindicator3-0.1 python3-gi");
            return 1;
        }
    }

    private static string GetLinuxTrayScript(int port, string iconPath)
    {
        return $@"#!/usr/bin/env python3
import sys, os, subprocess, signal

PORT = {port}
ICON = r'''{iconPath}''' or 'applications-multimedia'

try:
    import gi
    gi.require_version('Gtk', '3.0')
    mod = None
    for m in ('AyatanaAppIndicator3', 'AppIndicator3'):
        try:
            gi.require_version(m, '0.1'); mod = m; break
        except Exception:
            continue
    if mod is None:
        raise ImportError('No AppIndicator3 module installed')
    from gi.repository import Gtk
    AppIndicator3 = getattr(__import__('gi.repository', fromlist=[mod]), mod)
except Exception as e:
    print(f'[WatchNexus Tray] {{e}}', file=sys.stderr)
    sys.exit(1)

ind = AppIndicator3.Indicator.new('watchnexus', ICON,
    AppIndicator3.IndicatorCategory.APPLICATION_STATUS)
ind.set_status(AppIndicator3.IndicatorStatus.ACTIVE)
ind.set_title('WatchNexus')

menu = Gtk.Menu()

hdr = Gtk.MenuItem(label='WatchNexus v{AppVersion}')
hdr.set_sensitive(False)
menu.append(hdr); menu.append(Gtk.SeparatorMenuItem())

def open_url(url):
    subprocess.Popen(['xdg-open', url])

m = Gtk.MenuItem(label='Open WatchNexus')
m.connect('activate', lambda _: open_url(f'http://localhost:{{PORT}}'))
menu.append(m)

m = Gtk.MenuItem(label='Open Settings')
m.connect('activate', lambda _: open_url(f'http://localhost:{{PORT}}/settings'))
menu.append(m)

menu.append(Gtk.SeparatorMenuItem())

# systemctl service control (uses pkexec for elevation)
def svc(verb):
    subprocess.Popen(['pkexec', 'systemctl', verb, 'watchnexus.service'])
for label, verb in [('Stop Service', 'stop'),
                    ('Start Service', 'start'),
                    ('Restart Service', 'restart')]:
    m = Gtk.MenuItem(label=label)
    m.connect('activate', lambda _, v=verb: svc(v))
    menu.append(m)

menu.append(Gtk.SeparatorMenuItem())

m = Gtk.MenuItem(label='Open Log Folder')
m.connect('activate', lambda _: open_url('/var/log/watchnexus'))
menu.append(m)

m = Gtk.MenuItem(label='Open Data Folder')
m.connect('activate', lambda _: open_url('/var/lib/watchnexus'))
menu.append(m)

menu.append(Gtk.SeparatorMenuItem())

m = Gtk.MenuItem(label='Quit Tray Icon')
m.connect('activate', lambda _: Gtk.main_quit())
menu.append(m)

menu.show_all()
ind.set_menu(menu)
signal.signal(signal.SIGTERM, lambda *_: Gtk.main_quit())
signal.signal(signal.SIGINT,  lambda *_: Gtk.main_quit())
print('[WatchNexus Tray] active', file=sys.stderr)
Gtk.main()
";
    }
}

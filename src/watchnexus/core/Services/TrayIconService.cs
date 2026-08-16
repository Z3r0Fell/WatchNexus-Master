using System.Diagnostics;
using System.Runtime.InteropServices;

namespace WatchNexus.Core.Services;

/// <summary>
/// Background service that creates a system tray icon on supported desktop platforms.
/// Windows: Native WinForms NotifyIcon on a dedicated STA thread.
/// Linux:   Launches an embedded Python helper using GTK AppIndicator3.
/// Fails gracefully on headless / unsupported environments.
/// </summary>
public sealed class TrayIconService : BackgroundService
{
    private readonly IHostApplicationLifetime _lifetime;
    private readonly ILogger<TrayIconService> _logger;
    private readonly int _port;
    private Process? _linuxTrayProcess;

    private const string AppVersion = "1.0.3";

    public TrayIconService(IHostApplicationLifetime lifetime, ILogger<TrayIconService> logger)
    {
        _lifetime = lifetime;
        _logger = logger;
        _port = int.TryParse(Environment.GetEnvironmentVariable("WATCHNEXUS_PORT"), out var p) ? p : 8001;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ── Session 0 / non-interactive guard ──
        // Windows Services run in Session 0 with no desktop, so NotifyIcon
        // would silently fail. The user-session tray is now spawned via
        // `WatchNexus.Core.exe --tray` from the HKLM\...\Run autostart
        // (Windows) or `/etc/xdg/autostart/watchnexus-tray.desktop` (Linux),
        // both handled by TrayController. So if we're not interactive,
        // just no-op here.
        if (!Environment.UserInteractive)
        {
            _logger.LogInformation("[Tray] In-service tray skipped (not user-interactive). "
                + "The user-session controller is launched separately by the installer.");
            return Task.CompletedTask;
        }
        if (OperatingSystem.IsLinux())
        {
            var disp = Environment.GetEnvironmentVariable("DISPLAY")
                    ?? Environment.GetEnvironmentVariable("WAYLAND_DISPLAY");
            if (string.IsNullOrEmpty(disp))
            {
                _logger.LogInformation("[Tray] No DISPLAY/WAYLAND_DISPLAY — running headless, skipping in-process tray.");
                return Task.CompletedTask;
            }
        }

        var iconPath = ResolveIconPath();

        var thread = new Thread(() => SafeRunTray(iconPath, stoppingToken))
        {
            IsBackground = true,
            Name = "WNTray"
        };

        if (OperatingSystem.IsWindows())
            thread.SetApartmentState(ApartmentState.STA);

        thread.Start();
        return Task.CompletedTask;
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (_linuxTrayProcess is { HasExited: false })
            {
                _linuxTrayProcess.Kill();
                _linuxTrayProcess.Dispose();
                _linuxTrayProcess = null;
                _logger.LogInformation("[Tray] Linux tray subprocess terminated");
            }
        }
        catch { /* best-effort cleanup */ }

        await base.StopAsync(cancellationToken);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private string? ResolveIconPath()
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "web", "build", "watchnexus-logo.png"),
            Path.Combine(AppContext.BaseDirectory, "watchnexus-logo.png"),
        };
        var found = candidates.FirstOrDefault(File.Exists);
        if (found != null)
            _logger.LogInformation("[Tray] Using icon: {Path}", found);
        return found;
    }

    private void OpenBrowser()
    {
        var url = $"http://localhost:{_port}";
        try
        {
            if (OperatingSystem.IsWindows())
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            else if (OperatingSystem.IsLinux())
                Process.Start("xdg-open", url);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Tray] Failed to open browser to {Url}", url);
        }
    }

    private void RequestShutdown()
    {
        _logger.LogInformation("[Tray] Shutdown requested via tray icon");
        _lifetime.StopApplication();
    }

    private void RestartServer()
    {
        _logger.LogInformation("[Tray] Restart requested via tray icon");
        // Relaunch self then exit
        var exe = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
        if (exe != null)
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                WorkingDirectory = AppContext.BaseDirectory,
                UseShellExecute = true,
            });
        }
        _lifetime.StopApplication();
    }

    private static string GetConfigPath()
    {
        return Path.Combine(AppContext.BaseDirectory, "appsettings.json");
    }

    private void OpenPreferencesInBrowser()
    {
        var url = $"http://localhost:{_port}/settings";
        try
        {
            if (OperatingSystem.IsWindows())
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            else if (OperatingSystem.IsLinux())
                Process.Start("xdg-open", url);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Tray] Failed to open preferences");
        }
    }

    private void SafeRunTray(string? iconPath, CancellationToken ct)
    {
        try
        {
            if (OperatingSystem.IsWindows())
                RunWindowsTray(iconPath, ct);
            else if (OperatingSystem.IsLinux())
                RunLinuxTray(iconPath, ct);
            else
                _logger.LogInformation("[Tray] No tray icon support for this OS");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Tray] System tray icon failed to initialize — server continues without it");
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  WINDOWS — WinForms NotifyIcon
    // ══════════════════════════════════════════════════════════════

    private void RunWindowsTray(string? iconPath, CancellationToken ct)
    {
#if WINDOWS_BUILD
        System.Drawing.Icon? icon = null;

        // Try loading from PNG file
        if (iconPath != null && File.Exists(iconPath))
        {
            try
            {
                using var bmp = new System.Drawing.Bitmap(iconPath);
                using var scaled = new System.Drawing.Bitmap(bmp, 32, 32);
                icon = System.Drawing.Icon.FromHandle(scaled.GetHicon());
            }
            catch { /* fall through to branded icon */ }
        }

        // Fallback: generate a branded "W" icon
        icon ??= CreateBrandedIcon();
        icon ??= System.Drawing.SystemIcons.Application;

        var trayIcon = new System.Windows.Forms.NotifyIcon
        {
            Icon = icon,
            Text = $"WatchNexus v{AppVersion}",
            Visible = true,
            ContextMenuStrip = BuildWindowsMenu()
        };

        trayIcon.DoubleClick += (_, _) => OpenBrowser();

        ct.Register(() =>
        {
            trayIcon.Visible = false;
            trayIcon.Dispose();
            System.Windows.Forms.Application.ExitThread();
        });

        _logger.LogInformation("[Tray] Windows system tray icon loaded successfully");
        System.Windows.Forms.Application.Run();
#else
        _logger.LogDebug("[Tray] Windows tray not compiled into this build");
#endif
    }

#if WINDOWS_BUILD
    private static System.Drawing.Icon? CreateBrandedIcon()
    {
        try
        {
            using var bmp = new System.Drawing.Bitmap(32, 32);
            using var g = System.Drawing.Graphics.FromImage(bmp);
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            g.Clear(System.Drawing.Color.FromArgb(109, 40, 217));
            using var brush = new System.Drawing.SolidBrush(System.Drawing.Color.White);
            using var font = new System.Drawing.Font("Segoe UI", 16, System.Drawing.FontStyle.Bold);
            g.DrawString("W", font, brush, 2, 2);
            return System.Drawing.Icon.FromHandle(bmp.GetHicon());
        }
        catch { return null; }
    }

    private System.Windows.Forms.ContextMenuStrip BuildWindowsMenu()
    {
        var menu = new System.Windows.Forms.ContextMenuStrip();

        // ── Header ──
        menu.Items.Add(new System.Windows.Forms.ToolStripLabel($"WatchNexus v{AppVersion}")
        {
            ForeColor = System.Drawing.Color.Gray,
            Font = new System.Drawing.Font("Segoe UI", 9, System.Drawing.FontStyle.Italic)
        });
        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        // ── Open Browser ──
        var open = new System.Windows.Forms.ToolStripMenuItem("Open WatchNexus");
        open.Font = new System.Drawing.Font("Segoe UI", 9, System.Drawing.FontStyle.Bold);
        open.Click += (_, _) => OpenBrowser();
        menu.Items.Add(open);

        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        // ── Server Control ──
        var serverLabel = new System.Windows.Forms.ToolStripLabel("Server")
        {
            ForeColor = System.Drawing.Color.DimGray,
            Font = new System.Drawing.Font("Segoe UI", 8, System.Drawing.FontStyle.Bold)
        };
        menu.Items.Add(serverLabel);

        var stop = new System.Windows.Forms.ToolStripMenuItem("Stop Server");
        stop.Click += (_, _) => RequestShutdown();
        menu.Items.Add(stop);

        var restart = new System.Windows.Forms.ToolStripMenuItem("Restart Server");
        restart.Click += (_, _) => RestartServer();
        menu.Items.Add(restart);

        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        // ── Preferences Submenu ──
        var prefs = new System.Windows.Forms.ToolStripMenuItem("Preferences");

        var portItem = new System.Windows.Forms.ToolStripMenuItem($"Server Port: {_port}");
        portItem.Enabled = false;
        prefs.DropDownItems.Add(portItem);

        prefs.DropDownItems.Add(new System.Windows.Forms.ToolStripSeparator());

        var openSettings = new System.Windows.Forms.ToolStripMenuItem("Open Settings Page");
        openSettings.Click += (_, _) => OpenPreferencesInBrowser();
        prefs.DropDownItems.Add(openSettings);

        var portForward = new System.Windows.Forms.ToolStripMenuItem("Port Forwarding (UPnP)");
        portForward.Click += (_, _) => OpenPortForwardingUrl();
        prefs.DropDownItems.Add(portForward);

        var editConfig = new System.Windows.Forms.ToolStripMenuItem("Edit appsettings.json");
        editConfig.Click += (_, _) => OpenConfigFile();
        prefs.DropDownItems.Add(editConfig);

        prefs.DropDownItems.Add(new System.Windows.Forms.ToolStripSeparator());

        var openLogs = new System.Windows.Forms.ToolStripMenuItem("Open Log Folder");
        openLogs.Click += (_, _) => OpenLogFolder();
        prefs.DropDownItems.Add(openLogs);

        var openDataDir = new System.Windows.Forms.ToolStripMenuItem("Open Data Folder");
        openDataDir.Click += (_, _) => OpenDataFolder();
        prefs.DropDownItems.Add(openDataDir);

        menu.Items.Add(prefs);

        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        // ── Quit ──
        var quit = new System.Windows.Forms.ToolStripMenuItem("Quit WatchNexus");
        quit.Click += (_, _) => RequestShutdown();
        menu.Items.Add(quit);

        return menu;
    }

    private void OpenPortForwardingUrl()
    {
        // Open the Gelatin external access page which handles UPnP / port forwarding
        var url = $"http://localhost:{_port}/settings?tab=gelatin";
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception ex) { _logger.LogWarning(ex, "[Tray] Failed to open port forwarding page"); }
    }

    private void OpenConfigFile()
    {
        var path = GetConfigPath();
        try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); }
        catch (Exception ex) { _logger.LogWarning(ex, "[Tray] Failed to open config file"); }
    }

    private void OpenLogFolder()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "logs");
        Directory.CreateDirectory(path);
        try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); }
        catch (Exception ex) { _logger.LogWarning(ex, "[Tray] Failed to open log folder"); }
    }

    private void OpenDataFolder()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data");
        Directory.CreateDirectory(path);
        try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); }
        catch (Exception ex) { _logger.LogWarning(ex, "[Tray] Failed to open data folder"); }
    }
#endif

    // ══════════════════════════════════════════════════════════════
    //  LINUX — Python AppIndicator3 subprocess
    // ══════════════════════════════════════════════════════════════

    private void RunLinuxTray(string? iconPath, CancellationToken ct)
    {
        // Skip on headless systems (no display server)
        var display = Environment.GetEnvironmentVariable("DISPLAY")
                   ?? Environment.GetEnvironmentVariable("WAYLAND_DISPLAY");
        if (string.IsNullOrEmpty(display))
        {
            _logger.LogInformation("[Tray] No display server detected (headless mode) — skipping tray icon");
            return;
        }

        // Write the embedded Python helper to disk
        var scriptPath = Path.Combine(AppContext.BaseDirectory, "watchnexus-tray.py");
        File.WriteAllText(scriptPath, GetLinuxTrayScript());

        var exePath = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName ?? "";

        var psi = new ProcessStartInfo
        {
            FileName = "python3",
            ArgumentList = { scriptPath, _port.ToString(), iconPath ?? "", exePath },
            UseShellExecute = false,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            CreateNoWindow = true,
        };

        try
        {
            _linuxTrayProcess = Process.Start(psi);
            if (_linuxTrayProcess == null)
            {
                _logger.LogWarning("[Tray] Failed to start Linux tray subprocess");
                return;
            }

            _logger.LogInformation("[Tray] Linux system tray icon launched (PID {Pid})", _linuxTrayProcess.Id);

            ct.Register(() =>
            {
                try
                {
                    if (_linuxTrayProcess is { HasExited: false })
                    {
                        _linuxTrayProcess.Kill();
                        _linuxTrayProcess.Dispose();
                        _linuxTrayProcess = null;
                    }
                }
                catch { }
            });

            // Monitor stderr for diagnostic output
            _ = Task.Run(async () =>
            {
                try
                {
                    while (_linuxTrayProcess != null && !_linuxTrayProcess.HasExited)
                    {
                        var line = await _linuxTrayProcess.StandardError.ReadLineAsync();
                        if (line != null)
                            _logger.LogDebug("[Tray/Py] {Line}", line);
                    }
                }
                catch { }
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogInformation("[Tray] Could not start tray helper: {Msg}. Install python3 for tray icon support", ex.Message);
        }
    }

    private static string GetLinuxTrayScript()
    {
        return $@"#!/usr/bin/env python3
import sys, os, subprocess, signal

def main():
    port = sys.argv[1] if len(sys.argv) > 1 else ""8001""
    icon_path = sys.argv[2] if len(sys.argv) > 2 else """"
    exe_path = sys.argv[3] if len(sys.argv) > 3 else """"
    ppid = os.getppid()

    try:
        import gi
        gi.require_version('Gtk', '3.0')
        indicator_mod = None
        for mod_name in ('AyatanaAppIndicator3', 'AppIndicator3'):
            try:
                gi.require_version(mod_name, '0.1')
                indicator_mod = mod_name
                break
            except Exception:
                continue
        if indicator_mod is None:
            raise ImportError(""No AppIndicator3 module found"")
        from gi.repository import Gtk
        AppIndicator3 = getattr(__import__('gi.repository', fromlist=[indicator_mod]), indicator_mod)
    except Exception as e:
        print(f""[WatchNexus Tray] GTK/AppIndicator not available: {{e}}"", file=sys.stderr)
        print(""[WatchNexus Tray] Install: sudo apt install gir1.2-ayatanaappindicator3-0.1"", file=sys.stderr)
        sys.exit(1)

    icon_arg = icon_path if icon_path and os.path.isfile(icon_path) else ""applications-multimedia""

    indicator = AppIndicator3.Indicator.new(
        ""watchnexus"", icon_arg,
        AppIndicator3.IndicatorCategory.APPLICATION_STATUS
    )
    indicator.set_status(AppIndicator3.IndicatorStatus.ACTIVE)
    indicator.set_title(""WatchNexus"")

    menu = Gtk.Menu()

    header = Gtk.MenuItem(label=""WatchNexus v{AppVersion}"")
    header.set_sensitive(False)
    menu.append(header)
    menu.append(Gtk.SeparatorMenuItem())

    # Open in browser
    item_open = Gtk.MenuItem(label=""Open WatchNexus"")
    item_open.connect(""activate"", lambda _: subprocess.Popen([""xdg-open"", f""http://localhost:{{port}}""]))
    menu.append(item_open)

    menu.append(Gtk.SeparatorMenuItem())

    # Server control
    item_stop = Gtk.MenuItem(label=""Stop Server"")
    def on_stop(_):
        try: os.kill(ppid, signal.SIGTERM)
        except: pass
        Gtk.main_quit()
    item_stop.connect(""activate"", on_stop)
    menu.append(item_stop)

    item_restart = Gtk.MenuItem(label=""Restart Server"")
    def on_restart(_):
        if exe_path and os.path.isfile(exe_path):
            base_dir = os.path.dirname(exe_path)
            subprocess.Popen([exe_path], cwd=base_dir)
        try: os.kill(ppid, signal.SIGTERM)
        except: pass
        Gtk.main_quit()
    item_restart.connect(""activate"", on_restart)
    menu.append(item_restart)

    menu.append(Gtk.SeparatorMenuItem())

    # Preferences submenu
    prefs = Gtk.MenuItem(label=""Preferences"")
    prefs_menu = Gtk.Menu()

    port_info = Gtk.MenuItem(label=f""Server Port: {{port}}"")
    port_info.set_sensitive(False)
    prefs_menu.append(port_info)
    prefs_menu.append(Gtk.SeparatorMenuItem())

    item_settings = Gtk.MenuItem(label=""Open Settings Page"")
    item_settings.connect(""activate"", lambda _: subprocess.Popen([""xdg-open"", f""http://localhost:{{port}}/settings""]))
    prefs_menu.append(item_settings)

    item_port_fwd = Gtk.MenuItem(label=""Port Forwarding (UPnP)"")
    item_port_fwd.connect(""activate"", lambda _: subprocess.Popen([""xdg-open"", f""http://localhost:{{port}}/settings?tab=gelatin""]))
    prefs_menu.append(item_port_fwd)

    prefs_menu.append(Gtk.SeparatorMenuItem())

    if exe_path:
        base_dir = os.path.dirname(exe_path)
        item_logs = Gtk.MenuItem(label=""Open Log Folder"")
        log_dir = os.path.join(base_dir, ""logs"")
        os.makedirs(log_dir, exist_ok=True)
        item_logs.connect(""activate"", lambda _: subprocess.Popen([""xdg-open"", log_dir]))
        prefs_menu.append(item_logs)

        item_data = Gtk.MenuItem(label=""Open Data Folder"")
        data_dir = os.path.join(base_dir, ""data"")
        os.makedirs(data_dir, exist_ok=True)
        item_data.connect(""activate"", lambda _: subprocess.Popen([""xdg-open"", data_dir]))
        prefs_menu.append(item_data)

    prefs.set_submenu(prefs_menu)
    menu.append(prefs)

    menu.append(Gtk.SeparatorMenuItem())

    # Quit
    item_quit = Gtk.MenuItem(label=""Quit WatchNexus"")
    item_quit.connect(""activate"", on_stop)
    menu.append(item_quit)

    menu.show_all()
    indicator.set_menu(menu)

    signal.signal(signal.SIGTERM, lambda *_: Gtk.main_quit())
    signal.signal(signal.SIGINT, lambda *_: Gtk.main_quit())

    print(""[WatchNexus Tray] System tray icon active"", file=sys.stderr)
    Gtk.main()

if __name__ == ""__main__"":
    main()
";
    }
}

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

    private const string AppVersion = "2.8.2.2";

    public TrayIconService(IHostApplicationLifetime lifetime, ILogger<TrayIconService> logger)
    {
        _lifetime = lifetime;
        _logger = logger;
        _port = int.TryParse(Environment.GetEnvironmentVariable("WATCHNEXUS_PORT"), out var p) ? p : 8002;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
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

        menu.Items.Add(new System.Windows.Forms.ToolStripLabel($"WatchNexus v{AppVersion}")
        {
            ForeColor = System.Drawing.Color.Gray,
            Font = new System.Drawing.Font("Segoe UI", 9, System.Drawing.FontStyle.Italic)
        });
        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        var open = new System.Windows.Forms.ToolStripMenuItem("Open WatchNexus");
        open.Font = new System.Drawing.Font("Segoe UI", 9, System.Drawing.FontStyle.Bold);
        open.Click += (_, _) => OpenBrowser();
        menu.Items.Add(open);

        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());

        var quit = new System.Windows.Forms.ToolStripMenuItem("Quit WatchNexus");
        quit.Click += (_, _) => RequestShutdown();
        menu.Items.Add(quit);

        return menu;
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

        var psi = new ProcessStartInfo
        {
            FileName = "python3",
            ArgumentList = { scriptPath, _port.ToString(), iconPath ?? "" },
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
    port = sys.argv[1] if len(sys.argv) > 1 else ""8002""
    icon_path = sys.argv[2] if len(sys.argv) > 2 else """"
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

    item_open = Gtk.MenuItem(label=""Open WatchNexus"")
    item_open.connect(""activate"", lambda _: subprocess.Popen([""xdg-open"", f""http://localhost:{{port}}""]))
    menu.append(item_open)

    menu.append(Gtk.SeparatorMenuItem())

    def on_quit(_):
        try:
            os.kill(ppid, signal.SIGTERM)
        except Exception:
            pass
        Gtk.main_quit()

    item_quit = Gtk.MenuItem(label=""Quit WatchNexus"")
    item_quit.connect(""activate"", on_quit)
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

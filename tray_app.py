"""
WatchNexus System Tray Application
Cross-platform system tray controller for WatchNexus server.

Codename: Beacon 🔦
Includes: Tiramisu 🍰 (Auto-Updater)

Works on:
- Windows (requires pystray with win32 backend)
- macOS (requires pystray with AppKit backend)  
- Linux (requires pystray with AppIndicator/GTK backend)

Features:
- Start/Stop/Restart server
- Server health monitoring
- Quick access to web UI sections
- System resource display
- Auto-start on launch
- Notifications
- Auto-update checking (Tiramisu)

Usage:
    python tray_app.py
    python tray_app.py --port 8001
    python tray_app.py --no-auto-start
    python tray_app.py --no-update-check

Requirements:
    pip install pystray pillow requests psutil
"""

import os
import sys
import webbrowser
import subprocess
import signal
import threading
import time
import json
from pathlib import Path
from datetime import datetime

try:
    import pystray
    from PIL import Image, ImageDraw, ImageFont
    import requests
    import psutil
except ImportError as e:
    missing = str(e).split("'")[1] if "'" in str(e) else str(e)
    print(f"Missing dependency: {missing}")
    print("Install with: pip install pystray pillow requests psutil")
    sys.exit(1)

# Import Tiramisu updater
try:
    from tiramisu import TiramisuUpdater, UpdateInfo
    HAS_TIRAMISU = True
except ImportError:
    HAS_TIRAMISU = False
    TiramisuUpdater = None
    UpdateInfo = None

# Optional: cairosvg for SVG icon support
try:
    import cairosvg
    import io
    HAS_CAIROSVG = True
except ImportError:
    HAS_CAIROSVG = False

# Configuration
DEFAULT_PORT = 8001
WATCHNEXUS_DIR = Path(__file__).parent
BACKEND_DIR = WATCHNEXUS_DIR / "backend"
SERVER_SCRIPT = BACKEND_DIR / "server.py"
LOGO_SVG_PATH = WATCHNEXUS_DIR / "frontend" / "public" / "watchnexus-logo.svg"
LOGO_PNG_PATH = WATCHNEXUS_DIR / "frontend" / "public" / "watchnexus-logo.png"
LOG_FILE = BACKEND_DIR / "logs" / "watchnexus.log"

# Version
TRAY_VERSION = "1.0.0"
CODENAME = "Beacon"


class ServerMonitor:
    """Monitor server health and status."""
    
    def __init__(self, port: int):
        self.port = port
        self.base_url = f"http://localhost:{port}"
        self.last_health = None
        self.last_check = None
        self.consecutive_failures = 0
        
    def check_health(self) -> dict:
        """Check server health status."""
        try:
            response = requests.get(
                f"{self.base_url}/api/health",
                timeout=2
            )
            if response.status_code == 200:
                self.last_health = response.json()
                self.last_check = datetime.now()
                self.consecutive_failures = 0
                return {"status": "healthy", "data": self.last_health}
        except requests.exceptions.ConnectionError:
            pass
        except Exception as e:
            pass
        
        self.consecutive_failures += 1
        return {"status": "unreachable", "failures": self.consecutive_failures}
    
    def get_system_stats(self) -> dict:
        """Get system resource usage."""
        try:
            response = requests.get(
                f"{self.base_url}/api/zest/stats",
                timeout=2
            )
            if response.status_code == 200:
                return response.json()
        except:
            pass
        
        # Fallback to local psutil
        return {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        }
    
    def get_active_downloads(self) -> int:
        """Get number of active downloads."""
        try:
            response = requests.get(
                f"{self.base_url}/api/downloads/active",
                timeout=2
            )
            if response.status_code == 200:
                data = response.json()
                return len(data.get("downloads", []))
        except:
            pass
        return 0


class WatchNexusTray:
    """System tray application for controlling WatchNexus server."""
    
    def __init__(self, port: int = DEFAULT_PORT, check_updates: bool = True):
        self.server_process = None
        self.server_running = False
        self.port = port
        self.icon = None
        self._stop_event = threading.Event()
        self.monitor = ServerMonitor(port)
        self._health_thread = None
        self._last_notification = None
        
        # Tiramisu updater
        self.check_updates = check_updates and HAS_TIRAMISU
        self.updater = None
        self.available_update = None
        
        if self.check_updates:
            self._init_updater()
        
    def create_icon_image(self, running=False, warning=False):
        """Create a tray icon image programmatically."""
        size = 64
        image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # Background circle color based on state
        if running:
            bg_color = (124, 58, 237, 255)  # Violet - running
        elif warning:
            bg_color = (234, 179, 8, 255)   # Yellow - warning
        else:
            bg_color = (75, 85, 99, 255)    # Gray - stopped
            
        draw.ellipse([4, 4, size-4, size-4], fill=bg_color)
        
        # Inner icon
        if running:
            # Play triangle
            points = [(22, 16), (22, 48), (48, 32)]
            draw.polygon(points, fill=(255, 255, 255, 255))
        elif warning:
            # Exclamation mark
            draw.rectangle([28, 16, 36, 38], fill=(255, 255, 255, 255))
            draw.ellipse([28, 42, 36, 50], fill=(255, 255, 255, 255))
        else:
            # Square (stopped)
            draw.rectangle([20, 20, 44, 44], fill=(255, 255, 255, 255))
        
        return image
    
    def load_custom_icon(self, running=False, warning=False):
        """Load the WatchNexus logo as tray icon."""
        icon_size = 64
        
        # Try SVG first
        if HAS_CAIROSVG and LOGO_SVG_PATH.exists():
            try:
                png_data = cairosvg.svg2png(
                    url=str(LOGO_SVG_PATH),
                    output_width=icon_size,
                    output_height=icon_size
                )
                image = Image.open(io.BytesIO(png_data))
                return self._add_status_overlay(image, running, warning)
            except:
                pass
        
        # Try PNG
        if LOGO_PNG_PATH.exists():
            try:
                image = Image.open(LOGO_PNG_PATH)
                image = image.resize((icon_size, icon_size), Image.LANCZOS)
                return self._add_status_overlay(image, running, warning)
            except:
                pass
        
        # Fallback to generated
        return self.create_icon_image(running, warning)
    
    def _add_status_overlay(self, image, running, warning):
        """Add status indicator dot to icon."""
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
            
        overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Status dot in bottom-right corner
        dot_size = 18
        margin = 2
        x1 = image.width - dot_size - margin
        y1 = image.height - dot_size - margin
        x2 = image.width - margin
        y2 = image.height - margin
        
        if running:
            color = (34, 197, 94, 255)   # Green
        elif warning:
            color = (234, 179, 8, 255)   # Yellow
        else:
            color = (220, 38, 38, 255)   # Red
            
        draw.ellipse([x1, y1, x2, y2], fill=color)
        
        return Image.alpha_composite(image, overlay)
    
    def start_server(self, icon=None, item=None):
        """Start the WatchNexus server."""
        if self.server_running:
            return
        
        try:
            python_exe = sys.executable
            
            if not SERVER_SCRIPT.exists():
                self.show_notification("Error", f"Server script not found")
                return
            
            env = os.environ.copy()
            env["WATCHNEXUS_PORT"] = str(self.port)
            
            cmd = [
                python_exe, "-m", "uvicorn",
                "server:app",
                "--host", "0.0.0.0",
                "--port", str(self.port),
                "--reload"
            ]
            
            # Platform-specific process creation
            kwargs = {
                "cwd": str(BACKEND_DIR),
                "env": env,
                "stdout": subprocess.PIPE,
                "stderr": subprocess.PIPE,
            }
            
            if sys.platform == "win32":
                kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
            
            self.server_process = subprocess.Popen(cmd, **kwargs)
            self.server_running = True
            self.update_icon()
            self.show_notification("WatchNexus", f"Server started on port {self.port}")
            
            # Start health monitoring
            self._start_health_monitor()
            
        except Exception as e:
            self.show_notification("Error", f"Failed to start: {str(e)[:50]}")
    
    def stop_server(self, icon=None, item=None):
        """Stop the WatchNexus server."""
        if not self.server_running:
            return
        
        try:
            if self.server_process:
                if sys.platform == "win32":
                    self.server_process.terminate()
                else:
                    os.kill(self.server_process.pid, signal.SIGTERM)
                
                try:
                    self.server_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.server_process.kill()
            
            self.server_process = None
            self.server_running = False
            self.update_icon()
            self.show_notification("WatchNexus", "Server stopped")
            
        except Exception as e:
            self.show_notification("Error", f"Failed to stop: {str(e)[:50]}")
    
    def restart_server(self, icon=None, item=None):
        """Restart the WatchNexus server."""
        self.show_notification("WatchNexus", "Restarting server...")
        self.stop_server()
        time.sleep(2)
        self.start_server()
    
    def open_browser(self, icon=None, item=None):
        """Open WatchNexus home in browser."""
        webbrowser.open(f"http://localhost:{self.port}")
    
    def open_settings(self, icon=None, item=None):
        """Open settings page."""
        webbrowser.open(f"http://localhost:{self.port}/settings")
    
    def open_downloads(self, icon=None, item=None):
        """Open downloads page."""
        webbrowser.open(f"http://localhost:{self.port}/downloads")
    
    def open_library(self, icon=None, item=None):
        """Open library page."""
        webbrowser.open(f"http://localhost:{self.port}/library")
    
    def open_logs(self, icon=None, item=None):
        """Open logs/health page."""
        webbrowser.open(f"http://localhost:{self.port}/settings?tab=logs")
    
    def open_log_file(self, icon=None, item=None):
        """Open log file in default text editor."""
        if LOG_FILE.exists():
            if sys.platform == "win32":
                os.startfile(str(LOG_FILE))
            elif sys.platform == "darwin":
                subprocess.run(["open", str(LOG_FILE)])
            else:
                subprocess.run(["xdg-open", str(LOG_FILE)])
        else:
            self.show_notification("Error", "Log file not found")
    
    def copy_url(self, icon=None, item=None):
        """Copy server URL to clipboard."""
        url = f"http://localhost:{self.port}"
        try:
            if sys.platform == "win32":
                subprocess.run(["clip"], input=url.encode(), check=True)
            elif sys.platform == "darwin":
                subprocess.run(["pbcopy"], input=url.encode(), check=True)
            else:
                subprocess.run(["xclip", "-selection", "clipboard"], input=url.encode(), check=True)
            self.show_notification("Copied", url)
        except:
            self.show_notification("URL", url)
    
    # ========== Tiramisu (Auto-Updater) Methods ==========
    
    def _init_updater(self):
        """Initialize the Tiramisu updater."""
        if not HAS_TIRAMISU:
            return
        
        self.updater = TiramisuUpdater(
            check_interval_hours=24,
            on_update_available=self._on_update_available,
            on_download_progress=self._on_download_progress,
            on_update_complete=self._on_update_complete,
            on_error=self._on_update_error
        )
    
    def _on_update_available(self, update: 'UpdateInfo'):
        """Callback when update is available."""
        self.available_update = update
        self.show_notification(
            "Update Available",
            f"WatchNexus v{update.version} is available!"
        )
    
    def _on_download_progress(self, percent: int, bytes_downloaded: int):
        """Callback for download progress."""
        # Could update icon or show progress
        pass
    
    def _on_update_complete(self, version: str):
        """Callback when update is installed."""
        self.available_update = None
        self.show_notification(
            "Update Complete",
            f"Updated to v{version}. Please restart."
        )
    
    def _on_update_error(self, error: str):
        """Callback for update errors."""
        self.show_notification("Update Error", error[:50])
    
    def check_for_updates_now(self, icon=None, item=None):
        """Manually check for updates."""
        if not self.updater:
            self.show_notification("Updater", "Auto-updater not available")
            return
        
        self.show_notification("Checking", "Looking for updates...")
        
        def _check():
            update = self.updater.check_for_updates(force=True)
            if not update:
                self.show_notification("Up to Date", f"You're on the latest version")
        
        threading.Thread(target=_check, daemon=True).start()
    
    def install_update(self, icon=None, item=None):
        """Install the available update."""
        if not self.updater or not self.available_update:
            return
        
        # Stop server first
        was_running = self.server_running
        if was_running:
            self.show_notification("Updating", "Stopping server for update...")
            self.stop_server()
            time.sleep(2)
        
        def _install():
            self.show_notification("Updating", "Downloading update...")
            success = self.updater.download_and_install(self.available_update)
            
            if success and was_running:
                time.sleep(1)
                self.start_server()
        
        threading.Thread(target=_install, daemon=True).start()
    
    def show_update_info(self, icon=None, item=None):
        """Show information about available update."""
        if not self.available_update:
            self.show_notification("No Update", "No updates available")
            return
        
        update = self.available_update
        info = f"v{update.version} ({update.release_date})"
        if update.size_bytes > 0:
            info += f" - {update.size_mb:.1f} MB"
        self.show_notification("Update Available", info)
    
    def get_update_status_text(self):
        """Get update status for menu."""
        if not self.check_updates:
            return "Updates: Disabled"
        if self.available_update:
            return f"⬆ Update: v{self.available_update.version}"
        if self.updater:
            return f"✓ v{self.updater.current_version} (latest)"
        return "Updates: N/A"
    
    def _start_update_checker(self):
        """Start background update checking."""
        if not self.updater:
            return
        
        def _check_loop():
            time.sleep(10)  # Initial delay
            while not self._stop_event.is_set():
                if self.updater.should_check():
                    self.updater.check_for_updates()
                time.sleep(3600)  # Check hourly
        
        threading.Thread(target=_check_loop, daemon=True).start()
    
    def show_notification(self, title, message):
        """Show system notification (with rate limiting)."""
        now = time.time()
        if self._last_notification and now - self._last_notification < 1:
            return  # Rate limit notifications
        
        self._last_notification = now
        
        if self.icon:
            try:
                self.icon.notify(message, title)
            except:
                print(f"{title}: {message}")
    
    def update_icon(self, warning=False):
        """Update tray icon based on server state."""
        if self.icon:
            self.icon.icon = self.load_custom_icon(self.server_running, warning)
            status = "Running" if self.server_running else "Stopped"
            self.icon.title = f"WatchNexus - {status}"
    
    def _start_health_monitor(self):
        """Start background health monitoring thread."""
        if self._health_thread and self._health_thread.is_alive():
            return
        
        self._health_thread = threading.Thread(target=self._health_monitor_loop, daemon=True)
        self._health_thread.start()
    
    def _health_monitor_loop(self):
        """Background loop to monitor server health."""
        while not self._stop_event.is_set() and self.server_running:
            time.sleep(30)  # Check every 30 seconds
            
            if not self.server_running:
                break
                
            health = self.monitor.check_health()
            if health["status"] == "unreachable":
                if health["failures"] >= 3:
                    self.update_icon(warning=True)
                    self.show_notification("Warning", "Server may be unresponsive")
            else:
                self.update_icon(warning=False)
    
    def get_status_text(self):
        """Get current status text for menu."""
        if self.server_running:
            return f"● Running on port {self.port}"
        return "○ Stopped"
    
    def get_resource_text(self):
        """Get system resource text."""
        try:
            cpu = psutil.cpu_percent()
            mem = psutil.virtual_memory().percent
            return f"CPU: {cpu:.0f}% | RAM: {mem:.0f}%"
        except:
            return "Resources: N/A"
    
    def create_menu(self):
        """Create the system tray context menu."""
        menu_items = [
            # Status section
            pystray.MenuItem(
                lambda item: self.get_status_text(),
                None,
                enabled=False
            ),
            pystray.MenuItem(
                lambda item: self.get_resource_text(),
                None,
                enabled=False
            ),
            pystray.Menu.SEPARATOR,
            
            # Server controls
            pystray.MenuItem(
                "▶ Start Server",
                self.start_server,
                enabled=lambda item: not self.server_running
            ),
            pystray.MenuItem(
                "■ Stop Server",
                self.stop_server,
                enabled=lambda item: self.server_running
            ),
            pystray.MenuItem(
                "↻ Restart Server",
                self.restart_server,
                enabled=lambda item: self.server_running
            ),
            pystray.Menu.SEPARATOR,
            
            # Quick access (default double-click action)
            pystray.MenuItem(
                "Open WatchNexus",
                self.open_browser,
                default=True,
                enabled=lambda item: self.server_running
            ),
            
            # Browser submenu
            pystray.MenuItem(
                "Open in Browser",
                pystray.Menu(
                    pystray.MenuItem("🏠 Home", self.open_browser),
                    pystray.MenuItem("📚 Library", self.open_library),
                    pystray.MenuItem("📥 Downloads", self.open_downloads),
                    pystray.MenuItem("⚙️ Settings", self.open_settings),
                    pystray.MenuItem("📋 Logs & Health", self.open_logs),
                ),
                enabled=lambda item: self.server_running
            ),
            pystray.Menu.SEPARATOR,
            
            # Tools
            pystray.MenuItem(
                "Tools",
                pystray.Menu(
                    pystray.MenuItem("📋 Copy Server URL", self.copy_url),
                    pystray.MenuItem("📄 Open Log File", self.open_log_file),
                )
            ),
        ]
        
        # Add Tiramisu (Updates) section if available
        if self.check_updates:
            menu_items.extend([
                pystray.Menu.SEPARATOR,
                pystray.MenuItem(
                    lambda item: self.get_update_status_text(),
                    None,
                    enabled=False
                ),
                pystray.MenuItem(
                    "🍰 Updates",
                    pystray.Menu(
                        pystray.MenuItem(
                            "Check for Updates",
                            self.check_for_updates_now
                        ),
                        pystray.MenuItem(
                            "Install Update",
                            self.install_update,
                            enabled=lambda item: self.available_update is not None
                        ),
                        pystray.MenuItem(
                            "Update Info",
                            self.show_update_info,
                            enabled=lambda item: self.available_update is not None
                        ),
                    )
                ),
            ])
        
        # About & Quit
        menu_items.extend([
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                f"WatchNexus Beacon v{TRAY_VERSION}",
                None,
                enabled=False
            ),
            pystray.MenuItem(
                "Quit",
                self.quit_app
            )
        ])
        
        return pystray.Menu(*menu_items)
    
    def quit_app(self, icon=None, item=None):
        """Quit the tray application."""
        self._stop_event.set()
        
        if self.server_running:
            self.stop_server()
        
        if self.icon:
            self.icon.stop()
    
    def run(self, auto_start=True):
        """Run the system tray application."""
        print(f"╔══════════════════════════════════════════╗")
        print(f"║   WatchNexus Beacon - System Tray App    ║")
        print(f"║   Version: {TRAY_VERSION}                          ║")
        print(f"║   + Tiramisu Auto-Updater                ║")
        print(f"╚══════════════════════════════════════════╝")
        print(f"")
        print(f"Server Port: {self.port}")
        print(f"Backend Dir: {BACKEND_DIR}")
        print(f"Auto-start:  {auto_start}")
        print(f"Updates:     {'Enabled' if self.check_updates else 'Disabled'}")
        print(f"")
        print("Right-click the tray icon for options.")
        print("Press Ctrl+C to quit.")
        print("")
        
        # Create tray icon
        self.icon = pystray.Icon(
            "WatchNexus",
            self.load_custom_icon(False),
            "WatchNexus - Stopped",
            menu=self.create_menu()
        )
        
        # Auto-start server if enabled
        if auto_start:
            threading.Thread(target=self._delayed_start, daemon=True).start()
        
        # Start update checker if enabled
        if self.check_updates:
            self._start_update_checker()
        
        # Run (blocks until quit)
        try:
            self.icon.run()
        except KeyboardInterrupt:
            self.quit_app()
    
    def _delayed_start(self):
        """Start server after short delay."""
        time.sleep(1.5)
        self.start_server()


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="WatchNexus Beacon - System Tray Application",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tray_app.py                    # Start with defaults
  python tray_app.py --port 9000        # Use custom port
  python tray_app.py --no-auto-start    # Don't auto-start server

The tray app will:
  - Show in your system tray
  - Auto-start the WatchNexus server
  - Provide quick access to all features
  - Monitor server health
        """
    )
    
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=DEFAULT_PORT,
        help=f"Server port (default: {DEFAULT_PORT})"
    )
    parser.add_argument(
        "--no-auto-start",
        action="store_true",
        help="Don't auto-start the server on launch"
    )
    parser.add_argument(
        "--version", "-v",
        action="version",
        version=f"WatchNexus Beacon v{TRAY_VERSION} ({CODENAME})"
    )
    
    args = parser.parse_args()
    
    # Create and run tray app
    tray = WatchNexusTray(port=args.port)
    
    try:
        tray.run(auto_start=not args.no_auto_start)
    except KeyboardInterrupt:
        tray.quit_app()
        print("\nGoodbye!")


if __name__ == "__main__":
    main()

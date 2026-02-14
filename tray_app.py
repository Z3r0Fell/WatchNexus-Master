"""
WatchNexus System Tray Application
Cross-platform system tray controller for WatchNexus server.

Works on:
- Windows (requires pystray with win32 backend)
- macOS (requires pystray with AppKit backend)
- Linux (requires pystray with AppIndicator/GTK backend)

Usage:
    python tray_app.py

Requirements:
    pip install pystray pillow
"""

import os
import sys
import webbrowser
import subprocess
import signal
import threading
import time
from pathlib import Path

try:
    import pystray
    from PIL import Image, ImageDraw
    import cairosvg
    import io
    HAS_CAIROSVG = True
except ImportError as e:
    if "cairosvg" in str(e):
        HAS_CAIROSVG = False
        import pystray
        from PIL import Image, ImageDraw
    else:
        print("Missing dependencies. Install with: pip install pystray pillow cairosvg")
        sys.exit(1)

# Configuration
DEFAULT_PORT = 8001
WATCHNEXUS_DIR = Path(__file__).parent
BACKEND_DIR = WATCHNEXUS_DIR / "backend"
SERVER_SCRIPT = BACKEND_DIR / "server.py"
LOGO_SVG_PATH = WATCHNEXUS_DIR / "frontend" / "public" / "watchnexus-logo.svg"
LOGO_PNG_PATH = WATCHNEXUS_DIR / "frontend" / "public" / "watchnexus-logo.png"

class WatchNexusTray:
    """System tray application for controlling WatchNexus server."""
    
    def __init__(self):
        self.server_process = None
        self.server_running = False
        self.port = int(os.environ.get("WATCHNEXUS_PORT", DEFAULT_PORT))
        self.icon = None
        self._stop_event = threading.Event()
        
    def create_icon_image(self, running=False):
        """Create a simple icon image programmatically."""
        # Create a 64x64 image
        size = 64
        image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # Background circle
        bg_color = (124, 58, 237, 255) if running else (75, 85, 99, 255)  # Violet or gray
        draw.ellipse([4, 4, size-4, size-4], fill=bg_color)
        
        # Inner design - play triangle or pause bars
        if running:
            # Play triangle (indicates running)
            points = [(22, 16), (22, 48), (48, 32)]
            draw.polygon(points, fill=(255, 255, 255, 255))
        else:
            # Square (indicates stopped)
            draw.rectangle([20, 20, 44, 44], fill=(255, 255, 255, 255))
        
        return image
    
    def load_custom_icon(self, running=False):
        """Load the WatchNexus logo as tray icon."""
        icon_size = 64
        
        # Try to load from SVG first (better quality)
        if HAS_CAIROSVG and LOGO_SVG_PATH.exists():
            try:
                png_data = cairosvg.svg2png(
                    url=str(LOGO_SVG_PATH),
                    output_width=icon_size,
                    output_height=icon_size
                )
                image = Image.open(io.BytesIO(png_data))
                # Add status indicator overlay if stopped
                if not running:
                    image = self._add_status_overlay(image, running)
                return image
            except Exception:
                pass
        
        # Fallback to PNG if available
        if LOGO_PNG_PATH.exists():
            try:
                image = Image.open(LOGO_PNG_PATH)
                image = image.resize((icon_size, icon_size), Image.LANCZOS)
                if not running:
                    image = self._add_status_overlay(image, running)
                return image
            except Exception:
                pass
        
        # Final fallback to generated icon
        return self.create_icon_image(running)
    
    def _add_status_overlay(self, image, running):
        """Add a status indicator overlay to the icon."""
        if running:
            return image
        # Convert to RGBA if needed
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        # Create a semi-transparent overlay to indicate stopped state
        overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        # Draw a small red dot in the corner to indicate stopped
        dot_size = 16
        margin = 4
        draw.ellipse(
            [image.width - dot_size - margin, margin, image.width - margin, dot_size + margin],
            fill=(220, 38, 38, 255)  # Red
        )
        return Image.alpha_composite(image, overlay)
    
    def start_server(self, icon=None, item=None):
        """Start the WatchNexus server."""
        if self.server_running:
            return
        
        try:
            # Find Python executable
            python_exe = sys.executable
            
            # Check if server script exists
            if not SERVER_SCRIPT.exists():
                self.show_notification("Error", f"Server script not found: {SERVER_SCRIPT}")
                return
            
            # Start server process
            env = os.environ.copy()
            env["WATCHNEXUS_PORT"] = str(self.port)
            
            # Use uvicorn to run the server
            cmd = [
                python_exe, "-m", "uvicorn", 
                "server:app", 
                "--host", "0.0.0.0", 
                "--port", str(self.port),
                "--reload"
            ]
            
            self.server_process = subprocess.Popen(
                cmd,
                cwd=str(BACKEND_DIR),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            
            self.server_running = True
            self.update_icon()
            self.show_notification("WatchNexus", f"Server started on port {self.port}")
            
        except Exception as e:
            self.show_notification("Error", f"Failed to start server: {str(e)}")
    
    def stop_server(self, icon=None, item=None):
        """Stop the WatchNexus server."""
        if not self.server_running or not self.server_process:
            return
        
        try:
            # Terminate the process
            if sys.platform == "win32":
                self.server_process.terminate()
            else:
                os.kill(self.server_process.pid, signal.SIGTERM)
            
            # Wait for graceful shutdown
            try:
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server_process.kill()
            
            self.server_process = None
            self.server_running = False
            self.update_icon()
            self.show_notification("WatchNexus", "Server stopped")
            
        except Exception as e:
            self.show_notification("Error", f"Failed to stop server: {str(e)}")
    
    def restart_server(self, icon=None, item=None):
        """Restart the WatchNexus server."""
        self.stop_server()
        time.sleep(1)
        self.start_server()
    
    def open_browser(self, icon=None, item=None):
        """Open WatchNexus in the default web browser."""
        url = f"http://localhost:{self.port}"
        webbrowser.open(url)
    
    def open_settings(self, icon=None, item=None):
        """Open WatchNexus settings in browser."""
        url = f"http://localhost:{self.port}/settings"
        webbrowser.open(url)
    
    def open_downloads(self, icon=None, item=None):
        """Open WatchNexus downloads in browser."""
        url = f"http://localhost:{self.port}/downloads"
        webbrowser.open(url)
    
    def show_notification(self, title, message):
        """Show a system notification."""
        if self.icon:
            try:
                self.icon.notify(message, title)
            except Exception:
                # Fallback: print to console
                print(f"{title}: {message}")
    
    def update_icon(self):
        """Update the tray icon based on server state."""
        if self.icon:
            self.icon.icon = self.load_custom_icon(self.server_running)
            status = "Running" if self.server_running else "Stopped"
            self.icon.title = f"WatchNexus - {status}"
    
    def quit_app(self, icon=None, item=None):
        """Quit the tray application."""
        # Stop server if running
        if self.server_running:
            self.stop_server()
        
        # Stop the tray icon
        self._stop_event.set()
        if self.icon:
            self.icon.stop()
    
    def get_server_status_text(self):
        """Get server status text for menu."""
        return f"● Running on port {self.port}" if self.server_running else "○ Stopped"
    
    def create_menu(self):
        """Create the system tray menu."""
        return pystray.Menu(
            pystray.MenuItem(
                lambda item: self.get_server_status_text(),
                None,
                enabled=False
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Start Server",
                self.start_server,
                enabled=lambda item: not self.server_running
            ),
            pystray.MenuItem(
                "Stop Server",
                self.stop_server,
                enabled=lambda item: self.server_running
            ),
            pystray.MenuItem(
                "Restart Server",
                self.restart_server,
                enabled=lambda item: self.server_running
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Open WatchNexus",
                self.open_browser,
                default=True,
                enabled=lambda item: self.server_running
            ),
            pystray.MenuItem(
                "Open in Browser",
                pystray.Menu(
                    pystray.MenuItem("Home", self.open_browser),
                    pystray.MenuItem("Downloads", self.open_downloads),
                    pystray.MenuItem("Settings", self.open_settings),
                )
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Quit",
                self.quit_app
            )
        )
    
    def run(self):
        """Run the system tray application."""
        print("Starting WatchNexus Tray Application...")
        print(f"Server will run on port: {self.port}")
        print(f"Backend directory: {BACKEND_DIR}")
        
        # Create the tray icon
        self.icon = pystray.Icon(
            "WatchNexus",
            self.load_custom_icon(False),
            "WatchNexus - Stopped",
            menu=self.create_menu()
        )
        
        # Auto-start server
        auto_start = os.environ.get("WATCHNEXUS_AUTO_START", "true").lower() == "true"
        if auto_start:
            threading.Thread(target=self._delayed_start, daemon=True).start()
        
        # Run the icon (this blocks)
        self.icon.run()
    
    def _delayed_start(self):
        """Start server after a short delay."""
        time.sleep(1)
        self.start_server()


def main():
    """Main entry point."""
    # Handle command line arguments
    import argparse
    parser = argparse.ArgumentParser(description="WatchNexus System Tray Application")
    parser.add_argument("--port", type=int, default=8001, help="Server port (default: 8001)")
    parser.add_argument("--no-auto-start", action="store_true", help="Don't auto-start the server")
    args = parser.parse_args()
    
    # Set environment variables
    os.environ["WATCHNEXUS_PORT"] = str(args.port)
    if args.no_auto_start:
        os.environ["WATCHNEXUS_AUTO_START"] = "false"
    
    # Create and run the tray app
    tray = WatchNexusTray()
    tray.port = args.port
    
    try:
        tray.run()
    except KeyboardInterrupt:
        tray.quit_app()
        print("\nExiting...")


if __name__ == "__main__":
    main()

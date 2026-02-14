#!/usr/bin/env python3
"""
WatchNexus Launcher
Cross-platform launcher for WatchNexus server with optional system tray support.

Usage:
    python launch.py                    # Start server with tray app
    python launch.py --no-tray          # Start server without tray (headless)
    python launch.py --port 9000        # Custom port
    python launch.py --open-browser     # Open browser after start
"""

import os
import sys
import argparse
import subprocess
import webbrowser
import time
import signal
from pathlib import Path

WATCHNEXUS_DIR = Path(__file__).parent
BACKEND_DIR = WATCHNEXUS_DIR / "backend"
TRAY_APP = WATCHNEXUS_DIR / "tray_app.py"

def find_python():
    """Find the Python executable."""
    return sys.executable

def check_dependencies():
    """Check if required dependencies are installed."""
    missing = []
    
    # Check backend dependencies
    try:
        import fastapi
        import uvicorn
    except ImportError as e:
        missing.append(f"Backend: {e}")
    
    return missing

def start_server_headless(port: int):
    """Start the server without system tray."""
    python = find_python()
    
    env = os.environ.copy()
    env["WATCHNEXUS_PORT"] = str(port)
    
    cmd = [
        python, "-m", "uvicorn", 
        "server:app", 
        "--host", "0.0.0.0", 
        "--port", str(port),
        "--reload"
    ]
    
    print(f"Starting WatchNexus server on port {port}...")
    print(f"Open http://localhost:{port} in your browser")
    print("Press Ctrl+C to stop")
    
    try:
        process = subprocess.Popen(
            cmd,
            cwd=str(BACKEND_DIR),
            env=env,
        )
        process.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
        process.terminate()

def start_with_tray(port: int, auto_start: bool = True):
    """Start server with system tray application."""
    python = find_python()
    
    # Check if tray dependencies are available
    try:
        import pystray
        from PIL import Image
    except ImportError:
        print("System tray dependencies not available.")
        print("Install with: pip install pystray pillow")
        print("\nStarting in headless mode instead...")
        return start_server_headless(port)
    
    env = os.environ.copy()
    env["WATCHNEXUS_PORT"] = str(port)
    if not auto_start:
        env["WATCHNEXUS_AUTO_START"] = "false"
    
    cmd = [python, str(TRAY_APP), "--port", str(port)]
    if not auto_start:
        cmd.append("--no-auto-start")
    
    print(f"Starting WatchNexus with system tray...")
    print(f"Server will run on port {port}")
    
    try:
        subprocess.run(cmd, env=env)
    except KeyboardInterrupt:
        print("\nExiting...")

def main():
    parser = argparse.ArgumentParser(
        description="WatchNexus Launcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python launch.py                    Start with system tray
  python launch.py --no-tray          Headless mode (for servers)
  python launch.py --port 9000        Custom port
  python launch.py --open-browser     Open browser after start
        """
    )
    
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=8001,
        help="Server port (default: 8001)"
    )
    
    parser.add_argument(
        "--no-tray",
        action="store_true",
        help="Run without system tray (headless mode)"
    )
    
    parser.add_argument(
        "--no-auto-start",
        action="store_true",
        help="Don't auto-start the server (tray mode only)"
    )
    
    parser.add_argument(
        "--open-browser",
        action="store_true",
        help="Open browser after server starts"
    )
    
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check dependencies and exit"
    )
    
    args = parser.parse_args()
    
    # Check dependencies
    missing = check_dependencies()
    if missing:
        print("Missing dependencies:")
        for m in missing:
            print(f"  - {m}")
        print("\nInstall requirements with:")
        print(f"  cd {BACKEND_DIR}")
        print("  pip install -r requirements.txt")
        sys.exit(1)
    
    if args.check:
        print("All dependencies OK!")
        sys.exit(0)
    
    # Open browser if requested
    if args.open_browser:
        def open_browser_delayed():
            time.sleep(3)  # Wait for server to start
            webbrowser.open(f"http://localhost:{args.port}")
        
        import threading
        threading.Thread(target=open_browser_delayed, daemon=True).start()
    
    # Start the application
    if args.no_tray:
        start_server_headless(args.port)
    else:
        start_with_tray(args.port, auto_start=not args.no_auto_start)

if __name__ == "__main__":
    main()

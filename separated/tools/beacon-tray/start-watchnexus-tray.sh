#!/bin/bash
# WatchNexus Beacon - System Tray Launcher (macOS/Linux)
# Run: ./start-watchnexus-tray.sh

echo "============================================"
echo "  WatchNexus Beacon - Starting..."
echo "============================================"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found!"
    echo "Please install Python 3.8+ first."
    exit 1
fi

# Check/Install dependencies
echo "Checking dependencies..."
if ! python3 -c "import pystray" 2>/dev/null; then
    echo "Installing required packages..."
    pip3 install pystray pillow requests psutil --quiet
fi

# Additional Linux dependencies
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if ! python3 -c "import gi" 2>/dev/null; then
        echo "Note: For best results on Linux, install: sudo apt install python3-gi gir1.2-appindicator3-0.1"
    fi
fi

# Start the tray app
echo "Starting WatchNexus Beacon..."
echo ""
echo "Look for the WatchNexus icon in your system tray."
echo "Press Ctrl+C to quit."
echo ""

python3 tray_app.py "$@"

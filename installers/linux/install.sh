#!/bin/bash
# WatchNexus Linux Installer
# Creates an AppImage-compatible installation
set -e

APP_NAME="WatchNexus"
APP_VERSION="2.8.0"
INSTALL_DIR="${HOME}/.local/share/watchnexus"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/256x256/apps"

echo "================================================"
echo "  $APP_NAME v$APP_VERSION - Linux Installer"
echo "================================================"
echo ""

# Check dependencies
echo "[1/6] Checking dependencies..."
MISSING=""
command -v python3 >/dev/null 2>&1 || MISSING="$MISSING python3"
command -v node >/dev/null 2>&1 || MISSING="$MISSING nodejs"
command -v yarn >/dev/null 2>&1 || { command -v npm >/dev/null 2>&1 || MISSING="$MISSING nodejs/yarn"; }
command -v ffmpeg >/dev/null 2>&1 || echo "  WARNING: ffmpeg not found (optional, for transcoding)"

if [ -n "$MISSING" ]; then
    echo "  ERROR: Missing required dependencies:$MISSING"
    echo "  Install with your package manager:"
    echo "    Arch:   sudo pacman -S python nodejs yarn ffmpeg"
    echo "    Ubuntu: sudo apt install python3 python3-pip nodejs npm ffmpeg"
    echo "    Fedora: sudo dnf install python3 nodejs yarn ffmpeg"
    exit 1
fi
echo "  All dependencies found."

# Create directories
echo "[2/6] Creating installation directory..."
mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"

# Copy application files
echo "[3/6] Installing application files..."
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Backend
cp -r "$SCRIPT_DIR/src/server/"* "$INSTALL_DIR/"
cd "$INSTALL_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --quiet -r requirements.txt
deactivate

# Frontend (build)
echo "[4/6] Building frontend..."
TEMP_WEB=$(mktemp -d)
cp -r "$SCRIPT_DIR/src/web/"* "$TEMP_WEB/"
cd "$TEMP_WEB"
yarn install --frozen-lockfile --silent 2>/dev/null
yarn build 2>/dev/null
mv build "$INSTALL_DIR/frontend_build"
rm -rf "$TEMP_WEB"

# Tray app
cp "$SCRIPT_DIR/tray_app.py" "$INSTALL_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/launch.py" "$INSTALL_DIR/" 2>/dev/null || true

# Create launcher script
echo "[5/6] Creating launcher..."
cat > "$BIN_DIR/watchnexus" << 'LAUNCHER'
#!/bin/bash
INSTALL_DIR="${HOME}/.local/share/watchnexus"
export WATCHNEXUS_PORT=${WATCHNEXUS_PORT:-8001}

cd "$INSTALL_DIR"
source venv/bin/activate

# Check if --tray flag is passed
if [[ "$1" == "--tray" ]]; then
    python3 tray_app.py --port $WATCHNEXUS_PORT &
else
    echo "WatchNexus starting on http://localhost:$WATCHNEXUS_PORT"
    python3 -m uvicorn server:app --host 0.0.0.0 --port $WATCHNEXUS_PORT
fi
LAUNCHER
chmod +x "$BIN_DIR/watchnexus"

# Create .desktop file
echo "[6/6] Creating desktop entry..."
cat > "$DESKTOP_DIR/watchnexus.desktop" << DESKTOP
[Desktop Entry]
Name=WatchNexus
Comment=Unified Media Pipeline
Exec=$BIN_DIR/watchnexus --tray
Icon=watchnexus
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
StartupNotify=true
StartupWMClass=WatchNexus
DESKTOP

# Copy icon if available
if [ -f "$SCRIPT_DIR/src/web/public/watchnexus-logo.png" ]; then
    cp "$SCRIPT_DIR/src/web/public/watchnexus-logo.png" "$ICON_DIR/watchnexus.png"
fi

echo ""
echo "================================================"
echo "  Installation complete!"
echo "================================================"
echo ""
echo "  Run:           watchnexus"
echo "  Run with tray: watchnexus --tray"
echo "  Dashboard:     http://localhost:8001"
echo "  Data dir:      $INSTALL_DIR"
echo ""
echo "  To uninstall:"
echo "    rm -rf $INSTALL_DIR $BIN_DIR/watchnexus"
echo "    rm $DESKTOP_DIR/watchnexus.desktop"
echo ""

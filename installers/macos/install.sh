#!/bin/bash
# WatchNexus macOS Installer
set -e

APP_NAME="WatchNexus"
APP_VERSION="2.8.0"
INSTALL_DIR="/Applications/WatchNexus.app"
SUPPORT_DIR="${HOME}/Library/Application Support/WatchNexus"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"

echo "================================================"
echo "  $APP_NAME v$APP_VERSION - macOS Installer"
echo "================================================"
echo ""

# Check dependencies
echo "[1/6] Checking dependencies..."
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 required. Install via: brew install python"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: nodejs required. Install via: brew install node"; exit 1; }
command -v yarn >/dev/null 2>&1 || { echo "WARNING: yarn not found, using npm"; }
echo "  Dependencies OK."

# Create support directory
echo "[2/6] Creating application directories..."
mkdir -p "$SUPPORT_DIR"
mkdir -p "$INSTALL_DIR/Contents/MacOS"
mkdir -p "$INSTALL_DIR/Contents/Resources"

# Copy backend
echo "[3/6] Installing backend..."
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cp -r "$SCRIPT_DIR/src/server/"* "$SUPPORT_DIR/"
cd "$SUPPORT_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --quiet -r requirements.txt
deactivate

# Build frontend
echo "[4/6] Building frontend..."
TEMP_WEB=$(mktemp -d)
cp -r "$SCRIPT_DIR/src/web/"* "$TEMP_WEB/"
cd "$TEMP_WEB"
yarn install --frozen-lockfile --silent 2>/dev/null || npm install --silent 2>/dev/null
yarn build 2>/dev/null || npm run build 2>/dev/null
mv build "$SUPPORT_DIR/frontend_build"
rm -rf "$TEMP_WEB"

# Copy tray app
cp "$SCRIPT_DIR/tray_app.py" "$SUPPORT_DIR/" 2>/dev/null || true

# Create app launcher
echo "[5/6] Creating application bundle..."
cat > "$INSTALL_DIR/Contents/MacOS/WatchNexus" << 'LAUNCHER'
#!/bin/bash
SUPPORT_DIR="${HOME}/Library/Application Support/WatchNexus"
export WATCHNEXUS_PORT=${WATCHNEXUS_PORT:-8001}

cd "$SUPPORT_DIR"
source venv/bin/activate
python3 tray_app.py --port $WATCHNEXUS_PORT
LAUNCHER
chmod +x "$INSTALL_DIR/Contents/MacOS/WatchNexus"

# Create Info.plist
cat > "$INSTALL_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>WatchNexus</string>
    <key>CFBundleIdentifier</key>
    <string>com.watchnexus.app</string>
    <key>CFBundleName</key>
    <string>WatchNexus</string>
    <key>CFBundleVersion</key>
    <string>2.8.0</string>
    <key>CFBundleShortVersionString</key>
    <string>2.8.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
</dict>
</plist>
PLIST

# Create launch agent for auto-start (optional)
echo "[6/6] Creating launch agent (optional)..."
cat > "$LAUNCH_AGENTS_DIR/com.watchnexus.server.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.watchnexus.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>${SUPPORT_DIR}/venv/bin/python3</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>server:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8001</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${SUPPORT_DIR}</string>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
PLIST

echo ""
echo "================================================"
echo "  Installation complete!"
echo "================================================"
echo ""
echo "  App:       /Applications/WatchNexus.app"
echo "  Data:      ~/Library/Application Support/WatchNexus"
echo "  Dashboard: http://localhost:8001"
echo ""
echo "  Launch from Applications folder or Spotlight."
echo "  To auto-start: launchctl load ~/Library/LaunchAgents/com.watchnexus.server.plist"
echo ""

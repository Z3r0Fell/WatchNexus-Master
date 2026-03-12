#!/bin/bash
# WatchNexus macOS Installer (.NET 10) — v2.6.5
# Auto-start via LaunchAgent + LaunchDaemon
set -e

APP_NAME="WatchNexus"
APP_VERSION="2.6.5"
INSTALL_DIR="/Applications/WatchNexus.app"
SUPPORT_DIR="${HOME}/Library/Application Support/WatchNexus"
AGENT_PLIST="$HOME/Library/LaunchAgents/ca.watchnexus.server.plist"
DAEMON_PLIST="/Library/LaunchDaemons/ca.watchnexus.server.plist"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "================================================"
echo "  $APP_NAME v$APP_VERSION - macOS Installer"
echo "================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Prerequisite check
echo -e "${CYAN}Checking prerequisites...${NC}"
MISSING=()
FOUND=()

if command -v dotnet &>/dev/null; then
    if dotnet --list-runtimes 2>/dev/null | grep -q "AspNetCore.*10\."; then
        FOUND+=(".NET 10 ASP.NET Core Runtime")
    else MISSING+=("ASP.NET Core 10 Runtime"); fi
else MISSING+=(".NET 10 SDK/Runtime"); fi

command -v node &>/dev/null && FOUND+=("Node.js $(node --version)") || MISSING+=("Node.js (optional)")

echo "  -----------------------------------------------"
for item in "${FOUND[@]}"; do echo -e "  ${GREEN}OK${NC}      $item"; done
for item in "${MISSING[@]}"; do echo -e "  ${RED}MISSING${NC} $item"; done
echo "  -----------------------------------------------"
echo ""

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "  Install .NET 10:"
    echo "    brew install dotnet"
    echo "    Or: https://dotnet.microsoft.com/download/dotnet/10.0"
    read -p "  Install via Homebrew now? (y/n): " ANSWER
    if [[ "$ANSWER" == "y" || "$ANSWER" == "Y" ]]; then
        command -v brew &>/dev/null && brew install dotnet || {
            curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --install-dir "$HOME/.dotnet"
            export PATH="$HOME/.dotnet:$PATH"
        }
    else exit 0; fi
fi

# Build and install
echo "[1/4] Building WatchNexus..."
mkdir -p "$SUPPORT_DIR"/{data,logs,modules}
mkdir -p "$INSTALL_DIR/Contents/"{MacOS,Resources}
mkdir -p "$HOME/Library/LaunchAgents"
cd "$SCRIPT_DIR/watchnexus"
dotnet publish core/WatchNexus.Core.csproj -c Release -o "$INSTALL_DIR/Contents/Resources/bin" --self-contained false

echo "[2/4] Installing modules..."
cp -r modules/* "$SUPPORT_DIR/modules/" 2>/dev/null || true

echo "[3/4] Creating app bundle..."
DOTNET_PATH=$(which dotnet)
cat > "$INSTALL_DIR/Contents/MacOS/watchnexus" << LAUNCHER
#!/bin/bash
export ASPNETCORE_URLS="http://0.0.0.0:\${WATCHNEXUS_PORT:-8001}"
APP_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
cd "\$APP_DIR/Resources/bin"
exec $DOTNET_PATH WatchNexus.Core.dll
LAUNCHER
chmod +x "$INSTALL_DIR/Contents/MacOS/watchnexus"

cat > "$INSTALL_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>WatchNexus</string>
    <key>CFBundleIdentifier</key><string>ca.watchnexus.app</string>
    <key>CFBundleVersion</key><string>$APP_VERSION</string>
    <key>CFBundleShortVersionString</key><string>$APP_VERSION</string>
    <key>CFBundleExecutable</key><string>watchnexus</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
EOF

# Auto-start registration
echo "[4/4] Registering auto-start service..."

# LaunchAgent — starts at user login, restarts on crash
cat > "$AGENT_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>ca.watchnexus.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/Contents/MacOS/watchnexus</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key>
    <dict><key>SuccessfulExit</key><false/></dict>
    <key>ThrottleInterval</key><integer>5</integer>
    <key>StandardOutPath</key><string>$SUPPORT_DIR/logs/server.log</string>
    <key>StandardErrorPath</key><string>$SUPPORT_DIR/logs/error.log</string>
</dict>
</plist>
EOF
launchctl unload "$AGENT_PLIST" 2>/dev/null || true
launchctl load -w "$AGENT_PLIST"

# LaunchDaemon — starts at BOOT before login (requires sudo)
if sudo -n true 2>/dev/null; then
    sudo tee "$DAEMON_PLIST" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>ca.watchnexus.server.daemon</string>
    <key>ProgramArguments</key>
    <array><string>$INSTALL_DIR/Contents/MacOS/watchnexus</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ThrottleInterval</key><integer>5</integer>
    <key>StandardOutPath</key><string>$SUPPORT_DIR/logs/server.log</string>
    <key>StandardErrorPath</key><string>$SUPPORT_DIR/logs/error.log</string>
</dict>
</plist>
EOF
    sudo launchctl load -w "$DAEMON_PLIST" 2>/dev/null || true
    echo -e "  ${GREEN}LaunchDaemon registered — starts at BOOT${NC}"
fi

echo ""
echo "================================================"
echo "  Installation complete!  v$APP_VERSION"
echo "================================================"
echo "  Dashboard: http://localhost:8001"
echo "  App:       $INSTALL_DIR"
echo "  Data:      $SUPPORT_DIR"
echo ""
echo -e "  ${GREEN}Auto-start: ENABLED${NC}"
echo "  WatchNexus starts on boot/login, restarts on crash."
echo ""
echo "  Commands:"
echo "    launchctl list | grep watchnexus"
echo "    launchctl stop ca.watchnexus.server"
echo "    launchctl unload -w ~/Library/LaunchAgents/ca.watchnexus.server.plist  (disable)"
echo ""

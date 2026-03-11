#!/bin/bash
# WatchNexus macOS Installer (.NET 10)
set -e

APP_NAME="WatchNexus"
APP_VERSION="3.0.0-beta"
INSTALL_DIR="/Applications/WatchNexus.app"
SUPPORT_DIR="${HOME}/Library/Application Support/WatchNexus"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"

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
echo "  -----------------------------------------------"
MISSING=()
FOUND=()

if command -v dotnet &>/dev/null; then
    DOTNET_VER=$(dotnet --version 2>/dev/null || echo "unknown")
    if dotnet --list-runtimes 2>/dev/null | grep -q "AspNetCore.*10\."; then
        FOUND+=(".NET 10 ASP.NET Core Runtime ($DOTNET_VER)")
    elif dotnet --list-runtimes 2>/dev/null | grep -q "AspNetCore"; then
        FOUND+=(".NET Runtime ($DOTNET_VER) - may need ASP.NET Core 10")
    else
        MISSING+=("ASP.NET Core 10 Runtime")
    fi
else
    MISSING+=(".NET 10 SDK/Runtime")
fi

if command -v node &>/dev/null; then
    FOUND+=("Node.js $(node --version)")
else
    MISSING+=("Node.js (optional, for frontend build)")
fi

for item in "${FOUND[@]}"; do
    echo -e "  ${GREEN}OK${NC}      $item"
done
for item in "${MISSING[@]}"; do
    echo -e "  ${RED}MISSING${NC} $item"
done
echo "  -----------------------------------------------"
echo ""

if [ ${#MISSING[@]} -gt 0 ]; then
    echo -e "  ${YELLOW}Missing prerequisites detected.${NC}"
    echo "  .NET 10 SDK can be installed via Homebrew:"
    echo "    brew install dotnet"
    echo "  Or download from: https://dotnet.microsoft.com/download/dotnet/10.0"
    echo ""
    read -p "  Attempt to install .NET 10 via Homebrew? (y/n): " ANSWER
    if [[ "$ANSWER" == "y" || "$ANSWER" == "Y" ]]; then
        if command -v brew &>/dev/null; then
            brew install dotnet
        else
            echo "  Homebrew not found. Installing .NET via install script..."
            curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --install-dir "$HOME/.dotnet"
            export PATH="$HOME/.dotnet:$PATH"
        fi
    else
        echo "  Please install .NET 10 and re-run this installer."
        exit 0
    fi
fi

# Verify .NET
echo "[1/5] Verifying .NET 10 runtime..."
if ! command -v dotnet &>/dev/null; then
    echo "ERROR: dotnet command not found."
    exit 1
fi
dotnet --list-runtimes | grep -q "AspNetCore" || {
    echo "ERROR: ASP.NET Core 10 runtime required."
    exit 1
}
echo "  .NET runtime verified."

# Create dirs
echo "[2/5] Creating application directories..."
mkdir -p "$SUPPORT_DIR"/{data,logs,modules}
mkdir -p "$INSTALL_DIR/Contents/MacOS"
mkdir -p "$INSTALL_DIR/Contents/Resources"

# Build and publish
echo "[3/5] Building WatchNexus..."
cd "$SCRIPT_DIR/watchnexus"
dotnet publish core/WatchNexus.Core.csproj -c Release -o "$INSTALL_DIR/Contents/Resources/bin" --self-contained false

# Copy modules
echo "[4/5] Installing modules..."
cp -r "$SCRIPT_DIR/watchnexus/modules/"* "$SUPPORT_DIR/modules/" 2>/dev/null || true

# Build frontend (if node available)
if command -v node &>/dev/null && [ -d "$SCRIPT_DIR/src/web" ]; then
    echo "  Building frontend..."
    cd "$SCRIPT_DIR/src/web"
    yarn install --frozen-lockfile --silent 2>/dev/null || npm install --silent 2>/dev/null
    yarn build 2>/dev/null || npm run build 2>/dev/null
    cp -r build "$INSTALL_DIR/Contents/Resources/web/" 2>/dev/null || true
fi

# Create launcher
echo "[5/5] Creating application bundle..."
cat > "$INSTALL_DIR/Contents/MacOS/WatchNexus" << 'LAUNCHER'
#!/bin/bash
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="$APP_DIR/Resources"
SUPPORT_DIR="${HOME}/Library/Application Support/WatchNexus"
LOG_DIR="$SUPPORT_DIR/logs"
mkdir -p "$LOG_DIR"
export ASPNETCORE_URLS="http://0.0.0.0:${WATCHNEXUS_PORT:-8001}"
cd "$RESOURCES/bin"
dotnet WatchNexus.Core.dll >> "$LOG_DIR/server.log" 2>&1 &
PID=$!
sleep 3
if kill -0 $PID 2>/dev/null; then
    open "http://localhost:${WATCHNEXUS_PORT:-8001}"
    wait $PID
else
    osascript -e 'display alert "WatchNexus" message "Failed to start. Check logs at ~/Library/Application Support/WatchNexus/logs/"'
fi
LAUNCHER
chmod +x "$INSTALL_DIR/Contents/MacOS/WatchNexus"

cat > "$INSTALL_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>WatchNexus</string>
    <key>CFBundleIdentifier</key><string>ca.watchnexus.app</string>
    <key>CFBundleName</key><string>WatchNexus</string>
    <key>CFBundleVersion</key><string>$APP_VERSION</string>
    <key>CFBundleShortVersionString</key><string>$APP_VERSION</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSUIElement</key><true/>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>LSApplicationCategoryType</key><string>public.app-category.entertainment</string>
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
echo ""

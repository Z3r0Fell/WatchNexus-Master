#!/bin/bash
# WatchNexus Linux Installer (.NET 10)
set -e

APP_NAME="WatchNexus"
APP_VERSION="3.0.0-beta"
INSTALL_DIR="${HOME}/.local/share/watchnexus"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "================================================"
echo "  $APP_NAME v$APP_VERSION - Linux Installer"
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
    read -p "  Attempt to install missing dependencies? (y/n): " ANSWER
    if [[ "$ANSWER" != "y" && "$ANSWER" != "Y" ]]; then
        echo ""
        echo "Install .NET 10 manually:"
        echo "  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --runtime aspnetcore"
        echo "  Or visit: https://dotnet.microsoft.com/download/dotnet/10.0"
        exit 0
    fi
fi

# Check/install .NET 10 runtime
echo "[1/5] Checking dependencies..."
if ! command -v dotnet &>/dev/null; then
    echo "  Installing .NET 10 Runtime..."
    curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --runtime aspnetcore --install-dir "$HOME/.dotnet"
    export PATH="$HOME/.dotnet:$PATH"
fi
dotnet --list-runtimes | grep -q "AspNetCore" || {
    echo "ERROR: ASP.NET Core 10 runtime required."
    echo "Install: curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --runtime aspnetcore"
    exit 1
}
echo "  .NET runtime found."

# Create dirs
echo "[2/5] Creating installation directory..."
mkdir -p "$INSTALL_DIR/modules" "$INSTALL_DIR/data" "$INSTALL_DIR/logs" "$BIN_DIR" "$DESKTOP_DIR"

# Build and publish
echo "[3/5] Building WatchNexus..."
cd "$SCRIPT_DIR/watchnexus"
dotnet publish core/WatchNexus.Core.csproj -c Release -o "$INSTALL_DIR/bin" --self-contained false

# Copy modules
echo "[4/5] Installing modules..."
cp -r "$SCRIPT_DIR/watchnexus/modules/"* "$INSTALL_DIR/modules/" 2>/dev/null || true

# Build frontend (if node available)
if command -v node &>/dev/null && [ -d "$SCRIPT_DIR/src/web" ]; then
    echo "  Building frontend..."
    cd "$SCRIPT_DIR/src/web"
    yarn install --frozen-lockfile --silent 2>/dev/null
    yarn build 2>/dev/null
    mkdir -p "$INSTALL_DIR/web"
    cp -r build "$INSTALL_DIR/web/"
fi

# Create launcher
echo "[5/5] Creating launcher..."
cat > "$BIN_DIR/watchnexus" << LAUNCHER
#!/bin/bash
export ASPNETCORE_URLS="http://0.0.0.0:\${WATCHNEXUS_PORT:-8001}"
cd "$INSTALL_DIR/bin"
exec dotnet WatchNexus.Core.dll "\$@"
LAUNCHER
chmod +x "$BIN_DIR/watchnexus"

# Desktop entry
cat > "$DESKTOP_DIR/watchnexus.desktop" << DESKTOP
[Desktop Entry]
Name=WatchNexus
Comment=Unified Media Pipeline
Exec=$BIN_DIR/watchnexus
Terminal=false
Type=Application
Categories=AudioVideo;Video;
DESKTOP

echo ""
echo "================================================"
echo "  Installation complete!"
echo "================================================"
echo "  Run:       watchnexus"
echo "  Dashboard: http://localhost:8001"
echo "  Data:      $INSTALL_DIR"
echo ""

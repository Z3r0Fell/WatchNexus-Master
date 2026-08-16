#!/bin/bash
# WatchNexus Linux Installer (.NET 10) — v1.0.1
# Auto-start via systemd service
set -e
set -o pipefail

APP_NAME="WatchNexus"
APP_VERSION="1.0.1"
INSTALL_DIR="${HOME}/.local/share/watchnexus"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
SERVICE_NAME="watchnexus"

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
    if dotnet --list-sdks 2>/dev/null | grep -q "10\.0"; then
        FOUND+=(".NET 10 SDK ($DOTNET_VER)")
    else
        MISSING+=(".NET 10 SDK")
    fi
else
    MISSING+=(".NET 10 SDK")
fi

command -v node &>/dev/null && FOUND+=("Node.js $(node --version)") || MISSING+=("Node.js (required for frontend build)")
command -v yarn &>/dev/null && FOUND+=("Yarn $(yarn --version)") || MISSING+=("Yarn (required for frontend build)")

for item in "${FOUND[@]}"; do echo -e "  ${GREEN}OK${NC}      $item"; done
for item in "${MISSING[@]}"; do echo -e "  ${RED}MISSING${NC} $item"; done
echo "  -----------------------------------------------"
echo ""

if [ ${#MISSING[@]} -gt 0 ]; then
    read -p "  Install .NET 10 SDK automatically? (y/n): " ANSWER
    if [[ "$ANSWER" == "y" || "$ANSWER" == "Y" ]]; then
        curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
        if [ ! -s /tmp/dotnet-install.sh ] || ! head -1 /tmp/dotnet-install.sh | grep -q "dotnet-install"; then
            echo "  [ERROR] Downloaded script appears invalid. Aborting."
            rm -f /tmp/dotnet-install.sh
            exit 1
        fi
        bash /tmp/dotnet-install.sh --channel 10.0 --install-dir "$HOME/.dotnet"
        rm -f /tmp/dotnet-install.sh
        export PATH="$HOME/.dotnet:$PATH"
    else
        echo "Install manually: https://dotnet.microsoft.com/download/dotnet/10.0"
        exit 0
    fi
fi

# Resolve dotnet path
DOTNET_CMD="$(command -v dotnet)"

# Build
echo "[1/4] Building WatchNexus..."
mkdir -p "$INSTALL_DIR"/{bin/modules,data,logs} "$BIN_DIR" "$DESKTOP_DIR"
cd "$SCRIPT_DIR/src/watchnexus"
dotnet publish core/WatchNexus.Core.csproj -c Release -o "$INSTALL_DIR/bin" --self-contained false

echo "[2/4] Installing modules..."
cp -r "$SCRIPT_DIR/src/watchnexus/modules/"* "$INSTALL_DIR/bin/modules/" 2>/dev/null || true

# Create launcher
echo "[3/4] Creating launcher..."
cat > "$BIN_DIR/watchnexus" << LAUNCHER
#!/bin/bash
export ASPNETCORE_URLS="http://0.0.0.0:\${WATCHNEXUS_PORT:-8001}"
cd "$INSTALL_DIR/bin"
exec dotnet WatchNexus.Core.dll "\$@"
LAUNCHER
chmod +x "$BIN_DIR/watchnexus"

# systemd user service for auto-start
echo "[4/4] Registering auto-start service..."
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/${SERVICE_NAME}.service" << EOF
[Unit]
Description=WatchNexus Media Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment="WATCHNEXUS_PORT=8001"
ExecStart=$HOME/.local/bin/watchnexus
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable ${SERVICE_NAME}.service
if ! systemctl --user is-active --quiet ${SERVICE_NAME}.service; then
    systemctl --user start ${SERVICE_NAME}.service
fi

# Enable lingering so user services start at boot (before login)
loginctl enable-linger "$(whoami)"

echo ""
echo "================================================"
echo "  Installation complete!  v$APP_VERSION"
echo "================================================"
echo "  Dashboard: http://localhost:${WATCHNEXUS_PORT:-8001}"
echo "  Data:      $INSTALL_DIR"
echo ""
echo -e "  ${GREEN}Auto-start: ENABLED${NC}"
echo "  WatchNexus starts on boot, restarts on crash."
echo ""
echo "  Commands:"
echo "    systemctl --user status ${SERVICE_NAME}"
echo "    systemctl --user restart ${SERVICE_NAME}"
echo "    systemctl --user disable ${SERVICE_NAME}  (disable auto-start)"
echo ""

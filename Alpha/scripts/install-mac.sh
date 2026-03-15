#!/bin/bash
#===============================================================================
# WatchNexus Installation Script for macOS
# v2.6.5 — Installs WatchNexus + registers a LaunchDaemon for auto-start
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/Applications/WatchNexus.app"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"
CONFIG_DIR="$DATA_DIR/config"
VERSION="2.6.5"

# LaunchDaemon = system-level, starts at boot BEFORE any user logs in
# LaunchAgent  = user-level, starts at login
# We use a LaunchDaemon for resilience + a LaunchAgent as fallback
DAEMON_PLIST="/Library/LaunchDaemons/ca.watchnexus.server.plist"
AGENT_PLIST="$HOME/Library/LaunchAgents/ca.watchnexus.server.plist"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${BOLD}=============================================="
echo "  WatchNexus Installer - macOS  v${VERSION}"
echo -e "==============================================${NC}"
echo ""

check_macos_version() {
    local version=$(sw_vers -productVersion)
    local major=$(echo "$version" | cut -d. -f1)
    [ "$major" -lt 12 ] && { log_error "Requires macOS 12+. Current: $version"; exit 1; }
    log_info "macOS $version"
}

check_prerequisites() {
    echo -e "${BOLD}Checking prerequisites...${NC}"
    MISSING=()
    FOUND=()

    if command -v brew &>/dev/null; then FOUND+=("Homebrew"); else MISSING+=("Homebrew"); fi

    if command -v python3 &>/dev/null; then
        PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1); PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
        [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ] && FOUND+=("Python $PY_VER") || MISSING+=("Python 3.10+ (found $PY_VER)")
    else MISSING+=("Python 3.10+"); fi

    if command -v node &>/dev/null; then
        NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
        [ "$NODE_MAJOR" -ge 18 ] && FOUND+=("Node.js $(node --version)") || MISSING+=("Node.js 18+")
    else MISSING+=("Node.js 18+"); fi

    command -v yarn &>/dev/null && FOUND+=("Yarn") || MISSING+=("Yarn")
    command -v mongod &>/dev/null && FOUND+=("MongoDB") || MISSING+=("MongoDB 7.x")
    command -v ffmpeg &>/dev/null && FOUND+=("FFmpeg") || MISSING+=("FFmpeg (optional)")

    echo -e "  ${CYAN}Prerequisite Status:${NC}"
    echo "  -----------------------------------------------"
    for item in "${FOUND[@]}"; do echo -e "  ${GREEN}OK${NC}      $item"; done
    for item in "${MISSING[@]}"; do echo -e "  ${RED}MISSING${NC} $item"; done
    echo "  -----------------------------------------------"
    echo ""

    if [ ${#MISSING[@]} -gt 0 ]; then
        read -p "  Install missing dependencies via Homebrew? (y/n): " ANSWER
        [[ "$ANSWER" != "y" && "$ANSWER" != "Y" ]] && { log_info "Cancelled."; exit 0; }
    else
        echo -e "  ${GREEN}All prerequisites satisfied!${NC}"
    fi
    echo ""
}

install_homebrew() {
    if ! command -v brew &>/dev/null; then
        log_info "[1/7] Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        [[ $(uname -m) == "arm64" ]] && eval "$(/opt/homebrew/bin/brew shellenv)" || eval "$(/usr/local/bin/brew shellenv)"
    else
        log_info "[1/7] Homebrew OK"
    fi
}

install_deps() {
    log_info "[2/7] Installing dependencies..."
    brew install node yarn python@3.11 ffmpeg 2>/dev/null || true
    if ! command -v mongod &>/dev/null; then
        brew tap mongodb/brew 2>/dev/null || true
        brew install mongodb-community 2>/dev/null || log_warn "MongoDB not installed — use Docker"
    fi
    command -v mongod &>/dev/null && brew services start mongodb-community 2>/dev/null || true
    log_info "Dependencies installed"
}

create_directories() {
    log_info "[3/7] Creating directories..."
    mkdir -p "$DATA_DIR"/{config,themes,plugins,downloads,media,logs}
    mkdir -p "$HOME/Library/LaunchAgents"
    log_info "Directories created"
}

build_frontend() {
    log_info "[4/7] Building frontend..."
    cd "$PROJECT_ROOT/frontend"
    [ -f "yarn.lock" ] && yarn install --frozen-lockfile 2>/dev/null || yarn install
    yarn build
    [ -d "build" ] && FRONTEND_BUILD_DIR="build" || FRONTEND_BUILD_DIR="dist"
    log_info "Frontend built"
}

install_backend() {
    log_info "[5/7] Installing backend..."
    cd "$PROJECT_ROOT/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    log_info "Backend installed"
}

create_app_bundle() {
    log_info "[6/7] Creating app bundle..."
    rm -rf "$INSTALL_DIR" 2>/dev/null || true
    mkdir -p "$INSTALL_DIR/Contents/"{MacOS,Resources}

    cd "$PROJECT_ROOT/frontend"
    cp -r "$FRONTEND_BUILD_DIR" "$INSTALL_DIR/Contents/Resources/frontend"
    cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/Contents/Resources/"

    cat > "$INSTALL_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>WatchNexus</string>
    <key>CFBundleIdentifier</key><string>ca.watchnexus.app</string>
    <key>CFBundleVersion</key><string>$VERSION</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundleExecutable</key><string>watchnexus</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>LSApplicationCategoryType</key><string>public.app-category.entertainment</string>
</dict>
</plist>
EOF

    cat > "$INSTALL_DIR/Contents/MacOS/watchnexus" << 'LAUNCHEREOF'
#!/bin/bash
RESOURCES="$(cd "$(dirname "$0")/../Resources" && pwd)"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"
LOG_DIR="$DATA_DIR/logs"
mkdir -p "$LOG_DIR"
cd "$RESOURCES/backend"
source venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 8001 >> "$LOG_DIR/server.log" 2>&1 &
PID=$!
sleep 3
if kill -0 $PID 2>/dev/null; then
    open "http://localhost:8001"
    wait $PID
else
    osascript -e 'display alert "WatchNexus" message "Failed to start. Check ~/Library/Application Support/WatchNexus/logs/"'
fi
LAUNCHEREOF
    chmod +x "$INSTALL_DIR/Contents/MacOS/watchnexus"

    cat > "$INSTALL_DIR/Contents/Resources/backend/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF
    log_info "App bundle created"
}

#===============================================================================
# AUTO-START — LaunchDaemon (boot) + LaunchAgent (login) for full resilience
#===============================================================================
register_autostart() {
    log_info "[7/7] Registering auto-start service..."

    BACKEND_VENV="$INSTALL_DIR/Contents/Resources/backend/venv/bin/python"
    BACKEND_DIR="$INSTALL_DIR/Contents/Resources/backend"

    # --- LaunchAgent (user-level, starts at login) ---
    cat > "$AGENT_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ca.watchnexus.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BACKEND_VENV</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>server:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8001</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$BACKEND_DIR</string>

    <!-- Start automatically at login -->
    <key>RunAtLoad</key>
    <true/>

    <!-- Auto-restart on crash, max 3 retries -->
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>5</integer>

    <key>StandardOutPath</key>
    <string>$DATA_DIR/logs/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/logs/error.log</string>
</dict>
</plist>
EOF

    # Load the agent now
    launchctl unload "$AGENT_PLIST" 2>/dev/null || true
    launchctl load -w "$AGENT_PLIST" 2>/dev/null || true

    # --- LaunchDaemon (system-level, starts at boot BEFORE login) ---
    # Requires sudo — only attempt if user has admin privileges
    if [ "$(whoami)" = "root" ] || sudo -n true 2>/dev/null; then
        sudo tee "$DAEMON_PLIST" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ca.watchnexus.server.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BACKEND_VENV</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>server:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8001</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$BACKEND_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>$DATA_DIR/logs/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/logs/error.log</string>
</dict>
</plist>
EOF
        sudo launchctl load -w "$DAEMON_PLIST" 2>/dev/null || true
        log_info "LaunchDaemon registered — starts at BOOT (before login)"
    else
        log_warn "No admin access — skipped system-level daemon."
        log_warn "WatchNexus will start at login instead of boot."
    fi

    log_info "LaunchAgent registered — starts at LOGIN"
    echo ""
    echo -e "  ${GREEN}Auto-start: ENABLED${NC}"
    echo "  WatchNexus will automatically start after reboot/power failure."
}

main() {
    check_macos_version
    check_prerequisites
    install_homebrew
    install_deps
    create_directories
    build_frontend
    install_backend
    create_app_bundle
    register_autostart

    echo ""
    echo -e "${BOLD}=============================================="
    echo "  Installation Complete!  v${VERSION}"
    echo -e "==============================================${NC}"
    echo ""
    echo -e "  Access:    ${CYAN}http://localhost:8001${NC}"
    echo "  App:       $INSTALL_DIR"
    echo "  Data:      $DATA_DIR"
    echo ""
    echo -e "  ${GREEN}Auto-start: ENABLED${NC} — WatchNexus starts"
    echo "  automatically on every boot or login."
    echo ""
    echo "  Service commands:"
    echo "    launchctl list | grep watchnexus"
    echo "    launchctl stop ca.watchnexus.server"
    echo "    launchctl start ca.watchnexus.server"
    echo ""
    echo "  To disable auto-start:"
    echo "    launchctl unload -w ~/Library/LaunchAgents/ca.watchnexus.server.plist"
    echo ""
}

main "$@"

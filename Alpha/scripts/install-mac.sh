#!/bin/bash
#===============================================================================
# WatchNexus Installation Script for macOS
# v2.8.4 — Self-contained .NET 10 build (no runtime dependencies needed)
# Note: macOS builds are not currently produced. This script is a placeholder
# for future osx-x64 / osx-arm64 self-contained builds.
#===============================================================================

set -e

VERSION="2.8.4"
INSTALL_DIR="/Applications/WatchNexus"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"
DAEMON_PLIST="/Library/LaunchDaemons/ca.watchnexus.server.plist"
AGENT_PLIST="$HOME/Library/LaunchAgents/ca.watchnexus.server.plist"
PORT=8002

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Locate the binary
find_binary() {
    for path in \
        "$PROJECT_ROOT/WatchNexus.Core" \
        "$PROJECT_ROOT/osx-x64/WatchNexus.Core" \
        "$PROJECT_ROOT/osx-arm64/WatchNexus.Core"; do
        if [ -f "$path" ]; then
            SOURCE_DIR="$(dirname "$path")"
            log_info "Found release build at: $SOURCE_DIR"
            return 0
        fi
    done

    log_error "Could not find WatchNexus.Core executable."
    log_error "macOS builds (osx-x64 / osx-arm64) are not currently included in this alpha."
    log_error "A macOS build is planned for a future release."
    exit 1
}

install_files() {
    log_info "[1/3] Installing files..."
    mkdir -p "$INSTALL_DIR" "$DATA_DIR"

    # Preserve database
    if [ -d "$INSTALL_DIR/data" ]; then
        cp -r "$INSTALL_DIR/data" /tmp/wn_data_bak 2>/dev/null || true
    fi

    cp -r "$SOURCE_DIR"/* "$INSTALL_DIR/"
    chmod +x "$INSTALL_DIR/WatchNexus.Core"

    if [ -d /tmp/wn_data_bak ]; then
        cp -r /tmp/wn_data_bak "$INSTALL_DIR/data"
        rm -rf /tmp/wn_data_bak
    fi

    log_info "Files installed to $INSTALL_DIR"
}

create_launch_agent() {
    log_info "[2/3] Creating LaunchAgent for auto-start..."
    mkdir -p "$(dirname "$AGENT_PLIST")"

    cat > "$AGENT_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ca.watchnexus.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/WatchNexus.Core</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>WATCHNEXUS_PORT</key>
        <string>$PORT</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$DATA_DIR/watchnexus.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/watchnexus-error.log</string>
</dict>
</plist>
EOF

    launchctl load "$AGENT_PLIST" 2>/dev/null || true
    log_info "LaunchAgent registered"
}

start_and_verify() {
    log_info "[3/3] Starting WatchNexus..."
    launchctl start ca.watchnexus.server 2>/dev/null || true
    sleep 3
    if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}WatchNexus is running${NC}"
    else
        log_warn "Server may still be starting. Check: http://localhost:$PORT"
    fi
}

main() {
    find_binary
    install_files
    create_launch_agent
    start_and_verify

    echo ""
    echo -e "${BOLD}=============================================="
    echo "  Installation Complete!  v${VERSION}"
    echo -e "==============================================${NC}"
    echo ""
    echo -e "  Access:    ${CYAN}http://localhost:${PORT}${NC}"
    echo "  Install:   $INSTALL_DIR"
    echo "  Database:  $INSTALL_DIR/data/watchnexus.db"
    echo "  Logs:      $DATA_DIR/watchnexus.log"
    echo ""
    echo -e "  ${GREEN}Auto-start: ENABLED (LaunchAgent)${NC}"
    echo "  No additional dependencies required (self-contained .NET 10 build)."
    echo ""
    echo "  Commands:"
    echo "    launchctl start ca.watchnexus.server"
    echo "    launchctl stop ca.watchnexus.server"
    echo "    launchctl unload $AGENT_PLIST  (disable auto-start)"
    echo ""
}

main "$@"

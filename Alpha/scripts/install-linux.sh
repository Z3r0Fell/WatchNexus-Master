#!/bin/bash
#===============================================================================
# WatchNexus Installation Script for Linux (Debian/Ubuntu/Fedora/Arch)
# v2.8.4 — Self-contained .NET 10 build (no runtime dependencies needed)
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/watchnexus"
VERSION="2.8.4"
SERVICE_NAME="watchnexus"
USER="watchnexus"
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
echo "  WatchNexus Installer - Linux  v${VERSION}"
echo -e "==============================================${NC}"
echo ""

#===============================================================================
# LOCATE RELEASE BUILD
#===============================================================================
find_release_build() {
    for path in \
        "$PROJECT_ROOT/WatchNexus.Core" \
        "$PROJECT_ROOT/linux-x64/WatchNexus.Core" \
        "$PROJECT_ROOT/release_builds/linux-x64/WatchNexus.Core"; do
        if [ -f "$path" ]; then
            SOURCE_DIR="$(dirname "$path")"
            log_info "Found release build at: $SOURCE_DIR"
            return 0
        fi
    done

    log_error "Could not find WatchNexus.Core executable."
    log_error "Run this script from the extracted release archive directory."
    exit 1
}

#===============================================================================
# OPTIONAL: INSTALL TRAY ICON DEPENDENCIES
#===============================================================================
install_tray_deps() {
    echo ""
    echo -e "  ${CYAN}Optional: System tray icon support${NC}"
    echo "  WatchNexus can display a tray icon on desktop environments."
    echo "  This requires python3 and GTK AppIndicator3."
    echo ""
    read -p "  Install tray icon dependencies? (y/n): " ANSWER
    if [[ "$ANSWER" == "y" || "$ANSWER" == "Y" ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            case "$ID" in
                ubuntu|debian|pop|linuxmint|elementary)
                    sudo apt-get update -qq
                    sudo apt-get install -y python3 python3-gi gir1.2-ayatanaappindicator3-0.1 2>/dev/null || \
                    sudo apt-get install -y python3 python3-gi gir1.2-appindicator3-0.1 2>/dev/null || \
                    log_warn "Could not install tray dependencies — tray icon may not appear"
                    ;;
                fedora|rhel|centos|rocky|alma)
                    sudo dnf install -y python3 python3-gobject libayatana-appindicator-gtk3 2>/dev/null || \
                    log_warn "Could not install tray dependencies — tray icon may not appear"
                    ;;
                arch|manjaro|endeavouros)
                    sudo pacman -S --needed --noconfirm python python-gobject libayatana-appindicator 2>/dev/null || \
                    log_warn "Could not install tray dependencies — tray icon may not appear"
                    ;;
                *)
                    log_warn "Unknown distro: $ID. Install python3 + GTK AppIndicator3 manually for tray icon."
                    ;;
            esac
        fi
    fi
}

#===============================================================================
# INSTALL
#===============================================================================
setup_user_and_dirs() {
    log_info "[1/4] Creating user and directories..."
    id "$USER" &>/dev/null || sudo useradd -r -s /bin/false -d "$INSTALL_DIR" "$USER"
    sudo mkdir -p "$INSTALL_DIR"
    log_info "Directories created"
}

install_files() {
    log_info "[2/4] Installing files..."
    # Preserve existing database if upgrading
    if [ -d "$INSTALL_DIR/data" ]; then
        log_info "Preserving existing database..."
        sudo cp -r "$INSTALL_DIR/data" /tmp/watchnexus_data_backup 2>/dev/null || true
    fi

    sudo cp -r "$SOURCE_DIR"/* "$INSTALL_DIR/"
    sudo chmod +x "$INSTALL_DIR/WatchNexus.Core"

    # Restore database
    if [ -d /tmp/watchnexus_data_backup ]; then
        sudo cp -r /tmp/watchnexus_data_backup "$INSTALL_DIR/data"
        sudo rm -rf /tmp/watchnexus_data_backup
    fi

    sudo chown -R "$USER:$USER" "$INSTALL_DIR"
    log_info "Files installed to $INSTALL_DIR"
}

create_service() {
    log_info "[3/4] Creating systemd service..."

    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=WatchNexus Media Server v${VERSION}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/WatchNexus.Core
Environment=WATCHNEXUS_PORT=$PORT

Restart=always
RestartSec=5

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$INSTALL_DIR
PrivateTmp=true

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}.service
    log_info "Service created and enabled for auto-start"
}

start_and_verify() {
    log_info "[4/4] Starting WatchNexus..."
    sudo systemctl start ${SERVICE_NAME}.service 2>/dev/null || {
        log_warn "Could not start WatchNexus now — it will start on next boot."
        log_warn "Check: sudo journalctl -u ${SERVICE_NAME} -f"
        return
    }

    sleep 3
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "  ${GREEN}WatchNexus is running${NC}"
    else
        log_warn "Service not yet active. Check: sudo systemctl status ${SERVICE_NAME}"
    fi
}

main() {
    find_release_build
    install_tray_deps
    setup_user_and_dirs
    install_files
    create_service
    start_and_verify

    echo ""
    echo -e "${BOLD}=============================================="
    echo "  Installation Complete!  v${VERSION}"
    echo -e "==============================================${NC}"
    echo ""
    echo -e "  Access:    ${CYAN}http://localhost:${PORT}${NC}"
    echo "  Install:   $INSTALL_DIR"
    echo "  Database:  $INSTALL_DIR/data/watchnexus.db"
    echo ""
    echo -e "  ${GREEN}Auto-start: ENABLED${NC}"
    echo "  No additional dependencies required (self-contained .NET 10 build)."
    echo ""
    echo "  Service commands:"
    echo "    sudo systemctl status ${SERVICE_NAME}"
    echo "    sudo systemctl restart ${SERVICE_NAME}"
    echo "    sudo systemctl stop ${SERVICE_NAME}"
    echo "    sudo journalctl -u ${SERVICE_NAME} -f"
    echo ""
}

main "$@"

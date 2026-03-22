#!/bin/bash
#===============================================================================
# WatchNexus Build Script for Arch Linux
# v2.8.2.2 — Builds self-contained .NET 10 release and creates PKGBUILD
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
VERSION="2.8.2.2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[$1/$2]${NC} $3"; }

echo "=============================================="
echo "  WatchNexus Build Script - Arch Linux"
echo "  Version: $VERSION"
echo "=============================================="
echo ""

# Check if running on Arch Linux
check_arch() {
    if [ ! -f /etc/arch-release ]; then
        log_warn "This script is designed for Arch Linux."
        log_warn "It may work on Arch-based distros (Manjaro, EndeavourOS, etc.)"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
    fi
    log_info "Arch Linux detected"
}

# Install build dependencies
install_build_deps() {
    log_step 1 5 "Installing build dependencies..."
    sudo pacman -Sy
    sudo pacman -S --needed --noconfirm base-devel git nodejs npm yarn

    # Ensure .NET SDK is available
    export PATH="/opt/dotnet:$PATH"
    if ! command -v dotnet &>/dev/null; then
        log_info "Installing .NET 10 SDK..."
        curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 10.0 --install-dir /opt/dotnet
    fi
    log_info ".NET SDK: $(dotnet --version)"

    # Optional: tray icon dependencies
    sudo pacman -S --needed --noconfirm python python-gobject libayatana-appindicator 2>/dev/null || \
        log_warn "Tray icon dependencies not available — tray icon may not appear on desktop"

    log_info "Build dependencies installed"
}

# Build frontend
build_frontend() {
    log_step 2 5 "Building frontend..."
    cd "$PROJECT_ROOT/src/web"
    if [ ! -d node_modules ]; then yarn install --frozen-lockfile 2>/dev/null || yarn install; fi
    yarn build
    log_info "Frontend built"
}

# Build self-contained .NET release
build_dotnet() {
    log_step 3 5 "Building self-contained .NET release for linux-x64..."
    export PATH="/opt/dotnet:$PATH"
    cd "$PROJECT_ROOT/src/watchnexus/core"
    rm -rf bin obj
    dotnet publish -c Release -r linux-x64 --self-contained true -o "$BUILD_DIR/linux-x64" 2>&1 | tail -5
    chmod +x "$BUILD_DIR/linux-x64/WatchNexus.Core"
    log_info "Build complete"
}

# Create PKGBUILD and support files
create_arch_package() {
    log_step 4 5 "Creating Arch package files..."
    mkdir -p "$BUILD_DIR/pkg"

    # systemd service
    cat > "$BUILD_DIR/pkg/watchnexus.service" << 'SDEOF'
[Unit]
Description=WatchNexus Media Server
After=network.target

[Service]
Type=simple
User=watchnexus
Group=watchnexus
WorkingDirectory=/opt/watchnexus
ExecStart=/opt/watchnexus/WatchNexus.Core
Environment=WATCHNEXUS_PORT=8002
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
SDEOF

    # PKGBUILD
    cat > "$BUILD_DIR/pkg/PKGBUILD" << PKGEOF
# Maintainer: WatchNexus Team
pkgname=watchnexus
pkgver=${VERSION}
pkgrel=1
pkgdesc="Unified, self-hosted media pipeline"
arch=('x86_64')
license=('custom')
depends=()
optdepends=('python: system tray icon' 'python-gobject: system tray icon' 'libayatana-appindicator: system tray icon')
backup=('etc/systemd/system/watchnexus.service')
source=()

package() {
    install -dm755 "\$pkgdir/opt/watchnexus"
    cp -r "$BUILD_DIR/linux-x64/"* "\$pkgdir/opt/watchnexus/"
    install -Dm755 "$BUILD_DIR/linux-x64/WatchNexus.Core" "\$pkgdir/opt/watchnexus/WatchNexus.Core"
    install -Dm644 "$BUILD_DIR/pkg/watchnexus.service" "\$pkgdir/etc/systemd/system/watchnexus.service"
    install -dm755 "\$pkgdir/opt/watchnexus/data"
    install -Dm644 /dev/stdin "\$pkgdir/usr/lib/sysusers.d/watchnexus.conf" <<SYSEOF
u watchnexus - "WatchNexus" /opt/watchnexus /usr/bin/nologin
SYSEOF
}
PKGEOF

    # Desktop entry
    cat > "$BUILD_DIR/pkg/watchnexus.desktop" << 'DEOF'
[Desktop Entry]
Name=WatchNexus
Comment=Unified Media Pipeline
Exec=xdg-open http://localhost:8002
Icon=video-x-generic
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
DEOF

    log_info "Package files created"
}

# Install locally
install_local() {
    log_step 5 5 "Installing locally..."

    INSTALL_DIR="/opt/watchnexus"
    sudo mkdir -p "$INSTALL_DIR"

    # Preserve database
    if [ -d "$INSTALL_DIR/data" ]; then
        sudo cp -r "$INSTALL_DIR/data" /tmp/wn_data_bak 2>/dev/null || true
    fi

    sudo cp -r "$BUILD_DIR/linux-x64/"* "$INSTALL_DIR/"
    sudo chmod +x "$INSTALL_DIR/WatchNexus.Core"

    if [ -d /tmp/wn_data_bak ]; then
        sudo cp -r /tmp/wn_data_bak "$INSTALL_DIR/data"
        sudo rm -rf /tmp/wn_data_bak
    fi

    id watchnexus &>/dev/null || sudo useradd -r -s /usr/bin/nologin -d "$INSTALL_DIR" watchnexus
    sudo chown -R watchnexus:watchnexus "$INSTALL_DIR"
    sudo cp "$BUILD_DIR/pkg/watchnexus.service" /etc/systemd/system/
    sudo cp "$BUILD_DIR/pkg/watchnexus.desktop" /usr/share/applications/ 2>/dev/null || true
    sudo systemctl daemon-reload
    sudo systemctl enable watchnexus

    read -p "Start WatchNexus now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl start watchnexus
        sleep 2
        if systemctl is-active --quiet watchnexus; then
            log_info "WatchNexus is running at http://localhost:8002"
        else
            log_warn "Check: journalctl -u watchnexus -f"
        fi
    fi
}

main() {
    check_arch
    install_build_deps
    build_frontend
    build_dotnet
    create_arch_package
    install_local

    echo ""
    echo "=============================================="
    echo "  Installation Complete!  v$VERSION"
    echo "=============================================="
    echo ""
    echo -e "Access at: ${YELLOW}http://localhost:8002${NC}"
    echo ""
    echo "Commands:"
    echo "  sudo systemctl start watchnexus"
    echo "  sudo systemctl stop watchnexus"
    echo "  sudo systemctl status watchnexus"
    echo "  journalctl -u watchnexus -f"
    echo ""
}

main "$@"

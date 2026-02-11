#!/bin/bash
#===============================================================================
# WatchNexus Build Script for Arch Linux
# Creates an installable package using makepkg
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
DIST_DIR="$PROJECT_ROOT/dist"
VERSION="1.0.0"

echo "=============================================="
echo "  WatchNexus Build Script - Arch Linux"
echo "=============================================="
echo ""

# Check for required tools
check_dependencies() {
    echo "[1/6] Checking dependencies..."
    
    local missing=()
    
    command -v node >/dev/null 2>&1 || missing+=("nodejs")
    command -v yarn >/dev/null 2>&1 || missing+=("yarn")
    command -v python3 >/dev/null 2>&1 || missing+=("python")
    command -v pip >/dev/null 2>&1 || missing+=("python-pip")
    command -v makepkg >/dev/null 2>&1 || missing+=("pacman")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo "Missing dependencies: ${missing[*]}"
        echo "Installing with pacman..."
        sudo pacman -S --needed --noconfirm "${missing[@]}"
    fi
    
    echo "✓ All dependencies installed"
}

# Install system dependencies
install_system_deps() {
    echo "[2/6] Installing system dependencies..."
    
    sudo pacman -S --needed --noconfirm \
        base-devel \
        mongodb \
        libtorrent-rasterbar \
        python-libtorrent \
        ffmpeg \
        libvips \
        electron
    
    echo "✓ System dependencies installed"
}

# Build frontend
build_frontend() {
    echo "[3/6] Building frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # Install dependencies
    yarn install --frozen-lockfile
    
    # Build production bundle
    yarn build
    
    echo "✓ Frontend built"
}

# Build backend
build_backend() {
    echo "[4/6] Building backend..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Create standalone with PyInstaller (optional)
    # pip install pyinstaller
    # pyinstaller --onefile server.py
    
    deactivate
    
    echo "✓ Backend built"
}

# Create PKGBUILD
create_pkgbuild() {
    echo "[5/6] Creating PKGBUILD..."
    
    mkdir -p "$BUILD_DIR/pkg"
    
    cat > "$BUILD_DIR/pkg/PKGBUILD" << 'EOF'
# Maintainer: WatchNexus Team <team@watchnexus.ca>
pkgname=watchnexus
pkgver=1.0.0
pkgrel=1
pkgdesc="Unified, self-hosted media pipeline"
arch=('x86_64')
url="https://watchnexus.ca"
license=('MIT')
depends=(
    'electron'
    'nodejs'
    'python'
    'python-pip'
    'mongodb'
    'libtorrent-rasterbar'
    'python-libtorrent'
    'ffmpeg'
)
makedepends=('yarn' 'npm')
source=("watchnexus-$pkgver.tar.gz")
sha256sums=('SKIP')

package() {
    cd "$srcdir/watchnexus-$pkgver"
    
    # Install frontend
    install -dm755 "$pkgdir/opt/watchnexus/frontend"
    cp -r frontend/build/* "$pkgdir/opt/watchnexus/frontend/"
    
    # Install backend
    install -dm755 "$pkgdir/opt/watchnexus/backend"
    cp -r backend/* "$pkgdir/opt/watchnexus/backend/"
    
    # Install systemd service
    install -Dm644 scripts/watchnexus.service "$pkgdir/usr/lib/systemd/system/watchnexus.service"
    
    # Install desktop entry
    install -Dm644 scripts/watchnexus.desktop "$pkgdir/usr/share/applications/watchnexus.desktop"
    
    # Install icon
    install -Dm644 frontend/public/watchnexus-logo.svg "$pkgdir/usr/share/icons/hicolor/scalable/apps/watchnexus.svg"
    
    # Install launcher script
    install -Dm755 scripts/watchnexus "$pkgdir/usr/bin/watchnexus"
}
EOF

    # Create systemd service file
    cat > "$BUILD_DIR/pkg/watchnexus.service" << 'EOF'
[Unit]
Description=WatchNexus Media Server
After=network.target mongodb.service

[Service]
Type=simple
User=watchnexus
WorkingDirectory=/opt/watchnexus/backend
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Create desktop entry
    cat > "$BUILD_DIR/pkg/watchnexus.desktop" << 'EOF'
[Desktop Entry]
Name=WatchNexus
Comment=Unified Media Pipeline
Exec=watchnexus
Icon=watchnexus
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
StartupWMClass=WatchNexus
EOF

    # Create launcher script
    cat > "$BUILD_DIR/pkg/watchnexus" << 'EOF'
#!/bin/bash
cd /opt/watchnexus/frontend
electron .
EOF

    echo "✓ PKGBUILD created"
}

# Build package
build_package() {
    echo "[6/6] Building package..."
    
    mkdir -p "$DIST_DIR"
    cd "$BUILD_DIR/pkg"
    
    # Create source tarball
    tar -czvf "watchnexus-$VERSION.tar.gz" \
        -C "$PROJECT_ROOT" \
        frontend/build \
        backend \
        scripts
    
    # Build package
    makepkg -sf
    
    # Move package to dist
    mv *.pkg.tar.zst "$DIST_DIR/"
    
    echo "✓ Package built: $DIST_DIR/watchnexus-$VERSION-1-x86_64.pkg.tar.zst"
}

# Main
main() {
    check_dependencies
    install_system_deps
    build_frontend
    build_backend
    create_pkgbuild
    build_package
    
    echo ""
    echo "=============================================="
    echo "  Build Complete!"
    echo "=============================================="
    echo ""
    echo "Install with:"
    echo "  sudo pacman -U $DIST_DIR/watchnexus-$VERSION-1-x86_64.pkg.tar.zst"
    echo ""
    echo "Or install from AUR:"
    echo "  yay -S watchnexus-bin"
    echo ""
}

main "$@"

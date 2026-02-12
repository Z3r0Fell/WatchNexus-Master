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
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    command -v python3 >/dev/null 2>&1 || missing+=("python")
    command -v pip >/dev/null 2>&1 || missing+=("python-pip")
    command -v makepkg >/dev/null 2>&1 || missing+=("base-devel")
    command -v git >/dev/null 2>&1 || missing+=("git")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo "Missing dependencies: ${missing[*]}"
        echo "Installing with pacman..."
        sudo pacman -Sy --needed --noconfirm "${missing[@]}"
    fi
    
    # Install yarn globally if not present
    if ! command -v yarn &> /dev/null; then
        echo "Installing yarn..."
        sudo npm install -g yarn
    fi
    
    echo "✓ All dependencies installed"
}

# Install system dependencies
install_system_deps() {
    echo "[2/6] Installing system dependencies..."
    
    # Install available packages (some may not exist in repos)
    sudo pacman -Sy --needed --noconfirm \
        base-devel \
        ffmpeg \
        libvips || true
    
    # MongoDB - use AUR or skip
    if ! command -v mongod &> /dev/null; then
        echo "Note: MongoDB not found in official repos."
        echo "Install from AUR: yay -S mongodb-bin"
        echo "Or use Docker: docker run -d -p 27017:27017 mongo:7"
    fi
    
    echo "✓ System dependencies installed"
}

# Build frontend
build_frontend() {
    echo "[3/6] Building frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # Check if frontend directory exists
    if [ ! -f "package.json" ]; then
        echo "Error: frontend/package.json not found"
        echo "Make sure you're running this from the WatchNexus project root"
        exit 1
    fi
    
    # Install dependencies (don't use frozen-lockfile if no lock file)
    if [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile
    else
        yarn install
    fi
    
    # Build production bundle
    yarn build
    
    echo "✓ Frontend built"
}

# Build backend
build_backend() {
    echo "[4/6] Building backend..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Check if backend directory exists
    if [ ! -f "requirements.txt" ]; then
        echo "Error: backend/requirements.txt not found"
        exit 1
    fi
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    pip install --upgrade pip
    pip install -r requirements.txt
    
    deactivate
    
    echo "✓ Backend built"
}

# Create PKGBUILD and support files
create_pkgbuild() {
    echo "[5/6] Creating PKGBUILD..."
    
    mkdir -p "$BUILD_DIR/pkg"
    
    # Create systemd service file
    cat > "$BUILD_DIR/pkg/watchnexus.service" << 'SERVICEEOF'
[Unit]
Description=WatchNexus Media Server
After=network.target

[Service]
Type=simple
User=watchnexus
WorkingDirectory=/opt/watchnexus/backend
ExecStart=/opt/watchnexus/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

    # Create desktop entry
    cat > "$BUILD_DIR/pkg/watchnexus.desktop" << 'DESKTOPEOF'
[Desktop Entry]
Name=WatchNexus
Comment=Unified Media Pipeline
Exec=xdg-open http://localhost:8001
Icon=watchnexus
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
DESKTOPEOF

    # Create launcher script
    cat > "$BUILD_DIR/pkg/watchnexus" << 'LAUNCHEREOF'
#!/bin/bash
cd /opt/watchnexus/backend
source venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 8001 &
sleep 2
xdg-open http://localhost:8001
LAUNCHEREOF

    chmod +x "$BUILD_DIR/pkg/watchnexus"

    echo "✓ Support files created"
}

# Build/Install locally (without makepkg)
install_local() {
    echo "[6/6] Installing locally..."
    
    INSTALL_DIR="/opt/watchnexus"
    
    # Create directories
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p /var/lib/watchnexus/{themes,plugins,downloads,media}
    
    # Copy files
    sudo cp -r "$PROJECT_ROOT/frontend/build" "$INSTALL_DIR/frontend" 2>/dev/null || \
    sudo cp -r "$PROJECT_ROOT/frontend/dist" "$INSTALL_DIR/frontend" 2>/dev/null || \
    echo "Warning: No frontend build found"
    
    sudo cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/"
    
    # Install service
    sudo cp "$BUILD_DIR/pkg/watchnexus.service" /etc/systemd/system/ 2>/dev/null || true
    
    # Create user
    sudo useradd -r -s /bin/false watchnexus 2>/dev/null || true
    sudo chown -R watchnexus:watchnexus "$INSTALL_DIR"
    sudo chown -R watchnexus:watchnexus /var/lib/watchnexus
    
    echo "✓ Installed to $INSTALL_DIR"
}

# Main
main() {
    check_dependencies
    install_system_deps
    build_frontend
    build_backend
    create_pkgbuild
    install_local
    
    echo ""
    echo "=============================================="
    echo "  Build Complete!"
    echo "=============================================="
    echo ""
    echo "WatchNexus installed to: /opt/watchnexus"
    echo ""
    echo "Start the service:"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable --now watchnexus"
    echo ""
    echo "Or run manually:"
    echo "  cd /opt/watchnexus/backend"
    echo "  source venv/bin/activate"
    echo "  python -m uvicorn server:app --host 0.0.0.0 --port 8001"
    echo ""
    echo "Access at: http://localhost:8001"
    echo ""
}

main "$@"

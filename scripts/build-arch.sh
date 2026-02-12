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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check for required tools
check_dependencies() {
    log_info "[1/6] Checking dependencies..."
    
    local missing=()
    
    # Check for required commands
    command -v node >/dev/null 2>&1 || missing+=("nodejs")
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    command -v python3 >/dev/null 2>&1 || missing+=("python")
    command -v pip >/dev/null 2>&1 || missing+=("python-pip")
    command -v git >/dev/null 2>&1 || missing+=("git")
    
    # Check for base-devel group
    if ! pacman -Qg base-devel &>/dev/null; then
        missing+=("base-devel")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_warn "Missing dependencies: ${missing[*]}"
        log_info "Installing with pacman..."
        sudo pacman -Sy --needed --noconfirm "${missing[@]}" || {
            log_error "Failed to install dependencies"
            exit 1
        }
    fi
    
    # Install yarn globally if not present
    if ! command -v yarn &> /dev/null; then
        log_info "Installing yarn..."
        sudo npm install -g yarn || {
            log_error "Failed to install yarn"
            exit 1
        }
    fi
    
    log_info "✓ All dependencies installed"
}

# Install system dependencies
install_system_deps() {
    log_info "[2/6] Installing system dependencies..."
    
    # Install core packages
    sudo pacman -Sy --needed --noconfirm \
        base-devel \
        ffmpeg \
        python-virtualenv \
        python-pip || {
        log_error "Failed to install system packages"
        exit 1
    }
    
    # Try to install libvips if available
    sudo pacman -S --needed --noconfirm libvips 2>/dev/null || log_warn "libvips not found in repos, skipping"
    
    # MongoDB - check AUR or provide instructions
    if ! command -v mongod &> /dev/null; then
        log_warn "MongoDB not found in official repos."
        echo ""
        echo "  To install MongoDB, choose one of these options:"
        echo ""
        echo "  Option 1 - AUR (recommended):"
        echo "    yay -S mongodb-bin"
        echo ""
        echo "  Option 2 - Docker:"
        echo "    docker run -d --name mongodb -p 27017:27017 mongo:7"
        echo ""
        echo "  Option 3 - Manual install from MongoDB website"
        echo ""
        read -p "Press Enter to continue without MongoDB, or Ctrl+C to exit and install it first..."
    fi
    
    log_info "✓ System dependencies installed"
}

# Build frontend
build_frontend() {
    log_info "[3/6] Building frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # Check if frontend directory exists
    if [ ! -f "package.json" ]; then
        log_error "frontend/package.json not found"
        log_error "Make sure you're running this from the WatchNexus project root"
        exit 1
    fi
    
    # Clean previous builds
    rm -rf build dist node_modules/.cache 2>/dev/null || true
    
    # Install dependencies
    log_info "Installing frontend dependencies..."
    if [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile || yarn install
    else
        yarn install
    fi
    
    # Build production bundle
    log_info "Building production bundle..."
    yarn build || {
        log_error "Frontend build failed"
        exit 1
    }
    
    # Check which output directory was created
    if [ -d "build" ]; then
        FRONTEND_BUILD_DIR="build"
    elif [ -d "dist" ]; then
        FRONTEND_BUILD_DIR="dist"
    else
        log_error "No build output directory found (expected 'build' or 'dist')"
        exit 1
    fi
    
    log_info "✓ Frontend built (output: $FRONTEND_BUILD_DIR)"
}

# Build backend
build_backend() {
    log_info "[4/6] Building backend..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Check if backend directory exists
    if [ ! -f "requirements.txt" ]; then
        log_error "backend/requirements.txt not found"
        exit 1
    fi
    
    # Remove old virtual environment if corrupt
    if [ -d "venv" ] && [ ! -f "venv/bin/activate" ]; then
        log_warn "Corrupt venv detected, removing..."
        rm -rf venv
    fi
    
    # Create virtual environment
    log_info "Creating virtual environment..."
    python3 -m venv venv || {
        log_error "Failed to create virtual environment"
        log_info "Try: sudo pacman -S python-virtualenv"
        exit 1
    }
    
    # Activate and install
    source venv/bin/activate
    
    log_info "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt || {
        log_error "Failed to install Python dependencies"
        deactivate
        exit 1
    }
    
    deactivate
    
    log_info "✓ Backend built"
}

# Create PKGBUILD and support files
create_pkgbuild() {
    log_info "[5/6] Creating support files..."
    
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
BACKEND_PID=$!
sleep 2
xdg-open http://localhost:8001
wait $BACKEND_PID
LAUNCHEREOF

    chmod +x "$BUILD_DIR/pkg/watchnexus"

    log_info "✓ Support files created"
}

# Build/Install locally (without makepkg)
install_local() {
    log_info "[6/6] Installing locally..."
    
    INSTALL_DIR="/opt/watchnexus"
    
    # Create directories
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p /var/lib/watchnexus/{themes,plugins,downloads,media}
    
    # Determine frontend build directory
    cd "$PROJECT_ROOT/frontend"
    if [ -d "build" ]; then
        FRONTEND_BUILD_DIR="build"
    elif [ -d "dist" ]; then
        FRONTEND_BUILD_DIR="dist"
    else
        log_error "No frontend build directory found"
        exit 1
    fi
    
    # Copy frontend
    log_info "Copying frontend..."
    sudo rm -rf "$INSTALL_DIR/frontend" 2>/dev/null || true
    sudo cp -r "$PROJECT_ROOT/frontend/$FRONTEND_BUILD_DIR" "$INSTALL_DIR/frontend"
    
    # Copy backend
    log_info "Copying backend..."
    sudo rm -rf "$INSTALL_DIR/backend" 2>/dev/null || true
    sudo cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/"
    
    # Install service
    sudo cp "$BUILD_DIR/pkg/watchnexus.service" /etc/systemd/system/ 2>/dev/null || true
    
    # Create user (ignore if exists)
    sudo useradd -r -s /bin/false watchnexus 2>/dev/null || true
    
    # Set permissions
    sudo chown -R watchnexus:watchnexus "$INSTALL_DIR"
    sudo chown -R watchnexus:watchnexus /var/lib/watchnexus
    
    log_info "✓ Installed to $INSTALL_DIR"
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

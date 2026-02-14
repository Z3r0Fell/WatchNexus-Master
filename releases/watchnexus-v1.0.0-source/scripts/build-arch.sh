#!/bin/bash
#===============================================================================
# WatchNexus Build Script for Arch Linux
# Installs dependencies via pacman and builds WatchNexus
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
VERSION="1.0.0"

echo "=============================================="
echo "  WatchNexus Build Script - Arch Linux"
echo "  Version: $VERSION"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[$1/$2]${NC} $3"; }

# Check if running on Arch Linux
check_arch() {
    if [ ! -f /etc/arch-release ]; then
        log_warn "This script is designed for Arch Linux."
        log_warn "It may work on Arch-based distros (Manjaro, EndeavourOS, etc.)"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    log_info "Arch Linux detected"
}

# Install all dependencies via pacman
install_dependencies() {
    log_step 1 6 "Installing dependencies via pacman..."
    
    log_info "Updating package database..."
    sudo pacman -Sy
    
    log_info "Installing core packages..."
    sudo pacman -S --needed --noconfirm \
        base-devel \
        git \
        nodejs \
        npm \
        yarn \
        python \
        python-pip \
        python-virtualenv \
        ffmpeg \
        libvips || {
        log_error "Failed to install pacman packages"
        exit 1
    }
    
    log_info "Core packages installed"
    
    # MongoDB - needs AUR
    if ! command -v mongod &> /dev/null; then
        echo ""
        log_warn "MongoDB is not available in official Arch repos."
        echo ""
        echo "  Choose an installation method:"
        echo ""
        echo "  1) AUR with yay (recommended)"
        echo "  2) AUR with paru"  
        echo "  3) Docker container"
        echo "  4) Skip (I'll install manually)"
        echo ""
        read -p "Enter choice [1-4]: " mongo_choice
        
        case $mongo_choice in
            1)
                if ! command -v yay &> /dev/null; then
                    log_info "Installing yay AUR helper..."
                    cd /tmp
                    git clone https://aur.archlinux.org/yay.git
                    cd yay
                    makepkg -si --noconfirm
                    cd "$PROJECT_ROOT"
                    rm -rf /tmp/yay
                fi
                log_info "Installing MongoDB from AUR..."
                yay -S --noconfirm mongodb-bin
                ;;
            2)
                if ! command -v paru &> /dev/null; then
                    log_info "Installing paru AUR helper..."
                    cd /tmp
                    git clone https://aur.archlinux.org/paru.git
                    cd paru
                    makepkg -si --noconfirm
                    cd "$PROJECT_ROOT"
                    rm -rf /tmp/paru
                fi
                log_info "Installing MongoDB from AUR..."
                paru -S --noconfirm mongodb-bin
                ;;
            3)
                log_info "Setting up MongoDB via Docker..."
                sudo pacman -S --needed --noconfirm docker
                sudo systemctl enable --now docker
                sudo docker run -d \
                    --name mongodb \
                    -p 27017:27017 \
                    -v mongodb_data:/data/db \
                    --restart unless-stopped \
                    mongo:7
                log_info "MongoDB container started"
                ;;
            4)
                log_warn "Skipping MongoDB. You'll need to install it manually."
                log_warn "Commands:"
                log_warn "  yay -S mongodb-bin"
                log_warn "  OR: docker run -d --name mongodb -p 27017:27017 mongo:7"
                ;;
            *)
                log_warn "Invalid choice. Skipping MongoDB installation."
                ;;
        esac
    else
        log_info "MongoDB already installed"
    fi
    
    log_info "Dependencies installed successfully"
}

# Build frontend
build_frontend() {
    log_step 2 6 "Building frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    
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
        yarn install --frozen-lockfile 2>/dev/null || yarn install
    else
        yarn install
    fi
    
    # Build production bundle
    log_info "Building production bundle..."
    NODE_OPTIONS="--max-old-space-size=4096" yarn build || {
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
    
    log_info "Frontend built (output: $FRONTEND_BUILD_DIR)"
}

# Build backend
build_backend() {
    log_step 3 6 "Building backend..."
    
    cd "$PROJECT_ROOT/backend"
    
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
    python -m venv venv || {
        log_error "Failed to create virtual environment"
        exit 1
    }
    
    # Activate and install
    source venv/bin/activate
    
    log_info "Upgrading pip..."
    pip install --upgrade pip
    
    log_info "Installing Python dependencies..."
    pip install -r requirements.txt || {
        log_error "Failed to install Python dependencies"
        deactivate
        exit 1
    }
    
    deactivate
    
    log_info "Backend built"
}

# Create systemd and support files
create_support_files() {
    log_step 4 6 "Creating support files..."
    
    mkdir -p "$BUILD_DIR/pkg"
    
    # Create systemd service file
    cat > "$BUILD_DIR/pkg/watchnexus.service" << 'SERVICEEOF'
[Unit]
Description=WatchNexus Media Server
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=simple
User=watchnexus
WorkingDirectory=/opt/watchnexus/backend
Environment=MONGO_URL=mongodb://localhost:27017
Environment=DB_NAME=watchnexus
Environment=WATCHNEXUS_PLUGINS_DIR=/var/lib/watchnexus/plugins
Environment=WATCHNEXUS_THEMES_DIR=/var/lib/watchnexus/themes
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
Icon=video-x-generic
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
DESKTOPEOF

    # Create launcher script for manual use
    cat > "$BUILD_DIR/pkg/watchnexus-run" << 'LAUNCHEREOF'
#!/bin/bash
cd /opt/watchnexus/backend
source venv/bin/activate
echo "Starting WatchNexus..."
echo "Access at: http://localhost:8001"
echo "Press Ctrl+C to stop."
python -m uvicorn server:app --host 127.0.0.1 --port 8001
LAUNCHEREOF

    chmod +x "$BUILD_DIR/pkg/watchnexus-run"

    log_info "Support files created"
}

# Install to system
install_local() {
    log_step 5 6 "Installing to system..."
    
    INSTALL_DIR="/opt/watchnexus"
    DATA_DIR="/var/lib/watchnexus"
    
    # Create directories
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p "$DATA_DIR"/{themes,plugins,downloads,media,logs}
    
    # Copy frontend
    log_info "Installing frontend..."
    cd "$PROJECT_ROOT/frontend"
    if [ -d "build" ]; then
        FRONTEND_BUILD_DIR="build"
    elif [ -d "dist" ]; then
        FRONTEND_BUILD_DIR="dist"
    fi
    sudo rm -rf "$INSTALL_DIR/frontend" 2>/dev/null || true
    sudo cp -r "$FRONTEND_BUILD_DIR" "$INSTALL_DIR/frontend"
    
    # Copy backend
    log_info "Installing backend..."
    sudo rm -rf "$INSTALL_DIR/backend" 2>/dev/null || true
    sudo cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/"
    
    # Create environment file
    sudo tee "$INSTALL_DIR/backend/.env" > /dev/null << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF

    # Install systemd service
    sudo cp "$BUILD_DIR/pkg/watchnexus.service" /etc/systemd/system/
    
    # Install desktop entry
    sudo cp "$BUILD_DIR/pkg/watchnexus.desktop" /usr/share/applications/ 2>/dev/null || true
    
    # Install launcher script
    sudo cp "$BUILD_DIR/pkg/watchnexus-run" /usr/local/bin/watchnexus
    
    # Create system user (ignore if exists)
    sudo useradd -r -s /usr/bin/nologin -d "$INSTALL_DIR" watchnexus 2>/dev/null || true
    
    # Set permissions
    sudo chown -R watchnexus:watchnexus "$INSTALL_DIR"
    sudo chown -R watchnexus:watchnexus "$DATA_DIR"
    
    log_info "Installed to $INSTALL_DIR"
}

# Enable and start service
start_service() {
    log_step 6 6 "Configuring service..."
    
    sudo systemctl daemon-reload
    
    echo ""
    read -p "Enable WatchNexus to start on boot? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl enable watchnexus
        log_info "WatchNexus will start on boot"
    fi
    
    echo ""
    read -p "Start WatchNexus now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl start watchnexus
        sleep 2
        if systemctl is-active --quiet watchnexus; then
            log_info "WatchNexus is running!"
        else
            log_warn "WatchNexus may have failed to start. Check logs with:"
            log_warn "  journalctl -u watchnexus -f"
        fi
    fi
}

# Main
main() {
    check_arch
    install_dependencies
    build_frontend
    build_backend
    create_support_files
    install_local
    start_service
    
    echo ""
    echo "=============================================="
    echo "  Installation Complete!"
    echo "=============================================="
    echo ""
    echo "WatchNexus installed to: /opt/watchnexus"
    echo ""
    echo "Commands:"
    echo "  Start:   sudo systemctl start watchnexus"
    echo "  Stop:    sudo systemctl stop watchnexus"
    echo "  Status:  sudo systemctl status watchnexus"
    echo "  Logs:    journalctl -u watchnexus -f"
    echo "  Manual:  watchnexus  (or /usr/local/bin/watchnexus)"
    echo ""
    echo -e "Access at: ${YELLOW}http://localhost:8001${NC}"
    echo ""
    
    if ! command -v mongod &> /dev/null && ! docker ps 2>/dev/null | grep -q mongodb; then
        echo ""
        log_warn "MongoDB is required but may not be running."
        log_warn "Start MongoDB before using WatchNexus:"
        log_warn "  sudo systemctl start mongodb"
        log_warn "  OR: docker start mongodb"
    fi
    echo ""
}

main "$@"

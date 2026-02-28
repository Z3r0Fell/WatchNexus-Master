#!/bin/bash
#
# WatchNexus Installer for Linux
# Downloads and installs all dependencies automatically
#

set -e

VERSION="2.6.1"
INSTALL_DIR="$HOME/.local/share/watchnexus"
BIN_DIR="$HOME/.local/bin"
DATA_DIR="$HOME/.watchnexus"
DOWNLOAD_URL="https://github.com/watchnexus/watchnexus/releases/download/v${VERSION}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[*]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Detect distro
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
    elif command -v lsb_release &>/dev/null; then
        DISTRO=$(lsb_release -is | tr '[:upper:]' '[:lower:]')
    else
        DISTRO="unknown"
    fi
}

# Install Python 3.10+ if needed
install_python() {
    if command -v python3 &>/dev/null; then
        PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        PY_MAJOR=$(echo $PY_VER | cut -d. -f1)
        PY_MINOR=$(echo $PY_VER | cut -d. -f2)
        if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ]; then
            success "Python $PY_VER already installed"
            return 0
        fi
    fi
    
    log "Installing Python 3.11..."
    case $DISTRO in
        ubuntu|debian|linuxmint|pop)
            sudo apt-get update -qq
            sudo apt-get install -y python3.11 python3.11-venv python3-pip
            ;;
        fedora)
            sudo dnf install -y python3.11
            ;;
        arch|manjaro)
            sudo pacman -S --noconfirm python
            ;;
        *)
            warn "Unknown distro, trying generic python3 install"
            sudo apt-get install -y python3 python3-venv python3-pip 2>/dev/null || \
            sudo dnf install -y python3 2>/dev/null || \
            sudo pacman -S --noconfirm python 2>/dev/null || \
            error "Could not install Python. Install Python 3.10+ manually."
            ;;
    esac
    success "Python installed"
}

# Install Node.js 18+ if needed
install_node() {
    if command -v node &>/dev/null; then
        NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VER" -ge 18 ]; then
            success "Node.js v$NODE_VER already installed"
            return 0
        fi
    fi
    
    log "Installing Node.js 20 LTS..."
    
    # Use NodeSource for consistent installs
    if command -v curl &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null && \
        sudo apt-get install -y nodejs 2>/dev/null
    fi
    
    # Fallback to distro packages
    if ! command -v node &>/dev/null; then
        case $DISTRO in
            ubuntu|debian) sudo apt-get install -y nodejs npm ;;
            fedora) sudo dnf install -y nodejs npm ;;
            arch|manjaro) sudo pacman -S --noconfirm nodejs npm ;;
        esac
    fi
    
    command -v node &>/dev/null || error "Could not install Node.js. Install Node.js 18+ manually."
    success "Node.js installed"
}

# Install FFmpeg if needed
install_ffmpeg() {
    if command -v ffmpeg &>/dev/null; then
        success "FFmpeg already installed"
        return 0
    fi
    
    log "Installing FFmpeg..."
    case $DISTRO in
        ubuntu|debian|linuxmint|pop)
            sudo apt-get install -y ffmpeg
            ;;
        fedora)
            sudo dnf install -y ffmpeg
            ;;
        arch|manjaro)
            sudo pacman -S --noconfirm ffmpeg
            ;;
        *)
            warn "Could not auto-install FFmpeg - install manually for transcoding support"
            return 0
            ;;
    esac
    success "FFmpeg installed"
}

# Download WatchNexus
download_app() {
    log "Downloading WatchNexus v${VERSION}..."
    
    mkdir -p "$INSTALL_DIR" "$DATA_DIR"
    cd "$INSTALL_DIR"
    
    # Try to download release tarball
    if command -v curl &>/dev/null; then
        curl -fsSL "${DOWNLOAD_URL}/watchnexus-${VERSION}-linux.tar.gz" -o watchnexus.tar.gz 2>/dev/null || \
        curl -fsSL "${DOWNLOAD_URL}/watchnexus-linux.tar.gz" -o watchnexus.tar.gz 2>/dev/null || true
    elif command -v wget &>/dev/null; then
        wget -q "${DOWNLOAD_URL}/watchnexus-${VERSION}-linux.tar.gz" -O watchnexus.tar.gz 2>/dev/null || true
    fi
    
    if [ -f watchnexus.tar.gz ] && [ -s watchnexus.tar.gz ]; then
        tar -xzf watchnexus.tar.gz
        rm watchnexus.tar.gz
        success "Downloaded release package"
    else
        # Fallback: clone from git
        warn "Release not found, cloning from repository..."
        rm -f watchnexus.tar.gz
        if command -v git &>/dev/null; then
            git clone --depth 1 https://github.com/watchnexus/watchnexus.git . 2>/dev/null || \
            error "Could not download WatchNexus. Check your internet connection."
        else
            error "Git not installed. Install git or download manually."
        fi
    fi
}

# Setup Python environment
setup_backend() {
    log "Setting up backend..."
    
    cd "$INSTALL_DIR"
    
    # Find server directory
    if [ -d "src/server" ]; then
        SERVER_DIR="src/server"
    elif [ -d "server" ]; then
        SERVER_DIR="server"
    elif [ -d "separated/server" ]; then
        SERVER_DIR="separated/server"
    else
        error "Server directory not found"
    fi
    
    cd "$SERVER_DIR"
    
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    deactivate
    
    # Create env file
    if [ ! -f .env ]; then
        echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
        echo "DATA_DIR=$DATA_DIR" >> .env
    fi
    
    success "Backend configured"
}

# Create launcher script
create_launcher() {
    log "Creating launcher..."
    
    mkdir -p "$BIN_DIR"
    
    cat > "$BIN_DIR/watchnexus" << 'LAUNCHER'
#!/bin/bash
INSTALL_DIR="$HOME/.local/share/watchnexus"
cd "$INSTALL_DIR"

# Find and start server
for dir in src/server server separated/server; do
    if [ -d "$dir" ]; then
        cd "$dir"
        source venv/bin/activate
        exec uvicorn server:app --host 127.0.0.1 --port 8001
    fi
done
echo "Server not found"
exit 1
LAUNCHER

    chmod +x "$BIN_DIR/watchnexus"
    
    # Add to PATH if needed
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
    fi
    
    success "Launcher created at $BIN_DIR/watchnexus"
}

# Create desktop entry
create_desktop_entry() {
    DESKTOP_DIR="$HOME/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    
    cat > "$DESKTOP_DIR/watchnexus.desktop" << EOF
[Desktop Entry]
Name=WatchNexus
Comment=Media Server
Exec=sh -c '$BIN_DIR/watchnexus & sleep 2 && xdg-open http://localhost:8001'
Icon=video-display
Terminal=false
Type=Application
Categories=AudioVideo;Video;
EOF

    success "Desktop entry created"
}

# Create systemd service
create_service() {
    SERVICE_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SERVICE_DIR"
    
    cat > "$SERVICE_DIR/watchnexus.service" << EOF
[Unit]
Description=WatchNexus Media Server
After=network.target

[Service]
Type=simple
ExecStart=$BIN_DIR/watchnexus
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    success "Systemd service created (run: systemctl --user enable --now watchnexus)"
}

# Main
main() {
    echo ""
    echo "  WatchNexus Installer v${VERSION}"
    echo "  ================================"
    echo ""
    
    detect_distro
    log "Detected: $DISTRO"
    
    install_python
    install_node
    install_ffmpeg
    download_app
    setup_backend
    create_launcher
    create_desktop_entry
    create_service
    
    echo ""
    echo "  ================================"
    success "Installation complete!"
    echo ""
    echo "  Start WatchNexus:"
    echo "    watchnexus"
    echo ""
    echo "  Or enable auto-start:"
    echo "    systemctl --user enable --now watchnexus"
    echo ""
    echo "  Then open: http://localhost:8001"
    echo ""
}

main "$@"

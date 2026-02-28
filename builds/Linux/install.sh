#!/bin/bash
# WatchNexus Linux Installer
# Installs all dependencies and sets up the application

set -e

echo "=========================================="
echo "  WatchNexus Linux Installer"
echo "=========================================="
echo ""

# Detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        DISTRO_VERSION=$VERSION_ID
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
    elif [ -f /etc/redhat-release ]; then
        DISTRO="rhel"
    else
        DISTRO="unknown"
    fi
    echo "Detected distribution: $DISTRO"
}

# Install system dependencies based on distro
install_system_deps() {
    echo ""
    echo "Installing system dependencies..."
    
    case $DISTRO in
        ubuntu|debian|linuxmint|pop)
            sudo apt update
            sudo apt install -y python3 python3-pip python3-venv nodejs npm ffmpeg curl
            ;;
        fedora)
            sudo dnf install -y python3 python3-pip nodejs npm ffmpeg curl
            ;;
        centos|rhel|rocky|almalinux)
            sudo dnf install -y python3 python3-pip nodejs npm curl
            # FFmpeg requires RPM Fusion
            sudo dnf install -y epel-release
            sudo dnf install -y ffmpeg --enablerepo=epel
            ;;
        arch|manjaro|endeavouros)
            sudo pacman -Syu --noconfirm python python-pip nodejs npm ffmpeg curl
            ;;
        opensuse*)
            sudo zypper install -y python3 python3-pip nodejs npm ffmpeg curl
            ;;
        *)
            echo "Unsupported distribution: $DISTRO"
            echo "Please install manually: python3, pip, nodejs, npm, ffmpeg"
            exit 1
            ;;
    esac
}

# Install Yarn
install_yarn() {
    echo ""
    echo "Installing Yarn..."
    if ! command -v yarn &> /dev/null; then
        sudo npm install -g yarn
    else
        echo "Yarn already installed"
    fi
}

# Create installation directory
INSTALL_DIR="${HOME}/watchnexus"
DATA_DIR="${HOME}/.watchnexus"

setup_directories() {
    echo ""
    echo "Setting up directories..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR/logs"
    mkdir -p "$DATA_DIR/backups"
    mkdir -p "$DATA_DIR/cache"
}

# Copy application files
copy_files() {
    echo ""
    echo "Copying application files..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Copy backend
    if [ -d "$SCRIPT_DIR/server" ]; then
        cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/"
    elif [ -d "$SCRIPT_DIR/../separated/server" ]; then
        cp -r "$SCRIPT_DIR/../separated/server" "$INSTALL_DIR/"
    fi
    
    # Copy frontend build or source
    if [ -d "$SCRIPT_DIR/web/build" ]; then
        cp -r "$SCRIPT_DIR/web/build" "$INSTALL_DIR/web/"
    elif [ -d "$SCRIPT_DIR/web" ]; then
        cp -r "$SCRIPT_DIR/web" "$INSTALL_DIR/"
    elif [ -d "$SCRIPT_DIR/../separated/web" ]; then
        cp -r "$SCRIPT_DIR/../separated/web" "$INSTALL_DIR/"
    fi
}

# Setup Python virtual environment
setup_python_env() {
    echo ""
    echo "Setting up Python environment..."
    
    cd "$INSTALL_DIR/server"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
}

# Setup Node.js dependencies
setup_node_env() {
    echo ""
    echo "Setting up Node.js environment..."
    
    if [ -d "$INSTALL_DIR/web" ] && [ -f "$INSTALL_DIR/web/package.json" ]; then
        cd "$INSTALL_DIR/web"
        yarn install --production
    fi
}

# Create environment file
create_env_file() {
    echo ""
    echo "Creating environment configuration..."
    
    if [ ! -f "$INSTALL_DIR/server/.env" ]; then
        cat > "$INSTALL_DIR/server/.env" << EOF
# WatchNexus Configuration
JWT_SECRET=$(openssl rand -hex 32)

# Optional: TMDB API key for metadata (get free at themoviedb.org)
# TMDB_API_KEY=your-key-here

# Data directory
DATA_DIR=$DATA_DIR
EOF
    fi
}

# Create systemd service
create_systemd_service() {
    echo ""
    echo "Creating systemd service..."
    
    SERVICE_FILE="/etc/systemd/system/watchnexus.service"
    
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=WatchNexus Media Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/server
Environment=PATH=$INSTALL_DIR/server/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$INSTALL_DIR/server/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable watchnexus
    echo "Service created. Start with: sudo systemctl start watchnexus"
}

# Create desktop entry
create_desktop_entry() {
    echo ""
    echo "Creating desktop entry..."
    
    DESKTOP_FILE="${HOME}/.local/share/applications/watchnexus.desktop"
    mkdir -p "$(dirname "$DESKTOP_FILE")"
    
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=WatchNexus
Comment=Unified Media Pipeline
Exec=xdg-open http://localhost:8001
Icon=video-display
Terminal=false
Type=Application
Categories=AudioVideo;Video;
EOF

    echo "Desktop entry created"
}

# Create start script
create_start_script() {
    echo ""
    echo "Creating start script..."
    
    cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/server"
source venv/bin/activate
exec uvicorn server:app --host 0.0.0.0 --port 8001
EOF

    chmod +x "$INSTALL_DIR/start.sh"
}

# Main installation
main() {
    detect_distro
    
    echo ""
    read -p "Install system dependencies? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_system_deps
        install_yarn
    fi
    
    setup_directories
    copy_files
    setup_python_env
    setup_node_env
    create_env_file
    create_start_script
    
    echo ""
    read -p "Create systemd service for auto-start? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_systemd_service
    fi
    
    echo ""
    read -p "Create desktop menu entry? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_desktop_entry
    fi
    
    echo ""
    echo "=========================================="
    echo "  Installation Complete!"
    echo "=========================================="
    echo ""
    echo "Installation directory: $INSTALL_DIR"
    echo ""
    echo "To start WatchNexus:"
    echo "  $INSTALL_DIR/start.sh"
    echo ""
    echo "Or if systemd service was installed:"
    echo "  sudo systemctl start watchnexus"
    echo ""
    echo "Then open: http://localhost:8001"
    echo ""
}

main "$@"

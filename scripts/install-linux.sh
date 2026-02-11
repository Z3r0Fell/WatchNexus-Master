#!/bin/bash
#===============================================================================
# WatchNexus Installation Script for Linux (Debian/Ubuntu/Fedora)
# Supports: Ubuntu 22.04+, Debian 12+, Fedora 38+
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/watchnexus"
DATA_DIR="/var/lib/watchnexus"
CONFIG_DIR="/etc/watchnexus"
USER="watchnexus"
VERSION="1.0.0"

echo "=============================================="
echo "  WatchNexus Installer - Linux"
echo "=============================================="
echo ""

# Detect distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION_ID=$VERSION_ID
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        DISTRO=$DISTRIB_ID
        VERSION_ID=$DISTRIB_RELEASE
    else
        echo "Error: Could not detect Linux distribution"
        exit 1
    fi
    
    echo "Detected: $DISTRO $VERSION_ID"
}

# Install dependencies for Debian/Ubuntu
install_deps_debian() {
    echo "[1/7] Installing dependencies (apt)..."
    
    sudo apt-get update
    sudo apt-get install -y \
        curl \
        gnupg \
        ca-certificates \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        ffmpeg \
        libvips-dev \
        libtorrent-rasterbar-dev \
        python3-libtorrent
    
    # Install Node.js 20.x
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install Yarn
    if ! command -v yarn &> /dev/null; then
        sudo npm install -g yarn
    fi
    
    # Install MongoDB
    if ! command -v mongod &> /dev/null; then
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
            sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
            sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        sudo apt-get update
        sudo apt-get install -y mongodb-org
    fi
    
    echo "✓ Dependencies installed"
}

# Install dependencies for Fedora/RHEL
install_deps_fedora() {
    echo "[1/7] Installing dependencies (dnf)..."
    
    sudo dnf install -y \
        curl \
        gnupg2 \
        gcc \
        gcc-c++ \
        make \
        python3 \
        python3-pip \
        python3-devel \
        python3-virtualenv \
        ffmpeg \
        vips-devel \
        rb_libtorrent-devel \
        rb_libtorrent-python3
    
    # Install Node.js
    if ! command -v node &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    fi
    
    # Install Yarn
    if ! command -v yarn &> /dev/null; then
        sudo npm install -g yarn
    fi
    
    # Install MongoDB
    if ! command -v mongod &> /dev/null; then
        cat > /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
        sudo dnf install -y mongodb-org
    fi
    
    echo "✓ Dependencies installed"
}

# Create user and directories
setup_user_and_dirs() {
    echo "[2/7] Creating user and directories..."
    
    # Create service user
    if ! id "$USER" &>/dev/null; then
        sudo useradd -r -s /bin/false -d "$INSTALL_DIR" "$USER"
    fi
    
    # Create directories
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p "$DATA_DIR"/{config,themes,plugins,downloads,media}
    sudo mkdir -p "$CONFIG_DIR"
    sudo mkdir -p /var/log/watchnexus
    
    echo "✓ Directories created"
}

# Build frontend
build_frontend() {
    echo "[3/7] Building frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    yarn install --frozen-lockfile
    yarn build
    
    echo "✓ Frontend built"
}

# Install backend
install_backend() {
    echo "[4/7] Installing backend..."
    
    # Create virtual environment
    cd "$PROJECT_ROOT/backend"
    python3 -m venv venv
    source venv/bin/activate
    
    pip install --upgrade pip
    pip install -r requirements.txt
    
    deactivate
    
    echo "✓ Backend installed"
}

# Copy files to installation directory
install_files() {
    echo "[5/7] Installing files..."
    
    # Copy frontend build
    sudo cp -r "$PROJECT_ROOT/frontend/build" "$INSTALL_DIR/frontend"
    
    # Copy backend
    sudo cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/"
    
    # Copy plugins
    if [ -d "$PROJECT_ROOT/backend/plugins" ]; then
        sudo cp -r "$PROJECT_ROOT/backend/plugins"/* "$DATA_DIR/plugins/" 2>/dev/null || true
    fi
    
    # Set permissions
    sudo chown -R "$USER:$USER" "$INSTALL_DIR"
    sudo chown -R "$USER:$USER" "$DATA_DIR"
    sudo chown -R "$USER:$USER" /var/log/watchnexus
    
    echo "✓ Files installed"
}

# Create configuration files
create_config() {
    echo "[6/7] Creating configuration..."
    
    # Create main config
    sudo cat > "$CONFIG_DIR/watchnexus.conf" << EOF
# WatchNexus Configuration

# Server
HOST=0.0.0.0
BACKEND_PORT=8001
FRONTEND_PORT=3000

# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus

# Paths
DATA_DIR=$DATA_DIR
MEDIA_DIR=$DATA_DIR/media
DOWNLOADS_DIR=$DATA_DIR/downloads
PLUGINS_DIR=$DATA_DIR/plugins
THEMES_DIR=$DATA_DIR/themes

# Security
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF
    
    # Create environment file
    sudo cat > "$INSTALL_DIR/backend/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF
    
    sudo chown "$USER:$USER" "$CONFIG_DIR/watchnexus.conf"
    sudo chown "$USER:$USER" "$INSTALL_DIR/backend/.env"
    sudo chmod 600 "$CONFIG_DIR/watchnexus.conf"
    sudo chmod 600 "$INSTALL_DIR/backend/.env"
    
    echo "✓ Configuration created"
}

# Create systemd service
create_service() {
    echo "[7/7] Creating systemd service..."
    
    sudo cat > /etc/systemd/system/watchnexus.service << EOF
[Unit]
Description=WatchNexus Media Server
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin:/usr/local/bin:/usr/bin"
EnvironmentFile=$CONFIG_DIR/watchnexus.conf
ExecStart=$INSTALL_DIR/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10
StandardOutput=append:/var/log/watchnexus/server.log
StandardError=append:/var/log/watchnexus/error.log

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable and start services
    sudo systemctl enable mongod
    sudo systemctl start mongod
    sudo systemctl enable watchnexus
    sudo systemctl start watchnexus
    
    echo "✓ Service created and started"
}

# Main
main() {
    detect_distro
    
    case "$DISTRO" in
        ubuntu|debian|pop|linuxmint)
            install_deps_debian
            ;;
        fedora|rhel|centos|rocky|alma)
            install_deps_fedora
            ;;
        *)
            echo "Unsupported distribution: $DISTRO"
            echo "Try manual installation or use Docker."
            exit 1
            ;;
    esac
    
    setup_user_and_dirs
    build_frontend
    install_backend
    install_files
    create_config
    create_service
    
    echo ""
    echo "=============================================="
    echo "  Installation Complete!"
    echo "=============================================="
    echo ""
    echo "WatchNexus is now running at:"
    echo "  http://localhost:8001"
    echo ""
    echo "Service commands:"
    echo "  sudo systemctl status watchnexus"
    echo "  sudo systemctl restart watchnexus"
    echo "  sudo journalctl -u watchnexus -f"
    echo ""
    echo "Configuration: $CONFIG_DIR/watchnexus.conf"
    echo "Data directory: $DATA_DIR"
    echo "Logs: /var/log/watchnexus/"
    echo ""
}

main "$@"

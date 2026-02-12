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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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
        log_error "Could not detect Linux distribution"
        exit 1
    fi
    
    log_info "Detected: $DISTRO $VERSION_ID"
}

# Install dependencies for Debian/Ubuntu
install_deps_debian() {
    log_info "[1/7] Installing dependencies (apt)..."
    
    sudo apt-get update || {
        log_error "Failed to update package lists"
        exit 1
    }
    
    sudo apt-get install -y \
        curl \
        gnupg \
        ca-certificates \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        ffmpeg || {
        log_error "Failed to install core packages"
        exit 1
    }
    
    # Optional packages (don't fail if unavailable)
    sudo apt-get install -y libvips-dev 2>/dev/null || log_warn "libvips-dev not available, skipping"
    
    # Install Node.js 20.x
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - || {
            log_error "Failed to add NodeSource repository"
            exit 1
        }
        sudo apt-get install -y nodejs || {
            log_error "Failed to install Node.js"
            exit 1
        }
    fi
    
    # Install Yarn
    if ! command -v yarn &> /dev/null; then
        log_info "Installing Yarn..."
        sudo npm install -g yarn
    fi
    
    # MongoDB
    if ! command -v mongod &> /dev/null; then
        log_warn "MongoDB not found. Installing..."
        
        # Try to install MongoDB 7.0
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
            sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>/dev/null || true
        
        # Detect Ubuntu version for MongoDB repo
        UBUNTU_CODENAME=$(lsb_release -cs 2>/dev/null || echo "jammy")
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" | \
            sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        
        sudo apt-get update
        sudo apt-get install -y mongodb-org 2>/dev/null || {
            log_warn "Could not install MongoDB from official repo"
            log_warn "Please install MongoDB manually or use Docker:"
            log_warn "  docker run -d --name mongodb -p 27017:27017 mongo:7"
        }
    fi
    
    log_info "✓ Dependencies installed"
}

# Install dependencies for Fedora/RHEL
install_deps_fedora() {
    log_info "[1/7] Installing dependencies (dnf)..."
    
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
        ffmpeg || {
        log_error "Failed to install core packages"
        exit 1
    }
    
    # Optional packages
    sudo dnf install -y vips-devel 2>/dev/null || log_warn "vips-devel not available"
    
    # Install Node.js
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    fi
    
    # Install Yarn
    if ! command -v yarn &> /dev/null; then
        sudo npm install -g yarn
    fi
    
    # MongoDB
    if ! command -v mongod &> /dev/null; then
        log_warn "MongoDB not found. Setting up repository..."
        
        sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
        sudo dnf install -y mongodb-org 2>/dev/null || {
            log_warn "Could not install MongoDB. Use Docker instead:"
            log_warn "  docker run -d --name mongodb -p 27017:27017 mongo:7"
        }
    fi
    
    log_info "✓ Dependencies installed"
}

# Create user and directories
setup_user_and_dirs() {
    log_info "[2/7] Creating user and directories..."
    
    # Create service user
    if ! id "$USER" &>/dev/null; then
        sudo useradd -r -s /bin/false -d "$INSTALL_DIR" "$USER"
    fi
    
    # Create directories
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p "$DATA_DIR"/{config,themes,plugins,downloads,media}
    sudo mkdir -p "$CONFIG_DIR"
    sudo mkdir -p /var/log/watchnexus
    
    log_info "✓ Directories created"
}

# Build frontend
build_frontend() {
    log_info "[3/7] Building frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    
    if [ ! -f "package.json" ]; then
        log_error "frontend/package.json not found"
        exit 1
    fi
    
    # Install dependencies
    if [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile 2>/dev/null || yarn install
    else
        yarn install
    fi
    
    # Build
    yarn build || {
        log_error "Frontend build failed"
        exit 1
    }
    
    # Determine output directory
    if [ -d "build" ]; then
        FRONTEND_BUILD_DIR="build"
    elif [ -d "dist" ]; then
        FRONTEND_BUILD_DIR="dist"
    else
        log_error "No frontend build directory found"
        exit 1
    fi
    
    log_info "✓ Frontend built"
}

# Install backend
install_backend() {
    log_info "[4/7] Installing backend..."
    
    cd "$PROJECT_ROOT/backend"
    
    if [ ! -f "requirements.txt" ]; then
        log_error "backend/requirements.txt not found"
        exit 1
    fi
    
    # Create virtual environment
    python3 -m venv venv || {
        log_error "Failed to create virtual environment"
        exit 1
    }
    
    source venv/bin/activate
    
    pip install --upgrade pip
    pip install -r requirements.txt || {
        log_error "Failed to install Python dependencies"
        deactivate
        exit 1
    }
    
    deactivate
    
    log_info "✓ Backend installed"
}

# Copy files to installation directory
install_files() {
    log_info "[5/7] Installing files..."
    
    # Copy frontend build
    cd "$PROJECT_ROOT/frontend"
    sudo rm -rf "$INSTALL_DIR/frontend" 2>/dev/null || true
    sudo cp -r "$FRONTEND_BUILD_DIR" "$INSTALL_DIR/frontend"
    
    # Copy backend
    cd "$PROJECT_ROOT"
    sudo rm -rf "$INSTALL_DIR/backend" 2>/dev/null || true
    sudo cp -r backend "$INSTALL_DIR/"
    
    # Copy plugins if exist
    if [ -d "$PROJECT_ROOT/backend/plugins" ]; then
        sudo cp -r "$PROJECT_ROOT/backend/plugins"/* "$DATA_DIR/plugins/" 2>/dev/null || true
    fi
    
    # Set permissions
    sudo chown -R "$USER:$USER" "$INSTALL_DIR"
    sudo chown -R "$USER:$USER" "$DATA_DIR"
    sudo chown -R "$USER:$USER" /var/log/watchnexus
    
    log_info "✓ Files installed"
}

# Create configuration files
create_config() {
    log_info "[6/7] Creating configuration..."
    
    # Generate secrets
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    
    # Create main config
    sudo tee "$CONFIG_DIR/watchnexus.conf" > /dev/null << EOF
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
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF
    
    # Create environment file
    sudo tee "$INSTALL_DIR/backend/.env" > /dev/null << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF
    
    sudo chown "$USER:$USER" "$CONFIG_DIR/watchnexus.conf"
    sudo chown "$USER:$USER" "$INSTALL_DIR/backend/.env"
    sudo chmod 600 "$CONFIG_DIR/watchnexus.conf"
    sudo chmod 600 "$INSTALL_DIR/backend/.env"
    
    log_info "✓ Configuration created"
}

# Create systemd service
create_service() {
    log_info "[7/7] Creating systemd service..."
    
    sudo tee /etc/systemd/system/watchnexus.service > /dev/null << EOF
[Unit]
Description=WatchNexus Media Server
After=network.target mongodb.service mongod.service
Wants=mongodb.service mongod.service

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
    
    # Enable and start MongoDB if available
    if command -v mongod &> /dev/null; then
        sudo systemctl enable mongod 2>/dev/null || sudo systemctl enable mongodb 2>/dev/null || true
        sudo systemctl start mongod 2>/dev/null || sudo systemctl start mongodb 2>/dev/null || true
    fi
    
    # Enable WatchNexus
    sudo systemctl enable watchnexus
    
    # Try to start (may fail if MongoDB not running)
    sudo systemctl start watchnexus 2>/dev/null || {
        log_warn "Could not start WatchNexus service automatically"
        log_warn "Make sure MongoDB is running, then: sudo systemctl start watchnexus"
    }
    
    log_info "✓ Service created"
}

# Main
main() {
    detect_distro
    
    case "$DISTRO" in
        ubuntu|debian|pop|linuxmint|elementary)
            install_deps_debian
            ;;
        fedora|rhel|centos|rocky|alma)
            install_deps_fedora
            ;;
        arch|manjaro|endeavouros)
            log_info "For Arch-based systems, please use build-arch.sh instead"
            exit 0
            ;;
        *)
            log_error "Unsupported distribution: $DISTRO"
            log_error "Try manual installation or use Docker."
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
    echo "WatchNexus is installed at:"
    echo "  $INSTALL_DIR"
    echo ""
    echo "Access at: http://localhost:8001"
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

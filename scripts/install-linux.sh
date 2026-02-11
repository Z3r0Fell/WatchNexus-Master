#!/bin/bash
#
# WatchNexus Installer for Linux
# Supports: Ubuntu/Debian, Fedora/RHEL, Arch Linux, openSUSE
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/watchnexus}"
DATA_DIR="${DATA_DIR:-/var/lib/watchnexus}"
CONFIG_DIR="${CONFIG_DIR:-/etc/watchnexus}"
LOG_DIR="${LOG_DIR:-/var/log/watchnexus}"
USER="${WATCHNEXUS_USER:-watchnexus}"
VERSION="${VERSION:-1.0.0}"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Banner
show_banner() {
    echo -e "${PURPLE}"
    cat << 'EOF'
    
    ██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
    ██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
    ██║ █╗ ██║███████║   ██║   ██║     ███████║██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
    ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
    ╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
     ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
    
                        🍯 Unified Media Pipeline - Linux Installer
EOF
    echo -e "${NC}"
}

# Detect Linux distribution
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        DISTRO=$ID
        DISTRO_VERSION=$VERSION_ID
        DISTRO_NAME=$NAME
    elif [[ -f /etc/lsb-release ]]; then
        . /etc/lsb-release
        DISTRO=$DISTRIB_ID
        DISTRO_VERSION=$DISTRIB_RELEASE
    else
        log_error "Cannot detect Linux distribution"
    fi
    
    log_info "Detected: $DISTRO_NAME ($DISTRO $DISTRO_VERSION)"
}

# Install dependencies based on distro
install_dependencies() {
    log_info "Installing dependencies..."
    
    case $DISTRO in
        ubuntu|debian|linuxmint|pop)
            sudo apt-get update
            sudo apt-get install -y \
                python3 python3-pip python3-venv \
                nodejs npm \
                mongodb \
                ffmpeg \
                git curl wget \
                build-essential \
                libssl-dev libffi-dev \
                libtorrent-rasterbar-dev
            
            # Install yarn
            sudo npm install -g yarn
            ;;
            
        fedora|rhel|centos|rocky|alma)
            sudo dnf install -y \
                python3 python3-pip python3-virtualenv \
                nodejs npm \
                mongodb-server \
                ffmpeg \
                git curl wget \
                gcc gcc-c++ make \
                openssl-devel libffi-devel \
                rb_libtorrent-devel
            
            sudo npm install -g yarn
            ;;
            
        arch|manjaro|endeavouros)
            sudo pacman -Syu --noconfirm
            sudo pacman -S --needed --noconfirm \
                python python-pip python-virtualenv \
                nodejs npm yarn \
                mongodb \
                ffmpeg \
                git curl wget \
                base-devel \
                openssl libffi \
                libtorrent-rasterbar
            ;;
            
        opensuse*|suse*)
            sudo zypper install -y \
                python3 python3-pip python3-virtualenv \
                nodejs npm \
                mongodb \
                ffmpeg \
                git curl wget \
                gcc gcc-c++ make \
                libopenssl-devel libffi-devel
            
            sudo npm install -g yarn
            ;;
            
        *)
            log_warning "Unsupported distribution: $DISTRO"
            log_info "Please install dependencies manually:"
            echo "  - Python 3.9+"
            echo "  - Node.js 16+"
            echo "  - MongoDB 5+"
            echo "  - FFmpeg"
            echo "  - libtorrent"
            read -p "Continue anyway? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
            ;;
    esac
    
    log_success "Dependencies installed"
}

# Create system user
create_user() {
    log_info "Creating system user: $USER"
    
    if id "$USER" &>/dev/null; then
        log_info "User $USER already exists"
    else
        sudo useradd -r -s /bin/false -d "$DATA_DIR" "$USER"
        log_success "User created"
    fi
}

# Create directories
create_directories() {
    log_info "Creating directories..."
    
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p "$DATA_DIR"/{downloads,library,cache}
    sudo mkdir -p "$CONFIG_DIR"
    sudo mkdir -p "$LOG_DIR"
    
    sudo chown -R "$USER:$USER" "$DATA_DIR"
    sudo chown -R "$USER:$USER" "$LOG_DIR"
    
    log_success "Directories created"
}

# Install WatchNexus
install_watchnexus() {
    log_info "Installing WatchNexus..."
    
    # Clone or copy files
    if [[ -d "/tmp/watchnexus-source" ]]; then
        sudo cp -r /tmp/watchnexus-source/* "$INSTALL_DIR/"
    else
        # Download from release
        log_info "Downloading WatchNexus v$VERSION..."
        wget -q "https://github.com/watchnexus/watchnexus/releases/download/v$VERSION/watchnexus-$VERSION-linux.tar.gz" \
            -O /tmp/watchnexus.tar.gz || {
            log_warning "Could not download release, using local files..."
            return
        }
        
        sudo tar -xzf /tmp/watchnexus.tar.gz -C "$INSTALL_DIR"
        rm /tmp/watchnexus.tar.gz
    fi
    
    # Setup Python environment
    cd "$INSTALL_DIR/backend"
    sudo python3 -m venv venv
    sudo ./venv/bin/pip install --upgrade pip
    sudo ./venv/bin/pip install -r requirements.txt
    
    # Setup frontend
    cd "$INSTALL_DIR/frontend"
    sudo yarn install --production
    
    log_success "WatchNexus installed"
}

# Create configuration
create_config() {
    log_info "Creating configuration..."
    
    # Backend config
    sudo tee "$CONFIG_DIR/backend.env" > /dev/null << EOF
# WatchNexus Backend Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
DOWNLOAD_PATH=$DATA_DIR/downloads
LIBRARY_PATH=$DATA_DIR/library
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=*
EOF
    
    # Frontend config
    sudo tee "$CONFIG_DIR/frontend.env" > /dev/null << EOF
# WatchNexus Frontend Configuration
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
    
    # Link configs
    sudo ln -sf "$CONFIG_DIR/backend.env" "$INSTALL_DIR/backend/.env"
    sudo ln -sf "$CONFIG_DIR/frontend.env" "$INSTALL_DIR/frontend/.env"
    
    log_success "Configuration created"
}

# Create systemd services
create_services() {
    log_info "Creating systemd services..."
    
    # Backend service
    sudo tee /etc/systemd/system/watchnexus-backend.service > /dev/null << EOF
[Unit]
Description=WatchNexus Backend (Marmalade Media Server)
After=network.target mongodb.service
Requires=mongodb.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin"
EnvironmentFile=$CONFIG_DIR/backend.env
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service (optional, for serving built frontend)
    sudo tee /etc/systemd/system/watchnexus-frontend.service > /dev/null << EOF
[Unit]
Description=WatchNexus Frontend
After=network.target watchnexus-backend.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/frontend
EnvironmentFile=$CONFIG_DIR/frontend.env
ExecStart=/usr/bin/npx serve -s build -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    
    log_success "Services created"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    # Start MongoDB if not running
    sudo systemctl enable mongodb || sudo systemctl enable mongod
    sudo systemctl start mongodb || sudo systemctl start mongod
    
    # Start WatchNexus
    sudo systemctl enable watchnexus-backend
    sudo systemctl start watchnexus-backend
    
    log_success "Services started"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    sleep 3
    
    if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
        log_success "Backend is running"
    else
        log_warning "Backend may not be running correctly"
    fi
}

# Main installation
main() {
    show_banner
    
    # Check root/sudo
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root or with sudo"
    fi
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --user)
                USER="$2"
                shift 2
                ;;
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --help)
                echo "Usage: sudo $0 [options]"
                echo ""
                echo "Options:"
                echo "  --user USER         System user (default: watchnexus)"
                echo "  --install-dir DIR   Installation directory (default: /opt/watchnexus)"
                echo "  --version VER       Version to install (default: 1.0.0)"
                echo "  --help              Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                ;;
        esac
    done
    
    detect_distro
    install_dependencies
    create_user
    create_directories
    install_watchnexus
    create_config
    create_services
    start_services
    verify_installation
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          WatchNexus Installation Complete! 🎉                ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  Access WatchNexus at: http://localhost:8001                 ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Manage services:                                            ║${NC}"
    echo -e "${GREEN}║    sudo systemctl status watchnexus-backend                  ║${NC}"
    echo -e "${GREEN}║    sudo systemctl restart watchnexus-backend                 ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Logs: /var/log/watchnexus/                                  ║${NC}"
    echo -e "${GREEN}║  Config: /etc/watchnexus/                                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

main "$@"

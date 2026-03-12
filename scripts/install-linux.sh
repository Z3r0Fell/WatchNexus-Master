#!/bin/bash
#===============================================================================
# WatchNexus Installation Script for Linux (Debian/Ubuntu/Fedora)
# v2.6.5 — Installs WatchNexus + registers a systemd service for auto-start
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/watchnexus"
DATA_DIR="/var/lib/watchnexus"
CONFIG_DIR="/etc/watchnexus"
USER="watchnexus"
VERSION="2.6.5"
SERVICE_NAME="watchnexus"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${BOLD}=============================================="
echo "  WatchNexus Installer - Linux  v${VERSION}"
echo -e "==============================================${NC}"
echo ""

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
    else
        log_error "Could not detect Linux distribution"
        exit 1
    fi
    log_info "Detected: $DISTRO"
}

#===============================================================================
# PREREQUISITE CHECK
#===============================================================================
check_prerequisites() {
    echo -e "${BOLD}Checking prerequisites...${NC}"
    echo ""
    MISSING=()
    FOUND=()

    if command -v python3 &>/dev/null; then
        PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
        PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
        if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ]; then
            FOUND+=("Python $PY_VER")
        else
            MISSING+=("Python 3.10+ (found $PY_VER)")
        fi
    else
        MISSING+=("Python 3.10+")
    fi

    if command -v node &>/dev/null; then
        NODE_VER=$(node --version | sed 's/v//')
        NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge 18 ]; then FOUND+=("Node.js v$NODE_VER")
        else MISSING+=("Node.js 18+ (found v$NODE_VER)"); fi
    else MISSING+=("Node.js 18+"); fi

    command -v yarn &>/dev/null && FOUND+=("Yarn $(yarn --version)") || MISSING+=("Yarn")
    command -v mongod &>/dev/null && FOUND+=("MongoDB") || MISSING+=("MongoDB 7.x")
    command -v ffmpeg &>/dev/null && FOUND+=("FFmpeg") || MISSING+=("FFmpeg (optional, for transcoding)")
    command -v git &>/dev/null && FOUND+=("Git") || MISSING+=("Git")

    echo -e "  ${CYAN}Prerequisite Status:${NC}"
    echo "  -----------------------------------------------"
    for item in "${FOUND[@]}"; do echo -e "  ${GREEN}OK${NC}      $item"; done
    for item in "${MISSING[@]}"; do echo -e "  ${RED}MISSING${NC} $item"; done
    echo "  -----------------------------------------------"
    echo ""

    if [ ${#MISSING[@]} -gt 0 ]; then
        echo -e "  ${YELLOW}Missing prerequisites:${NC}"
        for item in "${MISSING[@]}"; do echo "    - $item"; done
        echo ""
        read -p "  Attempt to install missing dependencies? (y/n): " ANSWER
        if [[ "$ANSWER" != "y" && "$ANSWER" != "Y" ]]; then
            log_info "Installation cancelled."
            exit 0
        fi
    else
        echo -e "  ${GREEN}All prerequisites satisfied!${NC}"
    fi
    echo ""
}

install_deps_debian() {
    log_info "[1/8] Installing dependencies (apt)..."
    sudo apt-get update -qq
    sudo apt-get install -y curl gnupg ca-certificates build-essential \
        python3 python3-pip python3-venv python3-dev ffmpeg

    if ! command -v node &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    command -v yarn &>/dev/null || sudo npm install -g yarn

    if ! command -v mongod &>/dev/null; then
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
            sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>/dev/null || true
        CODENAME=$(lsb_release -cs 2>/dev/null || echo "jammy")
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/7.0 multiverse" | \
            sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        sudo apt-get update -qq
        sudo apt-get install -y mongodb-org 2>/dev/null || log_warn "MongoDB install failed — use Docker instead"
    fi
    log_info "Dependencies installed"
}

install_deps_fedora() {
    log_info "[1/8] Installing dependencies (dnf)..."
    sudo dnf install -y curl gcc gcc-c++ make python3 python3-pip python3-devel python3-virtualenv ffmpeg
    if ! command -v node &>/dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    fi
    command -v yarn &>/dev/null || sudo npm install -g yarn
    log_info "Dependencies installed"
}

setup_user_and_dirs() {
    log_info "[2/8] Creating user and directories..."
    id "$USER" &>/dev/null || sudo useradd -r -s /bin/false -d "$INSTALL_DIR" "$USER"
    sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"/{config,themes,plugins,downloads,media} "$CONFIG_DIR" /var/log/watchnexus
    log_info "Directories created"
}

build_frontend() {
    log_info "[3/8] Building frontend..."
    cd "$PROJECT_ROOT/frontend"
    [ -f "yarn.lock" ] && yarn install --frozen-lockfile 2>/dev/null || yarn install
    yarn build
    [ -d "build" ] && FRONTEND_BUILD_DIR="build" || FRONTEND_BUILD_DIR="dist"
    log_info "Frontend built"
}

install_backend() {
    log_info "[4/8] Installing backend..."
    cd "$PROJECT_ROOT/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    log_info "Backend installed"
}

install_files() {
    log_info "[5/8] Installing files..."
    cd "$PROJECT_ROOT/frontend"
    sudo rm -rf "$INSTALL_DIR/frontend" 2>/dev/null || true
    sudo cp -r "$FRONTEND_BUILD_DIR" "$INSTALL_DIR/frontend"
    sudo rm -rf "$INSTALL_DIR/backend" 2>/dev/null || true
    sudo cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/"
    sudo chown -R "$USER:$USER" "$INSTALL_DIR" "$DATA_DIR" /var/log/watchnexus
    log_info "Files installed"
}

create_config() {
    log_info "[6/8] Creating configuration..."
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    sudo tee "$INSTALL_DIR/backend/.env" > /dev/null << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
JWT_SECRET=$JWT_SECRET
EOF
    sudo chown "$USER:$USER" "$INSTALL_DIR/backend/.env"
    sudo chmod 600 "$INSTALL_DIR/backend/.env"
    log_info "Configuration created"
}

#===============================================================================
# SYSTEMD SERVICE — auto-start on boot, auto-restart on crash
#===============================================================================
create_service() {
    log_info "[7/8] Creating systemd service (auto-start on boot)..."

    # MongoDB service
    if command -v mongod &>/dev/null; then
        sudo systemctl enable mongod 2>/dev/null || sudo systemctl enable mongodb 2>/dev/null || true
        sudo systemctl start mongod 2>/dev/null || sudo systemctl start mongodb 2>/dev/null || true
    fi

    # WatchNexus service
    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=WatchNexus Media Server
Documentation=https://github.com/watchnexus
After=network-online.target mongodb.service mongod.service
Wants=network-online.target mongodb.service mongod.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin:/usr/local/bin:/usr/bin"
ExecStart=$INSTALL_DIR/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001

# Auto-restart on crash or unexpected exit
Restart=always
RestartSec=5

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$DATA_DIR /var/log/watchnexus $INSTALL_DIR/backend
PrivateTmp=true

StandardOutput=append:/var/log/watchnexus/server.log
StandardError=append:/var/log/watchnexus/error.log

[Install]
# This ensures the service starts at boot, before any user logs in
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}.service
    sudo systemctl start ${SERVICE_NAME}.service 2>/dev/null || {
        log_warn "Could not start WatchNexus now — it will start on next boot."
        log_warn "Check: sudo journalctl -u ${SERVICE_NAME} -f"
    }

    log_info "Service created and enabled for auto-start on boot"
}

verify_service() {
    log_info "[8/8] Verifying service..."
    sleep 3
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "  ${GREEN}WatchNexus is running${NC}"
    else
        log_warn "Service not yet active. Check: sudo systemctl status ${SERVICE_NAME}"
    fi
    if systemctl is-enabled --quiet ${SERVICE_NAME}; then
        echo -e "  ${GREEN}Auto-start on boot: ENABLED${NC}"
    fi
}

main() {
    detect_distro
    check_prerequisites

    case "$DISTRO" in
        ubuntu|debian|pop|linuxmint|elementary) install_deps_debian ;;
        fedora|rhel|centos|rocky|alma) install_deps_fedora ;;
        *) log_error "Unsupported distribution: $DISTRO"; exit 1 ;;
    esac

    setup_user_and_dirs
    build_frontend
    install_backend
    install_files
    create_config
    create_service
    verify_service

    echo ""
    echo -e "${BOLD}=============================================="
    echo "  Installation Complete!  v${VERSION}"
    echo -e "==============================================${NC}"
    echo ""
    echo -e "  Access:    ${CYAN}http://localhost:8001${NC}"
    echo "  Install:   $INSTALL_DIR"
    echo "  Data:      $DATA_DIR"
    echo "  Logs:      /var/log/watchnexus/"
    echo ""
    echo -e "  ${GREEN}Auto-start: ENABLED${NC} — WatchNexus will start"
    echo "  automatically on every boot, before the login screen."
    echo ""
    echo "  Service commands:"
    echo "    sudo systemctl status ${SERVICE_NAME}"
    echo "    sudo systemctl restart ${SERVICE_NAME}"
    echo "    sudo systemctl stop ${SERVICE_NAME}"
    echo "    sudo journalctl -u ${SERVICE_NAME} -f"
    echo ""
    echo "  To disable auto-start:"
    echo "    sudo systemctl disable ${SERVICE_NAME}"
    echo ""
}

main "$@"

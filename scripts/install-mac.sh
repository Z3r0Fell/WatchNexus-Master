#!/bin/bash
#
# WatchNexus Installer for macOS
# Supports: macOS 11+ (Big Sur and later)
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
INSTALL_DIR="${INSTALL_DIR:-$HOME/Applications/WatchNexus}"
DATA_DIR="${DATA_DIR:-$HOME/Library/Application Support/WatchNexus}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/watchnexus}"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/WatchNexus}"
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
    
                        🍯 Unified Media Pipeline - macOS Installer
EOF
    echo -e "${NC}"
}

# Check macOS version
check_macos_version() {
    local macos_version=$(sw_vers -productVersion)
    local major_version=$(echo "$macos_version" | cut -d. -f1)
    
    log_info "Detected macOS version: $macos_version"
    
    if [[ "$major_version" -lt 11 ]]; then
        log_error "macOS 11 (Big Sur) or later is required"
    fi
}

# Check/Install Homebrew
install_homebrew() {
    if command -v brew &> /dev/null; then
        log_info "Homebrew already installed"
        brew update
    else
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add to path for Apple Silicon
        if [[ -f /opt/homebrew/bin/brew ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
        
        log_success "Homebrew installed"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies via Homebrew..."
    
    # Core dependencies
    brew install python@3.11 || brew upgrade python@3.11
    brew install node || brew upgrade node
    brew install yarn || brew upgrade yarn
    brew install mongodb-community || brew upgrade mongodb-community
    brew install ffmpeg || brew upgrade ffmpeg
    brew install libtorrent-rasterbar || brew upgrade libtorrent-rasterbar
    
    log_success "Dependencies installed"
}

# Create directories
create_directories() {
    log_info "Creating directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR"/{downloads,library,cache,thumbnails}
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    
    log_success "Directories created"
}

# Install WatchNexus
install_watchnexus() {
    log_info "Installing WatchNexus..."
    
    # Check for local source or download
    if [[ -d "./backend" && -d "./frontend" ]]; then
        log_info "Installing from local source..."
        cp -r ./backend "$INSTALL_DIR/"
        cp -r ./frontend "$INSTALL_DIR/"
    else
        log_info "Downloading WatchNexus v$VERSION..."
        
        local download_url="https://github.com/watchnexus/watchnexus/releases/download/v$VERSION/watchnexus-$VERSION-mac.tar.gz"
        
        curl -L "$download_url" -o /tmp/watchnexus.tar.gz 2>/dev/null || {
            log_warning "Could not download release"
            return 1
        }
        
        tar -xzf /tmp/watchnexus.tar.gz -C "$INSTALL_DIR"
        rm /tmp/watchnexus.tar.gz
    fi
    
    # Setup Python environment
    cd "$INSTALL_DIR/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    
    # Setup frontend
    cd "$INSTALL_DIR/frontend"
    yarn install
    
    log_success "WatchNexus installed to $INSTALL_DIR"
}

# Create configuration
create_config() {
    log_info "Creating configuration..."
    
    # Backend .env
    cat > "$CONFIG_DIR/backend.env" << EOF
# WatchNexus Backend Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
DOWNLOAD_PATH=$DATA_DIR/downloads
LIBRARY_PATH=$DATA_DIR/library
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=*
EOF
    
    # Frontend .env
    cat > "$CONFIG_DIR/frontend.env" << EOF
# WatchNexus Frontend Configuration
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
    
    # Symlink configs
    ln -sf "$CONFIG_DIR/backend.env" "$INSTALL_DIR/backend/.env"
    ln -sf "$CONFIG_DIR/frontend.env" "$INSTALL_DIR/frontend/.env"
    
    log_success "Configuration created"
}

# Create LaunchAgent for auto-start
create_launchagent() {
    log_info "Creating LaunchAgent for auto-start..."
    
    local launch_agents_dir="$HOME/Library/LaunchAgents"
    mkdir -p "$launch_agents_dir"
    
    # Backend LaunchAgent
    cat > "$launch_agents_dir/com.watchnexus.backend.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.watchnexus.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/backend/venv/bin/uvicorn</string>
        <string>server:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8001</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR/backend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$INSTALL_DIR/backend/venv/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/backend.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/backend.error.log</string>
</dict>
</plist>
EOF
    
    # Load the agent
    launchctl load "$launch_agents_dir/com.watchnexus.backend.plist" 2>/dev/null || true
    
    log_success "LaunchAgent created"
}

# Start MongoDB
start_mongodb() {
    log_info "Starting MongoDB..."
    
    brew services start mongodb-community
    
    # Wait for MongoDB to start
    sleep 3
    
    if mongosh --eval "db.runCommand('ping').ok" &>/dev/null; then
        log_success "MongoDB is running"
    else
        log_warning "MongoDB may not be running correctly"
    fi
}

# Start WatchNexus
start_watchnexus() {
    log_info "Starting WatchNexus..."
    
    launchctl start com.watchnexus.backend 2>/dev/null || {
        # Start manually if LaunchAgent fails
        cd "$INSTALL_DIR/backend"
        source venv/bin/activate
        nohup uvicorn server:app --host 0.0.0.0 --port 8001 > "$LOG_DIR/backend.log" 2>&1 &
        deactivate
    }
    
    sleep 3
    
    if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
        log_success "WatchNexus is running"
    else
        log_warning "WatchNexus may not be running correctly"
    fi
}

# Create application bundle (optional)
create_app_bundle() {
    log_info "Creating macOS application bundle..."
    
    local app_dir="$HOME/Applications/WatchNexus.app"
    mkdir -p "$app_dir/Contents/MacOS"
    mkdir -p "$app_dir/Contents/Resources"
    
    # Create Info.plist
    cat > "$app_dir/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>watchnexus</string>
    <key>CFBundleIdentifier</key>
    <string>com.watchnexus.app</string>
    <key>CFBundleName</key>
    <string>WatchNexus</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
</dict>
</plist>
EOF
    
    # Create launcher script
    cat > "$app_dir/Contents/MacOS/watchnexus" << EOF
#!/bin/bash
open http://localhost:8001
EOF
    chmod +x "$app_dir/Contents/MacOS/watchnexus"
    
    log_success "Application bundle created"
}

# Create uninstaller
create_uninstaller() {
    cat > "$INSTALL_DIR/uninstall.sh" << 'EOF'
#!/bin/bash
echo "Uninstalling WatchNexus..."

# Stop services
launchctl stop com.watchnexus.backend 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.watchnexus.backend.plist 2>/dev/null

# Remove files
rm -rf "$HOME/Applications/WatchNexus"
rm -rf "$HOME/Applications/WatchNexus.app"
rm -rf "$HOME/Library/Application Support/WatchNexus"
rm -rf "$HOME/.config/watchnexus"
rm -rf "$HOME/Library/Logs/WatchNexus"
rm -f "$HOME/Library/LaunchAgents/com.watchnexus.backend.plist"

echo "WatchNexus uninstalled"
EOF
    chmod +x "$INSTALL_DIR/uninstall.sh"
}

# Main installation
main() {
    show_banner
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --install-dir DIR   Installation directory (default: ~/Applications/WatchNexus)"
                echo "  --version VER       Version to install (default: 1.0.0)"
                echo "  --help              Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                ;;
        esac
    done
    
    check_macos_version
    install_homebrew
    install_dependencies
    create_directories
    install_watchnexus
    create_config
    start_mongodb
    create_launchagent
    start_watchnexus
    create_app_bundle
    create_uninstaller
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          WatchNexus Installation Complete! 🎉                ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  Access WatchNexus at: http://localhost:8001                 ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Manage services:                                            ║${NC}"
    echo -e "${GREEN}║    Start:   launchctl start com.watchnexus.backend           ║${NC}"
    echo -e "${GREEN}║    Stop:    launchctl stop com.watchnexus.backend            ║${NC}"
    echo -e "${GREEN}║    MongoDB: brew services restart mongodb-community          ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Logs: ~/Library/Logs/WatchNexus/                            ║${NC}"
    echo -e "${GREEN}║  Uninstall: $INSTALL_DIR/uninstall.sh        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

main "$@"

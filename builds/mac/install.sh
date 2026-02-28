#!/bin/bash
#
# WatchNexus Installer for macOS
# Downloads and installs all dependencies automatically
#

set -e

VERSION="2.6.1"
INSTALL_DIR="$HOME/Library/Application Support/WatchNexus"
APP_DIR="/Applications/WatchNexus.app"
DATA_DIR="$HOME/.watchnexus"
DOWNLOAD_URL="https://github.com/watchnexus/watchnexus/releases/download/v${VERSION}"

log() { echo "[*] $1"; }
success() { echo "[✓] $1"; }
warn() { echo "[!] $1"; }
error() { echo "[✗] $1"; exit 1; }

# Install Homebrew if needed
install_homebrew() {
    if command -v brew &>/dev/null; then
        success "Homebrew already installed"
        return 0
    fi
    
    log "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add to PATH for Apple Silicon
    if [[ $(uname -m) == 'arm64' ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
    fi
    
    success "Homebrew installed"
}

# Install Python
install_python() {
    if command -v python3 &>/dev/null; then
        PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        PY_MINOR=$(echo $PY_VER | cut -d. -f2)
        if [ "$PY_MINOR" -ge 10 ]; then
            success "Python $PY_VER already installed"
            return 0
        fi
    fi
    
    log "Installing Python..."
    brew install python@3.11
    success "Python installed"
}

# Install Node.js
install_node() {
    if command -v node &>/dev/null; then
        NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VER" -ge 18 ]; then
            success "Node.js v$NODE_VER already installed"
            return 0
        fi
    fi
    
    log "Installing Node.js..."
    brew install node
    success "Node.js installed"
}

# Install FFmpeg
install_ffmpeg() {
    if command -v ffmpeg &>/dev/null; then
        success "FFmpeg already installed"
        return 0
    fi
    
    log "Installing FFmpeg..."
    brew install ffmpeg
    success "FFmpeg installed"
}

# Download WatchNexus
download_app() {
    log "Downloading WatchNexus v${VERSION}..."
    
    mkdir -p "$INSTALL_DIR" "$DATA_DIR"
    cd "$INSTALL_DIR"
    
    # Try release download
    curl -fsSL "${DOWNLOAD_URL}/watchnexus-${VERSION}-mac.tar.gz" -o watchnexus.tar.gz 2>/dev/null || \
    curl -fsSL "${DOWNLOAD_URL}/watchnexus-mac.tar.gz" -o watchnexus.tar.gz 2>/dev/null || true
    
    if [ -f watchnexus.tar.gz ] && [ -s watchnexus.tar.gz ]; then
        tar -xzf watchnexus.tar.gz
        rm watchnexus.tar.gz
        success "Downloaded release package"
    else
        warn "Release not found, cloning from repository..."
        rm -f watchnexus.tar.gz
        git clone --depth 1 https://github.com/watchnexus/watchnexus.git . 2>/dev/null || \
        error "Could not download WatchNexus"
    fi
}

# Setup backend
setup_backend() {
    log "Setting up backend..."
    
    cd "$INSTALL_DIR"
    
    # Find server directory
    for dir in src/server server separated/server; do
        if [ -d "$dir" ]; then
            SERVER_DIR="$dir"
            break
        fi
    done
    
    [ -z "$SERVER_DIR" ] && error "Server directory not found"
    
    cd "$SERVER_DIR"
    
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    deactivate
    
    # Create env
    if [ ! -f .env ]; then
        echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
        echo "DATA_DIR=$DATA_DIR" >> .env
    fi
    
    success "Backend configured"
}

# Create macOS app bundle
create_app() {
    log "Creating application bundle..."
    
    # Find server dir
    cd "$INSTALL_DIR"
    for dir in src/server server separated/server; do
        [ -d "$dir" ] && SERVER_DIR="$dir" && break
    done
    
    mkdir -p "$APP_DIR/Contents/MacOS"
    mkdir -p "$APP_DIR/Contents/Resources"
    
    # Info.plist
    cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>WatchNexus</string>
    <key>CFBundleDisplayName</key>
    <string>WatchNexus</string>
    <key>CFBundleIdentifier</key>
    <string>com.watchnexus.app</string>
    <key>CFBundleVersion</key>
    <string>2.6.1</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>WatchNexus</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

    # Launcher script
    cat > "$APP_DIR/Contents/MacOS/WatchNexus" << LAUNCHER
#!/bin/bash
cd "$INSTALL_DIR/$SERVER_DIR"
source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8001 &
sleep 2
open "http://localhost:8001"
wait
LAUNCHER

    chmod +x "$APP_DIR/Contents/MacOS/WatchNexus"
    
    success "Application bundle created at $APP_DIR"
}

# Create LaunchAgent for auto-start
create_launchagent() {
    PLIST_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$PLIST_DIR"
    
    # Find server dir
    cd "$INSTALL_DIR"
    for dir in src/server server separated/server; do
        [ -d "$dir" ] && SERVER_DIR="$dir" && break
    done
    
    cat > "$PLIST_DIR/com.watchnexus.server.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.watchnexus.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/$SERVER_DIR/venv/bin/uvicorn</string>
        <string>server:app</string>
        <string>--host</string>
        <string>127.0.0.1</string>
        <string>--port</string>
        <string>8001</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR/$SERVER_DIR</string>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$DATA_DIR/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/stderr.log</string>
</dict>
</plist>
PLIST

    success "LaunchAgent created"
}

# Main
main() {
    echo ""
    echo "  WatchNexus Installer v${VERSION}"
    echo "  ================================"
    echo ""
    
    install_homebrew
    install_python
    install_node
    install_ffmpeg
    download_app
    setup_backend
    create_app
    create_launchagent
    
    echo ""
    echo "  ================================"
    success "Installation complete!"
    echo ""
    echo "  Start WatchNexus:"
    echo "    Open WatchNexus from /Applications"
    echo ""
    echo "  Or run in terminal:"
    echo "    open /Applications/WatchNexus.app"
    echo ""
    echo "  Enable auto-start:"
    echo "    launchctl load ~/Library/LaunchAgents/com.watchnexus.server.plist"
    echo ""
    echo "  Then open: http://localhost:8001"
    echo ""
}

main "$@"

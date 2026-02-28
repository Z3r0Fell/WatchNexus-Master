#!/bin/bash
# WatchNexus macOS Installer
# Installs all dependencies and sets up the application

set -e

echo "=========================================="
echo "  WatchNexus macOS Installer"
echo "=========================================="
echo ""

# Check for Homebrew
check_homebrew() {
    if ! command -v brew &> /dev/null; then
        echo "Homebrew not found. Installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon
        if [[ $(uname -m) == 'arm64' ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi
    echo "Homebrew is available"
}

# Install system dependencies
install_deps() {
    echo ""
    echo "Installing dependencies with Homebrew..."
    
    brew update
    
    # Core dependencies
    brew install python node yarn
    
    # Optional but recommended
    brew install ffmpeg
    
    echo "Dependencies installed"
}

# Set directories
INSTALL_DIR="$HOME/Applications/WatchNexus"
DATA_DIR="$HOME/.watchnexus"

# Create directories
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
    
    # Copy frontend
    if [ -d "$SCRIPT_DIR/web" ]; then
        cp -r "$SCRIPT_DIR/web" "$INSTALL_DIR/"
    elif [ -d "$SCRIPT_DIR/../separated/web" ]; then
        cp -r "$SCRIPT_DIR/../separated/web" "$INSTALL_DIR/"
    fi
}

# Setup Python environment
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

# Setup Node.js environment
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

# Optional: TMDB API key for metadata
# TMDB_API_KEY=your-key-here

DATA_DIR=$DATA_DIR
EOF
    fi
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

# Create macOS app bundle
create_app_bundle() {
    echo ""
    echo "Creating macOS application bundle..."
    
    APP_DIR="$HOME/Applications/WatchNexus.app"
    mkdir -p "$APP_DIR/Contents/MacOS"
    mkdir -p "$APP_DIR/Contents/Resources"
    
    # Create Info.plist
    cat > "$APP_DIR/Contents/Info.plist" << EOF
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
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleExecutable</key>
    <string>WatchNexus</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

    # Create launcher script
    cat > "$APP_DIR/Contents/MacOS/WatchNexus" << EOF
#!/bin/bash
cd "$INSTALL_DIR/server"
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 &
sleep 2
open "http://localhost:8001"
wait
EOF

    chmod +x "$APP_DIR/Contents/MacOS/WatchNexus"
    
    echo "Application bundle created at: $APP_DIR"
}

# Create LaunchAgent for auto-start
create_launch_agent() {
    echo ""
    echo "Creating LaunchAgent for auto-start..."
    
    PLIST_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$PLIST_DIR"
    
    cat > "$PLIST_DIR/com.watchnexus.server.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.watchnexus.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/start.sh</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$DATA_DIR/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/logs/stderr.log</string>
</dict>
</plist>
EOF

    echo "LaunchAgent created"
    echo "To enable auto-start: launchctl load ~/Library/LaunchAgents/com.watchnexus.server.plist"
}

# Main installation
main() {
    echo ""
    read -p "Install Homebrew and dependencies? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        check_homebrew
        install_deps
    fi
    
    setup_directories
    copy_files
    setup_python_env
    setup_node_env
    create_env_file
    create_start_script
    
    echo ""
    read -p "Create macOS application bundle? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_app_bundle
    fi
    
    echo ""
    read -p "Create LaunchAgent for background service? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_launch_agent
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
    echo "Or open WatchNexus.app from Applications folder"
    echo ""
    echo "Then open: http://localhost:8001"
    echo ""
}

main "$@"

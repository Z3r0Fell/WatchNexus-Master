#!/bin/bash
#===============================================================================
# WatchNexus Installation Script for macOS
# Supports: macOS 12 Monterey and later
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/Applications/WatchNexus.app"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"
CONFIG_DIR="$DATA_DIR/config"
VERSION="1.0.0"

echo "=============================================="
echo "  WatchNexus Installer - macOS"
echo "=============================================="
echo ""

# Check macOS version
check_macos_version() {
    local version=$(sw_vers -productVersion)
    local major=$(echo "$version" | cut -d. -f1)
    
    if [ "$major" -lt 12 ]; then
        echo "Error: WatchNexus requires macOS 12 Monterey or later"
        echo "Current version: $version"
        exit 1
    fi
    
    echo "macOS version: $version ✓"
}

# Install Homebrew if not present
install_homebrew() {
    if ! command -v brew &> /dev/null; then
        echo "[1/6] Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH
        if [[ $(uname -m) == "arm64" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        else
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    else
        echo "[1/6] Homebrew already installed ✓"
    fi
}

# Install dependencies
install_deps() {
    echo "[2/6] Installing dependencies..."
    
    brew update
    
    # Install required packages
    brew install \
        node \
        yarn \
        python@3.11 \
        mongodb-community \
        ffmpeg \
        vips \
        libtorrent-rasterbar
    
    # Start MongoDB
    brew services start mongodb-community
    
    echo "✓ Dependencies installed"
}

# Create directories
create_directories() {
    echo "[3/6] Creating directories..."
    
    mkdir -p "$DATA_DIR"/{config,themes,plugins,downloads,media,logs}
    mkdir -p "$CONFIG_DIR"
    
    echo "✓ Directories created"
}

# Build frontend
build_frontend() {
    echo "[4/6] Building frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    yarn install --frozen-lockfile
    yarn build
    
    echo "✓ Frontend built"
}

# Install backend
install_backend() {
    echo "[5/6] Installing backend..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    pip install --upgrade pip
    pip install -r requirements.txt
    
    deactivate
    
    echo "✓ Backend installed"
}

# Create macOS app bundle
create_app_bundle() {
    echo "[6/6] Creating app bundle..."
    
    # Create app structure
    mkdir -p "$INSTALL_DIR/Contents/"{MacOS,Resources}
    
    # Copy frontend
    cp -r "$PROJECT_ROOT/frontend/build" "$INSTALL_DIR/Contents/Resources/frontend"
    
    # Copy backend
    cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/Contents/Resources/"
    
    # Create Info.plist
    cat > "$INSTALL_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>WatchNexus</string>
    <key>CFBundleDisplayName</key>
    <string>WatchNexus</string>
    <key>CFBundleIdentifier</key>
    <string>ca.watchnexus.app</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleExecutable</key>
    <string>watchnexus</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.entertainment</string>
</dict>
</plist>
EOF

    # Create launcher script
    cat > "$INSTALL_DIR/Contents/MacOS/watchnexus" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/../Resources"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"

# Start backend
cd "$RESOURCES_DIR/backend"
source venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Open frontend in browser
open "http://localhost:8001"

# Wait for backend process
wait $BACKEND_PID
EOF
    
    chmod +x "$INSTALL_DIR/Contents/MacOS/watchnexus"
    
    # Create environment file
    cat > "$INSTALL_DIR/Contents/Resources/backend/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF
    
    echo "✓ App bundle created"
}

# Create LaunchAgent for auto-start
create_launch_agent() {
    local plist_dir="$HOME/Library/LaunchAgents"
    local plist_file="$plist_dir/ca.watchnexus.server.plist"
    
    mkdir -p "$plist_dir"
    
    cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ca.watchnexus.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/Contents/Resources/backend/venv/bin/python</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>server:app</string>
        <string>--host</string>
        <string>127.0.0.1</string>
        <string>--port</string>
        <string>8001</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR/Contents/Resources/backend</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$DATA_DIR/logs/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/logs/error.log</string>
</dict>
</plist>
EOF
    
    echo "LaunchAgent created (optional auto-start)"
    echo "Enable with: launchctl load $plist_file"
}

# Main
main() {
    check_macos_version
    install_homebrew
    install_deps
    create_directories
    build_frontend
    install_backend
    create_app_bundle
    create_launch_agent
    
    echo ""
    echo "=============================================="
    echo "  Installation Complete!"
    echo "=============================================="
    echo ""
    echo "WatchNexus has been installed to:"
    echo "  $INSTALL_DIR"
    echo ""
    echo "Data directory:"
    echo "  $DATA_DIR"
    echo ""
    echo "To start WatchNexus:"
    echo "  1. Open WatchNexus.app from Applications"
    echo "  2. Or run from terminal:"
    echo "     $INSTALL_DIR/Contents/MacOS/watchnexus"
    echo ""
    echo "MongoDB service:"
    echo "  brew services start mongodb-community"
    echo "  brew services stop mongodb-community"
    echo ""
}

main "$@"

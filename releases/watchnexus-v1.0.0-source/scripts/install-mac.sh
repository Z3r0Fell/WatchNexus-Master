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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=============================================="
echo "  WatchNexus Installer - macOS"
echo "=============================================="
echo ""

# Check macOS version
check_macos_version() {
    local version=$(sw_vers -productVersion)
    local major=$(echo "$version" | cut -d. -f1)
    
    if [ "$major" -lt 12 ]; then
        log_error "WatchNexus requires macOS 12 Monterey or later"
        log_error "Current version: $version"
        exit 1
    fi
    
    log_info "macOS version: $version ✓"
}

# Install Homebrew if not present
install_homebrew() {
    if ! command -v brew &> /dev/null; then
        log_info "[1/6] Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
            log_error "Failed to install Homebrew"
            exit 1
        }
        
        # Add Homebrew to PATH
        if [[ $(uname -m) == "arm64" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        else
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    else
        log_info "[1/6] Homebrew already installed ✓"
    fi
}

# Install dependencies
install_deps() {
    log_info "[2/6] Installing dependencies..."
    
    brew update || log_warn "Homebrew update failed, continuing..."
    
    # Install required packages
    brew install node yarn python@3.11 ffmpeg vips || {
        log_error "Failed to install required packages"
        exit 1
    }
    
    # MongoDB - try to install, don't fail if unavailable
    if ! command -v mongod &> /dev/null; then
        log_info "Installing MongoDB..."
        brew tap mongodb/brew 2>/dev/null || true
        brew install mongodb-community 2>/dev/null || {
            log_warn "Could not install MongoDB via Homebrew"
            log_warn "You can use Docker instead:"
            log_warn "  docker run -d --name mongodb -p 27017:27017 mongo:7"
        }
    fi
    
    # Start MongoDB if installed
    if command -v mongod &> /dev/null; then
        brew services start mongodb-community 2>/dev/null || true
    fi
    
    log_info "✓ Dependencies installed"
}

# Create directories
create_directories() {
    log_info "[3/6] Creating directories..."
    
    mkdir -p "$DATA_DIR"/{config,themes,plugins,downloads,media,logs}
    mkdir -p "$CONFIG_DIR"
    
    log_info "✓ Directories created"
}

# Build frontend
build_frontend() {
    log_info "[4/6] Building frontend..."
    
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
    log_info "[5/6] Installing backend..."
    
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

# Create macOS app bundle
create_app_bundle() {
    log_info "[6/6] Creating app bundle..."
    
    # Remove old installation
    rm -rf "$INSTALL_DIR" 2>/dev/null || true
    
    # Create app structure
    mkdir -p "$INSTALL_DIR/Contents/"{MacOS,Resources}
    
    # Copy frontend
    cd "$PROJECT_ROOT/frontend"
    cp -r "$FRONTEND_BUILD_DIR" "$INSTALL_DIR/Contents/Resources/frontend"
    
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
    cat > "$INSTALL_DIR/Contents/MacOS/watchnexus" << 'LAUNCHEREOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/../Resources"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"
LOG_DIR="$DATA_DIR/logs"

mkdir -p "$LOG_DIR"

# Start backend
cd "$RESOURCES_DIR/backend"
source venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 8001 >> "$LOG_DIR/server.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend started
if kill -0 $BACKEND_PID 2>/dev/null; then
    # Open frontend in browser
    open "http://localhost:8001"
    
    # Wait for backend process
    wait $BACKEND_PID
else
    osascript -e 'display alert "WatchNexus" message "Failed to start backend. Check logs at ~/Library/Application Support/WatchNexus/logs/"'
fi
LAUNCHEREOF
    
    chmod +x "$INSTALL_DIR/Contents/MacOS/watchnexus"
    
    # Create environment file
    cat > "$INSTALL_DIR/Contents/Resources/backend/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF
    
    log_info "✓ App bundle created"
}

# Create LaunchAgent for auto-start (optional)
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
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$DATA_DIR/logs/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DATA_DIR/logs/error.log</string>
</dict>
</plist>
EOF
    
    log_info "LaunchAgent created (for optional auto-start)"
    log_info "Enable with: launchctl load $plist_file"
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
    echo "Access at: http://localhost:8001"
    echo ""
    
    if ! command -v mongod &> /dev/null; then
        echo ""
        log_warn "MongoDB is required but not installed."
        log_warn "Start MongoDB before using WatchNexus:"
        log_warn "  brew services start mongodb-community"
        log_warn "  OR: docker run -d --name mongodb -p 27017:27017 mongo:7"
    else
        echo "MongoDB service:"
        echo "  brew services start mongodb-community"
        echo "  brew services stop mongodb-community"
    fi
    echo ""
}

main "$@"

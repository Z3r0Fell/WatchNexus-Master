#!/bin/bash
#===============================================================================
# WatchNexus Installation Script for macOS
# Supports: macOS 12 Monterey and later
# v3.0.0-beta
#===============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/Applications/WatchNexus.app"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"
CONFIG_DIR="$DATA_DIR/config"
VERSION="3.0.0-beta"

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
echo "  WatchNexus Installer - macOS  v${VERSION}"
echo -e "==============================================${NC}"
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
    log_info "macOS version: $version"
}

#===============================================================================
# PREREQUISITE CHECK
#===============================================================================
check_prerequisites() {
    echo -e "${BOLD}Checking prerequisites...${NC}"
    echo ""

    MISSING=()
    FOUND=()

    # Homebrew
    if command -v brew &>/dev/null; then
        FOUND+=("Homebrew $(brew --version | head -1 | awk '{print $2}')")
    else
        MISSING+=("Homebrew (package manager)")
    fi

    # Python 3.10+
    if command -v python3 &>/dev/null; then
        PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
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

    # Node.js 18+
    if command -v node &>/dev/null; then
        NODE_VER=$(node --version | sed 's/v//')
        NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge 18 ]; then
            FOUND+=("Node.js v$NODE_VER")
        else
            MISSING+=("Node.js 18+ (found v$NODE_VER)")
        fi
    else
        MISSING+=("Node.js 18+")
    fi

    # Yarn
    if command -v yarn &>/dev/null; then
        FOUND+=("Yarn $(yarn --version)")
    else
        MISSING+=("Yarn")
    fi

    # MongoDB
    if command -v mongod &>/dev/null; then
        FOUND+=("MongoDB")
    else
        MISSING+=("MongoDB 7.x")
    fi

    # FFmpeg
    if command -v ffmpeg &>/dev/null; then
        FOUND+=("FFmpeg")
    else
        MISSING+=("FFmpeg (optional, for transcoding)")
    fi

    # Display results
    echo -e "  ${CYAN}Prerequisite Status:${NC}"
    echo "  -----------------------------------------------"
    for item in "${FOUND[@]}"; do
        echo -e "  ${GREEN}OK${NC}      $item"
    done
    for item in "${MISSING[@]}"; do
        echo -e "  ${RED}MISSING${NC} $item"
    done
    echo "  -----------------------------------------------"
    echo ""

    if [ ${#MISSING[@]} -gt 0 ]; then
        echo -e "  ${YELLOW}The following prerequisites are missing:${NC}"
        for item in "${MISSING[@]}"; do
            echo -e "    - $item"
        done
        echo ""
        read -p "  The installer can attempt to install missing dependencies via Homebrew. Continue? (y/n): " ANSWER
        if [[ "$ANSWER" != "y" && "$ANSWER" != "Y" ]]; then
            echo ""
            log_info "Installation cancelled. Install prerequisites manually:"
            echo "  - Homebrew:   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "  - Python:     brew install python@3.11"
            echo "  - Node.js:    brew install node"
            echo "  - Yarn:       brew install yarn"
            echo "  - MongoDB:    brew tap mongodb/brew && brew install mongodb-community"
            echo "  - FFmpeg:     brew install ffmpeg"
            exit 0
        fi
    else
        echo -e "  ${GREEN}All prerequisites satisfied!${NC}"
    fi
    echo ""
}

# Install Homebrew if not present
install_homebrew() {
    if ! command -v brew &> /dev/null; then
        log_info "[1/6] Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
            log_error "Failed to install Homebrew"
            exit 1
        }
        if [[ $(uname -m) == "arm64" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        else
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    else
        log_info "[1/6] Homebrew already installed"
    fi
}

# Install dependencies
install_deps() {
    log_info "[2/6] Installing dependencies..."
    brew update || log_warn "Homebrew update failed, continuing..."
    brew install node yarn python@3.11 ffmpeg vips || {
        log_error "Failed to install required packages"
        exit 1
    }
    
    if ! command -v mongod &> /dev/null; then
        log_info "Installing MongoDB..."
        brew tap mongodb/brew 2>/dev/null || true
        brew install mongodb-community 2>/dev/null || {
            log_warn "Could not install MongoDB via Homebrew"
            log_warn "You can use Docker instead:"
            log_warn "  docker run -d --name mongodb -p 27017:27017 mongo:7"
        }
    fi
    
    if command -v mongod &> /dev/null; then
        brew services start mongodb-community 2>/dev/null || true
    fi
    
    log_info "Dependencies installed"
}

create_directories() {
    log_info "[3/6] Creating directories..."
    mkdir -p "$DATA_DIR"/{config,themes,plugins,downloads,media,logs}
    mkdir -p "$CONFIG_DIR"
    log_info "Directories created"
}

build_frontend() {
    log_info "[4/6] Building frontend..."
    cd "$PROJECT_ROOT/frontend"
    if [ ! -f "package.json" ]; then
        log_error "frontend/package.json not found"
        exit 1
    fi
    if [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile 2>/dev/null || yarn install
    else
        yarn install
    fi
    yarn build || { log_error "Frontend build failed"; exit 1; }
    if [ -d "build" ]; then FRONTEND_BUILD_DIR="build"
    elif [ -d "dist" ]; then FRONTEND_BUILD_DIR="dist"
    else log_error "No frontend build directory found"; exit 1; fi
    log_info "Frontend built"
}

install_backend() {
    log_info "[5/6] Installing backend..."
    cd "$PROJECT_ROOT/backend"
    if [ ! -f "requirements.txt" ]; then
        log_error "backend/requirements.txt not found"; exit 1
    fi
    python3 -m venv venv || { log_error "Failed to create virtual environment"; exit 1; }
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt || { log_error "Failed to install Python dependencies"; deactivate; exit 1; }
    deactivate
    log_info "Backend installed"
}

create_app_bundle() {
    log_info "[6/6] Creating app bundle..."
    rm -rf "$INSTALL_DIR" 2>/dev/null || true
    mkdir -p "$INSTALL_DIR/Contents/"{MacOS,Resources}

    cd "$PROJECT_ROOT/frontend"
    cp -r "$FRONTEND_BUILD_DIR" "$INSTALL_DIR/Contents/Resources/frontend"
    cp -r "$PROJECT_ROOT/backend" "$INSTALL_DIR/Contents/Resources/"

    cat > "$INSTALL_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>WatchNexus</string>
    <key>CFBundleDisplayName</key><string>WatchNexus</string>
    <key>CFBundleIdentifier</key><string>ca.watchnexus.app</string>
    <key>CFBundleVersion</key><string>$VERSION</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundleExecutable</key><string>watchnexus</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>LSApplicationCategoryType</key><string>public.app-category.entertainment</string>
</dict>
</plist>
EOF

    cat > "$INSTALL_DIR/Contents/MacOS/watchnexus" << 'LAUNCHEREOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/../Resources"
DATA_DIR="$HOME/Library/Application Support/WatchNexus"
LOG_DIR="$DATA_DIR/logs"
mkdir -p "$LOG_DIR"
cd "$RESOURCES_DIR/backend"
source venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 8001 >> "$LOG_DIR/server.log" 2>&1 &
BACKEND_PID=$!
sleep 3
if kill -0 $BACKEND_PID 2>/dev/null; then
    open "http://localhost:8001"
    wait $BACKEND_PID
else
    osascript -e 'display alert "WatchNexus" message "Failed to start backend. Check logs at ~/Library/Application Support/WatchNexus/logs/"'
fi
LAUNCHEREOF
    chmod +x "$INSTALL_DIR/Contents/MacOS/watchnexus"

    cat > "$INSTALL_DIR/Contents/Resources/backend/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF
    log_info "App bundle created"
}

# Main
main() {
    check_macos_version
    check_prerequisites
    install_homebrew
    install_deps
    create_directories
    build_frontend
    install_backend
    create_app_bundle
    
    echo ""
    echo -e "${BOLD}=============================================="
    echo "  Installation Complete!"
    echo -e "==============================================${NC}"
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
    echo -e "Access at: ${CYAN}http://localhost:8001${NC}"
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

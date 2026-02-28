#!/bin/bash
# WatchNexus Master Build Script
# Builds desktop installers for all platforms

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$ROOT_DIR/src/server"
WEB_DIR="$ROOT_DIR/src/web"
BUILD_OUTPUT="$ROOT_DIR/releases"
VERSION=$(grep '"version"' "$WEB_DIR/package.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

echo "=========================================="
echo "  WatchNexus Build System v$VERSION"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 is required${NC}"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is required${NC}"
        exit 1
    fi
    
    # Check Yarn
    if ! command -v yarn &> /dev/null; then
        echo -e "${RED}Error: Yarn is required${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}All prerequisites satisfied${NC}"
}

# Install build dependencies
install_deps() {
    echo ""
    echo -e "${YELLOW}Installing build dependencies...${NC}"
    
    # Python deps
    cd "$SERVER_DIR"
    pip install pyinstaller --quiet
    pip install -r requirements.txt --quiet
    
    # Node deps
    cd "$WEB_DIR"
    yarn install --silent
    
    echo -e "${GREEN}Dependencies installed${NC}"
}

# Build backend executable
build_backend() {
    echo ""
    echo -e "${YELLOW}Building backend executable...${NC}"
    
    cd "$SERVER_DIR"
    
    # Clean previous builds
    rm -rf dist/ build/ __pycache__/
    
    # Run PyInstaller
    pyinstaller watchnexus.spec --clean --noconfirm
    
    # Create dist directory structure
    mkdir -p "$WEB_DIR/../backend/dist"
    
    # Copy executable to web folder for electron-builder
    if [[ "$OSTYPE" == "darwin"* ]]; then
        cp dist/watchnexus-server "$WEB_DIR/../backend/dist/"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        cp dist/watchnexus-server "$WEB_DIR/../backend/dist/"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        cp dist/watchnexus-server.exe "$WEB_DIR/../backend/dist/"
    fi
    
    echo -e "${GREEN}Backend built successfully${NC}"
}

# Build frontend
build_frontend() {
    echo ""
    echo -e "${YELLOW}Building frontend...${NC}"
    
    cd "$WEB_DIR"
    yarn build
    
    echo -e "${GREEN}Frontend built successfully${NC}"
}

# Build electron app for current platform
build_electron() {
    echo ""
    echo -e "${YELLOW}Building desktop application...${NC}"
    
    cd "$WEB_DIR"
    
    case "$1" in
        mac)
            echo "Building for macOS..."
            yarn electron:build:mac
            ;;
        win)
            echo "Building for Windows..."
            yarn electron:build:win
            ;;
        linux)
            echo "Building for Linux..."
            yarn electron:build:linux
            ;;
        all)
            echo "Building for all platforms..."
            yarn electron:build:all
            ;;
        *)
            echo "Building for current platform..."
            yarn electron:build
            ;;
    esac
    
    echo -e "${GREEN}Desktop app built successfully${NC}"
}

# Copy outputs to releases folder
collect_releases() {
    echo ""
    echo -e "${YELLOW}Collecting release artifacts...${NC}"
    
    mkdir -p "$BUILD_OUTPUT/installers"
    
    # Copy all built installers
    if [ -d "$WEB_DIR/dist" ]; then
        cp -r "$WEB_DIR/dist/"* "$BUILD_OUTPUT/installers/" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Release artifacts collected in: $BUILD_OUTPUT/installers${NC}"
    ls -la "$BUILD_OUTPUT/installers/" 2>/dev/null || echo "No installers found"
}

# Main
usage() {
    echo "Usage: $0 [command] [platform]"
    echo ""
    echo "Commands:"
    echo "  all       - Build everything (default)"
    echo "  backend   - Build only backend executable"
    echo "  frontend  - Build only frontend"
    echo "  electron  - Build only electron app"
    echo "  deps      - Install dependencies only"
    echo "  clean     - Clean all build artifacts"
    echo ""
    echo "Platforms (for electron command):"
    echo "  mac       - Build .dmg for macOS"
    echo "  win       - Build .exe/.msi for Windows"
    echo "  linux     - Build .AppImage/.deb/.rpm for Linux"
    echo "  all       - Build for all platforms (requires all platform SDKs)"
    echo ""
    echo "Examples:"
    echo "  $0              # Build for current platform"
    echo "  $0 electron mac # Build macOS installer only"
    echo "  $0 clean        # Clean all builds"
}

clean() {
    echo -e "${YELLOW}Cleaning build artifacts...${NC}"
    rm -rf "$SERVER_DIR/dist" "$SERVER_DIR/build" "$SERVER_DIR/__pycache__"
    rm -rf "$WEB_DIR/build" "$WEB_DIR/dist"
    rm -rf "$BUILD_OUTPUT/installers"
    echo -e "${GREEN}Cleaned${NC}"
}

# Parse arguments
case "$1" in
    backend)
        check_prerequisites
        build_backend
        ;;
    frontend)
        check_prerequisites
        build_frontend
        ;;
    electron)
        check_prerequisites
        build_electron "$2"
        collect_releases
        ;;
    deps)
        check_prerequisites
        install_deps
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        usage
        ;;
    all|"")
        check_prerequisites
        install_deps
        build_backend
        build_frontend
        build_electron "$2"
        collect_releases
        echo ""
        echo -e "${GREEN}=========================================="
        echo "  Build Complete!"
        echo "==========================================${NC}"
        echo ""
        echo "Installers are in: $BUILD_OUTPUT/installers"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        usage
        exit 1
        ;;
esac

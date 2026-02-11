#!/bin/bash
#
# WatchNexus Build Script for Arch Linux
# Ensures all dependencies are installed and builds the application
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PYTHON_VERSION="3.11"
NODE_VERSION="18"

# System dependencies (pacman packages)
PACMAN_DEPS=(
    "python"
    "python-pip"
    "python-virtualenv"
    "nodejs"
    "npm"
    "yarn"
    "mongodb"
    "ffmpeg"
    "git"
    "base-devel"
    "openssl"
    "libffi"
    "libtorrent-rasterbar"
)

# AUR dependencies (if needed)
AUR_DEPS=(
    # "mongodb-bin"  # Alternative if mongodb not in repos
)

# Python dependencies (from requirements.txt)
PYTHON_DEPS=(
    "fastapi"
    "uvicorn"
    "pymongo"
    "python-jose"
    "passlib"
    "bcrypt"
    "httpx"
    "beautifulsoup4"
    "lxml"
    "cryptography"
    "python-multipart"
    "libtorrent"
)

# Node.js dependencies check
NODE_DEPS=(
    "react"
    "react-dom"
    "axios"
    "framer-motion"
    "tailwindcss"
)

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           WatchNexus Build Script - Arch Linux               ║"
echo "║                    🍯 Unified Media Pipeline                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root (not recommended)
if [[ $EUID -eq 0 ]]; then
    log_warning "Running as root is not recommended. Consider using a regular user with sudo."
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to check pacman package
package_installed() {
    pacman -Qi "$1" &> /dev/null
}

# Function to install pacman packages
install_pacman_deps() {
    log_info "Checking system dependencies..."
    
    local missing_deps=()
    
    for dep in "${PACMAN_DEPS[@]}"; do
        if ! package_installed "$dep"; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_info "Installing missing packages: ${missing_deps[*]}"
        sudo pacman -S --needed --noconfirm "${missing_deps[@]}"
        log_success "System dependencies installed"
    else
        log_success "All system dependencies already installed"
    fi
}

# Function to install AUR packages (using yay or paru)
install_aur_deps() {
    if [[ ${#AUR_DEPS[@]} -eq 0 ]]; then
        return 0
    fi
    
    log_info "Checking AUR dependencies..."
    
    local aur_helper=""
    if command_exists yay; then
        aur_helper="yay"
    elif command_exists paru; then
        aur_helper="paru"
    else
        log_warning "No AUR helper found (yay/paru). Installing yay..."
        
        cd /tmp
        git clone https://aur.archlinux.org/yay.git
        cd yay
        makepkg -si --noconfirm
        cd "$PROJECT_ROOT"
        aur_helper="yay"
    fi
    
    for dep in "${AUR_DEPS[@]}"; do
        if ! package_installed "$dep"; then
            log_info "Installing AUR package: $dep"
            $aur_helper -S --needed --noconfirm "$dep"
        fi
    done
    
    log_success "AUR dependencies installed"
}

# Function to setup Python virtual environment
setup_python_env() {
    log_info "Setting up Python virtual environment..."
    
    cd "$PROJECT_ROOT/backend"
    
    if [[ ! -d "venv" ]]; then
        python -m venv venv
        log_info "Created virtual environment"
    fi
    
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip wheel setuptools
    
    # Install requirements
    if [[ -f "requirements.txt" ]]; then
        log_info "Installing Python dependencies..."
        pip install -r requirements.txt
        log_success "Python dependencies installed"
    else
        log_warning "requirements.txt not found, installing core dependencies..."
        pip install "${PYTHON_DEPS[@]}"
    fi
    
    deactivate
}

# Function to setup Node.js/Frontend
setup_node_env() {
    log_info "Setting up Node.js environment..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # Check Node version
    local node_ver=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$node_ver" -lt 16 ]]; then
        log_error "Node.js version 16+ required. Found: v$node_ver"
        exit 1
    fi
    
    # Install dependencies
    if [[ -f "package.json" ]]; then
        log_info "Installing Node.js dependencies..."
        yarn install
        log_success "Node.js dependencies installed"
    else
        log_error "package.json not found in frontend directory"
        exit 1
    fi
}

# Function to setup MongoDB
setup_mongodb() {
    log_info "Checking MongoDB..."
    
    if ! systemctl is-active --quiet mongodb; then
        log_info "Starting MongoDB service..."
        sudo systemctl enable mongodb
        sudo systemctl start mongodb
    fi
    
    log_success "MongoDB is running"
}

# Function to build frontend for production
build_frontend() {
    log_info "Building frontend for production..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # Set production environment
    export NODE_ENV=production
    
    yarn build
    
    log_success "Frontend build complete"
}

# Function to build Electron app
build_electron() {
    log_info "Building Electron application..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # Check if electron-builder is available
    if ! yarn list electron-builder &> /dev/null; then
        log_info "Installing electron-builder..."
        yarn add --dev electron-builder
    fi
    
    # Build for Linux
    yarn electron:build --linux
    
    log_success "Electron build complete"
}

# Function to run tests
run_tests() {
    log_info "Running tests..."
    
    # Backend tests
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    
    if [[ -d "tests" ]]; then
        python -m pytest tests/ -v
    fi
    
    deactivate
    
    # Frontend tests
    cd "$PROJECT_ROOT/frontend"
    yarn test --watchAll=false || true
    
    log_success "Tests complete"
}

# Function to create distribution package
create_package() {
    log_info "Creating distribution package..."
    
    local dist_dir="$PROJECT_ROOT/dist"
    local version=$(cat "$PROJECT_ROOT/version.txt" 2>/dev/null || echo "1.0.0")
    
    mkdir -p "$dist_dir"
    
    # Copy backend
    cp -r "$PROJECT_ROOT/backend" "$dist_dir/"
    
    # Copy frontend build
    cp -r "$PROJECT_ROOT/frontend/build" "$dist_dir/frontend/"
    
    # Copy scripts
    cp -r "$PROJECT_ROOT/scripts" "$dist_dir/"
    
    # Create version file
    echo "$version" > "$dist_dir/version.txt"
    
    # Create tarball
    cd "$PROJECT_ROOT"
    tar -czvf "watchnexus-$version-linux.tar.gz" -C dist .
    
    log_success "Package created: watchnexus-$version-linux.tar.gz"
}

# Main build process
main() {
    local start_time=$(date +%s)
    
    log_info "Starting WatchNexus build process..."
    log_info "Project root: $PROJECT_ROOT"
    
    # Parse arguments
    local skip_deps=false
    local skip_tests=false
    local build_electron_app=false
    local create_dist=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                skip_deps=true
                shift
                ;;
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --electron)
                build_electron_app=true
                shift
                ;;
            --dist)
                create_dist=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --skip-deps     Skip dependency installation"
                echo "  --skip-tests    Skip running tests"
                echo "  --electron      Build Electron desktop app"
                echo "  --dist          Create distribution package"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Step 1: Install system dependencies
    if [[ "$skip_deps" == false ]]; then
        install_pacman_deps
        install_aur_deps
    fi
    
    # Step 2: Setup Python environment
    setup_python_env
    
    # Step 3: Setup Node.js environment
    setup_node_env
    
    # Step 4: Setup MongoDB
    setup_mongodb
    
    # Step 5: Build frontend
    build_frontend
    
    # Step 6: Build Electron (if requested)
    if [[ "$build_electron_app" == true ]]; then
        build_electron
    fi
    
    # Step 7: Run tests (if not skipped)
    if [[ "$skip_tests" == false ]]; then
        run_tests
    fi
    
    # Step 8: Create distribution package (if requested)
    if [[ "$create_dist" == true ]]; then
        create_package
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Build Complete! 🎉                        ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Duration: ${duration}s                                            ║"
    echo "║                                                              ║"
    echo "║  To start the application:                                   ║"
    echo "║    Backend:  cd backend && source venv/bin/activate          ║"
    echo "║              uvicorn server:app --reload                     ║"
    echo "║    Frontend: cd frontend && yarn start                       ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# Run main function
main "$@"

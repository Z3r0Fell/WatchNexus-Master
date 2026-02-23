#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  WatchNexus Server Launcher for macOS
#  Version: 1.0.0
# ═══════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$SCRIPT_DIR/.venv"
LOG_DIR="$BACKEND_DIR/logs"
PORT=${WATCHNEXUS_PORT:-8001}
FRONTEND_PORT=${WATCHNEXUS_FRONTEND_PORT:-3000}

# Banner
print_banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║   ██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗                ║"
    echo "║   ██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║                ║"
    echo "║   ██║ █╗ ██║███████║   ██║   ██║     ███████║                ║"
    echo "║   ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║                ║"
    echo "║   ╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║                ║"
    echo "║    ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝                ║"
    echo "║                     N E X U S                                ║"
    echo "║                                                              ║"
    echo "║              Unified Media Pipeline v1.0.0                   ║"
    echo "║                      macOS Edition                           ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 not found!${NC}"
        echo "Install with: brew install python3"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    echo -e "  ${GREEN}✓${NC} Python $PYTHON_VERSION"
    
    # Check Node.js (optional for development)
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "  ${GREEN}✓${NC} Node.js $NODE_VERSION"
    else
        echo -e "  ${YELLOW}⚠${NC} Node.js not found (optional)"
    fi
    
    # Check pip
    if ! command -v pip3 &> /dev/null; then
        echo -e "${RED}Error: pip3 not found!${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} pip3"
}

# Setup virtual environment
setup_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${BLUE}Creating virtual environment...${NC}"
        python3 -m venv "$VENV_DIR"
    fi
    
    echo -e "${BLUE}Activating virtual environment...${NC}"
    source "$VENV_DIR/bin/activate"
    
    # Upgrade pip
    pip install --upgrade pip -q
    
    # Install requirements
    if [ -f "$BACKEND_DIR/requirements.txt" ]; then
        echo -e "${BLUE}Installing Python dependencies...${NC}"
        pip install -r "$BACKEND_DIR/requirements.txt" -q
    fi
    
    echo -e "  ${GREEN}✓${NC} Virtual environment ready"
}

# Create directories
setup_directories() {
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKEND_DIR/data"
    mkdir -p "$BACKEND_DIR/backups"
    echo -e "  ${GREEN}✓${NC} Directories created"
}

# Start backend server
start_backend() {
    echo -e "${BLUE}Starting backend server on port $PORT...${NC}"
    
    cd "$BACKEND_DIR"
    
    # Check if already running
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Port $PORT is already in use${NC}"
        read -p "Kill existing process? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -Pi :$PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
            sleep 1
        else
            exit 1
        fi
    fi
    
    # Start uvicorn
    source "$VENV_DIR/bin/activate"
    python -m uvicorn server:app --host 0.0.0.0 --port $PORT &
    BACKEND_PID=$!
    
    # Wait for startup
    sleep 3
    
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Backend running (PID: $BACKEND_PID)"
    else
        echo -e "  ${RED}✗${NC} Backend failed to start"
        exit 1
    fi
}

# Start frontend (if built)
start_frontend() {
    if [ -d "$FRONTEND_DIR/build" ]; then
        echo -e "${BLUE}Frontend build found - serving static files${NC}"
        # Backend serves static files from frontend/build
    elif [ -f "$FRONTEND_DIR/package.json" ]; then
        echo -e "${YELLOW}Frontend not built. Run 'cd frontend && yarn build' for production.${NC}"
    fi
}

# Open browser
open_browser() {
    echo -e "${BLUE}Opening WatchNexus in browser...${NC}"
    sleep 2
    open "http://localhost:$PORT" 2>/dev/null || true
}

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down WatchNexus...${NC}"
    
    # Kill backend
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our port
    lsof -Pi :$PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}WatchNexus stopped.${NC}"
}

# Main
main() {
    trap cleanup EXIT INT TERM
    
    print_banner
    
    echo -e "${BLUE}Starting WatchNexus...${NC}\n"
    
    check_dependencies
    setup_directories
    setup_venv
    start_backend
    start_frontend
    
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  WatchNexus is running!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BLUE}Web Interface:${NC}  http://localhost:$PORT"
    echo -e "  ${BLUE}API Endpoint:${NC}   http://localhost:$PORT/api"
    echo -e "  ${BLUE}Logs:${NC}           $LOG_DIR/watchnexus.log"
    echo ""
    echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop the server"
    echo ""
    
    # Open browser
    if [ "$1" != "--no-browser" ]; then
        open_browser
    fi
    
    # Keep running
    wait $BACKEND_PID
}

# Run
main "$@"

#!/bin/bash
#===============================================
#  WatchNexus - Unified Media Pipeline
#  Version: 1.2.1
#  
#  ZERO EXTERNAL DEPENDENCIES
#  Just Python - that's it!
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=${1:-8001}
PID_FILE="$SCRIPT_DIR/watchnexus.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Handle stop command
if [ "$1" = "stop" ]; then
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "${YELLOW}Stopping WatchNexus (PID: $PID)...${NC}"
            kill "$PID"
            rm -f "$PID_FILE"
            echo -e "${GREEN}Stopped.${NC}"
        else
            echo -e "${YELLOW}Process not running. Cleaning up PID file.${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}No PID file found. Checking for running instances...${NC}"
        pkill -f "uvicorn server:app" 2>/dev/null && echo -e "${GREEN}Stopped.${NC}" || echo "No running instance found."
    fi
    exit 0
fi

# Handle status command
if [ "$1" = "status" ]; then
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "${GREEN}WatchNexus is running (PID: $PID)${NC}"
            echo -e "  URL: http://localhost:$PORT"
            echo -e "  Logs: $SCRIPT_DIR/backend/logs/watchnexus.log"
            exit 0
        fi
    fi
    echo -e "${YELLOW}WatchNexus is not running${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     🎬 ${GREEN}WatchNexus v1.2.1${NC}                    ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}     Unified Media Pipeline                     ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: Python 3 not found${NC}"
    echo "  Install Python 3.10+ from your package manager:"
    echo "    Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip"
    echo "    Fedora: sudo dnf install python3"
    echo "    Arch: sudo pacman -S python"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "  Python version: ${GREEN}$PYTHON_VERSION${NC}"

# Check if port is in use
if lsof -i:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    EXISTING_PID=$(lsof -i:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)
    echo ""
    echo -e "${YELLOW}WARNING: Port $PORT is already in use (PID: $EXISTING_PID)${NC}"
    echo ""
    echo "  Options:"
    echo "    1. Stop existing instance:  ./start-watchnexus.sh stop"
    echo "    2. Use a different port:    ./start-watchnexus.sh 8002"
    echo ""
    read -p "  Kill existing process and continue? (y/N): " KILL_EXISTING
    if [[ "$KILL_EXISTING" =~ ^[Yy]$ ]]; then
        kill "$EXISTING_PID" 2>/dev/null
        sleep 1
        echo -e "${GREEN}  Killed process $EXISTING_PID${NC}"
    else
        echo "  Exiting. Use a different port or stop the existing instance."
        exit 1
    fi
fi

# Check/create Python venv
if [ ! -f "backend/venv/bin/activate" ]; then
    echo ""
    echo -e "${YELLOW}First run - setting up Python environment...${NC}"
    echo "  This may take 1-2 minutes."
    echo ""
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
    deactivate
    cd ..
    echo -e "${GREEN}✓ Setup complete!${NC}"
    echo ""
fi

# Create minimal .env if needed (SQLite doesn't need external config)
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << EOF
# WatchNexus Configuration
# Database: SQLite (automatic, no setup needed)
# Add your TMDB API key for movie/TV metadata:
# TMDB_API_KEY=your_key_here
EOF
fi

cd backend
source venv/bin/activate

# Create logs directory
mkdir -p logs

echo ""
echo -e "  ${GREEN}Starting WatchNexus server...${NC}"
echo ""
echo -e "  📺 Open in your browser: ${BLUE}http://localhost:$PORT${NC}"
echo -e "  📁 Logs: ${BLUE}$SCRIPT_DIR/backend/logs/watchnexus.log${NC}"
echo -e "  🛑 Press ${YELLOW}Ctrl+C${NC} to stop"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    ./start-watchnexus.sh stop     - Stop the server"
echo -e "    ./start-watchnexus.sh status   - Check if running"
echo -e "    ./start-watchnexus.sh 8002     - Start on different port"
echo ""

# Save PID for stop command
echo $$ > "$PID_FILE"

# Trap to clean up PID file on exit
trap "rm -f $PID_FILE" EXIT

python -m uvicorn server:app --host 127.0.0.1 --port $PORT

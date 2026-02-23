#!/bin/bash
#===============================================
#  WatchNexus - Unified Media Pipeline
#  Version: 2.3.0
#  
#  ZERO EXTERNAL DEPENDENCIES
#  Just Python - that's it!
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8001
PID_FILE="$SCRIPT_DIR/watchnexus.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to check what's running on port 8001
check_port() {
    if command -v lsof &> /dev/null; then
        PROCESS_INFO=$(lsof -i:$PORT -sTCP:LISTEN 2>/dev/null)
        if [ -n "$PROCESS_INFO" ]; then
            PID=$(lsof -i:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)
            PNAME=$(ps -p $PID -o comm= 2>/dev/null)
            echo "$PID|$PNAME"
        fi
    elif command -v ss &> /dev/null; then
        PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
        if [ -n "$PID" ]; then
            PNAME=$(ps -p $PID -o comm= 2>/dev/null)
            echo "$PID|$PNAME"
        fi
    elif command -v netstat &> /dev/null; then
        PID=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | grep -oP '[0-9]+(?=/)' | head -1)
        if [ -n "$PID" ]; then
            PNAME=$(ps -p $PID -o comm= 2>/dev/null)
            echo "$PID|$PNAME"
        fi
    fi
}

# Function to kill process on port
kill_port() {
    RESULT=$(check_port)
    if [ -n "$RESULT" ]; then
        PID=$(echo "$RESULT" | cut -d'|' -f1)
        kill "$PID" 2>/dev/null
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null
        fi
        return 0
    fi
    return 1
}

# Handle stop command
if [ "$1" = "stop" ]; then
    echo -e "${YELLOW}Stopping WatchNexus...${NC}"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm -f "$PID_FILE"
            echo -e "${GREEN}✓ Stopped (PID: $PID)${NC}"
            exit 0
        fi
        rm -f "$PID_FILE"
    fi
    # Also check port directly
    if kill_port; then
        echo -e "${GREEN}✓ Stopped process on port $PORT${NC}"
    else
        echo -e "${YELLOW}No WatchNexus instance found running${NC}"
    fi
    exit 0
fi

# Handle status command
if [ "$1" = "status" ]; then
    RESULT=$(check_port)
    if [ -n "$RESULT" ]; then
        PID=$(echo "$RESULT" | cut -d'|' -f1)
        PNAME=$(echo "$RESULT" | cut -d'|' -f2)
        echo -e "${GREEN}Port $PORT is in use${NC}"
        echo -e "  PID:     $PID"
        echo -e "  Process: $PNAME"
        echo -e "  URL:     http://localhost:$PORT"
        if [ -f "$SCRIPT_DIR/backend/logs/watchnexus.log" ]; then
            echo -e "  Logs:    $SCRIPT_DIR/backend/logs/watchnexus.log"
        fi
    else
        echo -e "${YELLOW}Port $PORT is free - WatchNexus is not running${NC}"
    fi
    exit 0
fi

# Handle kill command (force kill whatever is on 8001)
if [ "$1" = "kill" ]; then
    RESULT=$(check_port)
    if [ -n "$RESULT" ]; then
        PID=$(echo "$RESULT" | cut -d'|' -f1)
        PNAME=$(echo "$RESULT" | cut -d'|' -f2)
        echo -e "${YELLOW}Killing process on port $PORT...${NC}"
        echo -e "  PID:     $PID"
        echo -e "  Process: $PNAME"
        kill_port
        echo -e "${GREEN}✓ Killed${NC}"
    else
        echo -e "${YELLOW}Nothing running on port $PORT${NC}"
    fi
    exit 0
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     🎬 ${GREEN}WatchNexus v2.3.0${NC}                    ${BLUE}║${NC}"
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

# Check if port 8001 is in use
RESULT=$(check_port)
if [ -n "$RESULT" ]; then
    PID=$(echo "$RESULT" | cut -d'|' -f1)
    PNAME=$(echo "$RESULT" | cut -d'|' -f2)
    echo ""
    echo -e "${YELLOW}⚠ Port $PORT is already in use${NC}"
    echo -e "  ${CYAN}PID:${NC}     $PID"
    echo -e "  ${CYAN}Process:${NC} $PNAME"
    echo ""
    
    # Check if it's already WatchNexus running
    if [[ "$PNAME" == *"python"* ]] || [[ "$PNAME" == *"uvicorn"* ]]; then
        echo -e "  ${BLUE}This looks like a WatchNexus instance.${NC}"
    fi
    
    echo -e "  Would you like to kill this process and start WatchNexus?"
    echo -e "  ${CYAN}[Y/n]:${NC} "
    read -r RESPONSE
    
    # Default to yes if empty or y/Y
    if [[ -z "$RESPONSE" ]] || [[ "$RESPONSE" =~ ^[Yy]$ ]]; then
        echo -e "  ${GREEN}Killing process...${NC}"
        kill_port
        sleep 1
        echo -e "  ${GREEN}✓ Port $PORT is now free${NC}"
        echo ""
    else
        echo -e "  ${RED}Aborting. Port $PORT is still in use.${NC}"
        echo -e "  ${YELLOW}You can manually stop the process with:${NC}"
        echo -e "    kill $PID"
        echo -e "  ${YELLOW}Or run WatchNexus with:${NC}"
        echo -e "    ./start-watchnexus.sh kill"
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

# TMDB API key for movie/TV metadata (free at themoviedb.org)
TMDB_API_KEY=8c860bcb88494f598008480abfe24d13
EOF
fi

cd backend
source venv/bin/activate

# Create logs directory
mkdir -p logs

echo ""
echo -e "  ${GREEN}Starting WatchNexus server...${NC}"
echo ""
echo -e "  📺 Open in browser: ${BLUE}http://localhost:$PORT${NC}"
echo -e "  📁 Logs:            ${BLUE}$SCRIPT_DIR/backend/logs/watchnexus.log${NC}"
echo -e "  🛑 Stop:            ${YELLOW}Ctrl+C${NC} or ${YELLOW}./start-watchnexus.sh stop${NC}"
echo ""
echo -e "  ${CYAN}Commands:${NC}"
echo -e "    ./start-watchnexus.sh stop   - Stop the server"
echo -e "    ./start-watchnexus.sh status - Check what's on port 8001"
echo -e "    ./start-watchnexus.sh kill   - Force kill port 8001"
echo ""

# Save PID for stop command
echo $$ > "$PID_FILE"

# Trap to clean up PID file on exit
trap "rm -f $PID_FILE" EXIT

python -m uvicorn server:app --host 127.0.0.1 --port $PORT

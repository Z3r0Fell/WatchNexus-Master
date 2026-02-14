#!/bin/bash
#===============================================
#  WatchNexus - Unified Media Pipeline
#  Version: 1.1.0
#  
#  ZERO EXTERNAL DEPENDENCIES
#  Just Python - that's it!
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     🎬 ${GREEN}WatchNexus v1.1.0${NC}                    ${BLUE}║${NC}"
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
echo ""
echo -e "  ${GREEN}Starting WatchNexus server...${NC}"
echo ""
echo -e "  📺 Open in your browser: ${BLUE}http://localhost:8001${NC}"
echo -e "  🛑 Press ${YELLOW}Ctrl+C${NC} to stop"
echo ""
python -m uvicorn server:app --host 127.0.0.1 --port 8001

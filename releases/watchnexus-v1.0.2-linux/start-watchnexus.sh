#!/bin/bash
#===============================================
#  WatchNexus - Unified Media Pipeline
#  Version: 1.0.2
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=============================================="
echo "  WatchNexus v1.0.2 - Starting..."
echo "=============================================="
echo ""

# Check for MongoDB
if ! command -v mongod &> /dev/null && ! pgrep -x mongod > /dev/null && ! docker ps 2>/dev/null | grep -q mongo; then
    echo -e "${YELLOW}WARNING: MongoDB not detected${NC}"
    echo "  Install MongoDB or use Docker:"
    echo "    docker run -d --name mongodb -p 27017:27017 mongo:7"
    echo ""
fi

# Check/create Python venv
if [ ! -f "backend/venv/bin/activate" ]; then
    echo "Setting up Python environment (first run)..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    cd ..
    echo -e "${GREEN}Setup complete!${NC}"
    echo ""
fi

# Check/create .env
if [ ! -f "backend/.env" ]; then
    echo "Creating default configuration..."
    cat > backend/.env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
EOF
fi

cd backend
source venv/bin/activate
echo ""
echo "Starting WatchNexus server..."
echo -e "Access at: ${GREEN}http://localhost:8001${NC}"
echo "Press Ctrl+C to stop."
echo ""
python -m uvicorn server:app --host 127.0.0.1 --port 8001

#!/bin/bash
#===============================================
#  WatchNexus - Unified Media Pipeline
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  WatchNexus - Starting..."
echo "=============================================="
echo ""

# Check/create Python venv
if [ ! -f "backend/venv/bin/activate" ]; then
    echo "Setting up Python environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    cd ..
    echo "Setup complete!"
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
echo "Access at: http://localhost:8001"
echo "Press Ctrl+C to stop."
echo ""
python -m uvicorn server:app --host 127.0.0.1 --port 8001

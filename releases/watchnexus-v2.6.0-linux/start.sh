#!/bin/bash
cd "$(dirname "$0")/server"

if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required. Install with: sudo apt install python3 python3-venv"
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "Installing dependencies..."
pip install -r requirements.txt --quiet

echo ""
echo "=========================================="
echo "  WatchNexus v2.6.0 - Starting..."
echo "  Open http://localhost:8001 in browser"
echo "=========================================="
echo ""
python3 server.py

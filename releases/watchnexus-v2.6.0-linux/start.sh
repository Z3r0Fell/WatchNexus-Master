#!/bin/bash
cd "$(dirname "$0")/server"

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt --quiet

# Run server
echo "Starting WatchNexus v2.6.0..."
echo "Open http://localhost:8001 in your browser"
python3 server.py

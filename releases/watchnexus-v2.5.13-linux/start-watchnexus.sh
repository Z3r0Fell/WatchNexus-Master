#!/bin/bash
# WatchNexus v2.5.13 - Unified Media Pipeline
# Linux Start Script

echo "Starting WatchNexus v2.5.13..."
echo "====================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required but not installed."
    exit 1
fi

# Navigate to script directory
cd "$(dirname "$0")"

# Install backend dependencies
echo "Installing backend dependencies..."
cd server
pip3 install -r requirements.txt --quiet 2>/dev/null

# Start backend server
echo "Starting backend server on port 8001..."
python3 server.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

echo ""
echo "====================================="
echo "WatchNexus v2.5.13 is running!"
echo "====================================="
echo ""
echo "Open your browser and navigate to:"
echo "  http://localhost:8001"
echo ""
echo "Default credentials:"
echo "  Email: admin@watchnexus.local"
echo "  Password: admin"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Wait for user interrupt
wait $BACKEND_PID

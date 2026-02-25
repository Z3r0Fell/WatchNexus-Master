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

# Check if frontend is built
FRONTEND_BUILD="../web/build"
if [ ! -d "$FRONTEND_BUILD" ]; then
    echo ""
    echo "Building frontend (first time only, this may take a few minutes)..."
    cd ../web
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo "ERROR: Node.js is required to build the frontend."
        echo "Please install Node.js from https://nodejs.org"
        exit 1
    fi
    
    # Install dependencies and build
    if command -v yarn &> /dev/null; then
        yarn install --silent 2>/dev/null
        yarn build 2>/dev/null
    else
        npm install --silent 2>/dev/null
        npm run build 2>/dev/null
    fi
    
    # Move build to server directory for serving
    if [ -d "build" ]; then
        mkdir -p ../server/frontend_build
        cp -r build/* ../server/frontend_build/
        echo "Frontend built successfully!"
    else
        echo "WARNING: Frontend build failed. Running in API-only mode."
        echo "You can still access the API at http://localhost:8001/api"
    fi
    
    cd ../server
fi

# If build exists, copy to server directory
if [ -d "../web/build" ] && [ ! -d "frontend_build" ]; then
    mkdir -p frontend_build
    cp -r ../web/build/* frontend_build/
fi

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

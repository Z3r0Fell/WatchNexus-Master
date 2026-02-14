#!/bin/bash
# Install WatchNexus system-wide on Linux
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/watchnexus"
DATA_DIR="/var/lib/watchnexus"

echo "Installing WatchNexus to $INSTALL_DIR..."

# Create directories
sudo mkdir -p "$INSTALL_DIR"
sudo mkdir -p "$DATA_DIR"/{themes,plugins,downloads,media,logs}

# Copy files
sudo cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"
sudo cp -r "$SCRIPT_DIR/backend" "$INSTALL_DIR/"

# Setup Python venv
cd "$INSTALL_DIR/backend"
sudo python3 -m venv venv
sudo "$INSTALL_DIR/backend/venv/bin/pip" install --upgrade pip
sudo "$INSTALL_DIR/backend/venv/bin/pip" install -r requirements.txt

# Create config
sudo tee "$INSTALL_DIR/backend/.env" > /dev/null << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DATA_DIR/plugins
WATCHNEXUS_THEMES_DIR=$DATA_DIR/themes
EOF

# Create systemd service
sudo tee /etc/systemd/system/watchnexus.service > /dev/null << EOF
[Unit]
Description=WatchNexus Media Server
After=network.target mongodb.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
echo ""
echo "Installation complete!"
echo ""
echo "Start with: sudo systemctl start watchnexus"
echo "Enable on boot: sudo systemctl enable watchnexus"
echo "Access at: http://localhost:8001"

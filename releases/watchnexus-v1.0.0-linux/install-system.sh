#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/watchnexus"

echo "Installing WatchNexus to $INSTALL_DIR..."

sudo mkdir -p "$INSTALL_DIR"
sudo cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"
sudo cp -r "$SCRIPT_DIR/backend" "$INSTALL_DIR/"

cd "$INSTALL_DIR/backend"
sudo python3 -m venv venv
sudo "$INSTALL_DIR/backend/venv/bin/pip" install --upgrade pip
sudo "$INSTALL_DIR/backend/venv/bin/pip" install -r requirements.txt

sudo tee "$INSTALL_DIR/backend/.env" > /dev/null << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
EOF

sudo tee /etc/systemd/system/watchnexus.service > /dev/null << EOF
[Unit]
Description=WatchNexus Media Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
echo ""
echo "Installation complete!"
echo "Start: sudo systemctl start watchnexus"
echo "Enable on boot: sudo systemctl enable watchnexus"

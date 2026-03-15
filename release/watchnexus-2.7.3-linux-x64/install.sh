#!/bin/bash
set -e
echo "=== WatchNexus v2.7.3 Installer (Linux x64) ==="
echo ""

INSTALL_DIR="/opt/watchnexus"

# Create user
if ! id -u watchnexus &>/dev/null; then
    useradd -r -s /usr/bin/nologin -d "$INSTALL_DIR" watchnexus
    echo "Created watchnexus user."
fi

# Install files
mkdir -p "$INSTALL_DIR"
cp -r ./* "$INSTALL_DIR/"
chown -R watchnexus:watchnexus "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/WatchNexus.Core"

# Install systemd service
cp "$INSTALL_DIR/watchnexus.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable watchnexus
systemctl start watchnexus

echo ""
echo "WatchNexus installed and running at http://localhost:8001"
echo "  Manage: systemctl {start|stop|restart|status} watchnexus"
echo "  Logs:   journalctl -u watchnexus -f"

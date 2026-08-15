#!/bin/bash
# WatchNexus Linux Uninstaller
set -e

INSTALL_DIR="${HOME}/.local/share/watchnexus"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/256x256/apps"
SERVICE_NAME="watchnexus"

echo "Uninstalling WatchNexus..."

# Stop and disable the systemd service
if systemctl --user is-active --quiet ${SERVICE_NAME}.service 2>/dev/null; then
    systemctl --user stop ${SERVICE_NAME}.service
fi
if systemctl --user is-enabled --quiet ${SERVICE_NAME}.service 2>/dev/null; then
    systemctl --user disable ${SERVICE_NAME}.service
fi
systemctl --user daemon-reload

# Disable lingering
loginctl disable-linger "$(whoami)" 2>/dev/null || true

# Stop any running instances (more specific patterns to avoid killing unrelated processes)
pkill -f "WatchNexus.Core.dll" 2>/dev/null || true

# Remove systemd unit
rm -f "$HOME/.config/systemd/user/${SERVICE_NAME}.service"

# Remove files
rm -rf "$INSTALL_DIR"
rm -f "$BIN_DIR/watchnexus"
rm -f "$DESKTOP_DIR/watchnexus.desktop"
rm -f "$ICON_DIR/watchnexus.png"

echo "WatchNexus has been uninstalled."

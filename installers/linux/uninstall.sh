#!/bin/bash
# WatchNexus Linux Uninstaller
set -e

INSTALL_DIR="${HOME}/.local/share/watchnexus"
BIN_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/256x256/apps"

echo "Uninstalling WatchNexus..."

# Stop any running instances
pkill -f "watchnexus" 2>/dev/null || true
pkill -f "uvicorn server:app" 2>/dev/null || true

# Remove files
rm -rf "$INSTALL_DIR"
rm -f "$BIN_DIR/watchnexus"
rm -f "$DESKTOP_DIR/watchnexus.desktop"
rm -f "$ICON_DIR/watchnexus.png"

echo "WatchNexus has been uninstalled."

#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Create WatchNexus DMG for macOS
#  Run this on a Mac to create a distributable DMG
# ═══════════════════════════════════════════════════════════════

APP_NAME="WatchNexus"
VERSION="1.0.0"
DMG_NAME="${APP_NAME}-${VERSION}.dmg"
VOLUME_NAME="${APP_NAME} ${VERSION}"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
STAGING_DIR="$TEMP_DIR/$APP_NAME"

echo "Creating $DMG_NAME..."

# Copy files to staging
mkdir -p "$STAGING_DIR"
cp -R . "$STAGING_DIR/"

# Remove unnecessary files
rm -f "$STAGING_DIR/create-dmg.sh"
rm -rf "$STAGING_DIR/.git"

# Create Applications symlink
ln -s /Applications "$TEMP_DIR/Applications"

# Create DMG
hdiutil create -volname "$VOLUME_NAME" \
    -srcfolder "$TEMP_DIR" \
    -ov -format UDZO \
    "$DMG_NAME"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✓ Created $DMG_NAME"
echo ""
echo "To install:"
echo "  1. Open the DMG"
echo "  2. Drag WatchNexus to Applications"
echo "  3. Run from Applications folder"

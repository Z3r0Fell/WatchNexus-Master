#!/bin/bash
set -e

# WatchNexus Release Build Script
# Produces self-contained release artifacts for Windows (x64) and Linux (x64)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/release_builds"
VERSION="2.8.4"
PROJECT_DIR="$ROOT_DIR/src/watchnexus/core"

echo "=== WatchNexus v${VERSION} Release Builder ==="

# Ensure dotnet is available
export PATH="/opt/dotnet:$PATH"
if ! command -v dotnet &>/dev/null; then
    echo "ERROR: .NET SDK not found. Install .NET 10 SDK first."
    echo "  curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 10.0 --install-dir /opt/dotnet"
    exit 1
fi

echo "Using .NET SDK: $(dotnet --version)"

# Clean old builds
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ── Build Frontend (if not already built) ──────────────────
FRONTEND_DIR="$ROOT_DIR/src/web"
if [ ! -f "$FRONTEND_DIR/build/index.html" ]; then
    echo "[1/6] Building frontend..."
    cd "$FRONTEND_DIR"
    if [ ! -d node_modules ]; then yarn install --frozen-lockfile 2>/dev/null || yarn install; fi
    yarn build
    echo "      Frontend built."
else
    echo "[1/6] Frontend already built — skipping."
fi

# ── Clean previous .NET build artifacts ──────────────────
echo "[2/6] Cleaning build artifacts..."
rm -rf "$PROJECT_DIR/bin" "$PROJECT_DIR/obj"
rm -rf "$ROOT_DIR/src/watchnexus/shared/bin" "$ROOT_DIR/src/watchnexus/shared/obj"

# ── Publish for Windows x64 ──────────────────────────────
echo "[3/6] Publishing for Windows x64 (with WinForms tray icon)..."
cd "$PROJECT_DIR"
dotnet publish -c Release -r win-x64 --self-contained true \
    -o "$BUILD_DIR/win-x64" 2>&1 | tail -5
echo "      Windows x64 build complete."

# Clean intermediates between builds
rm -rf "$PROJECT_DIR/bin" "$PROJECT_DIR/obj"

# ── Publish for Linux x64 ──────────────────────────────────
echo "[4/6] Publishing for Linux x64..."
dotnet publish -c Release -r linux-x64 --self-contained true \
    -o "$BUILD_DIR/linux-x64" 2>&1 | tail -5
chmod +x "$BUILD_DIR/linux-x64/WatchNexus.Core"
echo "      Linux x64 build complete."

# ── Copy supporting files ──────────────────────────────────
echo "[5/6] Copying supporting files..."
for TARGET in win-x64 linux-x64; do
    cp "$ROOT_DIR/CHANGELOG.md" "$BUILD_DIR/$TARGET/" 2>/dev/null || true
    cp "$ROOT_DIR/README.md" "$BUILD_DIR/$TARGET/" 2>/dev/null || true
done

# Create Windows launcher batch file
cat > "$BUILD_DIR/win-x64/start-watchnexus.bat" << 'WINEOF'
@echo off
title WatchNexus Server
echo ================================================
echo  WatchNexus v2.8.4 - Self-Hosted Media Pipeline
echo ================================================
echo.
echo Starting WatchNexus on http://localhost:8002 ...
echo A system tray icon will appear when ready.
echo.
WatchNexus.Core.exe
pause
WINEOF

# Create Linux launcher script
cat > "$BUILD_DIR/linux-x64/start-watchnexus.sh" << 'LXEOF'
#!/bin/bash
echo "================================================"
echo " WatchNexus v2.8.4 - Self-Hosted Media Pipeline"
echo "================================================"
echo ""
echo "Starting WatchNexus on http://localhost:8002 ..."
echo ""
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/WatchNexus.Core"
LXEOF
chmod +x "$BUILD_DIR/linux-x64/start-watchnexus.sh"

# Create systemd service file for Linux
cat > "$BUILD_DIR/linux-x64/watchnexus.service" << 'SDEOF'
[Unit]
Description=WatchNexus Media Server
After=network.target

[Service]
Type=simple
User=watchnexus
Group=watchnexus
WorkingDirectory=/opt/watchnexus
ExecStart=/opt/watchnexus/WatchNexus.Core
Environment=ASPNETCORE_URLS=http://0.0.0.0:8002
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
SDEOF

# ── Package as zip archives ──────────────────────────────
echo "[6/6] Creating zip archives..."
cd "$BUILD_DIR"
zip -r -q "WatchNexus-v${VERSION}-win-x64.zip" win-x64/
zip -r -q "WatchNexus-v${VERSION}-linux-x64.zip" linux-x64/

# Clean up uncompressed directories
rm -rf "$BUILD_DIR/win-x64" "$BUILD_DIR/linux-x64"

# Clean build intermediates
rm -rf "$PROJECT_DIR/bin" "$PROJECT_DIR/obj"
rm -rf "$ROOT_DIR/src/watchnexus/shared/bin" "$ROOT_DIR/src/watchnexus/shared/obj"

echo ""
echo "=== Release Build Complete ==="
echo "  Windows x64: $BUILD_DIR/WatchNexus-v${VERSION}-win-x64.zip"
echo "  Linux x64:   $BUILD_DIR/WatchNexus-v${VERSION}-linux-x64.zip"
echo ""
ls -lh "$BUILD_DIR"/*.zip

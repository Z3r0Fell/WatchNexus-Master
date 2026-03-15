#!/bin/bash
set -e

# WatchNexus Release Build Script
# Produces release artifacts for Windows (x64) and Arch Linux (x64)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/release"
VERSION="2.7.3-alpha"

echo "=== WatchNexus v${VERSION} Release Builder ==="

# Ensure dotnet is available
export PATH="/opt/dotnet:$PATH"
if ! command -v dotnet &>/dev/null; then
    echo "ERROR: .NET SDK not found. Install .NET 10 SDK first."
    exit 1
fi

# Clean old builds
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ── Build Frontend ──────────────────────────────────
echo "[1/5] Building frontend..."
cd "$ROOT_DIR/src/web"
if [ ! -d node_modules ]; then yarn install --frozen-lockfile; fi
yarn build
echo "      Frontend built."

# ── Publish for Windows x64 ──────────────────────────────────
echo "[2/5] Publishing for Windows x64..."
cd "$ROOT_DIR/src/watchnexus/core"
dotnet publish -c Release -r win-x64 --self-contained true \
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
    -o "$BUILD_DIR/win-x64" 2>&1 | tail -3

# Copy frontend build into Windows package
cp -r "$ROOT_DIR/src/web/build" "$BUILD_DIR/win-x64/wwwroot"

echo "      Windows x64 build complete."

# ── Publish for Linux x64 (Arch) ──────────────────────────────────
echo "[3/5] Publishing for Linux x64 (Arch)..."
dotnet publish -c Release -r linux-x64 --self-contained true \
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
    -o "$BUILD_DIR/linux-x64" 2>&1 | tail -3

# Copy frontend build into Linux package
cp -r "$ROOT_DIR/src/web/build" "$BUILD_DIR/linux-x64/wwwroot"

echo "      Linux x64 build complete."

# ── Create Windows Release Package ──────────────────────────────────
echo "[4/5] Packaging Windows release..."
WIN_PKG="$BUILD_DIR/watchnexus-${VERSION}-win-x64"
mkdir -p "$WIN_PKG"
cp "$BUILD_DIR/win-x64/WatchNexus.Core"* "$WIN_PKG/" 2>/dev/null || true
cp "$BUILD_DIR/win-x64/WatchNexus.Core.exe" "$WIN_PKG/" 2>/dev/null || true
cp -r "$BUILD_DIR/win-x64/wwwroot" "$WIN_PKG/"
cp "$BUILD_DIR/win-x64/"*.dll "$WIN_PKG/" 2>/dev/null || true
cp "$BUILD_DIR/win-x64/appsettings"* "$WIN_PKG/" 2>/dev/null || true

# Create Windows launcher script
cat > "$WIN_PKG/start-watchnexus.bat" << 'WINEOF'
@echo off
title WatchNexus Server
echo ================================================
echo  WatchNexus v2.7.3-alpha - Self-Hosted Media Pipeline
echo  QA: https://z3r0fell.github.io/watchnexus-qa/
echo ================================================
echo.
echo Starting WatchNexus on http://localhost:8001 ...
echo.
set ASPNETCORE_URLS=http://0.0.0.0:8001
WatchNexus.Core.exe
pause
WINEOF

# Create Windows install-as-service script
cat > "$WIN_PKG/install-service.ps1" << 'PSEOF'
#Requires -RunAsAdministrator
$svcName = "WatchNexus"
$binPath = Join-Path $PSScriptRoot "WatchNexus.Core.exe"
$env:ASPNETCORE_URLS = "http://0.0.0.0:8001"

if (Get-Service -Name $svcName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing $svcName service..."
    Stop-Service $svcName -Force
    sc.exe delete $svcName
    Start-Sleep 2
}

Write-Host "Installing $svcName as a Windows service..."
New-Service -Name $svcName -BinaryPathName $binPath -DisplayName "WatchNexus Media Server" `
    -StartupType Automatic -Description "WatchNexus unified media pipeline"

Write-Host "Starting $svcName..."
Start-Service $svcName
Write-Host "WatchNexus installed and running at http://localhost:8001"
PSEOF

# Windows README
cat > "$WIN_PKG/README.md" << 'RDEOF'
# WatchNexus v2.7.3-alpha - Windows Release

**QA & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

## Quick Start

1. Run `start-watchnexus.bat` (or double-click `WatchNexus.Core.exe`)
2. Open `http://localhost:8001` in your browser
3. Create an account and start using WatchNexus

## Install as Windows Service

Run PowerShell as Administrator:
```powershell
.\install-service.ps1
```

This registers WatchNexus as a system service that auto-starts on boot.

## Configuration

- Default port: `8001` (set `ASPNETCORE_URLS` env var to change)
- Database: SQLite, stored in `data/watchnexus.db` next to the executable
- Logs: Console output (or Windows Event Log when running as service)

## System Requirements

- Windows 10/11 or Windows Server 2019+
- 512MB RAM minimum, 1GB recommended
- No additional dependencies (self-contained .NET 10 build)

**QA Dashboard:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)
RDEOF

echo "      Windows package ready: $WIN_PKG"

# ── Create Arch Linux Release Package ──────────────────────────────────
echo "[5/5] Packaging Arch Linux release..."
LINUX_PKG="$BUILD_DIR/watchnexus-${VERSION}-linux-x64"
mkdir -p "$LINUX_PKG"
cp "$BUILD_DIR/linux-x64/WatchNexus.Core" "$LINUX_PKG/"
cp -r "$BUILD_DIR/linux-x64/wwwroot" "$LINUX_PKG/"
cp "$BUILD_DIR/linux-x64/"*.dll "$LINUX_PKG/" 2>/dev/null || true
cp "$BUILD_DIR/linux-x64/"*.so "$LINUX_PKG/" 2>/dev/null || true
cp "$BUILD_DIR/linux-x64/appsettings"* "$LINUX_PKG/" 2>/dev/null || true

chmod +x "$LINUX_PKG/WatchNexus.Core"

# Create systemd service file
cat > "$LINUX_PKG/watchnexus.service" << 'SDEOF'
[Unit]
Description=WatchNexus Media Server
After=network.target

[Service]
Type=simple
User=watchnexus
Group=watchnexus
WorkingDirectory=/opt/watchnexus
ExecStart=/opt/watchnexus/WatchNexus.Core
Environment=ASPNETCORE_URLS=http://0.0.0.0:8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SDEOF

# Create Arch Linux installer
cat > "$LINUX_PKG/install.sh" << 'LXEOF'
#!/bin/bash
set -e
echo "=== WatchNexus v2.7.3-alpha Installer (Arch Linux) ==="
echo "QA: https://z3r0fell.github.io/watchnexus-qa/"
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
LXEOF
chmod +x "$LINUX_PKG/install.sh"

# Create PKGBUILD for AUR/makepkg
cat > "$LINUX_PKG/PKGBUILD" << 'PKGEOF'
# Maintainer: WatchNexus Team
pkgname=watchnexus
pkgver=2.7.3-alpha
pkgrel=1
pkgdesc="Unified, self-hosted media pipeline"
arch=('x86_64')
url="https://z3r0fell.github.io/watchnexus-qa/"
license=('custom')
depends=()
backup=('etc/systemd/system/watchnexus.service')
source=()

package() {
    install -dm755 "$pkgdir/opt/watchnexus"
    install -Dm755 "$srcdir/WatchNexus.Core" "$pkgdir/opt/watchnexus/WatchNexus.Core"
    cp -r "$srcdir/wwwroot" "$pkgdir/opt/watchnexus/"
    install -Dm644 "$srcdir/watchnexus.service" "$pkgdir/etc/systemd/system/watchnexus.service"

    install -dm755 "$pkgdir/opt/watchnexus/data"

    # Create sysusers file
    install -Dm644 /dev/stdin "$pkgdir/usr/lib/sysusers.d/watchnexus.conf" <<SYSEOF
u watchnexus - "WatchNexus" /opt/watchnexus /usr/bin/nologin
SYSEOF
}
PKGEOF

# Linux README
cat > "$LINUX_PKG/README.md" << 'RDEOF'
# WatchNexus v2.7.3-alpha - Arch Linux Release

**QA & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

## Quick Install

```bash
sudo bash install.sh
```

This installs WatchNexus to `/opt/watchnexus` and registers a systemd service.

## Manual Install (makepkg)

```bash
makepkg -si
```

## Usage

```bash
# Start/stop
sudo systemctl start watchnexus
sudo systemctl stop watchnexus

# View logs
journalctl -u watchnexus -f

# Access
http://localhost:8001
```

## Configuration

- Default port: `8001` (edit `/etc/systemd/system/watchnexus.service` to change)
- Database: SQLite at `/opt/watchnexus/data/watchnexus.db`
- The binary is fully self-contained — no .NET runtime dependency required

## System Requirements

- x86_64 architecture
- 512MB RAM minimum, 1GB recommended
- glibc 2.17+ (any modern Arch install)

**QA Dashboard:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)
RDEOF

echo "      Arch Linux package ready: $LINUX_PKG"

echo ""
echo "=== Release Build Complete ==="
echo "  Windows x64:    $WIN_PKG/"
echo "  Arch Linux x64: $LINUX_PKG/"
echo ""
echo "To create distributable archives:"
echo "  cd $BUILD_DIR"
echo "  tar czf watchnexus-${VERSION}-win-x64.tar.gz watchnexus-${VERSION}-win-x64/"
echo "  tar czf watchnexus-${VERSION}-linux-x64.tar.gz watchnexus-${VERSION}-linux-x64/"

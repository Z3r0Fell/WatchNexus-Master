# WatchNexus Cross-Platform Build Guide

This guide explains how to package WatchNexus as a standalone desktop application for Mac, Linux (AppImage), and Windows.

## Architecture

WatchNexus uses a hybrid architecture:
1. **Frontend**: React app (can be packaged with Electron)
2. **Backend**: FastAPI Python server (packaged with PyInstaller)
3. **Built-in Torrent Engine**: libtorrent-based (part of backend)

## Option 1: Electron + PyInstaller (Recommended)

### Prerequisites

```bash
# Node.js & Yarn
node --version  # v18+
yarn --version  # v1.22+

# Python
python --version  # v3.10+
pip install pyinstaller
```

### Step 1: Package Backend with PyInstaller

```bash
cd /app/backend

# Install dependencies
pip install -r requirements.txt

# Create spec file
cat > watchnexus.spec << 'EOF'
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = collect_submodules('libtorrent') + collect_submodules('uvicorn')

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('torrent_engine.py', '.'),
        ('compote.py', '.'),
        ('media_health_checker.py', '.'),
        ('qbittorrent_client.py', '.'),
    ],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='watchnexus-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon='../assets/watchnexus.ico',
)
EOF

# Build
pyinstaller watchnexus.spec
```

### Step 2: Setup Electron for Frontend

```bash
cd /app/frontend

# Install Electron Builder
yarn add electron electron-builder --dev

# Create electron main process
cat > electron/main.js << 'EOF'
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function getBackendPath() {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return null; // Backend runs separately in dev
  }
  
  const platform = process.platform;
  const basePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend');
  
  switch (platform) {
    case 'win32':
      return path.join(basePath, 'watchnexus-server.exe');
    case 'darwin':
      return path.join(basePath, 'watchnexus-server');
    case 'linux':
      return path.join(basePath, 'watchnexus-server');
    default:
      return null;
  }
}

function startBackend() {
  const backendPath = getBackendPath();
  if (!backendPath) return;
  
  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      MONGO_URL: 'mongodb://localhost:27017',
      DB_NAME: 'watchnexus',
      JWT_SECRET: 'watchnexus_secret_' + Date.now(),
    }
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'WatchNexus',
    icon: path.join(__dirname, '..', 'assets', 'watchnexus.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a0f',
  });
  
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  }
  
  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  
  // Wait for backend to start
  setTimeout(createWindow, 2000);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
EOF

# Create electron-builder config
cat > electron-builder.yml << 'EOF'
appId: com.watchnexus.app
productName: WatchNexus
directories:
  output: dist
  buildResources: assets

files:
  - build/**/*
  - electron/**/*
  - package.json

extraResources:
  - from: ../backend/dist/watchnexus-server
    to: backend

mac:
  category: public.app-category.entertainment
  icon: assets/watchnexus.icns
  target:
    - target: dmg
      arch: [x64, arm64]
    - target: zip
      arch: [x64, arm64]
  hardenedRuntime: true
  gatekeeperAssess: false

win:
  icon: assets/watchnexus.ico
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: assets/watchnexus.ico
  uninstallerIcon: assets/watchnexus.ico

linux:
  icon: assets/watchnexus.png
  category: AudioVideo
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
    - target: rpm
      arch: [x64]

appImage:
  artifactName: WatchNexus-${version}.AppImage
EOF
```

### Step 3: Build for All Platforms

```bash
# Build frontend
cd /app/frontend
yarn build

# Build for Mac (on Mac)
yarn electron-builder --mac

# Build for Windows (on Windows or with Wine)
yarn electron-builder --win

# Build for Linux (on Linux)
yarn electron-builder --linux
```

## Option 2: Tauri (Lighter Weight Alternative)

Tauri uses the system's native webview instead of bundling Chromium, resulting in much smaller binaries.

### Setup Tauri

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli

# Initialize Tauri in frontend
cd /app/frontend
yarn add @tauri-apps/api @tauri-apps/cli
npx tauri init
```

### Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "build": {
    "beforeBuildCommand": "yarn build",
    "beforeDevCommand": "yarn start",
    "devPath": "http://localhost:3000",
    "distDir": "../build"
  },
  "package": {
    "productName": "WatchNexus",
    "version": "1.0.0"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "icon": ["icons/icon.icns", "icons/icon.ico", "icons/icon.png"],
      "identifier": "com.watchnexus.app",
      "targets": "all",
      "resources": ["../backend/dist/*"],
      "macOS": {
        "minimumSystemVersion": "10.15"
      },
      "windows": {
        "wix": null,
        "nsis": null
      },
      "linux": {
        "appimage": {
          "bundleMediaFramework": true
        }
      }
    }
  }
}
```

## MongoDB Options

### Option A: Embedded MongoDB (SQLite Alternative)

For true portability, use **TinyDB** or **SQLite** instead of MongoDB:

```python
# backend/database.py - Alternative using TinyDB
from tinydb import TinyDB, Query
import os

db_path = os.path.join(os.path.dirname(__file__), 'data', 'watchnexus.json')
os.makedirs(os.path.dirname(db_path), exist_ok=True)
db = TinyDB(db_path)

users = db.table('users')
settings = db.table('settings')
```

### Option B: MongoDB Bundled

Bundle MongoDB with the application:

- **Mac**: Use `mongodb-community` from Homebrew, extract binaries
- **Windows**: Bundle `mongod.exe` from MongoDB Community Server
- **Linux**: Include `mongod` binary in AppImage

## Cross-Platform Build Script

```bash
#!/bin/bash
# build-all.sh

set -e

VERSION="1.0.0"
BUILD_DIR="./release"

echo "🔧 Building WatchNexus v${VERSION}"

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Build backend
echo "📦 Building backend..."
cd backend
pip install -r requirements.txt
pyinstaller watchnexus.spec --clean --noconfirm
cp dist/watchnexus-server "../$BUILD_DIR/"
cd ..

# Build frontend
echo "🎨 Building frontend..."
cd frontend
yarn install
yarn build

# Build Electron apps
echo "💻 Building desktop apps..."

# Mac
if [[ "$OSTYPE" == "darwin"* ]]; then
    yarn electron-builder --mac --x64 --arm64
    cp dist/*.dmg "../$BUILD_DIR/"
fi

# Linux
if [[ "$OSTYPE" == "linux"* ]]; then
    yarn electron-builder --linux
    cp dist/*.AppImage "../$BUILD_DIR/"
fi

# Windows (requires Wine on Linux/Mac)
if command -v wine &> /dev/null; then
    yarn electron-builder --win
    cp dist/*.exe "../$BUILD_DIR/"
fi

cd ..

echo "✅ Build complete! Files in $BUILD_DIR/"
ls -la "$BUILD_DIR/"
```

## Notes

### Windows 10/11 Compatibility

- Ensure NSIS installer requests admin privileges only when needed
- Bundle Visual C++ Redistributable for libtorrent
- Test on both Windows 10 and 11

### Mac Compatibility

- Sign the app with an Apple Developer certificate for distribution
- Notarize the app for Gatekeeper
- Support both Intel (x64) and Apple Silicon (arm64)

### Linux Compatibility

- AppImage is the most portable format
- Test on Ubuntu 20.04+, Fedora 35+, Arch Linux
- Ensure all dependencies are bundled

## File Structure After Build

```
WatchNexus/
├── WatchNexus.app/              # Mac
│   └── Contents/
│       ├── MacOS/
│       │   └── WatchNexus
│       └── Resources/
│           └── backend/
│               └── watchnexus-server
├── WatchNexus-1.0.0.AppImage    # Linux
├── WatchNexus-1.0.0.exe         # Windows Installer
├── WatchNexus-1.0.0-portable.exe # Windows Portable
└── WatchNexus-1.0.0.dmg         # Mac Installer
```

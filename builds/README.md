# WatchNexus Build System

This directory contains everything needed to build WatchNexus installers for all platforms.

## Quick Start

```bash
# Build for your current platform
./build.sh

# Or on Windows
build.bat
```

## Output Formats

| Platform | Installer Types | Output Location |
|----------|-----------------|-----------------|
| **Windows** | `.exe` (NSIS), Portable `.exe` | `releases/installers/` |
| **macOS** | `.dmg`, `.zip` | `releases/installers/` |
| **Linux** | `.AppImage`, `.deb`, `.rpm` | `releases/installers/` |

## Prerequisites

### All Platforms
- Python 3.10+
- Node.js 18+
- Yarn

### Platform-Specific

**Windows:**
- Visual Studio Build Tools (for native modules)
- Windows SDK

**macOS:**
- Xcode Command Line Tools
- For code signing: Apple Developer certificate

**Linux:**
- Build essentials: `sudo apt install build-essential`
- For .rpm: `sudo apt install rpm`

## Build Commands

```bash
# Full build (backend + frontend + installer)
./build.sh all

# Backend only (creates watchnexus-server executable)
./build.sh backend

# Frontend only (creates React build)
./build.sh frontend

# Electron installer only (requires backend + frontend first)
./build.sh electron          # Current platform
./build.sh electron mac      # macOS .dmg
./build.sh electron win      # Windows .exe
./build.sh electron linux    # Linux .AppImage, .deb, .rpm

# Install dependencies
./build.sh deps

# Clean all build artifacts
./build.sh clean
```

## Build Process

The build system works in three stages:

### 1. Backend Build (PyInstaller)
```
src/server/ → PyInstaller → watchnexus-server(.exe)
```

Bundles the Python FastAPI server into a standalone executable using `watchnexus.spec`.

### 2. Frontend Build (React)
```
src/web/src/ → yarn build → src/web/build/
```

Compiles the React frontend into static files.

### 3. Electron Package
```
Electron + Backend + Frontend → .dmg / .exe / .AppImage
```

electron-builder packages everything into platform-native installers using `electron-builder.yml`.

## Configuration Files

| File | Purpose |
|------|---------|
| `src/server/watchnexus.spec` | PyInstaller configuration |
| `src/web/electron-builder.yml` | Electron-builder configuration |
| `src/web/electron/main.js` | Electron main process |
| `src/web/electron/preload.js` | Electron preload script |

## Customization

### Changing Version
Update `version` in `src/web/package.json`

### Icons
Replace files in `src/web/assets/`:
- `watchnexus.icns` - macOS icon (1024x1024)
- `watchnexus.ico` - Windows icon
- `icons/` - Linux icons (various sizes)

### Code Signing

**macOS:**
```bash
export CSC_LINK=/path/to/cert.p12
export CSC_KEY_PASSWORD=password
./build.sh electron mac
```

**Windows:**
```bash
export CSC_LINK=/path/to/cert.pfx
export CSC_KEY_PASSWORD=password
./build.sh electron win
```

## Troubleshooting

### PyInstaller fails
- Ensure all Python dependencies are installed
- Check for missing hidden imports in `watchnexus.spec`

### Electron build fails
- Run `yarn install` in `src/web/`
- Check that backend executable exists in `src/backend/dist/`

### Large installer size
- The backend executable includes Python runtime (~50MB)
- Use UPX compression (enabled by default)

## Directory Structure

```
builds/
├── build.sh           # Main build script (Linux/macOS)
├── build.bat          # Windows build script
├── README.md          # This file
├── Docker/            # Docker configuration
├── Linux/             # Additional Linux configs
├── Mac/               # Additional macOS configs
├── Windows/           # Additional Windows configs
├── NAS/               # NAS deployment guides
└── Unraid/            # Unraid templates

src/
├── server/
│   ├── watchnexus.spec    # PyInstaller spec
│   ├── server.py          # Main backend
│   └── requirements.txt
└── web/
    ├── electron/          # Electron files
    │   ├── main.js
    │   └── preload.js
    ├── electron-builder.yml
    ├── assets/            # Icons and images
    └── package.json

releases/
└── installers/        # Built installers output
```


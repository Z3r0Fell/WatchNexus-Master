# WatchNexus Build System

Everything you need to build WatchNexus installers.

## tl;dr

```bash
# Linux/Mac
./build.sh

# Windows
build.bat
```

This builds an installer for whatever OS you're on. Output lands in `releases/installers/`.

## What gets built

| Platform | Output |
|----------|--------|
| Windows | `.exe` installer, portable `.exe` |
| macOS | `.dmg` disk image |
| Linux | `.AppImage`, `.deb`, `.rpm` |

## Before you build

You'll need:
- Python 3.10+
- Node.js 18+
- Yarn (`npm i -g yarn`)

On Windows you also need Visual Studio Build Tools. On Mac, Xcode command line tools.

## Build commands

```bash
./build.sh              # everything for current platform
./build.sh backend      # just the server executable
./build.sh frontend     # just the web build
./build.sh electron mac # mac installer only
./build.sh electron win # windows installer only
./build.sh clean        # nuke all build artifacts
```

## How it works

Three stages:

1. **Backend** - PyInstaller bundles Python + FastAPI into a single executable
2. **Frontend** - React gets compiled to static files
3. **Electron** - Wraps both into a native app with installer

The backend executable ends up at ~50MB (Python runtime included). The full installer is ~150MB because Electron bundles Chromium.

## Lightweight installers

If you don't want the full Electron app, check out `linux/install.sh`, `mac/install.sh`, or `windows/install.bat`. These are ~10KB scripts that download prerequisites from the internet during install instead of bundling everything.

## Files that matter

```
src/server/watchnexus.spec  - PyInstaller config
src/web/electron-builder.yml - Electron builder config
src/web/electron/main.js    - Desktop app entry point
builds/build.sh             - Main build script
```

## Icons

Replace these with your actual icons:
- `src/web/assets/watchnexus.icns` - Mac (1024x1024)
- `src/web/assets/watchnexus.ico` - Windows
- `src/web/assets/icons/` - Linux (multiple sizes)

## Code signing

For signed releases, set these env vars before building:

```bash
# Mac
export CSC_LINK=/path/to/Developer_ID_Application.p12
export CSC_KEY_PASSWORD=yourpassword

# Windows
export CSC_LINK=/path/to/codesign.pfx
export CSC_KEY_PASSWORD=yourpassword
```

## Common issues

**PyInstaller fails:** Usually a missing hidden import. Edit `watchnexus.spec` and add to `hiddenimports`.

**Electron build fails:** Run `yarn install` in `src/web/` first. Make sure the backend executable exists.

**Installer too big:** That's just how Electron is. Use the lightweight shell script installers if size matters.

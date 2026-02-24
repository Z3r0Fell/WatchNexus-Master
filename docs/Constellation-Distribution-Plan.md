# WatchNexus Distribution & Packaging Plan
## Codename: **Constellation**

### Overview

This document outlines the build and distribution strategy for WatchNexus across all major platforms, architectures, and form factors.

---

## Architecture Compatibility Status

### ✅ VERIFIED COMPATIBLE

| Architecture | Status | Notes |
|-------------|--------|-------|
| **AMD64 (x86_64)** | ✅ Ready | Standard desktop/server |
| **ARM64 (aarch64)** | ✅ Ready | Apple Silicon, Raspberry Pi 4/5, AWS Graviton |
| **ARMv7 (armhf)** | ✅ Ready | Raspberry Pi 3, older ARM devices |
| **Intel (i386/i686)** | ✅ Ready | Legacy 32-bit systems |

### Processor-Specific Notes

| Processor | Compatibility | Special Considerations |
|-----------|--------------|----------------------|
| **Intel Core** | ✅ Native | No special config needed |
| **AMD Ryzen/EPYC** | ✅ Native | No special config needed |
| **Apple M1/M2/M3** | ✅ Native | ARM64 builds, Rosetta 2 fallback |
| **NVIDIA (GPU)** | ⚠️ Optional | For hardware transcoding (NVENC) |
| **Raspberry Pi** | ✅ Native | ARM64 or ARMv7 builds |

### Why WatchNexus is Architecture-Agnostic

1. **Pure Python Core** - No compiled C extensions in main code
2. **SQLite Database** - Cross-platform, self-contained
3. **LTorrent** - Pure Python torrent library
4. **No ctypes/cffi** - No native library calls

### External Dependencies (Architecture-Specific)

| Dependency | Purpose | Availability |
|-----------|---------|--------------|
| **FFmpeg/FFprobe** | Media analysis & transcoding | All platforms |
| **Chromaprint (fpcalc)** | Audio fingerprinting | Most platforms |

---

## 1. Windows Distribution

### Windows Executable (.exe)

**Build Tool:** PyInstaller or Nuitka

```
WatchNexus-Setup-2.5.5-win64.exe     # 64-bit installer
WatchNexus-Setup-2.5.5-win32.exe     # 32-bit installer (legacy)
WatchNexus-Portable-2.5.5-win64.zip  # Portable version
```

**Build Requirements:**
- Windows 10/11 build machine (or cross-compile via Wine)
- Python 3.11+ for Windows
- NSIS or Inno Setup for installer creation

**Installer Features:**
- Desktop shortcut creation
- Start menu integration
- System tray (Beacon) auto-start option
- FFmpeg bundled or auto-download
- Windows Firewall exception prompt

**Build Command:**
```bash
# Using PyInstaller
pyinstaller --onefile --windowed --icon=icon.ico \
  --add-data "frontend/build;frontend/build" \
  --name WatchNexus server.py

# Using Nuitka (better optimization)
nuitka --standalone --onefile --windows-icon=icon.ico \
  --include-data-dir=frontend/build=frontend/build \
  --output-dir=dist server.py
```

---

## 2. macOS Distribution

### Target Versions
| Version | Codename | Release Year | Support Status |
|---------|----------|--------------|----------------|
| macOS 15 | Sequoia | 2024 | ✅ Primary |
| macOS 14 | Sonoma | 2023 | ✅ Supported |
| macOS 13 | Ventura | 2022 | ✅ Supported |
| macOS 12 | Monterey | 2021 | ⚠️ Legacy |

### Distribution Formats

```
WatchNexus-2.5.5-macos-arm64.dmg      # Apple Silicon (M1/M2/M3)
WatchNexus-2.5.5-macos-x86_64.dmg     # Intel Macs
WatchNexus-2.5.5-macos-universal.dmg  # Universal Binary (both)
```

**Build Requirements:**
- macOS build machine (required for code signing)
- Apple Developer account ($99/year for notarization)
- Xcode Command Line Tools

**App Bundle Structure:**
```
WatchNexus.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── WatchNexus          # Main executable
│   ├── Resources/
│   │   ├── icon.icns
│   │   ├── ffmpeg              # Bundled
│   │   └── ffprobe             # Bundled
│   └── Frameworks/
│       └── Python.framework/   # Embedded Python
```

**Code Signing & Notarization:**
```bash
# Sign the app
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name" \
  WatchNexus.app

# Notarize with Apple
xcrun notarytool submit WatchNexus.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAMID" \
  --password "@keychain:AC_PASSWORD"

# Staple the ticket
xcrun stapler staple WatchNexus.dmg
```

---

## 3. Linux Distribution

### 3.1 AppImage (Universal Linux)

**Target:** All Linux distributions with glibc 2.17+

```
WatchNexus-2.5.5-x86_64.AppImage
WatchNexus-2.5.5-aarch64.AppImage
WatchNexus-2.5.5-armhf.AppImage
```

**Benefits:**
- Single file, no installation required
- Works on any Linux distribution
- Self-contained with all dependencies
- Desktop integration via appimaged

**Build Process:**
```bash
# Using linuxdeploy
linuxdeploy --appdir AppDir \
  --executable dist/watchnexus \
  --icon-file icon.png \
  --desktop-file watchnexus.desktop \
  --output appimage
```

### 3.2 DEB Package (Debian/Ubuntu)

**Target:** Debian 11+, Ubuntu 20.04+, Linux Mint, Pop!_OS

```
watchnexus_2.5.5-1_amd64.deb
watchnexus_2.5.5-1_arm64.deb
watchnexus_2.5.5-1_armhf.deb
```

**Package Structure:**
```
watchnexus_2.5.5-1_amd64/
├── DEBIAN/
│   ├── control           # Package metadata
│   ├── postinst          # Post-install script
│   ├── prerm             # Pre-removal script
│   └── conffiles         # Config file list
├── usr/
│   ├── bin/
│   │   └── watchnexus    # Launcher script
│   ├── lib/
│   │   └── watchnexus/   # Application files
│   └── share/
│       ├── applications/
│       │   └── watchnexus.desktop
│       └── icons/
│           └── watchnexus.png
└── etc/
    └── watchnexus/
        └── config.yaml   # Default config
```

**Control File:**
```
Package: watchnexus
Version: 2.5.5-1
Section: multimedia
Priority: optional
Architecture: amd64
Depends: python3 (>= 3.9), ffmpeg
Recommends: chromaprint
Maintainer: Your Name <your@email.com>
Description: Unified Media Pipeline
 WatchNexus is a self-hosted media streaming platform
 that combines media acquisition, organization, and playback.
```

**Build Command:**
```bash
dpkg-deb --build watchnexus_2.5.5-1_amd64
```

### 3.3 RPM Package (Fedora/RHEL/CentOS)

**Target:** Fedora 38+, RHEL 8+, CentOS Stream, Rocky Linux, AlmaLinux

```
watchnexus-2.5.5-1.fc39.x86_64.rpm
watchnexus-2.5.5-1.el8.x86_64.rpm
watchnexus-2.5.5-1.fc39.aarch64.rpm
```

**Spec File (watchnexus.spec):**
```spec
Name:           watchnexus
Version:        2.5.5
Release:        1%{?dist}
Summary:        Unified Media Pipeline

License:        AGPL-3.0
URL:            https://github.com/yourname/watchnexus
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  python3-devel
Requires:       python3 >= 3.9
Requires:       ffmpeg
Recommends:     chromaprint

%description
WatchNexus is a self-hosted media streaming platform
that combines media acquisition, organization, and playback.

%prep
%setup -q

%install
mkdir -p %{buildroot}/usr/lib/watchnexus
cp -r * %{buildroot}/usr/lib/watchnexus/

%files
/usr/lib/watchnexus/*
/usr/bin/watchnexus

%changelog
* Mon Feb 24 2026 Your Name <your@email.com> - 2.5.5-1
- Initial RPM release
```

**Build Command:**
```bash
rpmbuild -ba watchnexus.spec
```

### 3.4 AUR Package (Arch Linux)

**Target:** Arch Linux, Manjaro, EndeavourOS, Garuda

**PKGBUILD:**
```bash
# Maintainer: Your Name <your@email.com>
pkgname=watchnexus
pkgver=2.5.5
pkgrel=1
pkgdesc="Unified Media Pipeline - Self-hosted media streaming"
arch=('x86_64' 'aarch64')
url="https://github.com/yourname/watchnexus"
license=('AGPL3')
depends=('python' 'python-pip' 'ffmpeg')
optdepends=('chromaprint: audio fingerprinting')
makedepends=('git' 'python-build' 'python-installer' 'python-wheel')
source=("git+https://github.com/yourname/watchnexus.git#tag=v$pkgver")
sha256sums=('SKIP')

build() {
    cd "$srcdir/$pkgname"
    python -m build --wheel --no-isolation
}

package() {
    cd "$srcdir/$pkgname"
    python -m installer --destdir="$pkgdir" dist/*.whl
    
    # Install systemd service
    install -Dm644 watchnexus.service \
        "$pkgdir/usr/lib/systemd/system/watchnexus.service"
    
    # Install desktop file
    install -Dm644 watchnexus.desktop \
        "$pkgdir/usr/share/applications/watchnexus.desktop"
}
```

**AUR Submission:**
1. Create account on aur.archlinux.org
2. Create new package repository
3. Push PKGBUILD and .SRCINFO
4. Users install via: `yay -S watchnexus` or `paru -S watchnexus`

---

## 4. Build Matrix

| Platform | Architecture | Format | Priority |
|----------|-------------|--------|----------|
| Windows 10/11 | x64 | .exe (installer) | P0 |
| Windows 10/11 | x64 | .zip (portable) | P1 |
| macOS (Apple Silicon) | arm64 | .dmg | P0 |
| macOS (Intel) | x64 | .dmg | P1 |
| macOS (Universal) | universal | .dmg | P2 |
| Linux (Universal) | x64 | AppImage | P0 |
| Linux (Universal) | arm64 | AppImage | P0 |
| Debian/Ubuntu | x64 | .deb | P0 |
| Debian/Ubuntu | arm64 | .deb | P1 |
| Fedora/RHEL | x64 | .rpm | P1 |
| Arch Linux | any | AUR | P1 |

---

## 5. CI/CD Build Pipeline

### GitHub Actions Workflow

```yaml
name: Build All Platforms

on:
  release:
    types: [published]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Windows Executable
        run: |
          pip install pyinstaller
          pyinstaller --onefile watchnexus.spec
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows-build
          path: dist/*.exe

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build macOS App
        run: |
          pip install py2app
          python setup.py py2app
      - name: Sign and Notarize
        run: ./scripts/sign-macos.sh
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: macos-build
          path: dist/*.dmg

  build-linux:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        arch: [x86_64, aarch64]
    steps:
      - uses: actions/checkout@v4
      - name: Build AppImage
        run: ./scripts/build-appimage.sh ${{ matrix.arch }}
      - name: Build DEB
        run: ./scripts/build-deb.sh ${{ matrix.arch }}
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-${{ matrix.arch }}-build
          path: dist/*
```

---

## 6. Version Support Matrix

### Windows
| Version | Support Status |
|---------|---------------|
| Windows 11 | ✅ Full Support |
| Windows 10 (21H2+) | ✅ Full Support |
| Windows 10 (older) | ⚠️ Best Effort |
| Windows 8.1 | ❌ Not Supported |

### macOS
| Version | Support Status |
|---------|---------------|
| Sequoia (15) | ✅ Full Support |
| Sonoma (14) | ✅ Full Support |
| Ventura (13) | ✅ Full Support |
| Monterey (12) | ⚠️ Legacy Support |
| Big Sur (11) | ❌ Not Supported |

### Linux
| Distribution | Support Status |
|-------------|---------------|
| Ubuntu 22.04+ | ✅ Full Support |
| Ubuntu 20.04 | ⚠️ Legacy Support |
| Debian 11+ | ✅ Full Support |
| Fedora 38+ | ✅ Full Support |
| Arch Linux | ✅ Full Support |
| Any with glibc 2.17+ | ✅ Via AppImage |

---

## 7. FFmpeg Bundling Strategy

### Option A: Bundle FFmpeg (Recommended for Desktop)
- Include FFmpeg binaries in the package
- Increases package size (~100MB)
- Zero external dependencies
- Best user experience

### Option B: System FFmpeg (Recommended for Linux packages)
- Declare as package dependency
- Smaller package size
- Uses system updates for FFmpeg
- May have version mismatches

### Option C: Auto-Download (Hybrid)
- Check for system FFmpeg
- If missing, download appropriate version
- Best of both worlds
- Requires internet on first run

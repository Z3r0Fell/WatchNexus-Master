# WatchNexus - Unified Media Pipeline

<p align="center">
  <img src="frontend/public/watchnexus-logo.svg" alt="WatchNexus Logo" width="400">
</p>

<p align="center">
  <strong>One app to rule them all - Request, acquire, organize, and watch media without needing multiple applications.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-cross-platform">Cross-Platform</a> •
  <a href="#-architecture">Architecture</a>
</p>

---

## 🎯 What is WatchNexus?

WatchNexus is a **self-hosted, unified media pipeline** that replaces the need for multiple applications:

| Instead of... | WatchNexus Has... |
|---------------|-------------------|
| Sonarr/Radarr | Built-in request system |
| Prowlarr | **Compote** - Indexer manager |
| qBittorrent | **Built-in Torrent Engine** |
| Bazarr | Subtitle management |
| Jellyfin | **Marmalade** - Media server |

### The Preserve Theme 🍊🍇
All components are named after fruit preserves:
- **Marmalade** - Media Server (streams your content)
- **Compote** - Indexer Manager (finds your content)
- Built-in Torrent Engine (downloads your content)

---

## ✨ Key Features

### 🔒 No External Dependencies
- **Built-in Torrent Engine** - No qBittorrent, no Transmission
- **libtorrent-powered** - Fast, reliable, cross-platform
- **Sequential download** - Stream while downloading

### 📦 Cross-Platform Desktop App
- **Windows 10/11** - NSIS installer + portable
- **macOS** - Universal binary (Intel + Apple Silicon)
- **Linux** - AppImage, .deb, .rpm

### 🎬 Complete Media Experience
- TMDB integration for metadata
- Beautiful glassmorphism UI
- Video player with subtitles
- Library management
- Health checking & repair

### 🔐 Authentication
- Email/password (JWT)
- Google OAuth integration
- Multi-user support

---

## 🚀 Quick Start

### Web Mode (Development)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend
cd frontend
yarn install
yarn start
```

### Desktop Mode

```bash
# Build backend
cd backend
pip install pyinstaller
pyinstaller watchnexus.spec

# Build desktop app
cd frontend
yarn electron:build:linux    # Linux AppImage
yarn electron:build:mac      # macOS .dmg
yarn electron:build:win      # Windows .exe
```

See [BUILD_GUIDE.md](BUILD_GUIDE.md) for detailed instructions.

---

## 🏗️ Architecture

```
WatchNexus/
├── frontend/                   # React + Electron
│   ├── electron/               # Desktop app shell
│   │   ├── main.js             # Main process
│   │   └── preload.js          # IPC bridge
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.js    # Home page
│   │   │   ├── LibraryPage.js  # Media browser
│   │   │   ├── DownloadsPage.js # Download manager
│   │   │   └── SettingsPage.js # Configuration
│   │   └── components/
│   │       └── VideoPlayer.jsx # HTML5 player
│
├── backend/                    # FastAPI server
│   ├── server.py               # Main API
│   ├── torrent_engine.py       # Built-in downloader
│   ├── compote.py              # Indexer manager
│   ├── media_health_checker.py # File validation
│   └── qbittorrent_client.py   # Legacy client (optional)
│
└── watchnexus/                 # Marmalade server
    └── (Jellyfin fork)         # Media streaming
```

---

## 🔌 API Endpoints

### Downloads - Built-in Engine
```
GET  /api/downloads/engine/status     # Engine status
GET  /api/downloads/engine/torrents   # List all
POST /api/downloads/engine/add        # Add magnet
POST /api/downloads/engine/{id}/pause # Pause
POST /api/downloads/engine/{id}/resume # Resume
DELETE /api/downloads/engine/{id}     # Remove
```

### Compote - Indexer Manager
```
GET  /api/compote/indexers            # List indexers
POST /api/compote/indexers            # Add indexer
GET  /api/compote/search              # Search
POST /api/compote/grab                # Download release
```

### Media Health
```
POST /api/media/health-check          # Check file
POST /api/media/repair                # Fix file
GET  /api/media/scheduled-scans       # List scans
POST /api/media/redownload            # Re-acquire
```

---

## 💻 Cross-Platform Support

### Windows
- **Windows 10** (1903+)
- **Windows 11**
- Installer + Portable versions
- Runs as tray application

### macOS
- **Intel Macs** (x64)
- **Apple Silicon** (M1/M2/M3)
- Signed and notarized
- Menu bar integration

### Linux
- **AppImage** (universal)
- **.deb** (Debian/Ubuntu)
- **.rpm** (Fedora/RHEL)
- System tray support

---

## 📋 Status

| Feature | Status |
|---------|--------|
| Custom React UI | ✅ Complete |
| TMDB Discovery | ✅ Complete |
| Authentication | ✅ Complete |
| Media Health Checker | ✅ Complete |
| Compote (Indexers) | ✅ Complete |
| **Built-in Torrent Engine** | ✅ Complete |
| Video Player | ✅ Complete |
| Library UI | ✅ Complete |
| **Desktop Packaging** | ✅ Ready |
| Marmalade Server | 🟡 Needs .NET |
| IPTV Integration | 🔵 Planned |
| Streaming Services | 🔵 Planned |

---

## 🗺️ Roadmap

### v1.0 - Core ✅
- [x] Built-in torrent engine
- [x] Cross-platform packaging
- [x] Settings UI
- [x] Download management

### v1.1 - Media
- [ ] Video player + Marmalade
- [ ] Subtitle auto-download
- [ ] Watch history

### v1.2 - Integration
- [ ] IPTV support
- [ ] Streaming service logins
- [ ] Mobile apps

---

## 📄 License

GNU General Public License v2.0

---

## 🙏 Acknowledgments

- [libtorrent](https://libtorrent.org/) - Torrent library
- [Jellyfin](https://jellyfin.org/) - Marmalade foundation
- [TMDB](https://themoviedb.org/) - Metadata
- [Electron](https://electronjs.org/) - Desktop framework

---

<p align="center">
  <strong>WatchNexus</strong> - Your Media, Your Way
</p>

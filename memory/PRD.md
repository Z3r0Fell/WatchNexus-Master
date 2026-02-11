# WatchNexus - Product Requirements Document

## Project Status: ALPHA → BETA

Last Updated: February 2026

---

## Vision

A **single, self-contained application** that handles all media management tasks:
- Request content
- Find sources (Compote)
- Download content (Built-in Torrent Engine)
- Organize library (Marmalade)
- Watch content (Video Player)

**No external applications required.**

---

## The Preserve Theme 🍊🍇

- **Marmalade** = Media Server (Jellyfin fork)
- **Compote** = Indexer Manager (finds content)
- **Built-in Torrent Engine** = Downloads (replaces qBittorrent)

---

## Implemented Features

### Core UI
- [x] React frontend with glassmorphism design
- [x] Responsive sidebar navigation
- [x] TMDB discovery (movies, TV, search)
- [x] Watchlist functionality
- [x] **Video Player** - Custom HTML5 with controls
- [x] **Library Page** - Browse local media
- [x] **Settings Page** - All configuration tabs

### Authentication
- [x] JWT-based email/password login
- [x] User registration
- [x] Google OAuth (Emergent Auth)
- [x] Session management

### Media Health System
- [x] File health checking (FFprobe)
- [x] Container/codec validation
- [x] File repair (FFmpeg remux, faststart)
- [x] Scheduled scans (daily/weekly/monthly)
- [x] Scan notifications
- [x] Re-download queueing

### Compote - Indexer Manager
- [x] Torznab/Newznab protocol support
- [x] Multi-indexer concurrent search
- [x] Quality/codec parsing
- [x] Grab/download queueing
- [x] Default indexer configurations

### Built-in Torrent Engine (NEW)
- [x] libtorrent-based implementation
- [x] Magnet link support
- [x] .torrent file support
- [x] Sequential download (stream while downloading)
- [x] DHT, PEX, LSD support
- [x] Bandwidth management
- [x] Progress tracking
- [x] File priority selection
- [x] Pause/resume/remove operations
- [x] **Comprehensive Settings UI:**
  - Queue Management (max active downloads/uploads/torrents)
  - Speed Limits (download/upload rate caps)
  - Seeding Limits (ratio & time limits with configurable action)
  - Auto-Cleanup (remove after completion/seeding, max completed)
  - Connection Settings (global/per-torrent limits)
  - Network toggles (DHT, PEX, LSD)
  - Behavior options (sequential default, add paused)

### Cross-Platform Desktop (NEW)
- [x] Electron packaging ready
- [x] Windows 10/11 support
- [x] macOS Intel & Apple Silicon
- [x] Linux AppImage support
- [x] Portable mode

---

## API Endpoints

### Auth
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/google/session
POST /api/auth/logout
```

### Compote (Indexers)
```
GET  /api/compote/indexers
POST /api/compote/indexers
DELETE /api/compote/indexers/{id}
POST /api/compote/indexers/{id}/test
GET  /api/compote/search
POST /api/compote/grab
```

### Built-in Torrent Engine (NEW)
```
GET  /api/downloads/engine/status
GET  /api/downloads/engine/torrents
POST /api/downloads/engine/add
GET  /api/downloads/engine/{id}
GET  /api/downloads/engine/{id}/files
POST /api/downloads/engine/{id}/pause
POST /api/downloads/engine/{id}/resume
DELETE /api/downloads/engine/{id}
POST /api/downloads/engine/{id}/sequential
PUT  /api/downloads/engine/settings
```

### Media Health
```
POST /api/media/health-check
POST /api/media/repair
POST /api/media/scan-library
GET/POST/PUT/DELETE /api/media/scheduled-scans
GET/PUT/DELETE /api/media/notifications
POST /api/media/redownload
```

### Marmalade Proxy
```
* /api/marmalade/{path}
```

### qBittorrent (Legacy)
```
GET  /api/qbittorrent/status
GET  /api/qbittorrent/torrents
POST /api/qbittorrent/add
...
```

---

## File Structure

```
/app/
├── frontend/
│   ├── electron/                  # Desktop app (NEW)
│   │   ├── main.js                # Electron main process
│   │   ├── preload.js             # IPC bridge
│   │   └── entitlements.mac.plist # macOS permissions
│   ├── electron-builder.yml       # Build config (NEW)
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.js
│       │   ├── LibraryPage.js
│       │   ├── DownloadsPage.js   # Updated for built-in engine
│       │   └── SettingsPage.js    # Updated with engine config
│       ├── components/
│       │   └── VideoPlayer.jsx
│       └── services/
│           └── api.js             # Updated with torrentEngineApi
│
├── backend/
│   ├── server.py                  # Main FastAPI app
│   ├── torrent_engine.py          # NEW - Built-in downloader
│   ├── compote.py                 # Indexer manager
│   ├── media_health_checker.py    # File validation
│   └── qbittorrent_client.py      # Legacy (optional)
│
├── BUILD_GUIDE.md                 # NEW - Cross-platform build guide
└── README.md                      # Updated
```

---

## Pending Tasks

### P0 - Critical
- [ ] Test torrent engine with real magnet links
- [ ] Connect Compote search → Built-in Engine
- [ ] Verify all Settings tabs work

### P1 - Important
- [ ] Marmalade server (.NET runtime needed)
- [ ] Video player integration with Marmalade
- [ ] Subtitle auto-download

### P2 - Enhancement
- [ ] IPTV integration
- [ ] Streaming service logins
- [ ] UI animations (framer-motion)
- [ ] Rename /app/watchnexus → /app/marmalade

---

## Test Credentials

- Email: test@test.com
- Password: password
- Google OAuth available

---

## Tech Stack

- **Frontend**: React, Tailwind CSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI, Python 3.10+
- **Database**: MongoDB
- **Torrent**: libtorrent 2.0
- **Desktop**: Electron 28+
- **Media**: FFmpeg, FFprobe

---

## Build Commands

```bash
# Web Development
cd frontend && yarn start
cd backend && uvicorn server:app --port 8001

# Desktop Build
yarn electron:build:mac      # macOS
yarn electron:build:win      # Windows
yarn electron:build:linux    # Linux AppImage
```

---

## Changelog

### 2026-02-11
- Added built-in torrent engine (libtorrent)
- Created cross-platform desktop packaging (Electron)
- Updated DownloadsPage for built-in engine
- Updated SettingsPage with engine configuration
- Created BUILD_GUIDE.md
- Updated README.md with new architecture

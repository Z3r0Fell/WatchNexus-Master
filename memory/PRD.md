# WatchNexus - Product Requirements Document

## Project Status: BETA

Last Updated: December 2025

---

## Vision

A **single, self-contained application** that handles all media management tasks:
- Request content
- Find sources (Compote)
- Download content (Built-in Torrent Engine)
- Organize library (Marmalade - Python-based)
- Watch content (Video Player)

**No external applications required.**

---

## The Preserve Theme 🍊🍇

- **Marmalade** = Media Server (Python-based, self-contained)
- **Compote** = Indexer Manager (finds content, supports Cloudflare bypass)
- **Built-in Torrent Engine** = Downloads (replaces qBittorrent)

---

## Implemented Features

### Core UI
- [x] React frontend with glassmorphism design
- [x] Responsive sidebar navigation
- [x] TMDB discovery (movies, TV, search)
- [x] Watchlist functionality
- [x] **Video Player** - Custom HTML5 with controls
- [x] **Library Page** - Browse local media (integrated with Marmalade)
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

### Compote - Indexer Manager (ENHANCED - Dec 2025)
- [x] Torznab/Newznab protocol support
- [x] **RSS Feed support (NEW)**
- [x] **Cloudflare bypass support (NEW)**
- [x] Multi-indexer concurrent search
- [x] Quality/codec parsing
- [x] Grab/download queueing
- [x] **Enhanced Settings UI (NEW):**
  - Quick Add presets (Jackett, Prowlarr, RSS)
  - Add indexer form with all options
  - Test connectivity button
  - Cloudflare Protected toggle
  - Setup guides for each indexer type

### Marmalade - Media Server (NEW - Dec 2025)
- [x] **Python-based implementation (replaced .NET)**
- [x] Library management (add/remove/scan)
- [x] Media file scanning with metadata extraction
- [x] Filename parsing (title, year, season, episode, quality)
- [x] Continue watching tracking
- [x] Video streaming endpoint

### Built-in Torrent Engine
- [x] libtorrent-based implementation
- [x] Magnet link support
- [x] .torrent file support
- [x] Sequential download (stream while downloading)
- [x] DHT, PEX, LSD support
- [x] Bandwidth management
- [x] Progress tracking
- [x] **Comprehensive Settings UI**

### Cross-Platform Desktop
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

### Compote (Indexers) - UPDATED
```
GET  /api/compote/indexers
GET  /api/compote/indexer-types      # NEW - types info
GET  /api/compote/setup-guide        # NEW - setup guides
GET  /api/compote/default-indexers   # NEW - preset indexers
POST /api/compote/indexers
PUT  /api/compote/indexers/{id}      # NEW - update indexer
DELETE /api/compote/indexers/{id}
POST /api/compote/indexers/{id}/test
GET  /api/compote/search
POST /api/compote/grab
```

### Marmalade (Media Server) - NEW
```
GET  /api/marmalade/status
GET  /api/marmalade/libraries
POST /api/marmalade/libraries
DELETE /api/marmalade/libraries/{id}
POST /api/marmalade/libraries/{id}/scan
GET  /api/marmalade/media
GET  /api/marmalade/media/recent
GET  /api/marmalade/media/search
GET  /api/marmalade/media/{id}
POST /api/marmalade/media/{id}/progress
POST /api/marmalade/media/{id}/watched
GET  /api/marmalade/continue-watching
GET  /api/marmalade/stream/{id}
```

### Built-in Torrent Engine
```
GET  /api/downloads/engine/status
GET  /api/downloads/engine/torrents
POST /api/downloads/engine/add
GET  /api/downloads/engine/{id}
...
```

### Media Health
```
POST /api/media/health-check
POST /api/media/repair
POST /api/media/scan-library
GET/POST/PUT/DELETE /api/media/scheduled-scans
...
```

---

## Pending Tasks

### P1 - Important
- [ ] Direct magnet link pastebox on Downloads page
- [ ] UI animations (framer-motion page transitions)
- [ ] Use SVG logo instead of PNG
- [ ] Connect Compote to live indexers (not just demo)

### P2 - Enhancement
- [ ] Full IPTV integration (.m3u playlists, EPG)
- [ ] Streaming service logins
- [ ] Subtitle auto-download (OpenSubtitles)
- [ ] Cleanup obsolete .NET code in /app/watchnexus

### P3 - Nice to Have
- [ ] Mobile responsive improvements
- [ ] Dark/Light theme toggle
- [ ] Notification center

---

## Completed This Session (Dec 2025)

1. ✅ **Python Marmalade Server** - Replaced broken .NET server with full Python implementation
2. ✅ **Compote RSS Support** - Added RSS feed parsing with magnet link extraction
3. ✅ **Cloudflare Bypass** - Implemented FlareSolverr support and cookie persistence
4. ✅ **Enhanced Indexers UI** - Complete settings page with guides and quick-add
5. ✅ **Route Ordering Fix** - Fixed /marmalade/media endpoints
6. ✅ **83 Backend Tests** - Full test coverage for new features

---

## Test Credentials
- Email: test@test.com
- Password: password

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

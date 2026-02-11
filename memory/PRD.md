# WatchNexus - Product Requirements Document

## Project Status: BETA

Last Updated: December 2025

---

## Vision

A **single, self-contained application** that handles all media management tasks:
- Request content
- Find sources (Compote + Syrup)
- Download content (Built-in Torrent Engine)
- Organize library (Marmalade)
- Watch content (Video Player)

**No external applications required.** All functionality is built-in.

---

## The Preserve Theme 🍊🍇

WatchNexus uses a jam/preserve naming theme for its built-in modules:

- **Marmalade** = Media Server (Python-based library manager & streamer)
- **Compote** = Indexer Manager (orchestrates all indexer types)
- **Syrup** = Torrent Aggregator (scrapes and parses torrent sites)
- **Preserve** = Challenge Solver (Cloudflare and protection bypass)
- **Pulp** = NZB/Usenet Handler (Newznab API support)
- **Built-in Torrent Engine** = Downloads (libtorrent-based)

---

## Implemented Features

### Core UI
- [x] React frontend with glassmorphism design
- [x] Responsive sidebar navigation
- [x] TMDB discovery (movies, TV, search)
- [x] Watchlist functionality
- [x] **Video Player** - Custom HTML5 with controls
- [x] **Library Page** - Browse local media (via Marmalade)
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

### Compote - Indexer Manager (ENHANCED - Dec 2025)
- [x] **Syrup** - Built-in torrent aggregator (no external apps)
- [x] **Preserve** - Built-in Cloudflare/challenge solver
- [x] **Pulp** - Built-in NZB/Usenet handler
- [x] RSS Feed parsing with magnet extraction
- [x] Multi-indexer concurrent search
- [x] Quality/codec parsing from filenames
- [x] Quick-add presets (1337x, YTS, EZTV, Nyaa, ShowRSS)
- [x] Setup guides for each built-in module

### Marmalade - Media Server (NEW - Dec 2025)
- [x] Python-based implementation (fully self-contained)
- [x] Library management (add/remove/scan)
- [x] Media file scanning with metadata extraction
- [x] Filename parsing (title, year, season, episode, quality)
- [x] Continue watching tracking
- [x] Video streaming endpoint

### Built-in Torrent Engine
- [x] libtorrent-based implementation
- [x] Magnet link and .torrent file support
- [x] Sequential download (stream while downloading)
- [x] DHT, PEX, LSD support
- [x] Comprehensive Settings UI

### Cross-Platform Desktop
- [x] Electron packaging ready
- [x] Windows 10/11, macOS, Linux support

---

## Pending Tasks

### P1 - Important
- [ ] Direct magnet link pastebox on Downloads page
- [ ] UI animations (framer-motion page transitions)
- [ ] Use SVG logo instead of PNG
- [ ] Connect Syrup to actual site scraping (currently demo)

### P2 - Enhancement
- [ ] Full IPTV integration (.m3u playlists, EPG)
- [ ] Streaming service logins
- [ ] Subtitle auto-download (OpenSubtitles)
- [ ] Cleanup obsolete /app/watchnexus .NET code

---

## Completed This Session (Dec 2025)

1. ✅ **Python Marmalade Server** - Full media server implementation
2. ✅ **Syrup Module** - Built-in torrent aggregator replacing Jackett/Prowlarr
3. ✅ **Preserve Module** - Built-in Cloudflare bypass replacing FlareSolverr
4. ✅ **Pulp Module** - Built-in NZB handler replacing external usenet apps
5. ✅ **Removed "Made with Emergent" badge** from UI
6. ✅ **Removed all external app references** (Jackett, Prowlarr, FlareSolverr, etc.)
7. ✅ **Updated UI** with new module names and quick-add presets
8. ✅ **83 Backend Tests** passing

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

# WatchNexus - Product Requirements Document

## Project Status: BETA

Last Updated: December 2025

---

## Vision

A **single, self-contained application** that handles all media management tasks:
- Request content
- Find sources (Compote + Syrup scrapers)
- Download content (Built-in Torrent Engine)
- Organize library (Marmalade)
- Watch content (Video Player)

**No external applications required.** All functionality is built-in.

---

## The Preserve Theme 🍊🍇

WatchNexus uses a jam/preserve naming theme for its built-in modules:

- **Marmalade** = Media Server (Python-based library manager & streamer)
- **Compote** = Indexer Manager (orchestrates all indexer types)
- **Syrup** = Torrent Scraper Engine (YTS, EZTV, 1337x, Nyaa scrapers)
- **Preserve** = Challenge Solver (Cloudflare and protection bypass)
- **Pulp** = NZB/Usenet Handler (Newznab API support)
- **Built-in Torrent Engine** = Downloads (libtorrent-based)

---

## Implemented Features

### Core UI
- [x] React frontend with glassmorphism design
- [x] **Framer-motion animations** (page transitions, list animations)
- [x] Responsive sidebar navigation
- [x] TMDB discovery (movies, TV, search)
- [x] Watchlist functionality
- [x] **Video Player** - Custom HTML5 with controls
- [x] **Library Page** - Browse local media (via Marmalade)
- [x] **Settings Page** - All configuration tabs

### New Features (Dec 2025)
- [x] **Magnet Link Pastebox** - Direct magnet submission on Downloads page
- [x] **Library Tab** in Settings - Add/manage multiple drives and folders
- [x] **Syrup Scrapers** - Built-in site scrapers (YTS, EZTV, 1337x, Nyaa)
- [x] **UI Animations** - Page transitions, list staggering, hover effects

### Authentication
- [x] JWT-based email/password login
- [x] User registration
- [x] Google OAuth (Emergent Auth)
- [x] Session management

### Compote - Indexer Manager
- [x] **Syrup** - Built-in torrent aggregator with site scrapers
- [x] **Preserve** - Built-in Cloudflare/challenge solver
- [x] **Pulp** - Built-in NZB/Usenet handler
- [x] RSS Feed parsing with magnet extraction
- [x] Multi-indexer concurrent search
- [x] Quality/codec parsing from filenames
- [x] Quick-add presets (1337x, YTS, EZTV, Nyaa, ShowRSS)

### Marmalade - Media Server
- [x] Python-based implementation (fully self-contained)
- [x] **Multi-library support** (movies, TV, anime, music, audiobooks)
- [x] Library management UI in Settings
- [x] Media file scanning with metadata extraction
- [x] Filename parsing (title, year, season, episode, quality)
- [x] Video streaming endpoint

### Built-in Torrent Engine
- [x] libtorrent-based implementation
- [x] **Direct magnet link submission UI**
- [x] Magnet link and .torrent file support
- [x] Sequential download (stream while downloading)
- [x] Comprehensive Settings UI

---

## API Endpoints

### New Endpoints
```
GET  /api/syrup/scrapers          # List available scrapers
GET  /api/syrup/search            # Search using live scrapers
POST /api/downloads/add-magnet    # Direct magnet submission
```

### Marmalade (Media Server)
```
GET  /api/marmalade/libraries
POST /api/marmalade/libraries
DELETE /api/marmalade/libraries/{id}
POST /api/marmalade/libraries/{id}/scan
GET  /api/marmalade/media
GET  /api/marmalade/stream/{id}
```

---

## Pending Tasks

### P1 - Important
- [ ] Use SVG logo instead of PNG
- [ ] Fix Syrup scrapers (site access blocked in preview env, works locally)
- [ ] Subtitle auto-download integration

### P2 - Enhancement
- [ ] Full IPTV integration (.m3u playlists, EPG)
- [ ] Streaming service logins
- [ ] Delete obsolete /app/watchnexus .NET code

---

## Completed This Session (Dec 2025)

1. ✅ **Syrup Scrapers** - Built-in site scrapers for YTS, EZTV, 1337x, Nyaa
2. ✅ **Magnet Link Pastebox** - Direct magnet submission on Downloads page
3. ✅ **UI Animations** - Page transitions, list stagger, hover effects
4. ✅ **Library Tab** - Full UI for managing multiple media libraries/drives
5. ✅ **Preserve/Pulp modules** - Built-in CF bypass and NZB handling
6. ✅ **Removed Emergent badge** and all external app references

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

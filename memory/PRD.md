# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single application handling requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.6

## Core Architecture
- **Backend:** FastAPI + SQLite (aiosqlite)
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Media Engine:** Marmalade (library scanning/streaming)
- **Download Engine:** Fondue (built-in torrent engine)
- **Plugins:** Gadgets system (extensible plugin architecture)
- **Clients:** Android, AndroidTV, Firestick, Roku, Kodi
- **Tray App:** Beacon (system tray server management)
- **Updater:** Tiramisu (auto-update system)

## Completed Features (v2.5.6)
- [x] Movies page - Dual Library/Discover view with local + TMDB content
- [x] TV Shows page - Dual Library/Discover view with series grouping
- [x] Anime page - Distinct category with anime-specific styling
- [x] Gadgets Catalogue - 45 built-in extensions across 16 categories
- [x] Banner pack integration for Docker/Unraid/dashboard
- [x] Full theming system (light/dark modes + custom themes)
- [x] Credits section
- [x] Security hardening (auth on streaming endpoints)
- [x] Music & Audiobooks library pages
- [x] Download queue with built-in torrent engine
- [x] Plugin marketplace with Kodi addon converter
- [x] Quality profiles
- [x] Playback controls (skip intro/credits)
- [x] Who's Watching profile selector
- [x] System tray app
- [x] Auto-updater
- [x] Cloud sync plan (Marshmallow)
- [x] v2.5.6 release packages (12 zips)

## Pending Issues
- P0: Library scanning returns no results (needs user testing on local machine)
- P3: visual-edits babel plugin disabled (stack overflow error)

## Backlog / Future Tasks
- P1: Cloud Sync implementation (Marshmallow)
- P2: Fortress Code Protection (Cython + dual licensing)
- P2: Docker/Raspberry Pi distribution (Harbor plan)
- P3: FFmpeg replacement investigation (Project Echo/Crucible)
- P3: Proper Android APK builds with SDK
- P3: Real-world indexer/downloader testing

## Key API Endpoints
- `/api/auth/login` - JWT authentication
- `/api/marmalade/*` - Media library operations
- `/api/gadgets/*` - Plugin management
- `/api/gadgets/catalogue/*` - Built-in gadgets catalogue
- `/api/downloads/engine/*` - Download engine operations
- `/api/compote/*` - Indexer search
- `/api/kodi/*` - Kodi addon browser

## File Structure
```
/app/separated/          # Canonical source
  server/                # Backend (FastAPI)
  web/                   # Frontend (React)
  clients/               # Platform clients
  tools/                 # Tray app + updater
  docs/                  # Documentation
  assets/banners/        # Container banners
  releases/v2.5.6/       # Release packages
```

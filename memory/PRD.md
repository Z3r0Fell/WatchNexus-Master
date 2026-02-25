# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.6

## Core Architecture
- **Backend:** FastAPI + SQLite (aiosqlite)
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Media Engine:** Marmalade (library scanning/streaming)
- **Download Engine:** Fondue (built-in torrent engine)
- **Extensions:** Gadgets system (45 built-in + extensible)
- **Clients:** Android, AndroidTV, Firestick, Roku, Kodi
- **Tray App:** Beacon (system tray server management)
- **Updater:** Tiramisu (auto-update system)

## Completed Features (v2.5.6)
- [x] Movies page - Dual Library/Discover view (local + TMDB)
- [x] TV Shows page - Dual Library/Discover view with series grouping
- [x] Anime page - Distinct category with anime styling + Library/Discover
- [x] Gadgets Catalogue - 45 unique extensions across 16 categories
  - Metadata Providers (6): Atlas, Chronicle, Sakura, Vinyl, Almanac, Lexicon
  - Subtitle Services (4): Babel, Quill, Verse, Echo
  - Notification Services (5): Herald, Courier, Signal, Dispatch, Beacon
  - Visual Themes (4): Obsidian, Arctic, Sakura Bloom, Retro CRT
  - Video Extensions (4): Prism IPTV, Mosaic, Meridian, Archive
  - Audio Extensions (3): Cadence Radio, Rhythm Podcast, Sonata Lyrics
  - Indexer Connectors (3): Compass, Scope, Rover
  - System Tools (4): Sentinel, Vault, Curator, Warden
  - + 8 more categories (Image, Game, Screensaver, Weather, Program, Service, Context, Resource)
- [x] "Plugins" renamed to "Gadgets" throughout the app
- [x] Banner pack integrated for Docker/Unraid/dashboard
- [x] Full theming system (light/dark modes + custom themes)
- [x] Music & Audiobooks library pages
- [x] Download queue with built-in torrent engine
- [x] Quality profiles, Playback controls, Who's Watching
- [x] System tray app, Auto-updater
- [x] v2.5.6 release packages (12 zips in /app/separated/releases/v2.5.6/)

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
- `/api/gadgets/*` - Extension management
- `/api/gadgets/catalogue/*` - Built-in gadgets catalogue (search, categories)
- `/api/downloads/engine/*` - Download engine operations
- `/api/compote/*` - Indexer search

## File Structure
```
/app/separated/
  server/               # Backend (FastAPI)
  web/                  # Frontend (React)
  clients/              # Platform clients
  tools/                # Tray app + updater
  docs/                 # Documentation
  assets/banners/       # Container banners
  releases/v2.5.6/      # Release packages (12 zips)
```

## Test Credentials
- Email: test@test.com
- Password: password

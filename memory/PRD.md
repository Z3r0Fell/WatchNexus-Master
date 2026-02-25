# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.6

## Core Architecture
- **Backend:** FastAPI + SQLite (aiosqlite)
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Media Engine:** Marmalade (library scanning/streaming)
- **Download Engine:** Fondue (built-in torrent engine)
- **Gadget Engine:** Ripen (lifecycle management for extensions)
- **Extensions:** 45 built-in Gadgets across 16 categories
- **Clients:** Android, AndroidTV, Firestick, Roku, Kodi
- **Tray App:** Beacon (system tray server management)
- **Updater:** Tiramisu (auto-update system)

## Ripen - Gadget Lifecycle Engine (Codename: Ripen)
The Ripen engine manages the full lifecycle of WatchNexus gadgets:
- **Install** → Gadget registered in DB, hooks activated
- **Activate/Deactivate** → Toggle without removing
- **Uninstall** → Clean removal from DB and UI
- **UI Hooks:** sidebar entries, routes/pages, settings panels, dashboard widgets, theme presets, providers

### Gadget Types & What They Do:
- **Page-creating:** Games, Photos, Radio, Podcasts, Web Video → add sidebar entry + new page
- **Settings-panel:** Metadata, Subtitle, Notification, Indexer providers → add config in Settings
- **Theme:** Obsidian, Arctic, Sakura Bloom, Retro CRT → register new theme presets
- **Background:** Watchdog, Scheduler, Backup → system-level services
- **Enhancement:** Lyrics, Trakt, IPTV → enhance existing pages

### API Endpoints:
- `GET /api/ripen/installed` - All installed gadgets with hooks
- `GET /api/ripen/hooks` - Aggregated UI hooks from active gadgets
- `POST /api/ripen/install/{gadget_id}` - Install from catalogue
- `DELETE /api/ripen/uninstall/{gadget_id}` - Remove gadget
- `POST /api/ripen/activate/{gadget_id}` - Activate
- `POST /api/ripen/deactivate/{gadget_id}` - Deactivate

## Completed Features (v2.5.6)
- [x] Ripen Gadget Lifecycle Engine (install/uninstall/activate/deactivate)
- [x] Dynamic sidebar entries (appear when gadgets installed)
- [x] 5 Gadget pages: Games, Photos, Radio, Podcasts, Web Video
- [x] Gadgets Catalogue with 45 extensions across 16 categories
- [x] Movies page - Dual Library/Discover view
- [x] TV Shows page - Dual Library/Discover view
- [x] Anime page - Distinct category with Library/Discover
- [x] About page updated to v2.5.6 with full changelog (9 releases)
- [x] Banner pack for Docker/Unraid/dashboards
- [x] Full theming system, Security hardening, Music/Audiobooks pages
- [x] All release packages synced and zipped

## Pending Issues
- P0: Library scanning returns no results (needs user testing on local machine)
- P3: visual-edits babel plugin disabled

## Backlog / Future Tasks
- P1: Cloud Sync "Marshmallow"
- P2: Fortress Code Protection
- P2: Docker/RPi distribution (Harbor)
- P3: FFmpeg replacement (Project Echo)
- P3: Android APK builds, Real-world indexer testing

## Key Files
- `/app/backend/ripen_lifecycle.py` - Ripen engine
- `/app/backend/gadgets_catalogue.py` - 45 gadget definitions
- `/app/frontend/src/context/GadgetContext.jsx` - React context
- `/app/frontend/src/components/layout/Sidebar.js` - Dynamic sidebar
- `/app/frontend/src/pages/gadgets/*.jsx` - Gadget pages

# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.7

## Recent Changes (v2.5.7 - Feb 25, 2025)
- **Removed scaffolding:** Deleted non-functional gadget pages (Radio, Photos, Podcasts, WebVideo)
- **Gadget Compatibility UI:** Unsupported gadgets show "Coming Soon" badge instead of Install button
- **Legal & Trademarks:** Added comprehensive legal disclaimer with tabbed UI
- **Streaming Service Icons:** Replaced fake letter logos with generic Play icons to avoid copyright issues
- **About Page Redesign:** Split into tabbed interface (Overview, Release History, Credits, Legal)

## Core Architecture
- **Backend:** FastAPI + SQLite (aiosqlite)
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Media Engine:** Marmalade (library scanning/streaming)
- **Download Engine:** Fondue (built-in torrent engine)
- **Gadget Engine:** Ripen (lifecycle management for extensions)
- **Extensions:** 45 built-in Gadgets (28 supported, 17 planned)
- **Clients:** Android, AndroidTV, Firestick, Roku, Kodi
- **Tray App:** Beacon (system tray server management)
- **Updater:** Tiramisu (auto-update system)

## Ripen - Gadget Lifecycle Engine (Codename: Ripen)
The Ripen engine manages the full lifecycle of WatchNexus gadgets:
- **Install** → Gadget registered in DB, hooks activated (ONLY for supported gadgets)
- **Activate/Deactivate** → Toggle without removing
- **Uninstall** → Clean removal from DB and UI
- **UI Hooks:** sidebar entries, routes/pages, settings panels, dashboard widgets, theme presets, providers
- **Compatibility System:** Gadgets marked `supported: false` show "Coming Soon" badge, cannot be installed

### Gadget Support Status:
- **Supported (28):** Metadata providers, Subtitle providers, Themes, Indexers, System tools
- **Planned (17):** Radio, Podcasts, Photos, Games, Web Video, Notifications, Weather, Screensavers

### API Endpoints:
- `GET /api/ripen/installed` - All installed gadgets with hooks
- `GET /api/ripen/hooks` - Aggregated UI hooks from active gadgets
- `POST /api/ripen/install/{gadget_id}` - Install from catalogue (blocked for unsupported)
- `DELETE /api/ripen/uninstall/{gadget_id}` - Remove gadget
- `POST /api/ripen/activate/{gadget_id}` - Activate
- `POST /api/ripen/deactivate/{gadget_id}` - Deactivate

## Completed Features (v2.5.7 - Feb 25, 2025)
- [x] **Scaffolding Removal:** Removed dummy/non-functional gadget pages (Radio, Photos, Podcasts, WebVideo)
- [x] **Gadget Compatibility UI:** Unsupported gadgets now show "Coming Soon" instead of Install button
- [x] **Legal & Trademarks Section:** Added comprehensive legal disclaimer for third-party trademarks/logos
- [x] Ripen Gadget Lifecycle Engine (install/uninstall/activate/deactivate)
- [x] Dynamic sidebar entries (appear when gadgets installed)
- [x] Gadgets Catalogue with 45 extensions across 16 categories
- [x] Movies page - Dual Library/Discover view
- [x] TV Shows page - Dual Library/Discover view
- [x] Anime page - Distinct category with Library/Discover
- [x] About page with full changelog and Legal section
- [x] Banner pack for Docker/Unraid/dashboards
- [x] Full theming system, Security hardening, Music/Audiobooks pages

## Pending Issues
- P0: Library scanning returns no results (needs user testing on local machine)
- P3: visual-edits babel plugin disabled

## Backlog / Future Tasks
- P1: Cloud Sync "Marshmallow"
- P1: Implement functional gadgets (Radio, Podcasts, Photos when backend ready)
- P2: Fortress Code Protection
- P2: Docker/RPi distribution (Harbor)
- P3: FFmpeg replacement (Project Echo)
- P3: Android APK builds, Real-world indexer testing

## Key Files
- `/app/backend/ripen_lifecycle.py` - Ripen engine
- `/app/backend/gadgets_catalogue.py` - 45 gadget definitions with supported flag
- `/app/frontend/src/context/GadgetContext.jsx` - React context
- `/app/frontend/src/components/layout/Sidebar.js` - Dynamic sidebar
- `/app/frontend/src/components/settings/PluginsSettings.jsx` - Gadgets catalogue UI with compatibility
- `/app/frontend/src/components/settings/AboutSettings.jsx` - Legal & Trademarks section

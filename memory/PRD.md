# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.9

## Recent Changes (v2.5.9 - Feb 25, 2025)
### Watch History Management
- **X button on Continue Watching cards** - Hover to reveal, click to remove item from list
- **Watch History tab in Playback Settings** - View all watched items with progress bars
- **Clear individual items** - Remove specific items from history list
- **Clear All History** - Confirmation dialog before bulk delete (like Crunchyroll)
- **Backend APIs:** DELETE /watch-progress and /watch-progress/all endpoints

### Previous Changes (v2.5.8):
- Tabbed submenus for ALL Settings pages
- Reusable SettingsTabHeader component

### Previous Changes (v2.5.7):
- Removed non-functional gadget pages
- Added Legal & Trademarks section
- Copyright-safe streaming service icons

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

## Versioning Scheme
- **2.5.x** - Patch/minor changes (last number climbs)
- **2.6.x** - New major feature addition
- **3.x.x** - Set release (user-notified milestone)

## Releases
- `/app/releases/zips/watchnexus-v2.5.9-linux.zip` (7.3 MB)
- `/app/releases/zips/watchnexus-v2.5.9-windows.zip` (10.3 MB)

## Key New Features
### Continue Watching X Button
- Location: Dashboard > Continue Watching section
- Behavior: Hover over card to reveal X button in top-right corner
- Click to remove item from Continue Watching list
- Toast notification confirms removal

### Watch History Tab
- Location: Settings > Playback > Watch History
- Features:
  - List all watched items with thumbnails
  - Show progress bars and watched percentages
  - Remove individual items (hover to reveal X)
  - Clear All History button with confirmation

## Pending Issues
- P0: Library scanning returns no results (needs user testing on local machine)
- P3: visual-edits babel plugin disabled

## Backlog / Future Tasks
- P1: Cloud Sync "Marshmallow"
- P1: Implement functional gadgets (Radio, Podcasts, Photos when backend ready)
- P2: Fortress Code Protection
- P2: Docker/RPi distribution (Harbor)
- P3: FFmpeg replacement (Project Echo)
- P3: Android APK builds

## Key Files
- `/app/backend/VERSION` - Version number (2.5.9)
- `/app/backend/server.py` - Main server with watch-progress DELETE endpoints
- `/app/frontend/src/pages/Dashboard.js` - Continue Watching with X button
- `/app/frontend/src/components/settings/PlaybackSettings.jsx` - Watch History tab
- `/app/frontend/src/services/api.js` - progressApi with delete/clearAll methods

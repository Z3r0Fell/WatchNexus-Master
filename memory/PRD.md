# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.8

## Recent Changes (v2.5.8 - Feb 25, 2025)
### Settings UX Overhaul - Tabbed Navigation
Complete redesign of all Settings pages with consistent tabbed submenus:
- **General Settings:** Paths & Storage | Sidebar Tabs | Preferences
- **Playback Settings:** Skip Intro/Credits | Auto-Play | Detection Engine | Player Options
- **Users & Access:** User Management | Access & API | Activity Log
- **IPTV Configuration:** IPTV Sources | EPG Guide | Recording
- **Streaming Services:** Service Logins | Deep Links | Watch Tracking
- **Theme Forge:** Light/Dark Mode | Theme Presets | Custom Theme
- **Gelatin (External Access):** Server Status | Network Tunnels | Access Tokens
- **Maintenance:** System Status | Database | Cache & Services | Server Logs
- **Subtitles (Garnish):** Providers | Languages | Preferences
- **About & Releases:** Overview | Release History | Credits | Legal & Trademarks

### Previous Changes (v2.5.7):
- Removed non-functional gadget pages
- Added Legal & Trademarks section
- Replaced streaming service logos with generic Play icons

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
- `/app/releases/zips/watchnexus-v2.5.8-linux.zip`
- `/app/releases/zips/watchnexus-v2.5.8-windows.zip`

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
- `/app/backend/VERSION` - Version number (2.5.8)
- `/app/frontend/src/components/settings/SettingsTabHeader.jsx` - Reusable tab component
- `/app/frontend/src/components/settings/*.jsx` - All settings pages with tabs
- `/app/backend/ripen_lifecycle.py` - Ripen gadget engine
- `/app/backend/gadgets_catalogue.py` - 45 gadget definitions

## Completed Features (2.5.x Series)
- [x] Tabbed submenus for ALL Settings pages
- [x] Reusable SettingsTabHeader component
- [x] Scaffolding removal (non-functional gadget pages)
- [x] Gadget Compatibility System ("Coming Soon" badges)
- [x] Legal & Trademarks section
- [x] Copyright-safe streaming service icons
- [x] Ripen Gadget Lifecycle Engine
- [x] Movies, TV Shows, Anime pages with Library/Discover views
- [x] Full theming system (Milk)
- [x] Subtitle management (Garnish)
- [x] Release packages (Linux, Windows)

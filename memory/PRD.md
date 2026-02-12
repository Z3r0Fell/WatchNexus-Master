# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application.

## Core Architecture

### Frontend
- React with TailwindCSS
- Shadcn UI components
- Framer Motion animations

### Backend
- FastAPI (Python)
- MongoDB database
- Built-in torrent engine (Syrup)
- Kodi Repository Browser

---

## What's Been Implemented (December 2024)

### ✅ Core Application
- Complete React frontend with responsive design
- FastAPI backend with MongoDB
- User authentication system (local/remote detection)
- Dashboard with continue watching, activity feeds
- Movies & TV Shows library views
- Search with TMDB integration
- Comprehensive Settings page

### ✅ Login System (NEW)
- **Local/Remote Network Detection** - Detects if accessing from home network (192.168.x.x, 10.x.x.x) or remotely
- **Profile Selection** - Netflix-style "Who's Watching?" for local network users
- **Per-user profiles** - Each user has own watch progress, preferences
- Home Network = Green badge, shows profile picker
- Remote Access = Blue badge, standard login form

### ✅ Theme System
- **Built-in Themes**: Living Room, Cinema, Anime Pop, Audio Waves, Minimal, Streaming Service
- Custom theme color picker
- API endpoint working at `/api/milk/theme-forge`

### ✅ Kodi Repository Browser (NEW)
- Fetches from official Kodi repository (mirrors.kodi.tv)
- **1000+ add-ons** available
- Categories:
  - Video Add-ons (194)
  - Music Add-ons (33)
  - Scripts (185)
  - Metadata (36)
  - Services (32)
  - Skins (13)
  - Resources (174)
  - Screensavers (40)
  - Weather (8)
  - And more...
- Popular/Featured add-ons section
- Search functionality
- Addon detail modals with dependencies
- Category browsing with counts

### ✅ Media Pipeline
- Built-in torrent engine (Syrup)
- Indexer management (Compote)
- Library management (Marmalade)
- Subtitle support
- IPTV support

### ✅ Streaming & Access
- Built-in video player with transcoding
- Jellyfin-compatible API (`/api/emby/*`)
- Multi-user support with permissions
- Remote access via Gelatin

### ✅ Installation Scripts (FIXED)
- `build-arch.sh` - Arch Linux
- `install-linux.sh` - Debian/Ubuntu/Fedora
- `install-mac.sh` - macOS
- `install-windows.ps1` - Windows

### ✅ Marketing Website
- React version at `/app/website`
- Static HTML version at `/app/website-static`

### ✅ Code Stabilization
- Refactored SettingsPage.js (3559 → 2872 lines)
- Extracted components for better maintainability

---

## API Endpoints

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/users/profiles` - Local network profile selection

### Kodi Repository (NEW)
- `GET /api/kodi/categories` - List categories with counts
- `GET /api/kodi/addons` - Search/list addons
- `GET /api/kodi/addons/popular` - Featured addons
- `GET /api/kodi/addons/{id}` - Addon details
- `GET /api/kodi/addons/category/{cat}` - By category
- `POST /api/kodi/refresh` - Refresh cache

### Themes
- `GET /api/milk/theme-forge` - Get theme config

### Libraries, Media, Downloads, etc.
(See previous documentation)

---

## Test Credentials
- **Email:** `test@test.com`
- **Password:** `password`

---

## Pending/Upcoming Tasks

### 🔶 P1 - High Priority
- Complete Media Management UI (Sonarr-like features)
- Install Kodi addons to WatchNexus (adapter layer)
- Connect Community & DVR pages to backend

### 🔶 P2 - Medium Priority  
- Native mobile apps
- Roku/Fire Stick clients
- Live usenet/indexer testing

### 🔶 P3 - Lower Priority
- Watch party features
- Advanced DVR
- Plugin marketplace for custom plugins

---

## File References

### New/Updated Files
- `/app/frontend/src/pages/AuthPage.js` - Login with local/remote detection
- `/app/frontend/src/pages/PluginMarketplacePage.js` - Kodi-style addon browser
- `/app/backend/kodi_browser.py` - Kodi repository fetcher/parser
- `/app/backend/server.py` - Added Kodi endpoints, user profiles endpoint

### Scripts
- `/app/scripts/*.sh`, `/app/scripts/*.ps1` - Fixed installers

### Static Website
- `/app/website-static/` - Easy-to-edit HTML website

---

*Last updated: December 2024*

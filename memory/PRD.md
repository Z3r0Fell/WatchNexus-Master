# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces the need for multiple applications like Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin. A single, fully self-contained application handling requesting, acquiring, organizing, and watching media.

## Core Architecture

### Frontend
- React with TailwindCSS
- Shadcn UI components
- Framer Motion animations

### Backend
- FastAPI (Python)
- MongoDB database
- Built-in torrent engine (Syrup)

### Key Modules
- **Syrup** - Media Acquisition (torrents/usenet)
- **Marmalade** - Library Manager
- **Compote** - Indexer Manager
- **Pulp** - Usenet Handler
- **Gelatin** - Remote Access
- **Juice** - UI Engine
- **Milk** - Theme Forge

---

## What's Been Implemented

### ✅ Core Application
- Complete React frontend with responsive design
- FastAPI backend with MongoDB
- User authentication system
- Dashboard with activity feeds
- Movies & TV Shows library views
- Search functionality with TMDB integration
- Settings page with multiple tabs

### ✅ Media Pipeline
- Built-in torrent engine (Syrup) with queue management
- Indexer management (Compote)
- Library management (Marmalade) with folder scanning
- Subtitle support (Bazarr-like features)
- Media health checker
- IPTV support with M3U playlists

### ✅ Streaming & Access
- Built-in video player with transcoding
- Jellyfin-compatible API (`/api/emby/*`) for existing clients
- Multi-user support with permissions
- Remote access via Gelatin (Cloudflare tunnels)

### ✅ Customization
- Theme Forge (Milk) - custom color schemes
- Plugin system (Gadgets)
- Streaming service integrations

### ✅ Installation Scripts (FIXED - Dec 2024)
- `build-arch.sh` - Arch Linux package builder
- `install-linux.sh` - Debian/Ubuntu/Fedora installer
- `install-mac.sh` - macOS installer
- `install-windows.ps1` - Windows PowerShell installer

### ✅ Marketing Website
- React version at `/app/website`
- **NEW: Static HTML version at `/app/website-static`** (easily editable)
- Features, Download, Demo, FAQ, Troubleshooting, Terms, Disclaimer pages
- `.htaccess` for IONOS deployment

### ✅ Code Stabilization (Dec 2024)
- Refactored `SettingsPage.js` from 3559 to 2872 lines
- Extracted components:
  - `GeneralSettings.jsx`
  - `UsersSettings.jsx`
  - `LibrarySettings.jsx`
- Stable build with no "Maximum call stack size exceeded" errors

---

## Pending/In-Progress

### 🔶 Media Management UI (P1)
- Basic sub-tab structure exists in Library settings
- Full Sonarr-like implementation pending
- Needs: file renaming, quality profiles, mass editor

### 🔶 Community/DVR Pages
- UI designed but using static data
- Need backend API connections

---

## Backlog (Future Tasks)

### P1 - High Priority
- Complete Media Management UI (Sonarr-like features)
- Connect Community & DVR pages to backend
- Client app documentation (Android, Android TV, Chromecast, Kodi)

### P2 - Medium Priority
- Native mobile apps (iOS, Android)
- Roku/Fire Stick client apps
- Live usenet/indexer testing (Pulp, Compote modules)

### P3 - Lower Priority
- Separate Git repositories for plugins/community
- Advanced DVR functionality
- Watch party features

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create user

### Libraries
- `GET /api/libraries` - List libraries
- `POST /api/libraries` - Add library
- `POST /api/libraries/{id}/scan` - Scan library

### Media
- `GET /api/movies` - List movies
- `GET /api/tvshows` - List TV shows
- `GET /api/search` - Search TMDB

### Torrents (Syrup)
- `GET /api/syrup/search` - Search torrents
- `POST /api/syrup/download` - Start download

### File Browser
- `GET /api/browse` - Browse file system

### Jellyfin Compatible
- `GET /api/emby/*` - Jellyfin-compatible API

---

## Test Credentials
- **Email:** `test@test.com`
- **Password:** `password`

---

## File References

### Critical Files
- `/app/frontend/src/pages/SettingsPage.js` - Main settings (2872 lines)
- `/app/frontend/src/components/settings/` - Extracted settings components
- `/app/backend/server.py` - Main backend server
- `/app/backend/jellyfin_compat.py` - Jellyfin API facade

### Scripts
- `/app/scripts/build-arch.sh` - Arch Linux builder
- `/app/scripts/install-linux.sh` - Linux installer
- `/app/scripts/install-mac.sh` - macOS installer
- `/app/scripts/install-windows.ps1` - Windows installer

### Static Website
- `/app/website-static/` - Fully static HTML website
- `/app/website-static/README.md` - Editing instructions
- `/app/website-static/css/styles.css` - All styles (easy to customize)

### Documentation
- `/app/docs/CLIENT-APP-RESEARCH.md` - Client app feasibility
- `/app/docs/KICKSTARTER-CAMPAIGN.md` - Kickstarter document

---

## Notes

### Known Issues Resolved
1. ✅ Torrent scrapers (YTS, EZTV) fixed with fallback domains
2. ✅ Installation scripts fixed for all platforms
3. ✅ SettingsPage.js build instability resolved via refactoring

### Architecture Decisions
- MongoDB for flexibility with media metadata
- Jellyfin API compatibility for existing app ecosystem
- Modular design with named "modules" (Syrup, Marmalade, etc.)
- Plugin system for extensibility

---

*Last updated: December 2024*

# WatchNexus - Product Requirements Document

## Overview
WatchNexus is a unified, self-hosted media pipeline that replaces the need for Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin in a single application.

## Core Architecture
- **Frontend:** React + shadcn/UI + Framer Motion
- **Backend:** FastAPI + MongoDB
- **Key Modules:** Syrup (torrent), Compote (indexers), Marmalade (library), Gelatin (external access), Milk (themes), Gadgets (plugins)

## Completed Features

### Phase 1 (Previous Sessions)
- Full-stack React + FastAPI application with MongoDB
- Jellyfin-compatible API layer (/emby)
- User management with auth (JWT + Google OAuth)
- Torrent scraping and media library management
- Installation scripts for Windows, Linux, macOS, Arch

### Phase 2 (Previous Session)
- Fixed all 4 installation scripts
- Converted marketing website to static HTML (/app/website-static)
- Fixed built-in themes bug (API key mismatch)
- Enhanced login page with local/remote network detection
- Kodi addon browser on Plugins page
- Plugin adapter framework initiated

### Phase 3 (Feb 12, 2026)
- **SettingsPage.js fully refactored**: 2872 lines → 332 lines (88% reduction)
  - Extracted 12 self-contained tab components into /app/frontend/src/components/settings/
- **Plugin Adapter Framework completed**:
  - Backend: /api/adapter/convert accepts ZIP file uploads
  - Frontend: PluginConverter component with ecosystem selection, drag-and-drop file upload

### Phase 4 (Feb 12, 2026)
- **Documentation Created**:
  - `/app/docs/THEME-DEVELOPMENT-GUIDE.md` - Complete theme customization guide
  - `/app/docs/GADGETS-GUIDE.md` - Plugin/Gadget quick reference
  - `/app/docs/USER-GUIDE.md` - User guide with keyboard shortcuts

- **Dashboard Enhanced with Per-User Watch History**:
  - "Continue Watching" section with progress bars, time remaining, episode info
  - "Next Up" section for TV shows with next episode suggestions
  - "Recently Added" section showing new library additions with NEW badges
  - Per-user profile support (shows "for {username}")
  - New API endpoint: `/api/next-up` (GET)

- **Sonarr-like Media Management UI**:
  - Library Settings now has 5 sub-tabs: Libraries, Media Management, Quality Profiles, Mass Editor, Manual Import
  - Episode Naming with format templates
  - Quality Profiles with 3 presets

### Phase 5 (Feb 13, 2026) - Current Session ✅
- **Plugin Adapter Framework Backend VERIFIED COMPLETE**:
  - Full implementation for Kodi, Jellyfin/Emby, and Plex plugin conversion
  - API endpoints: `/api/adapter/convert`, `/api/adapter/detect`, `/api/adapter/supported`
  - 1440+ lines of conversion logic in `/app/backend/plugin_adapter.py`

- **Fixed Installation Scripts**:
  - **Windows (`install-windows.ps1`)**: Fixed to download dependencies directly without Chocolatey requirement
    - Direct download links for Node.js, Python, Git, VC++ Redistributable
    - Better error handling and progress feedback
  - **Arch Linux (`build-arch.sh`)**: Enhanced with interactive MongoDB installation options
    - Full pacman commands for all dependencies
    - AUR helper installation (yay/paru) for MongoDB
    - Docker alternative offered
    - systemd service creation

- **Created Comprehensive BUILD_GUIDE.md** (`/app/docs/BUILD_GUIDE.md`):
  - Direct download links for Windows dependencies (Node.js, Python, Git, MongoDB, FFmpeg)
  - Arch Linux pacman commands for all packages
  - Non-git installation methods (release downloads)
  - Ubuntu/Debian and Fedora instructions
  - Docker MongoDB setup
  - Troubleshooting section

## File Architecture
```
/app/
├── backend/
│   ├── server.py                 # Main FastAPI server
│   ├── plugin_adapter.py         # Plugin conversion framework (1440 lines)
│   └── tests/
├── frontend/src/
│   ├── components/
│   │   ├── settings/             # 12 settings tab components
│   │   └── PluginConverter.jsx   # Plugin conversion UI
│   └── pages/
├── docs/
│   ├── BUILD_GUIDE.md            # NEW - Comprehensive build instructions
│   ├── THEME-DEVELOPMENT-GUIDE.md
│   ├── GADGETS-GUIDE.md
│   ├── USER-GUIDE.md
│   └── KICKSTARTER-SETUP-GUIDE.md
├── scripts/
│   ├── install-windows.ps1       # FIXED - Windows installer
│   ├── build-arch.sh             # FIXED - Arch Linux installer
│   ├── install-linux.sh          # Debian/Ubuntu/Fedora installer
│   └── install-mac.sh            # macOS installer
└── website-static/               # Marketing website
```

## Prioritized Backlog

### P0 - High Priority
- [x] ~~Fix installation scripts for Windows and Linux~~ ✅
- [x] ~~Plugin Adapter Framework~~ ✅
- [ ] Test Usenet (Pulp) and Indexer (Compote) modules

### P1 - Medium Priority
- [ ] Connect Community & DVR pages to backend APIs
- [ ] Client App Planning (Android, Android TV, Chromecast, Kodi)

### P2 - Low Priority / Future
- [ ] Roku / Universal app
- [ ] Pre-built binary releases (.exe, .AppImage, .dmg)

## Key API Endpoints
- `/api/auth/login` (POST) - Login
- `/api/auth/me` (GET) - Current user
- `/api/watch-progress` (GET/POST) - Watch progress per user
- `/api/next-up` (GET) - Next episodes for TV shows
- `/api/kodi/categories` (GET) - Kodi addon categories
- `/api/adapter/convert` (POST) - Convert plugin ZIP
- `/api/adapter/supported` (GET) - List supported plugin ecosystems
- `/api/marmalade/libraries` (GET) - Media libraries

## Test Credentials
- Email: test@test.com
- Password: password

---
*Last updated: February 13, 2026*

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

### Phase 3 (Feb 12, 2026 - Session 1)
- **SettingsPage.js fully refactored**: 2872 lines → 332 lines (88% reduction)
  - Extracted 12 self-contained tab components into /app/frontend/src/components/settings/
- **Plugin Adapter Framework completed**:
  - Backend: /api/adapter/convert accepts ZIP file uploads
  - Frontend: PluginConverter component with ecosystem selection, drag-and-drop file upload

### Phase 4 (Feb 12, 2026 - Current Session) ✅
- **Documentation Created**:
  - `/app/docs/THEME-DEVELOPMENT-GUIDE.md` (726 lines) - Complete theme customization guide
  - `/app/docs/GADGETS-GUIDE.md` (171 lines) - Plugin/Gadget quick reference
  - `/app/docs/USER-GUIDE.md` (380 lines) - User guide with keyboard shortcuts

- **Dashboard Enhanced with Per-User Watch History**:
  - "Continue Watching" section with progress bars, time remaining, episode info
  - "Next Up" section for TV shows with next episode suggestions
  - Per-user profile support (shows "for {username}")
  - New API endpoint: `/api/next-up` (GET) - returns next episodes to watch

- **Sonarr-like Media Management UI**:
  - Library Settings now has 5 sub-tabs: Libraries, Media Management, Quality Profiles, Mass Editor, Manual Import
  - Episode Naming with format templates (e.g., `{Series Title} - S{season:00}E{episode:00}`)
  - Importing settings (hardlinks, extra files, min free space)
  - Quality Profiles with 3 presets (Any, HD-720p/1080p, Ultra-HD)
  - Mass Editor with series selection and bulk actions

- **Testing**: 100% pass rate (22/22 backend tests, all frontend features)

## File Architecture
```
/app/
├── backend/
│   ├── server.py                 # Main FastAPI server
│   ├── plugin_adapter.py         # Plugin conversion framework
│   └── tests/
│       └── test_new_dashboard_features.py
├── frontend/src/
│   ├── components/
│   │   ├── settings/
│   │   │   ├── LibrarySettings.jsx    # Main library tab with sub-tabs
│   │   │   ├── MediaManagement.jsx    # Sonarr-like Media Management components
│   │   │   └── ... (12 settings components)
│   │   └── PluginConverter.jsx
│   └── pages/
│       ├── Dashboard.js               # Enhanced with Continue Watching & Next Up
│       └── SettingsPage.js
├── docs/
│   ├── THEME-DEVELOPMENT-GUIDE.md     # NEW - Theme development guide
│   ├── GADGETS-GUIDE.md               # NEW - Plugin/Gadget guide
│   ├── USER-GUIDE.md                  # NEW - User guide
│   └── PLUGIN-DEVELOPMENT-GUIDE.md
└── website-static/
```

## Prioritized Backlog

### P0 - High Priority
- [x] ~~"Continue Watching" & "Next Up" on Dashboard (per-user watch history)~~ ✅
- [x] ~~Create documentation for user-creatable content (themes, plugins)~~ ✅
- [x] ~~Sonarr-like Media Management UI~~ ✅
- [ ] Test Usenet (Pulp) and Indexer (Compote) modules

### P1 - Medium Priority
- [ ] Connect Community & DVR pages to backend APIs
- [ ] Client App Planning (Android, Android TV, Chromecast, Kodi)

### P2 - Low Priority / Future
- [ ] Roku / Universal app
- [ ] New Git repositories for project and community content

## Key API Endpoints
- `/api/auth/login` (POST) - Login
- `/api/auth/me` (GET) - Current user
- `/api/watch-progress` (GET/POST) - Watch progress per user
- `/api/next-up` (GET) - **NEW** - Next episodes for TV shows
- `/api/kodi/categories` (GET) - Kodi addon categories
- `/api/adapter/convert` (POST) - Convert plugin ZIP
- `/api/marmalade/libraries` (GET) - Media libraries

## Test Credentials
- Email: test@test.com
- Password: password

---
*Last updated: February 12, 2026*

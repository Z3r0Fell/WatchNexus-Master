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

### Phase 3 (Current Session - Feb 12, 2026)
- **SettingsPage.js fully refactored**: 2872 lines → 332 lines (88% reduction)
  - Extracted 9 self-contained tab components into /app/frontend/src/components/settings/
  - All 12 settings tabs working: General, Users, Library, Media Health, Indexers, Download Client, IPTV, Streaming Services, Subtitles, External Access, Theme Forge, Plugins
- **Plugin Adapter Framework completed**:
  - Backend: /api/adapter/convert accepts ZIP file uploads (multipart/form-data)
  - Backend: /api/adapter/supported returns ecosystem list
  - Frontend: PluginConverter component with ecosystem selection, drag-and-drop file upload
  - Full conversion logic for Kodi, Jellyfin/Emby, and Plex plugins
- **Testing**: 100% pass rate (15/15 backend, all frontend features)

## File Architecture
```
/app/
├── backend/
│   ├── server.py                 # Main FastAPI server
│   ├── plugin_adapter.py         # Plugin conversion framework
│   ├── kodi_browser.py           # Kodi repository browser
│   └── tests/
├── frontend/src/
│   ├── components/
│   │   ├── PluginConverter.jsx   # Plugin conversion UI
│   │   ├── settings/             # 12 settings tab components
│   │   │   ├── GeneralSettings.jsx
│   │   │   ├── UsersSettings.jsx
│   │   │   ├── LibrarySettings.jsx
│   │   │   ├── MediaHealthSettings.jsx
│   │   │   ├── IndexerSettings.jsx
│   │   │   ├── DownloadSettings.jsx
│   │   │   ├── IPTVSettings.jsx
│   │   │   ├── StreamingSettings.jsx
│   │   │   ├── SubtitleSettings.jsx
│   │   │   ├── GelatinSettings.jsx
│   │   │   ├── ThemeForgeSettings.jsx
│   │   │   ├── PluginsSettings.jsx
│   │   │   └── index.js
│   │   └── ui/                   # shadcn components
│   └── pages/
│       ├── SettingsPage.js       # 332 lines (thin shell)
│       ├── PluginMarketplacePage.js
│       ├── Dashboard.js
│       └── AuthPage.js
├── docs/
│   └── PLUGIN-DEVELOPMENT-GUIDE.md
└── website-static/
```

## Prioritized Backlog

### P0 - High Priority
- [ ] "Continue Watching" & "Next Up" on Dashboard (per-user watch history)
- [ ] Connect Community & DVR pages to backend APIs

### P1 - Medium Priority
- [ ] Sonarr-like Media Management UI
- [ ] Client App Planning (Android, Android TV, Chromecast, Kodi)

### P2 - Low Priority / Future
- [ ] Roku / Universal app
- [ ] New Git repositories for project and community content
- [ ] Test Usenet (Pulp) and Indexer (Compote) modules

## Key API Endpoints
- `/api/auth/login` (POST) - Login
- `/api/auth/me` (GET) - Current user
- `/api/users/profiles` (GET) - User profiles for local login
- `/api/kodi/categories` (GET) - Kodi addon categories
- `/api/kodi/addons/popular` (GET) - Popular Kodi addons
- `/api/adapter/convert` (POST) - Convert plugin ZIP (multipart)
- `/api/adapter/supported` (GET) - List supported ecosystems
- `/api/adapter/detect` (GET) - Detect plugin ecosystem

## Test Credentials
- Email: test@test.com
- Password: password

---
*Last updated: February 12, 2026*

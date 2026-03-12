# WatchNexus - Product Requirements Document

## Original Problem Statement
WatchNexus is a unified, self-hosted media pipeline application. The project features a C#/.NET 10 backend with a React frontend. The application manages media libraries, integrates with TMDB for metadata, supports VPN portal, security management, indexer search, downloads, and various gadgets.

## Current Architecture
- **Frontend:** React (CRA) at `/app/frontend` -> symlink to `/app/src/web`
- **Backend:** C#/.NET 10 (ASP.NET Core) at `/app/src/watchnexus/core/`
- **Database:** SQLite via Entity Framework Core
- **Auth:** JWT Bearer Tokens (WatchNexus issuer/audience)
- **Build:** `dotnet build -c Release` from `/app/src/watchnexus/core/`
- **Run:** `watchnexus-server` supervisor program
- **DLL Path:** `/app/src/watchnexus/core/bin/Release/net10.0/WatchNexus.Core.dll`

## Core Features
1. **Authentication** - Register/Login with JWT tokens
2. **Dashboard** - Trending content, now playing, continue watching
3. **Media Libraries** - CRUD, scanning, TMDB metadata enrichment
4. **Folder Browsing** - Cross-platform filesystem navigation (Linux, macOS, Windows)
5. **Settings** - General, integrations, sidebar tab visibility (22 tabs in 3 groups), themes
6. **Security** - Audit logs, IP rules, API key management
7. **VPN Portal** - WireGuard server config and peer management (MOCKED)
8. **Downloads** - Built-in torrent engine, qBittorrent integration (MOCKED)
9. **Indexer Search** - Compote module for content search
10. **Streaming** - Service integrations
11. **Gadgets** - Weather, Podcasts, Radio, Photos, Web Video (stub endpoints)
12. **Marketplace** - Plugin management

## What's Been Implemented

### Mar 12, 2026
- **C# FilesystemController:** Cross-platform folder browsing at `/api/filesystem/browse`
  - Linux: Root, Home, Desktop, Documents, Downloads, Videos, Media, Mounts, Tmp, Srv
  - macOS: Root, Home, Desktop, Documents, Downloads, Movies, Music, Volumes (+ individual volumes)
  - Windows: Drive letters (C:, D:, etc.), Desktop, Documents, Downloads, Videos
  - Handles: broken symlinks, permission errors, hidden files (Windows attributes), child count capped at 999
- **C# ExtendedControllers:** 20+ stub controllers for all frontend-expected endpoints
  - Ripen (gadgets), Milk (themes), Gadgets (weather/radio/podcasts/photos/webvideo), IPTV, Drizzle (playlists), Gelatin (external access), System info, Subtitles, Streaming services, Watch party, Media health/management, Quality profiles, Compote (indexers), Kodi addons, Zest (code protection), Adapter (conversion), Cache, DB, Torrent, qBittorrent
- **Libraries `recent` endpoint:** Added `/api/libraries/recent`
- **Sidebar restructured:** Admin items (Security, VPN Portal, Lib Manager, Browse Media, Log Viewer, System, Marketplace) moved under collapsible Settings submenu
- **Sidebar tab visibility:** All 22 tabs now toggleable in Settings > General, grouped by Media (10), Gadgets (5), Admin (7)
- **AuthContext normalized:** Handles both PascalCase and lowercase user data

## Testing Status
- **Testing Agent v3 iteration 2:** All tests PASSED (100% backend 16/16, 100% frontend)
- Login, sidebar structure, settings expand, sidebar tabs, folder browsing, tab visibility all verified

## Known Mocked/Stub APIs
- VPN WireGuard control (wg-up, wg-down)
- qBittorrent integration
- Subtitle search
- All gadgets (weather, radio, podcasts, photos, web video)
- IPTV, drizzle, media management, quality profiles

## Test Credentials
- Email: test@test.com
- Password: password

## Prioritized Backlog

### P0 (Completed)
- [x] Fix sidebar UI - admin items under Settings
- [x] Fix folder browsing (cross-platform C#)
- [x] Add all sidebar tab toggles (22 tabs, 3 groups)
- [x] Add missing API endpoints for frontend

### P1 (Next)
- [ ] Full module separation & dynamic DLL loading
- [ ] Implement real gadget functionality (weather API, podcast RSS, radio streams)
- [ ] qBittorrent C# client implementation

### P2 (Future)
- [ ] EF Core migrations (replace Database.EnsureCreated)
- [ ] Re-implement Cloud Sync (Marshmallow)
- [ ] Re-implement Code Protection (Fortress)
- [ ] Consolidate installer scripts
- [ ] Module loading system completion
- [ ] TMDB key configuration flow improvement

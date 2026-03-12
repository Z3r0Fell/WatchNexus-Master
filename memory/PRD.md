# WatchNexus - Product Requirements Document

## Original Problem Statement
WatchNexus is a unified, self-hosted media pipeline application. The project features a C# .NET 10 backend architecture design with a React frontend. The application manages media libraries, integrates with TMDB for metadata, supports VPN portal, security management, indexer search, downloads, and various gadgets.

## Current Architecture
- **Frontend:** React (CRA) at `/app/frontend` -> symlink to `/app/src/web`
- **Backend:** Python/FastAPI at `/app/backend/server.py` (ported from C# .NET 10)
- **Database:** MongoDB via Motor (async driver)
- **Auth:** JWT Bearer Tokens (30-day expiry)
- **Hosting:** Kubernetes pod with supervisor managing services

## Core Features
1. **Authentication** - Register/Login with JWT tokens
2. **Dashboard** - Trending content, now playing, continue watching
3. **Media Libraries** - CRUD, scanning, TMDB metadata enrichment
4. **Folder Browsing** - OS-aware filesystem navigation for library paths
5. **Settings** - General, integrations, sidebar tab visibility, themes
6. **Security** - Audit logs, IP rules, API key management
7. **VPN Portal** - WireGuard server config and peer management (MOCKED)
8. **Downloads** - Built-in torrent engine, qBittorrent integration (MOCKED)
9. **Indexer Search** - Compote module for content search
10. **Streaming** - Service integrations
11. **Gadgets** - Weather, Podcasts, Radio, Photos, Web Video
12. **Marketplace** - Plugin management

## What's Been Implemented (Mar 12, 2026)

### Backend (FastAPI - /app/backend/server.py)
- All API endpoints ported from C# .NET 10 controllers
- Auth (register, login, me, logout)
- Users (me, profiles)
- Libraries CRUD + scan + media
- Marmalade bridge endpoints
- Settings CRUD + integrations (TMDB, qBittorrent)
- TMDB proxy (search, trending, discover, genres, details)
- Watchlist CRUD
- Watch Progress CRUD + next-up
- Downloads + engine status
- Security (stats, audit, IP rules, API keys, sessions)
- VPN (server config, peers, WireGuard control - MOCK)
- Logs (files, latest, system)
- Filesystem browse (OS-aware with drives/quick access)
- Streaming services, Compote indexers, Gelatin external access
- Subtitles, Watch Party, Media Health
- qBittorrent (MOCK), Ripen (gadgets), Milk (themes)
- User preferences (sidebar tab visibility sync)

### Frontend Fixes
- **Sidebar restructured:** Admin items (Security, VPN Portal, Lib Manager, Browse Media, Log Viewer, System, Marketplace) moved under collapsible Settings submenu
- **Sidebar tab visibility:** All 22 tabs now toggleable in Settings > General > Sidebar Tabs, grouped by Media (10), Gadgets (5), Admin (7)
- **AuthContext normalized:** Handles both PascalCase and lowercase user data fields

## Testing Status
- **Testing Agent v3 iteration 1:** All 10 tests PASSED (100% backend, 100% frontend)
- Login, sidebar structure, settings expand, sidebar tabs, folder browsing, tab visibility all verified

## Known Mocked APIs
- VPN WireGuard control (wg-up, wg-down) - returns mock responses
- qBittorrent integration - returns mock disconnected
- Subtitle search - returns empty results

## Test Credentials
- Email: test@test.com
- Password: password

## Prioritized Backlog

### P0 (Completed)
- [x] Fix sidebar UI - admin items under Settings
- [x] Fix folder browsing
- [x] Add all sidebar tab toggles
- [x] Create working FastAPI backend

### P1 (Next)
- [ ] Full module separation & dynamic DLL loading
- [ ] EF Core migrations equivalent for MongoDB (schema versioning)
- [ ] qBittorrent C#/Python client implementation

### P2 (Future)
- [ ] Re-implement Cloud Sync (Marshmallow)
- [ ] Re-implement Code Protection (Fortress)
- [ ] Consolidate installer scripts
- [ ] Module loading system completion
- [ ] TMDB key configuration flow improvement

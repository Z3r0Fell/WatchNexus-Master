# WatchNexus - Product Requirements Document

## Overview
WatchNexus is a self-hosted media pipeline application (C#/.NET 10 + React) that manages personal media libraries with TMDB metadata, torrenting, streaming, and a rich set of media management tools.

## Current Version: 2.8.3

## Architecture
- **Backend**: C#/.NET 10, ASP.NET Core, EF Core + SQLite
- **Frontend**: React (Create React App), served as static files via Kestrel
- **Proxy**: FastAPI proxy on port 8001 → .NET backend on port 8002
- **Build**: Self-contained single-file executables for Windows and Linux

## Core Features (Implemented)
- Authentication (JWT, seeded admin account)
- Media library management with folder scanning
- TMDB metadata integration (poster art, ratings, overviews, backdrops)
- Torrent management (qBittorrent integration)
- Indexer management (Compote/Syrup module)
- Streaming service credentials
- Subtitle search (OpenSubtitles, Addic7ed, etc.)
- IPTV channel management
- System tray icon (Windows + Linux) with Start/Stop/Restart/Preferences
- Watch progress tracking
- Watchlist management
- Analytics (Truffle module)
- Notifications (Pepper module)
- Media requests (Meringue module)
- Parental controls (Rind module)
- Media processing (Crucible module)
- Usenet support (Brine indexer + Ladle downloader)
- Help & Documentation page
- Gadgets: Podcasts, Radio, Photos, Weather, Web Video, GameBot

## What's Been Implemented

### v2.8.3 (2026-03-23)
- Fixed TMDB API key lookup across all sources (env, tmdb_api_key DB, crumbs_tmdb DB)
- Fixed TmdbProxyController to use IConfiguration fallback (trending/search/discover were returning empty)
- Fixed Dashboard poster rendering (poster_url vs poster_path)
- Fixed Continue Watching NaN display
- Added /api/library alias route
- Enhanced Marmalade scan to fetch TMDB metadata including posters
- Fixed TV show title parsing for TMDB search
- All 94 backend endpoints verified passing
- Frontend testing: 85%+ pass rate, all core features working
- Alpha builds created (Windows x64, Linux x64)

### v2.8.2.2 (2026-03-22)
- Deep dive audit fixing dozens of [FromBody] vs [FromQuery] mismatches
- Auth failure fix for standalone builds (hardcoded REACT_APP_BACKEND_URL)
- System tray icon implementation (Windows WinForms + Linux GTK)
- Complete Compote/Indexer controller rewrite
- Downloads controller implementation

### v2.8.2.1 - Help & Documentation Page
### v2.8.2 - Help Tooltips & Sidebar UX Fix
### v2.8.1 - Bug Fixes & New Frontend Pages
### v2.8.0 - Five New Native Features (Truffle, Pepper, Meringue, Rind, Crucible, Brine, Ladle)

## Alpha Build Credentials
- Email: admin@watchnexus.local
- Password: admin

## Upcoming Tasks (P1)
- **Glaze** — Trakt + Last.fm Scrobbling
- **Roux** — Collections & Smart Playlists
- **Simmer** — Scheduled Tasks Engine

## Future Tasks (P2)
- Sprout (RSS Feed Generator)
- Biscotti (Ebook/Audiobook/Comics Support)
- Treacle (Music Library & Player)
- Sage (AI Metadata & Recommendations)
- Terrine (Live TV DVR)
- Popsicle (Offline Sync / Mobile)
- Preserves (S3/Cloud Backup)
- Re-implement Marshmallow Cloud Sync

## Key Files
- `/app/src/watchnexus/core/Controllers/` - All backend controllers
- `/app/src/watchnexus/core/Services/TrayIconService.cs` - System tray
- `/app/src/watchnexus/core/WatchNexus.Core.csproj` - Build config
- `/app/frontend/src/services/api.js` - Frontend API definitions
- `/app/frontend/src/pages/Dashboard.js` - Main dashboard
- `/app/release_builds/` - Alpha builds

## Known Environment Issue
- .NET SDK at `/opt/dotnet/` is not persistent. Must reinstall on environment restart:
  `curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 10.0 --install-dir /opt/dotnet`

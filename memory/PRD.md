# WatchNexus - Product Requirements Document (PRD)

## Overview
WatchNexus is a unified, self-hosted media pipeline built with C#/.NET 10 backend and React frontend. It provides a comprehensive media management experience with 31+ features (called "gadgets") including library management, streaming, indexing, analytics, notifications, parental controls, and more.

## Version: 2.8.2.2

## Architecture
- **Backend**: C#/.NET 10 ASP.NET Core server (port 8002)
- **Proxy**: Python FastAPI reverse proxy (port 8001) for ingress routing
- **Frontend**: React + Vite (port 3000)
- **Database**: SQLite via Entity Framework Core
- **Deployment**: Self-contained release builds for Windows + Linux

## Core Features Implemented
### Original Features
1. **Auth System** - JWT-based authentication with login/register/logout
2. **Library Management** - Media library CRUD, scanning, metadata refresh
3. **TMDB Integration** - Movie/TV search, trending, details, genres
4. **Watchlist & Progress** - Track watch progress, continue watching
5. **Downloads** - Built-in torrent engine, qBittorrent integration
6. **IPTV** - Live TV channel management
7. **Playlists** (Drizzle) - User playlists with media items
8. **Weather** - Weather forecasts with location search
9. **Podcasts** - Podcast search, subscribe, episodes
10. **Radio** - Radio station search, favorites
11. **Photos** - Photo library management
12. **Web Video** - Video bookmarks and history
13. **Subtitles** - Multi-source subtitle search and download
14. **VPN** - WireGuard VPN portal management
15. **Security** - IP rules, API keys, audit logs
16. **External Access** (Gelatin) - Tunnels, share links
17. **Themes** (Milk) - Theme marketplace
18. **Plugin Marketplace** (Ripen) - Gadget management
19. **System Stats** (Nutmeg) - System monitoring
20. **Media Bridge** (Custard) - External media server integration
21. **Fortress** - Code protection with audit trail
22. **GameBot** - Movie quiz generator

### New Features (v2.8.0)
23. **Watch Analytics** (Truffle) - Viewing stats, play history, top genres
24. **Notification Hub** (Pepper) - Multi-channel notifications (webhook, email, discord, pushover)
25. **User Requests** (Meringue) - Media request system with approval workflow
26. **Parental Controls** (Rind) - PIN protection, rating limits, genre blocking
27. **Media Processing** (Crucible) - FFmpeg-based transcode jobs (MOCKED - requires ffmpeg)
28. **Usenet Indexer** (Brine) - Prowlarr-compatible Usenet search proxy
29. **Usenet Downloader** (Ladle) - SABnzbd-compatible download proxy

## Frontend Pages
- Dashboard, Library, Movies, TV Shows, Anime, Music, Audiobooks, Live TV, Streaming
- Downloads, Indexers, Playlists, Search, Watchlist, History, Discover, DVR
- Weather, Podcasts, Radio, Photos, Web Video
- **NEW**: Analytics, Notifications, Requests, Parental Controls, Processing, Usenet
- Settings, Security, VPN Portal, System, Library Manager, Log Viewer, Browse Media, Marketplace, Themes

## Bugs Fixed (v2.8.2)
1. **Sidebar scroll persistence** — Sidebar no longer jumps to top when navigating. Uses sessionStorage to save/restore scroll position.

## UX Enhancements (v2.8.2)
1. **Help Tooltips** — Visible question-mark icons next to every settings section heading and key individual options. Clicking opens a popover with description, purpose, and setup examples.
2. **HelpTooltip component** — Reusable component at `/components/ui/HelpTooltip.jsx`.
3. **SettingsTabHeader help prop** — All tabbed settings pages support a `help` prop for section-level tooltips.

## Bugs Fixed (v2.8.0 patch)
1. **Dropdown CSS** - Select option text was unreadable (white on white). Fixed with global CSS rule.
2. **Settings not saving** - Backend PUT /api/settings/{key} expected {"value":"..."} but frontend sent raw JSON. Fixed to accept both formats. Added bulk PUT /api/settings endpoint.
3. **User preferences** - Frontend sent preferences as query params, backend expected JSON body. Fixed frontend.
4. **Missing marmalade endpoints** - Added /status, /media/{id}, /media/search, /continue-watching, /tv-series, /libraries/{id}/refresh-metadata, /media/{id}/progress, /media/{id}/watched, /stream/{id}, /stream/{id}/file
5. **Meringue request** - tmdb_id was required; made optional (title-only requests now work).
6. **Pepper channel creation** - POST /api/pepper/channels endpoint was missing. Added.
7. **Version mismatch** - SystemController still showed 2.7.3; updated to 2.8.0.

## Test Status
- **Backend**: 45/45 API endpoints pass (iteration_11)
- **Frontend**: All pages load and function correctly
- **Testing Agent**: 16/16 tests passed, 100% success rate

## New Features (v2.8.2.2)
30. **System Tray Icon** — Cross-platform tray icon that loads on launch
    - Windows: Native WinForms NotifyIcon with branded icon, double-click to open browser
    - Linux: Embedded Python helper using GTK AppIndicator3 (ayatana + legacy support)
    - Headless environments gracefully skip tray initialization
    - TrayIconService registered as BackgroundService; csproj conditional UseWindowsForms for win-x64
    - **Enhanced Tray Menu**: Open WatchNexus, Stop Server, Restart Server, Preferences submenu (Server Port, Settings Page, Port Forwarding/UPnP, Edit appsettings.json, Log Folder, Data Folder), Quit
31. **Standalone Frontend Build Fix** — Frontend is now rebuilt with empty `REACT_APP_BACKEND_URL` during `dotnet publish`, ensuring the alpha release uses same-origin API requests instead of hardcoded preview URLs. This was the root cause of auth failures in the alpha build.

## Release Builds (v2.8.2.2)
- **Windows (win-x64)**: `/app/release_builds/WatchNexus-v2.8.2.2-win-x64.zip` (72MB, 472 files, self-contained + WinForms)
- **Linux (linux-x64)**: `/app/release_builds/WatchNexus-v2.8.2.2-linux-x64.zip` (59MB, 381 files, self-contained)
- Both include: executable, .NET runtime, React frontend build, CHANGELOG.md
- **Alpha folder** (`/app/Alpha/`): Updated to v2.8.2.2 — README, CHANGELOG, and all scripts (build-release, build-arch, install-windows, install-linux, install-mac) rewritten for .NET 10 self-contained architecture

## Upcoming Tasks (P1)
- **Glaze** - Trakt + Last.fm Scrobbling
- **Roux** - Collections & Smart Playlists
- **Simmer** - Scheduled Tasks Engine

## Future Tasks (P2)
- **Sprout** - RSS Feed Generator
- **Biscotti** - Ebook/Audiobook/Comics Support
- **Treacle** - Music Library & Player
- **Sage** - AI Metadata & Recommendations
- **Terrine** - Live TV DVR
- **Popsicle** - Offline Sync / Mobile
- **Preserves** - S3/Cloud Backup
- Re-implement **Marshmallow** Cloud Sync

## Credentials
- Admin: admin@watchnexus.local / admin
- Test: test@test.com / password

# WatchNexus - Product Requirements Document

## Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". The application manages media libraries, integrates with external services (TMDB, qBittorrent), provides security controls, VPN management, and exposes a rich web dashboard. Target deployment: personal servers, Arch Linux laptops, Docker, Unraid.

## Architecture
- **Backend:** Python 3.11 / FastAPI / SQLite (at `/app/src/server/`, symlinked as `/app/backend/`)
- **Frontend:** React 18 / TailwindCSS / Shadcn UI (at `/app/src/web/`, symlinked as `/app/frontend/`)
- **Auth:** JWT Bearer Tokens
- **Database:** SQLite with WAL mode, auto-backup, version tracking
- **API Pattern:** RESTful, all routes prefixed with `/api/`

## Core Requirements
1. Media library scanning with TMDB metadata enrichment
2. Download client integration (qBittorrent + built-in engine)
3. Security module (audit logs, IP rules, API keys, sessions)
4. VPN portal (WireGuard server/peer management)
5. Gadgets (weather, podcasts, radio, photos, IPTV)
6. Playlist/queue engine
7. System tray desktop application
8. Multi-platform installers (Docker, Linux, Windows, macOS, Unraid)

## User Personas
- **Self-hosted media enthusiast** running on personal Arch Linux laptop
- **Home server operator** using Unraid or Docker
- **Privacy-focused user** managing own VPN and security

## Module Codenames
| Codename | Module |
|----------|--------|
| Marmalade | Library Manager |
| Bastion | Security Module |
| Tunnel | VPN Portal |
| Zest | Log Viewer |
| Drizzle | Playlist Engine |
| Fondue | Download Manager |
| Compote | Indexer Manager |
| Gelatin | Transcoding |
| Syrup | Live Scraper |
| Beacon | Tray App |
| Tiramisu | Auto-Updater |

## What's Implemented (as of March 2026)

### Backend (All endpoints return 200)
- Authentication (register, login, JWT, Google OAuth)
- TMDB integration (search, trending, details, discover)
- Media library CRUD + scanning with TMDB metadata
- Background scan job tracking
- Integration settings (TMDB key, qBittorrent config)
- Security module (Bastion) - audit, IP rules, API keys, sessions
- VPN module (Tunnel) - server config, peers, WireGuard status
- System info endpoint with CPU/memory/disk/modules
- Downloads (built-in engine + qBittorrent)
- Playlists/queue engine (Drizzle)
- Indexer management (Compote)
- Gadgets (weather, podcasts, radio, photos, IPTV)
- Logs (file browser, latest entries, system diagnostics)
- Settings (user preferences, streaming services, quality profiles)
- File browser, watch progress, watchlist

### Frontend (All pages load without errors)
- Dashboard, Movies, TV Shows, Anime, Music, Audiobooks
- Library Manager (Marmalade) - create/scan/delete libraries
- Settings - Integrations (TMDB + qBittorrent config)
- Security (Bastion) - stats, audit, IP rules, API keys, sessions
- VPN Portal (Tunnel) - server config, peers, WireGuard controls
- System page with module health
- Log Viewer (Zest) with filters and system diagnostics
- Downloads, Playlists, Indexers, Search
- Streaming, Live TV, DVR
- Weather, Podcasts, Radio, Photos
- Watch Party, Watch History, Watchlist

### Infrastructure
- Docker installer (Dockerfile + docker-compose.yml)
- Linux installer (install.sh + uninstall.sh)
- Windows installer (install.bat)
- macOS installer (install.sh + .app bundle)
- Unraid template (watchnexus.xml)
- System tray app (Beacon) with server monitoring
- Comprehensive README and documentation

## Mocked/Limited Features
- WireGuard VPN: Mock commands (no real wg-quick)
- qBittorrent: Returns connection error (no instance in dev env)
- Library scanning: Works with real files and TMDB API

## Test Credentials
- Email: test@test.com
- Password: password

## Key API Endpoints
- `/api/auth/*` - Authentication
- `/api/users/me` - Current user
- `/api/libraries` - Library CRUD + scan
- `/api/settings/integrations` - TMDB/qBittorrent config
- `/api/security/*` - Bastion security module
- `/api/vpn/*` - Tunnel VPN module
- `/api/info` - System information
- `/api/logs/*` - Zest log viewer
- `/api/downloads` - Download management
- `/api/drizzle/*` - Playlist engine
- `/api/gadgets/*` - Weather, podcasts, radio, photos

## Remaining Backlog
- P1: Avalonia UI cross-platform desktop client
- P1: Robust background task processing (Hangfire-style)
- P2: Cloud sync ("Marshmallow") module
- P2: Code protection ("Fortress") module
- P2: Native installers (MSIX, DMG with code signing, .deb/.rpm)
- P2: PostgreSQL migration option
- P2: WebSocket real-time updates

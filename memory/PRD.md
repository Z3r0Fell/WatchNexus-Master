# WatchNexus - Product Requirements Document

## Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Single cohesive application with modular architecture where each module can be independently developed, updated, and installed.

## Architecture (v3.0.0-beta)
- **Backend:** Python 3 / FastAPI, SQLite (via custom ORM)
- **Frontend:** React 18, TailwindCSS, Shadcn UI, Framer Motion
- **Auth:** JWT Bearer Tokens + Google OAuth
- **Structure:** Unified modular monolith

```
src/
├── server/        # Python FastAPI backend
└── web/           # React SPA frontend
watchnexus/
├── core/          # C# ASP.NET Core (future migration)
├── shared/        # Shared interfaces
└── modules/       # Module manifests
```

## Module System
Each module has a `module.json` manifest and can be independently:
- Developed in its own repo
- Updated by replacing the module folder
- Installed by dropping into `modules/`

### Built-in Modules (v3.0.0)
| Codename | Module | Status |
|----------|--------|--------|
| Marmalade | Library Manager | Active |
| Bastion | Security Module | Active |
| Tunnel | VPN Portal | Active |
| Zest | Log Viewer | Active |
| Fondue | Download Manager | Active |
| Gadgets | Marketplace | Active |
| Drizzle | Playlist Engine | Planned |
| Compote | Indexer Manager | Planned |
| Gelatin | Transcoding | Planned |
| Syrup | Scrapers | Planned |
| Beacon | System Tray | Planned |

## What's Implemented (March 11, 2026)

### Python/FastAPI Backend (All endpoints 200)
- Auth: register, login, JWT, Google OAuth, /auth/me
- Libraries: CRUD, background scanning, TMDB metadata
- Security (Bastion): audit logs, IP rules, API keys, sessions
- VPN (Tunnel): server/peer config, WireGuard status (mocked in dev)
- Settings: integrations (TMDB, qBittorrent)
- Logs: file browser, latest entries, system health
- Downloads: engine status
- Dashboard: stats endpoint
- Marketplace: gadgets catalogue (16 categories), Kodi repository, plugin management
- Database reset: /api/db/reset endpoint
- Bridge routes: /api/marmalade/*, /api/preferences, /api/dashboard

### React Frontend (All pages load)
- Dashboard with trending media, Browse Media (Netflix-style grid)
- Library Manager, Movies, TV Shows, Anime, Music, Audiobooks
- Marketplace/Plugins (4 tabs: Catalogue, Kodi Repo, Installed, Convert Plugin)
- Settings > Integrations (TMDB + qBittorrent)
- Security (Bastion), VPN Portal (Tunnel), System Health
- Log Viewer, Downloads, Playlists, Streaming, Indexers
- Weather, Podcasts, Radio, Photos, Web Video
- Watch History, Watchlist, Discover, DVR

### Infrastructure
- Platform installers: Linux, macOS, Windows (with prerequisite checks)
- Docker installer with docker-compose
- Clean production database (v3.0.0-beta release ready)
- Module manifest system with module.json

## Test Credentials
- Email: test@test.com / Password: password

## Remaining Backlog
- P1: Implement qBittorrent C# client integration
- P1: EF Core Migrations for C# backend
- P2: Cloud Sync ("Marshmallow") module
- P2: Code Protection ("Fortress") module
- P2: Native code-signed installers (MSIX, DMG)
- P2: WebSocket real-time updates
- P2: Avalonia UI desktop client

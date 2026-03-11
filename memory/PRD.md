# WatchNexus - Product Requirements Document

## Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Single cohesive application with modular architecture where each module can be independently developed, updated, and installed.

## Architecture (v3.0.0-beta)
- **Backend:** C#/.NET 8, ASP.NET Core, Entity Framework Core, SQLite
- **Frontend:** React 18, TailwindCSS, Shadcn UI, Framer Motion
- **Auth:** JWT Bearer Tokens
- **Structure:** Unified modular monolith

```
watchnexus/
├── core/           # C# ASP.NET Core server
├── shared/         # Shared interfaces (IWatchNexusModule)
├── modules/        # Drop-in modules with module.json manifests
└── web/            # React SPA frontend
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
| Drizzle | Playlist Engine | Planned |
| Compote | Indexer Manager | Planned |
| Gelatin | Transcoding | Planned |
| Syrup | Scrapers | Planned |
| Beacon | System Tray | Planned |

## What's Implemented (March 11, 2026)

### C#/.NET 8 Backend (All endpoints 200)
- Auth: register, login, JWT, /users/me
- Libraries: CRUD, background scanning, TMDB metadata
- Security (Bastion): audit logs, IP rules, API keys, sessions
- VPN (Tunnel): server/peer config, WireGuard status
- Settings: integrations (TMDB, qBittorrent)
- Logs: file browser, latest entries, system health
- Downloads: engine status
- Dashboard: stats endpoint
- Bridge routes: /api/marmalade/*, /api/preferences, /api/dashboard

### React Frontend (All pages load)
- Dashboard, Browse Media (Netflix-style grid), Library Manager
- Settings > Integrations (TMDB + qBittorrent)
- Security (Bastion), VPN Portal (Tunnel), System Health
- Log Viewer, Downloads, Movies, TV Shows, Anime, Music
- Audiobooks, Playlists, Streaming, Indexers
- Weather, Podcasts, Radio, Photos

### Infrastructure
- Platform installers: Docker, Linux, Windows, macOS, Unraid
- All installers use .NET 8 (not Python)
- Clean production database (v3.0.0-beta release ready)
- Module manifest system with module.json

## Test Credentials
- Email: test@test.com / Password: password

## Remaining Backlog
- P1: Implement full module DLL loading (external modules as .NET assemblies)
- P1: Avalonia UI desktop client
- P2: Cloud Sync ("Marshmallow") module
- P2: Code Protection ("Fortress") module
- P2: Native code-signed installers (MSIX, DMG)
- P2: WebSocket real-time updates

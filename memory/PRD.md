# WatchNexus - Product Requirements Document

## Original Problem Statement
WatchNexus is a unified, self-hosted media pipeline. Migrated from Python/FastAPI to **C#/.NET 8** with Clean Architecture, enhanced with security hardening and VPN portal.

## Architecture
- **Backend**: C#/.NET 8 ASP.NET Core Web API (Clean Architecture)
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Framer Motion
- **Database**: SQLite via Entity Framework Core
- **Auth**: JWT Bearer tokens + role-based authorization

## Validated Module Codenames (16 total)
| Codename | Description | Status |
|---|---|---|
| Marmalade | Library Management | Active |
| Compote | Indexer Hub | Active |
| Fondue | Download Engine | Active |
| Garnish | Subtitle Manager | Active |
| Gelatin | External Access & Tunnels | Active |
| Zest | Log Viewer & Diagnostics | Active |
| Relish | IPTV Player | Active |
| Drizzle | Playlists | Active |
| Cream | Stream Links | Active |
| Fprint | Audio Fingerprint | Active |
| Potluck | Request System | Active |
| Sieve | Quality Profiles | Active |
| Syrup | Scraper Engine | Active |
| Tiramisu | Auto-Updater | Active |
| Bastion | Security & Audit | Active |
| Tunnel | VPN Portal | Active |

## API Controllers (22 total)
Auth, Users, Libraries, Media, Filesystem, Downloads, Indexers, Playlists, Watch Progress, IPTV, Subtitles, Podcasts, Radio, Photos, WebVideo, Security, VPN, Health, Zest (Logs), Settings

## Frontend Pages
- Dashboard, Library, Movies, TV Shows, Anime, Music, Playlists, Downloads, Streaming, Indexers, IPTV, Podcasts, Radio, Photos, Web Video
- **Security** (`/security`): Bastion dashboard — audit logs, IP rules, API keys, sessions
- **VPN Portal** (`/vpn`): Tunnel — WireGuard server/peers, QR codes, wg-quick controls
- **Library Manager** (`/library-manager`): Marmalade — add/scan/delete libraries
- **Log Viewer** (`/log-viewer`): Zest — live logs, level filters, system diagnostics
- **System** (`/system`): Health, 16 modules, security features

## Testing
- Backend: 100% (iterations 27-30)
- Frontend: 100% after MediaType enum fix
- Test reports: iteration_27 through iteration_30

## Test Credentials
- Email: test@test.com | Password: password | Role: Admin

## Upcoming Tasks (P1)
- TMDB API key integration (settings UI to configure)
- qBittorrent settings configuration UI
- Real WireGuard deployment (install wg-tools)
- Transcoding pipeline UI

## Future/Backlog (P2)
- Cloud Sync ("Marshmallow"), Code Protection ("Fortress")
- Docker/RPi distribution, Avalonia desktop client
- PostgreSQL migration, WebSocket real-time updates

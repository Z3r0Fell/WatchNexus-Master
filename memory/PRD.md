# WatchNexus - Product Requirements Document

## Original Problem Statement
WatchNexus is a unified, self-hosted media pipeline for media management. Migrated from Python/FastAPI/React to **C#/.NET 8** with Clean Architecture backend, enhanced with security hardening and VPN portal for outside access.

## Current Architecture
- **Backend**: C#/.NET 8 ASP.NET Core Web API (Clean Architecture)
- **Frontend**: React 19 with Tailwind CSS, Shadcn/UI, Framer Motion
- **Database**: SQLite via Entity Framework Core
- **Location**: `/app/src/dotnet/` (backend), `/app/frontend/` (frontend)
- **Port**: 8001 (matches Emergent platform ingress)
- **Auth**: JWT (Bearer tokens) with role-based authorization

## Solution Structure
```
/app/src/dotnet/
├── WatchNexus.sln
├── src/
│   ├── WatchNexus.API/          # Controllers (20), Middleware, Program.cs
│   ├── WatchNexus.Application/  # Application layer (DTOs, future CQRS)
│   ├── WatchNexus.Domain/       # Entities (Security.cs, VpnPortal.cs, etc.)
│   └── WatchNexus.Infrastructure/ # EF Core DbContext, Repositories, Services
└── start-api.sh
```

## Implemented Features

### Core API (20 Controllers)
- Auth, Users, Libraries, Media, Filesystem, Downloads, Indexers
- Playlists, Watch Progress, IPTV, Subtitles, Podcasts, Radio, Photos, Web Videos
- **SecurityController**: Audit logs, IP rules, API keys, sessions
- **VpnController**: Server config, peers, QR codes, WireGuard control, connection logs
- **HealthController**: Health check, system info

### Security Module ("Bastion")
- Audit logging middleware (all auth/security/VPN events)
- IP whitelist/blacklist with expiry
- API key management (generation, revocation, usage tracking)
- Session management with revocation
- Rate limiting (100 req/min sliding window)
- OWASP security headers (HSTS, X-Frame-Options, etc.)
- IP filtering middleware

### VPN Portal ("Tunnel")
- WireGuard server configuration and management
- Peer creation with auto IP assignment from subnet pool
- **QR code generation** (QRCoder) — scan with WireGuard mobile app
- Client .conf file generation and download
- **WireGuard system control** — wg-quick up/down, wg show (shell exec)
- Connection logging and bandwidth statistics
- Per-user access control

### Frontend Dashboard (3 new pages)
- **Security** (`/security`): 4 stat cards, tabbed (Audit Log, IP Rules, API Keys, Sessions)
- **VPN Portal** (`/vpn`): Server config, WireGuard controls with terminal output, peer cards with QR codes, connection logs
- **System** (`/system`): Health, runtime, security features grid, 15 modules

## Testing
- **Backend**: 53/53 tests passed (100%) — iteration_29
- **Frontend + Backend**: All pages 100% functional
- Test reports: iteration_27, iteration_28, iteration_29

## Test Credentials
- Email: test@test.com | Password: password | Role: Admin

## Mocked Components
- Subtitle search returns mock results
- Indexer test always returns success
- VPN keypair uses SHA256 placeholder (not real Curve25519)
- WireGuard commands (wg-quick/wg) not installed in preview env

## Upcoming Tasks (P1)
- TMDB API key integration for real metadata fetching
- Library scanning UI (trigger scans, show progress)
- Real WireGuard deployment (install wg-tools in production)
- Transcoding pipeline UI
- qBittorrent settings configuration UI

## Future/Backlog (P2)
- Cloud Sync ("Marshmallow")
- Code Protection ("Fortress")
- Docker/RPi distribution
- Real Curve25519 keypair generation
- PostgreSQL/SQL Server migration option
- WebSocket real-time updates
- Avalonia desktop client

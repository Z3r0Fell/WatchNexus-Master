# WatchNexus - Product Requirements Document

## Original Problem Statement
WatchNexus is a unified, self-hosted media pipeline for media management. The project has been migrated from Python/FastAPI/React to **C#/.NET 8** with a Clean Architecture backend.

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
│   ├── WatchNexus.API/          # Controllers, Middleware, Program.cs
│   ├── WatchNexus.Application/  # Application layer (DTOs, future CQRS)
│   ├── WatchNexus.Domain/       # Entities, Enums, Interfaces
│   └── WatchNexus.Infrastructure/ # EF Core DbContext, Repositories, Services
└── start-api.sh                 # Startup script
```

## Implemented Features (as of 2026-03-11)

### Core API (18 Controllers)
- **Auth**: Register, Login, Refresh, Logout (JWT + BCrypt)
- **Users**: CRUD, Profile, Password change, Admin management
- **Libraries**: CRUD, scan triggers, media browsing
- **Media**: Browse, stream, metadata, search
- **Filesystem**: Browse directories, drives, path validation
- **Downloads**: CRUD, pause/resume, stats
- **Indexers**: CRUD, test connectivity
- **Playlists**: CRUD, add/remove/reorder items
- **Watch Progress**: Track, continue watching, mark complete
- **IPTV**: Sources, channels, EPG
- **Subtitles**: Search, upload, delete
- **Podcasts**: Subscribe, episodes, playback
- **Radio**: Stations, favorites
- **Photos**: Libraries, browse, EXIF
- **Web Videos**: Bookmarks, search

### Security Module ("Bastion")
- Audit logging (all auth/security/VPN events) 
- IP access rules (whitelist/blacklist with expiry)
- API key management (generation, revocation, usage tracking)
- Session management (active sessions, revocation)
- Rate limiting (100 req/min sliding window per IP)
- Security headers (OWASP: HSTS, X-Frame-Options, CSP, etc.)
- IP filtering middleware

### VPN Portal ("Tunnel")
- WireGuard-based VPN server configuration
- Peer management (create, toggle, delete)
- Auto IP assignment from subnet pool
- Client config generation (WireGuard format, downloadable .conf)
- Connection logging and statistics
- Per-user access control

### Frontend Dashboard Pages
- **Security Dashboard** (`/security`): 4 stat cards, tabbed interface (Audit Log, IP Rules, API Keys, Sessions)
- **VPN Portal** (`/vpn`): Server config panel, peer management with add/toggle/delete, connection logs
- **System Info** (`/system`): Health status, runtime info, security features grid, 15 modules list

## Testing
- **Backend**: 45/45 tests passed (100% - iteration_27)
- **Frontend + Backend**: 100% pass (iteration_28)
- Test reports: `/app/test_reports/iteration_27.json`, `/app/test_reports/iteration_28.json`

## Test Credentials
- Email: test@test.com
- Password: password
- Role: Admin

## Mocked Components
- Subtitle search returns mock results
- Indexer test always returns success
- VPN keypair uses SHA256 placeholder (not real Curve25519)

## Upcoming Tasks (P1)
- Real WireGuard integration (wg-quick commands)
- TMDB metadata fetching with real API key
- Library scanning implementation
- Transcoding pipeline
- qBittorrent integration

## Future/Backlog (P2)
- Cloud Sync ("Marshmallow")
- Code Protection ("Fortress")
- Docker/RPi distribution
- Real Curve25519 keypair generation
- PostgreSQL/SQL Server migration option
- WebSocket real-time updates
- Avalonia desktop client

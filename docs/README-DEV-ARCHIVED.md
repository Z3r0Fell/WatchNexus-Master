# WatchNexus v2.8.4

> Unified, self-hosted media pipeline. Request, acquire, organize, and watch your media.

**QA & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)  
**Press Kit:** [docs/press-kit/](docs/press-kit/)

## What's New in 2.8.4

- **Real Indexer Search Engine** — Live RSS parsing across Nyaa.si, YTS, EZTV, Torznab, and generic RSS with quality/codec detection
- **TOTP 2FA** — Full two-factor authentication with Base32 secrets, QR code URIs, and backup codes (Bastion)
- **7 New Module Pages** — Glaze (Scrobbling), Saffron (Tasks), Fondue (Automation), Sourdough (Backups), Churro (Download Clients), Roux (Collections), Sprout (RSS Feeds)
- **System Dashboard Overhaul** — Real runtime metrics, 8 security feature indicators, 35 module listing
- **Configuration Cleanup** — All hardcoded placeholders removed, replaced with database-driven config
- **Enhanced VPN (Tunnel)** — WireGuard peer management, SSL certs, bandwidth monitoring, connectivity testing

## Repository Structure

```
WatchNexus/
├── src/                     # Source code
│   ├── watchnexus/          # C#/.NET 10 backend
│   │   ├── core/            # ASP.NET Core server (entry point)
│   │   │   ├── Data/        # AppDbContext + EF Core Migrations
│   │   │   ├── Controllers/ # API controllers (12+ files)
│   │   │   ├── Fortress.cs  # Code protection & integrity system
│   │   │   └── ModuleLoader.cs # Dynamic module compilation & loading
│   │   ├── shared/          # Shared interfaces (IWatchNexusModule)
│   │   └── modules/         # Module manifests
│   └── web/                 # React frontend (SPA)
│       ├── src/pages/       # Page components
│       ├── src/components/  # Reusable UI (Shadcn)
│       ├── src/services/    # API client layer
│       └── electron/        # Desktop app wrapper
│
├── separated/               # Standalone module projects (compiled at startup)
│   ├── marmalade/           # Library Manager
│   ├── bastion/             # Security
│   ├── tunnel/              # VPN Portal
│   ├── fondue/              # Downloads
│   ├── zest/                # Log Viewer
│   ├── drizzle/             # Playlists
│   ├── compote/             # Indexers
│   ├── gelatin/             # Transcoding
│   ├── syrup/               # Scrapers
│   └── beacon/              # System Tray
│
├── release_builds/          # Distributable archives
│   ├── WatchNexus-v2.8.4-win-x64.zip
│   └── WatchNexus-v2.8.4-linux-x64.tar.gz
│
├── scripts/                 # Build & install scripts
├── CHANGELOG.md
└── README.md
```

## Features

| Module | Codename | Description |
|--------|----------|-------------|
| Media Library | **Marmalade** | Scan directories, fetch TMDB metadata, organize collections |
| Security | **Bastion** | Audit logs, IP filtering, API keys, session management |
| VPN Portal | **Tunnel** | WireGuard server/peer management, QR configs |
| Downloads | **Fondue** | Built-in torrent engine + qBittorrent integration |
| Marketplace | **Ripen** | Module marketplace, Kodi repository, plugin management |
| Playlists | **Drizzle** | Queue management, playlists, skip markers |
| Indexers | **Compote** | Torrent indexer management, search |
| Transcoding | **Gelatin** | Media transcoding and quality profiles |
| Log Viewer | **Zest** | Application log browser and system diagnostics |
| Scrapers | **Syrup** | Live content scrapers |
| Tray App | **Beacon** | System tray controller for desktop |
| API Management | **Crumbs** | Centralized API key management for 11 services |
| Code Protection | **Fortress** | Assembly integrity, anti-tampering, license validation |
| Weather | **Sorbet** | Weather dashboard powered by Open-Meteo |
| Podcasts | **Brioche** | Podcast player with iTunes search and RSS feeds |
| Internet Radio | **Nectar** | Live radio streams via Radio Browser API |
| Photo Gallery | **Ganache** | Browse and view photos from local libraries |
| Web Video | **Bisque** | Web video bookmarks, history, and YouTube info |
| Matrix Chat | **Marzipan** | Matrix messaging, room management, and event sync |
| Synapse Admin | **Cinnamon** | Synapse homeserver user, room, and media management |
| Movie Quiz | **Waffle** | Guess-the-poster games with blur and reveal effects |
| Background Automation | **Yeast** | Inactivity checks, token drip, featured film rotation |
| Auth | **Sourdough** | JWT authentication, registration, session management |
| IPTV | **Taffy** | Live TV channel streams and EPG management |
| qBittorrent | **Churro** | Torrent client integration and download management |
| Subtitles | **Saffron** | Subtitle search and download from OpenSubtitles |
| Filesystem | **Pantry** | File and directory browser for media storage |
| System Stats | **Nutmeg** | CPU, memory, disk, and process monitoring |

## Fortress Security

WatchNexus includes a built-in code protection system:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fortress/status` | GET | Current security status, assembly count, license info |
| `/api/fortress/verify` | POST | Manual integrity re-check of all tracked assemblies |
| `/api/fortress/audit` | GET | Security event log (`?limit=50&offset=0`) |
| `/api/fortress/audit/export` | GET | Full audit log as JSON download |

Fortress computes SHA-256 baselines for all WatchNexus assemblies at startup, performs periodic runtime integrity checks, and auto-locks the API if tampering is detected. All events are persisted to `data/fortress/audit.jsonl`.

## Quick Start

### From Release Build
```bash
# Linux
tar xzf WatchNexus-v2.8.4-linux-x64.tar.gz
cd WatchNexus-v2.8.4-linux-x64
sudo bash install.sh
# Open http://localhost:8001

# Windows
# Extract WatchNexus-v2.8.4-win-x64.zip
# Run start-watchnexus.bat
# Open http://localhost:8001
```

### From Source
```bash
# Backend
cd src/watchnexus/core
dotnet run

# Frontend (separate terminal)
cd src/web
yarn install
yarn build        # production build
yarn start        # dev server
```

### Docker
```bash
cd installers/docker
docker compose up -d
```

### Platform Installers
```bash
# Linux (systemd)
sudo bash scripts/install-linux.sh

# Windows (Run as Admin)
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

All installers register WatchNexus as a **system service** that auto-starts on boot and restarts on crash.

## Tech Stack

- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Database:** SQLite with EF Core Migrations
- **Metadata:** TMDB API, OMDB API
- **Downloads:** qBittorrent Web API
- **Messaging:** Matrix Client-Server API
- **Weather:** Open-Meteo API
- **Security:** Fortress (assembly integrity, anti-tampering, license validation)

## Testing

**QA Dashboard & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

## License

Private - All rights reserved.

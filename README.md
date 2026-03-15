# WatchNexus v2.6.5

> Unified, self-hosted media pipeline. Request, acquire, organize, and watch your media.

**QA & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

## Repository Structure

```
WatchNexus/
├── src/                     # Source code
│   ├── watchnexus/          # C#/.NET 10 backend
│   │   ├── core/            # ASP.NET Core server (entry point)
│   │   ├── shared/          # Shared interfaces (IWatchNexusModule)
│   │   └── modules/         # Module manifests
│   └── web/                 # React frontend (SPA)
│       ├── src/pages/       # Page components
│       ├── src/components/  # Reusable UI (Shadcn)
│       ├── src/services/    # API client layer
│       └── electron/        # Desktop app wrapper
│
├── separated/               # Standalone module projects
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
├── docs/                    # Documentation + images
│   ├── images/              # App screenshots
│   └── *.md                 # Guides, plans, research
│
├── installers/              # Platform-specific installers
│   ├── docker/              # Docker + docker-compose
│   ├── linux/               # systemd installer
│   ├── macos/               # .app bundle + LaunchDaemon
│   ├── windows/             # Scheduled Task installer
│   └── unraid/              # Unraid template
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
| Marketplace | **Gadgets** | Module marketplace, Kodi repository, plugin management |
| Playlists | **Drizzle** | Queue management, playlists, skip markers |
| Indexers | **Compote** | Torrent indexer management, search |
| Transcoding | **Gelatin** | Media transcoding and quality profiles |
| Log Viewer | **Zest** | Application log browser and system diagnostics |
| Scrapers | **Syrup** | Live content scrapers |
| Tray App | **Beacon** | System tray controller for desktop |

## Quick Start

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
# Linux (Debian/Ubuntu/Fedora)
sudo bash scripts/install-linux.sh

# macOS
bash scripts/install-mac.sh

# Windows (Run as Admin)
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

All installers register WatchNexus as a **system service** that auto-starts on boot and restarts on crash.

## Tech Stack

- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Metadata:** TMDB API
- **Downloads:** qBittorrent Web API

## Testing

**QA Dashboard & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

## License

Private - All rights reserved.

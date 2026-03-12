# WatchNexus v2.6.5

> Unified, self-hosted media pipeline. Request, acquire, organize, and watch your media.

## Repository Structure

```
WatchNexus/
├── watchnexus/              # C#/.NET 10 backend
│   ├── core/                # ASP.NET Core server (entry point)
│   ├── shared/              # Shared interfaces (IWatchNexusModule)
│   └── modules/             # Drop-in module manifests
│       ├── marmalade/       # Library Manager
│       ├── bastion/         # Security
│       ├── tunnel/          # VPN Portal
│       ├── fondue/          # Downloads
│       ├── zest/            # Log Viewer
│       ├── drizzle/         # Playlists
│       ├── compote/         # Indexers
│       ├── gelatin/         # Transcoding
│       ├── syrup/           # Scrapers
│       └── beacon/          # System Tray
│
├── web/                     # React frontend (SPA)
│   ├── src/
│   │   ├── pages/           # All page components
│   │   ├── components/      # Reusable UI (Shadcn)
│   │   └── services/        # API client layer
│   └── electron/            # Desktop app wrapper
│
├── installers/              # Platform-specific installers
│   ├── docker/              # Docker + docker-compose
│   ├── linux/               # .NET 10 systemd installer
│   ├── macos/               # .app bundle + LaunchDaemon
│   ├── windows/             # Scheduled Task installer
│   └── unraid/              # Unraid template
│
├── scripts/                 # Build & install scripts
│   ├── install-linux.sh     # Full Linux installer (apt/dnf)
│   ├── install-mac.sh       # Full macOS installer (Homebrew)
│   ├── install-windows.ps1  # Full Windows installer
│   └── build-arch.sh        # Arch Linux build
│
├── docs/                    # Documentation
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
cd watchnexus/core
dotnet run

# Frontend (separate terminal)
cd web
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

## License

Private - All rights reserved.

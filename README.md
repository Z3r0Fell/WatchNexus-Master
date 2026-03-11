# WatchNexus v3.0.0-beta

> Unified, self-hosted media pipeline. Request, acquire, organize, and watch your media.

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
| Updater | **Tiramisu** | Auto-update system |

## Gadgets

- Weather dashboard
- Podcast player (RSS subscriptions)
- Internet radio
- Photo library browser
- IPTV viewer
- Live TV / DVR

## Quick Start

### Docker
```bash
cd installers/docker
docker compose up -d
open http://localhost:8001
```

### From Source (.NET 10)
```bash
cd watchnexus/core
dotnet run
# Dashboard: http://localhost:5236
```

### Manual (Python backend)
```bash
cd src/server
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001
```

## Tech Stack

- **Backend (C#):** .NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Backend (Python):** Python 3.11, FastAPI, MongoDB
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Metadata:** TMDB API
- **Downloads:** qBittorrent Web API

## Installers

| Platform | Method |
|----------|--------|
| Docker | `installers/docker/` |
| Linux | `installers/linux/install.sh` |
| Windows | `installers/windows/install.bat` |
| macOS | `installers/macos/install.sh` |
| Unraid | `installers/unraid/watchnexus.xml` |

## License

Private - All rights reserved.

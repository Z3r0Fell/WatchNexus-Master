# WatchNexus Source Code

## Architecture

```
src/
├── server/          # Python/FastAPI backend (primary)
│   ├── server.py    # Main API server (6000+ LOC)
│   ├── database.py  # SQLite database layer
│   ├── bastion.py   # Security module
│   ├── tunnel.py    # VPN module
│   ├── marmalade_server.py  # Media library manager
│   ├── qbittorrent_client.py  # qBittorrent integration
│   ├── zest.py      # Log viewer
│   ├── drizzle.py   # Playlist engine
│   ├── fondue.py    # Download manager
│   ├── compote.py   # Indexer manager
│   ├── gelatin.py   # Transcoding
│   ├── syrup_scrapers.py  # Live scrapers
│   └── ...
└── web/             # React frontend (symlinked as /app/frontend)
    ├── src/
    │   ├── App.js           # Root router
    │   ├── pages/           # Page components
    │   ├── components/      # Reusable components
    │   ├── services/        # API clients
    │   └── context/         # React contexts
    └── public/
```

## Module Codenames

| Codename | Module | Description |
|----------|--------|-------------|
| **Marmalade** | Library Manager | Media scanning, TMDB metadata |
| **Bastion** | Security | Audit logs, IP rules, API keys |
| **Tunnel** | VPN Portal | WireGuard management |
| **Zest** | Log Viewer | Application log browser |
| **Drizzle** | Playlists | Queue and playlist engine |
| **Fondue** | Downloads | Download management |
| **Compote** | Indexers | Torrent indexer manager |
| **Gelatin** | Transcoding | Media transcoding |
| **Syrup** | Scrapers | Live content scrapers |
| **Beacon** | Tray App | System tray controller |
| **Tiramisu** | Updater | Auto-update system |

## Tech Stack

- **Backend:** Python 3.11, FastAPI, SQLite, httpx
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Metadata:** TMDB API
- **Downloads:** qBittorrent Web API, Built-in torrent engine

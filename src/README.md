# WatchNexus Source Code

This directory contains the WatchNexus application source code organized in a Jellyfin-style modular structure.

## Directory Structure

```
/app/src/
├── WatchNexus.Server/      # Backend FastAPI application
│   ├── server.py           # Main application entry point
│   ├── marmalade_server.py # 🍯 Media library management
│   ├── compote.py          # 🍮 Indexer integration
│   ├── garnish.py          # 🌿 Subtitle services
│   ├── milk.py             # 🥛 Theme engine
│   ├── zest.py             # 🍋 Log viewer
│   ├── drizzle.py          # 💧 Playlist engine
│   ├── sieve.py            # 🧪 Media health checker
│   ├── gelatin.py          # 🧈 Jellyfin compatibility
│   ├── relish.py           # 🍭 IPTV integration
│   ├── fondue.py           # 🧀 Audio fingerprinting
│   ├── potluck.py          # 🍲 qBittorrent client
│   └── database.py         # Database layer
│
├── WatchNexus.Web/         # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   └── services/       # API services
│   ├── public/             # Static assets
│   └── package.json        # Dependencies
│
├── WatchNexus.Plugins/     # Plugin system
│   ├── core/               # Plugin infrastructure
│   ├── builtin/            # Built-in plugins
│   └── installed/          # User-installed plugins
│
└── WatchNexus.Common/      # Shared utilities
    ├── config.py           # Configuration management
    ├── logging.py          # Logging utilities
    ├── auth.py             # Authentication helpers
    └── database.py         # Database utilities
```

## Module Code Names

| Module | Code Name | Description |
|--------|-----------|-------------|
| marmalade | 🍯 | Media library and scanning |
| compote | 🍮 | Indexer management |
| garnish | 🌿 | Subtitle services |
| milk | 🥛 | Theme engine |
| zest | 🍋 | Log viewer |
| drizzle | 💧 | Playlists |
| sieve | 🧪 | Media health |
| gelatin | 🧈 | External access |
| relish | 🍭 | IPTV |
| fondue | 🧀 | Audio fingerprinting |
| potluck | 🍲 | Torrent client |
| gadgets | 🔧 | Plugin system |
| cream | 🍨 | Streaming services |

## Building

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --reload
```

### Frontend
```bash
cd /app/frontend
yarn install
yarn start
```

## Version

Current version: **2.3.0**

See `/app/memory/PRD.md` for changelog and roadmap.

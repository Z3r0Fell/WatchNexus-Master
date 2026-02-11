# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces the need for multiple applications like Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin. The goal is a single, fully self-contained application that handles requesting, acquiring, organizing, and watching media.

## Module Code Names (Food Theme 🍯)

| Module | Code Name | Description | File |
|--------|-----------|-------------|------|
| Indexer Aggregator | **Syrup** 🍯 | Aggregates multiple indexers, live scrapers | `syrup_scrapers.py` |
| Challenge Solver | **Preserve** 🫙 | Cloudflare bypass / anti-bot protection | `compote.py` |
| Usenet Handler | **Pulp** 🍊 | Usenet/NZB download management | `compote.py` |
| Indexer Manager | **Compote** 🍇 | Central manager for Syrup, Preserve, Pulp | `compote.py` |
| Media Server | **Marmalade** 🍊 | Library management, streaming, progress | `marmalade_server.py` |
| External Access | **Gelatin** 🍮 | LAN discovery, tunneling, share links | `gelatin.py` |
| Watch Party | **Potluck** 🍲 | WebSocket sync, chat, reactions | `potluck.py` |
| Subtitle Service | **Garnish** 🌿 | Addic7ed/OpenSubtitles integration | `garnish.py` |
| Torrent Engine | **Fondue** 🫕 | Built-in libtorrent client | `fondue.py` |
| Media Health | **Sieve** 🫗 | File validation, repair, scans | `sieve.py` |
| Plugin System | **Gadgets** 🔧 | Extension/plugin framework | `gadgets.py` |
| Theme Engine | **Milk** 🥛 | Visual customization, Theme Forge | `milk.py` |
| Color Picker | **Juice** 🧃 | Color selection component | `JuiceColorPicker.jsx` |
| IPTV Manager | **Relish** 📺 | M3U parsing, EPG, live TV | `relish.py` |

## What's Implemented (as of Feb 2025)

### ✅ All P0 Features Complete
- Full-stack React + FastAPI + MongoDB architecture
- JWT Authentication with Google OAuth
- TMDB API integration
- Built-in torrent engine (Fondue)
- Library management (Marmalade)
- Watch progress tracking
- External access (Gelatin)
- Watch Party (Potluck) with video integration
- Subtitle service (Garnish) with VideoPlayer integration
- Theme engine (Milk) with Theme Forge UI
- Plugin system (Gadgets)
- Marketing website (watchnexus.ca)
- Build/install scripts for all platforms

### ✅ All P1 Features Complete
- IPTV Integration (Relish) - M3U parsing, EPG, channel management
- Usenet/NZB support (Pulp)
- VideoPlayer subtitle overlay with Garnish
- Watch Party video integration with Marmalade
- Live TV page with full channel management UI

### 📋 Remaining Backlog
- Client apps (Android, Android TV, Chromecast, Kodi)
- Investigate Roku & Fire Stick
- Plugin marketplace
- Theme community sharing
- Full EPG guide view

## API Endpoints Summary

### IPTV (Relish) - NEW
- `GET /api/iptv/stats` - Statistics
- `GET/POST/DELETE /api/iptv/sources` - Source CRUD
- `POST /api/iptv/sources/{id}/refresh` - Refresh channels
- `GET /api/iptv/channels` - List with filters
- `GET /api/iptv/groups` - Channel groups
- `POST /api/iptv/channels/{id}/favorite` - Toggle favorite
- `GET /api/iptv/epg/{id}` - EPG programs
- `GET /api/iptv/export` - Export M3U

### Pulp (Usenet) - NEW
- `GET /api/pulp/queue` - NZB queue
- `POST /api/pulp/queue` - Add NZB
- `POST /api/pulp/search` - Search Newznab
- `POST /api/pulp/parse-nzb` - Parse NZB

## Architecture
```
/app/
├── backend/
│   ├── compote.py      # Indexer + Pulp
│   ├── fondue.py       # Torrent engine
│   ├── gadgets.py      # Plugins
│   ├── garnish.py      # Subtitles
│   ├── gelatin.py      # External access
│   ├── marmalade_server.py  # Media server
│   ├── milk.py         # Themes
│   ├── potluck.py      # Watch party
│   ├── relish.py       # IPTV (NEW)
│   ├── server.py       # FastAPI routes
│   ├── sieve.py        # Media health
│   └── syrup_scrapers.py
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── VideoPlayer.jsx  # With subtitle overlay
│       │   └── juice/JuiceColorPicker.jsx
│       └── pages/
│           ├── LiveTVPage.js    # Full IPTV UI (NEW)
│           ├── SettingsPage.js  # Theme Forge + Plugins
│           └── WatchPartyPage.js # Video integration
├── scripts/
│   ├── build-arch.sh
│   ├── install-linux.sh
│   ├── install-mac.sh
│   └── install-windows.ps1
└── website/            # Marketing site
```

## Test Credentials
- Email: test@test.com
- Password: password

## Preview URL
https://streamvault-209.preview.emergentagent.com

## Next Steps: Client App Planning
1. Android mobile app
2. Android TV app
3. Chromecast support
4. Kodi addon
5. Investigate: Roku & Amazon Fire Stick

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

### ✅ Session Feb 11, 2025 - Complete
- Legal Pages on Marketing Website (Terms & Conditions, Legal Disclaimer)
- EPG Guide View with full timeline implementation in Live TV page
- Plugin Marketplace page (full UI with sample plugins)
- Theme Community page (full UI with theme previews)
- DVR Recording page (full UI with scheduling/management)
- **Fixed Syrup Scrapers**: Updated YTS and EZTV to use working mirror domains
  - YTS: `yts.torrentbay.st` (primary), fallbacks available
  - EZTV: `eztvx.to` (primary), fallbacks available
  - Both scrapers now return real results with magnet links
- **Hidden Jellyfin-Compatible API**: `/api/emby/*` endpoints for existing clients
  - System info, authentication, library views, items, images, playback
  - Compatible with Jellyfin/Emby clients (Infuse, Swiftfin, etc.)
- **Kickstarter Campaign Document**: `/app/docs/KICKSTARTER-CAMPAIGN.md`
- **Client App Research**: `/app/docs/CLIENT-APP-RESEARCH.md`
- **Updated Login Logo**: Replaced play button with proper WatchNexus gradient logo
- **Users Management Tab**: New Settings > Users tab with full CRUD operations
  - Create, edit, delete users
  - Role assignment (admin/user/guest)
  - Granular permissions (download, delete, manage library, settings access)
  - Max concurrent streams setting
  - Server access info panel showing Jellyfin API endpoint
- **Library File Browser**: Browse button in Library tab to navigate local filesystem
  - Full folder navigation with item counts
  - Quick access shortcuts (/, /home, /media, /mnt, /srv, /data, Home)
  - Auto-detect library name and media type from folder name
  - Select folder to add as library
- **Media Management Sub-Tabs** (Sonarr-like): New sub-tab structure in Library settings
  - Libraries: Main library management (existing)
  - Media Management: File naming, importing, organization settings
  - Quality Profiles: Define quality preferences (HD-720p, Ultra-HD, etc.)
  - Mass Editor: Bulk edit multiple libraries
  - Manual Import: Import files from custom paths

### 📋 Remaining Backlog
- Client apps (Android, Android TV, Chromecast, Kodi)
- ✅ Roku & Fire Stick Research Complete (see /app/docs/CLIENT-APP-RESEARCH.md)
  - Fire Stick: ✅ HIGHLY FEASIBLE (Android-based, easy sideload)
  - Roku: ⚠️ DEPRIORITIZED (proprietary BrightScript, no code reuse)
- Connect Plugin Marketplace to backend API (currently uses sample data)
- Connect Theme Community to backend API (currently uses sample data)
- Connect DVR to backend recording service

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
│           ├── DVRPage.js        # DVR Recording (NEW)
│           ├── LiveTVPage.js     # Full IPTV UI + EPG Guide
│           ├── PluginMarketplacePage.js  # Plugin Marketplace (NEW)
│           ├── SettingsPage.js   # Theme Forge + Plugins
│           ├── ThemeCommunityPage.js     # Theme Community (NEW)
│           └── WatchPartyPage.js # Video integration
├── scripts/
│   ├── build-arch.sh
│   ├── install-linux.sh
│   ├── install-mac.sh
│   └── install-windows.ps1
└── website/            # Marketing site
    └── src/pages/
        ├── TermsPage.jsx       # Terms & Conditions (NEW)
        └── DisclaimerPage.jsx  # Legal Disclaimer (NEW)
```

## Test Credentials
- Email: test@test.com
- Password: password

## Preview URL
https://viewhub-1008.preview.emergentagent.com

## Next Steps: Client App Planning
1. Android mobile app
2. Android TV app
3. Chromecast support
4. Kodi addon
5. Investigate: Roku & Amazon Fire Stick

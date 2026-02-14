# WatchNexus - Unified Media Pipeline

## Product Requirements Document

### Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single, fully self-contained application for requesting, acquiring, organizing, and watching media.

### Architecture
- **Frontend**: React (port 3000)
- **Backend**: FastAPI (port 8001)
- **Database**: MongoDB
- **Torrent Engine**: LTorrent (pure Python, v1.6.0)

### Key Components (Food-themed)
- **Fondue**: Built-in torrent engine (LTorrent-based, magnet + .torrent)
- **Compote**: Indexer aggregation
- **Pulp**: Usenet downloader
- **Garnish**: Subtitle management
- **Gelatin**: DLNA/UPnP streaming
- **Marmalade**: Live TV/IPTV
- **Milk**: Media acquisition automation
- **Potluck**: Plugin system
- **Relish**: Request management
- **Sieve**: Metadata matching
- **Syrup**: Web scrapers
- **Gadgets**: Widget system

---

## What's Been Implemented

### Core Application ✅
- Full-stack React + FastAPI application
- User authentication (JWT + Google OAuth)
- MongoDB integration
- Jellyfin-compatible API layer
- Complete UI with dark theme

### Pages & Features ✅
- Dashboard with continue watching, trending
- Movies & TV Shows browsing
- Discover page
- Downloads management
- Watchlist
- Live TV (IPTV support)
- Settings (General, Users, Library, Media, Quality, etc.)
- Plugin Marketplace
- Theme Forge (custom themes)

### Infrastructure ✅
- Installation scripts (Linux, Windows, Arch)
- Release package generator
- Build guides
- Marketing website

---

## Recent Changes (Feb 2026)

### v1.0.2 - LTorrent Integration (Current)
- **Library**: LTorrent (pure Python)
- **Magnet links**: ✅ SUPPORTED
- **.torrent files**: ✅ SUPPORTED
- **Dependencies**: `bcoding`, `requests`, `ipaddress` (all pure Python)
- **No system packages required**

### v1.0.1 - aiotorrent (Superseded)
- Magnet links not supported - user rejected

### Files Modified
- `/app/backend/fondue.py` - Complete rewrite for LTorrent
- `/app/backend/requirements.txt` - LTorrent from GitHub
- `/app/scripts/create_releases.py` - Release generator
- Release packages in `/app/dist/`

---

## Backlog

### P0 - Critical
- [x] Fix torrent library dependency issue
- [x] Add magnet link support

### P1 - High Priority
- [ ] **Test release packages on user machines** (Linux, Windows)
- [ ] Complete Kickstarter video assets
- [ ] Test Usenet (Pulp) and Indexer (Compote) modules

### P2 - Medium Priority
- [ ] Connect Community & DVR pages to backend
- [ ] Client app architecture documentation

### P3 - Future
- [ ] Roku/Universal app
- [ ] Cloud sync feature
- [ ] Android/iOS apps

---

## Test Credentials
- Email: `test@test.com`
- Password: `password`

---

## External Integrations
- TMDB (The Movie Database)
- Google OAuth
- BeautifulSoup4 (scraping)
- Addic7ed (subtitles)
- LTorrent (torrents - pure Python)

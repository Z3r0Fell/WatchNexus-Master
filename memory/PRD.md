# WatchNexus - Unified Media Pipeline

## Product Requirements Document

### Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single, **fully self-contained application** for requesting, acquiring, organizing, and watching media.

---

## Current Version: 1.2.7

### Recent Changes (v1.2.7 - Feb 15, 2026)
- **SVG Favicon** - WatchNexus logo SVG now used as browser favicon
- **System Tray Icon** - tray_app.py updated to load WatchNexus logo (SVG/PNG) with status overlay

### Previous Changes (v1.2.6 - Feb 14, 2026)
- **Add to Playlist UI** - AddToPlaylistButton component added to MediaCard and MediaDetails pages
- **Plugin Import** - Users can now import plugins from file upload or URL
- **Plugin Uninstall** - Delete button added to remove installed plugins
- **Settings Page Redesign** - Converted from tabs to categorized sidebar navigation
- **System Tray App** - Cross-platform tray application created (tray_app.py)

### Bug Fixes (v1.2.5 - Feb 2026)
- **Fixed: API URL Configuration** - Frontend now supports both development (preview URL) and production (same-origin) modes
- **Fixed: Blank Home Page** - Root cause was hardcoded REACT_APP_BACKEND_URL in production builds
- **Fixed: Libraries Not Populating** - Media files now scan and display correctly
- **Fixed: Missing Browse Button** - Folder browser modal now accessible from Settings -> Library
- **Fixed: Playlists Page Blank** - Wrapped in Layout component
- **Fixed: Plugins Page Blank** - Now discovers bundled plugins correctly

---

## Architecture

### Stack
- **Frontend**: React 18 (served by FastAPI at port 8001)
- **Backend**: FastAPI (Python 3.10+)
- **Database**: SQLite with WAL mode
- **Torrent Engine**: LTorrent (pure Python)

---

## Module Codenames

| Codename | Module | Description |
|----------|--------|-------------|
| **Fondue** | Torrent Engine | BitTorrent download engine |
| **Compote** | Indexer Manager | Aggregates torrent indexers |
| **Syrup** | Live Scraper | Real-time site scraping |
| **Sieve** | Media Health | File health checker |
| **Preserve** | Challenge Solver | Cloudflare bypass |
| **Potluck** | Watch Party | Synchronized viewing |
| **Drizzle** | Playlist Engine | Continuous playback |
| **Marmalade** | Media Server | Library management & streaming |
| **Gadgets** | Plugin System | Extensible plugin architecture |

---

## What's Working (v1.2.6)

### Core Features
- User registration and login
- SQLite database (zero dependencies)
- TMDB integration for movie/TV/anime metadata
- Library management with folder browser
- Auto-scan on library add
- Watchlist and progress tracking
- Multi-user with permissions
- **NEW: Add media to playlists from any media card**
- **NEW: Import/uninstall plugins**
- **NEW: Reorganized settings with sidebar navigation**
- Built-in torrent engine (Fondue)
- Drizzle playlist system

### Pages
- Home (hero + trending)
- Movies (grid with filters)
- TV Shows
- Anime (Japanese animation)
- Playlists
- Library (with folder browser)
- Downloads
- Settings (with Maintenance tab)

---

## Release Packages

Current release: **v1.2.4**

- `/app/dist/watchnexus-v1.2.4-linux.zip` (90.1 MB)
- `/app/dist/watchnexus-v1.2.4-windows.zip` (90.1 MB)

---

## Key API Endpoints

### Library (Marmalade)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/marmalade/libraries` | GET/POST | List/Add libraries |
| `/api/marmalade/libraries/{id}/scan` | POST | Scan library |
| `/api/filesystem/browse` | GET | Browse directories |

### TMDB
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tmdb/discover/{media_type}` | GET | Discover with filters |
| `/api/tmdb/trending/{type}/{window}` | GET | Trending content |

### Drizzle (Playlists)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/drizzle/playlists` | GET/POST | List/Create playlists |
| `/api/drizzle/queue` | GET | Active queue state |

---

## Backlog

### P0 - Critical
- [x] Auth token bug fix
- [x] Folder browser
- [x] Anime section
- [x] API URL configuration fix (dev/prod modes)
- [ ] Test with actual media files

### P1 - High Priority
- [ ] Windows release testing
- [ ] Video player improvements
- [ ] macOS release

### P2 - Enhancements
- [ ] AI intro/credits detection
- [ ] Post-credits handling

### P3 - Future
- [ ] Roku/Universal app
- [ ] Cloud sync
- [ ] Mobile apps

---

## Files of Reference

### Backend
- `/app/backend/server.py` - Main FastAPI server (v1.2.4)
- `/app/backend/database.py` - SQLite database layer
- `/app/backend/drizzle.py` - Playlist engine
- `/app/backend/marmalade_server.py` - Media library server

### Frontend
- `/app/frontend/src/lib/config.js` - API URL configuration (NEW - handles dev/prod modes)
- `/app/frontend/src/pages/AnimePage.js` - Anime page (NEW)
- `/app/frontend/src/pages/LibraryPage.js` - Library with folder browser
- `/app/frontend/src/components/FolderBrowser.jsx` - Directory picker (NEW)
- `/app/frontend/src/components/layout/Sidebar.js` - Navigation with Anime link

### Scripts
- `/app/scripts/create_releases.py` - Release package generator
- `/app/tray_app.py` - Cross-platform system tray application

### Documentation
- `/app/memory/CHANGELOG.md` - Version history
- `/app/memory/PRD.md` - This file
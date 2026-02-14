# WatchNexus - Unified Media Pipeline

## Product Requirements Document

### Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single, **fully self-contained application** for requesting, acquiring, organizing, and watching media.

---

## Current Version: 1.2.4

### Recent Changes (v1.2.4)
- **Anime Section** - Dedicated anime page with Japanese animation filtering
- **Folder Browser** - Visual directory picker for library paths
- **Auto-Scan** - Libraries automatically scan after being added
- **Enhanced TMDB Discover** - Backend supports language/keyword filters

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

---

## What's Working (v1.2.4)

### Core Features
- User registration and login
- SQLite database (zero dependencies)
- TMDB integration for movie/TV/anime metadata
- Library management with folder browser
- Auto-scan on library add
- Watchlist and progress tracking
- Multi-user with permissions
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
- `/app/frontend/src/pages/AnimePage.js` - Anime page (NEW)
- `/app/frontend/src/pages/LibraryPage.js` - Library with folder browser
- `/app/frontend/src/components/FolderBrowser.jsx` - Directory picker (NEW)
- `/app/frontend/src/components/layout/Sidebar.js` - Navigation with Anime link

### Scripts
- `/app/scripts/create_releases.py` - Release package generator

### Documentation
- `/app/memory/CHANGELOG.md` - Version history
- `/app/memory/PRD.md` - This file
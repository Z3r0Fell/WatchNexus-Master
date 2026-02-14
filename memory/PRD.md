# WatchNexus - Unified Media Pipeline

## Product Requirements Document

### Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single, **fully self-contained application** for requesting, acquiring, organizing, and watching media.

The goal is to be **simpler than Plex, more powerful than Jellyfin, with ZERO external dependencies**.

---

## Current Version: 1.2.1

### Versioning Scheme
- **MAJOR** (1.x.x): Breaking changes, major architecture shifts
- **MINOR** (x.2.x): New features, significant enhancements  
- **PATCH** (x.x.0): Bug fixes, code changes

See [CHANGELOG.md](/app/CHANGELOG.md) for full version history.

---

## Architecture

### Stack
- **Frontend**: React 18 (served by FastAPI at port 8001)
- **Backend**: FastAPI (Python 3.10+)
- **Database**: SQLite with WAL mode
- **Torrent Engine**: LTorrent (pure Python)

### Database Features
- **WAL mode**: Concurrent read/write, no blocking
- **Auto-backup**: Creates backup on every startup (keeps 7)
- **Auto-VACUUM**: Optimizes database every 24 hours
- **64MB cache**: Fast queries for large libraries

### Capacity
- Handles 1,500+ movies, 3,000+ TV shows easily
- SQLite tested with millions of records
- Same engine used by Jellyfin and Plex

---

## What's Working (v1.2.0)

### Core Features
- ✅ User registration and login
- ✅ SQLite database (zero external dependencies)
- ✅ Server serves frontend (single executable)
- ✅ TMDB integration for movie/TV metadata
- ✅ Watchlist and watch progress tracking
- ✅ Multi-user with permissions
- ✅ LTorrent for magnet links and .torrent files

### New in v1.2.1
- ✅ **File-based logging** with rotation (10MB, 7 backups)
- ✅ **Log viewer in Maintenance tab** - view, download, clear logs
- ✅ **Better start script** - stop/status commands, port conflict handling

### New in v1.2.0
- ✅ **Maintenance Tab** in Settings
  - Server status (uptime, CPU, memory)
  - System info (platform, Python version)
  - Database health monitoring
  - Backup management
  - Cache statistics
  - Torrent engine status

---

## Release Packages

Current release: **v1.2.0**

- `/app/dist/watchnexus-v1.2.0-linux.zip`
- `/app/dist/watchnexus-v1.2.0-windows.zip`

### Requirements
- Python 3.10+ (that's it!)

---

## API Endpoints

### System Maintenance
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/system/info` | GET | Basic app info (public) |
| `/api/system/stats` | GET | Detailed system statistics |
| `/api/db/stats` | GET | Database health info |
| `/api/db/backups` | GET | List all backups |
| `/api/db/vacuum` | POST | Optimize database |
| `/api/db/backup` | POST | Create manual backup |
| `/api/cache/stats` | GET | TMDB cache info |
| `/api/cache/clear` | POST | Clear TMDB cache |
| `/api/torrent/status` | GET | Torrent engine status |

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user |
| `/api/auth/login` | POST | User login |
| `/api/auth/me` | GET | Current user info |
| `/api/auth/logout` | POST | Logout |

---

## Backlog

### P0 - Critical
- [x] SQLite database (zero dependencies)
- [x] Database hardening (WAL, backups, VACUUM)
- [x] Maintenance tab in Settings
- [ ] User testing of v1.2.0 release

### P1 - High Priority
- [ ] Windows release package testing
- [ ] Video assets for Kickstarter
- [ ] Full end-to-end standalone testing

### P2 - Playback Playlist Feature (User Requested)
- [ ] Queue-based playlists (movies + TV)
- [ ] Auto-play next on credits/end
- [ ] Skip intro/outro/credits
- [ ] Post-credits scene handling (MCU-style)
- [ ] "Play All" for collections, "Play Season" for TV
- [ ] AI-powered intro/credits detection

### P3 - Future
- [ ] Roku/Universal app
- [ ] Cloud sync
- [ ] Android/iOS apps

---

## External Integrations
- TMDB (The Movie Database)
- Google OAuth (Emergent-managed)
- BeautifulSoup4 (scraping)
- Addic7ed (subtitles)
- LTorrent (torrents - pure Python)

---

## Files of Reference

### Backend
- `/app/backend/server.py` - Main FastAPI server
- `/app/backend/database.py` - SQLite database layer
- `/app/backend/fondue.py` - Torrent engine (LTorrent)

### Frontend
- `/app/frontend/src/pages/SettingsPage.js` - Settings with tabs
- `/app/frontend/src/components/settings/MaintenanceSettings.jsx` - Maintenance tab

### Scripts
- `/app/scripts/create_releases.py` - Release package generator

### Documentation
- `/app/CHANGELOG.md` - Version history
- `/app/memory/PRD.md` - This file

# WatchNexus - Unified Media Pipeline

## Product Requirements Document

### Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single, **fully self-contained application** for requesting, acquiring, organizing, and watching media.

The goal is to be **simpler than Plex, more powerful than Jellyfin, with ZERO external dependencies**.

### Architecture
- **Frontend**: React (served by FastAPI at port 8001)
- **Backend**: FastAPI (port 8001)
- **Database**: SQLite (self-contained, zero setup)
- **Torrent Engine**: LTorrent (pure Python, v1.6.0)

---

## Current Status: v1.1.0 Release ✅

### What's Working
- ✅ **SQLite Database** - Zero external dependencies, just Python
- ✅ User registration and login working
- ✅ Server starts and serves frontend
- ✅ Static files (CSS, JS, images) load correctly
- ✅ API routes are accessible
- ✅ LTorrent (pure Python) - supports magnet links + .torrent files
- ✅ Release packages for Linux and Windows

### Key Changes in v1.1.0
- **Replaced MongoDB with SQLite** - No external database needed
- Updated start scripts - removed MongoDB dependency
- Simplified README - truly beginner-friendly

### Release Packages
- `/app/dist/watchnexus-v1.1.0-linux.zip`
- `/app/dist/watchnexus-v1.1.0-windows.zip`

---

## Key Files Modified This Session

1. **`/app/backend/database.py`** - NEW: SQLite database layer mimicking MongoDB's motor interface
2. **`/app/backend/server.py`** - Modified: Uses SQLite instead of MongoDB
3. **`/app/backend/requirements.txt`** - Updated: Removed MongoDB, added aiosqlite
4. **`/app/scripts/create_releases.py`** - Updated: v1.1.0, new start scripts, new README

---

## Backlog

### P0 - Critical
- [x] Fix torrent library (libtorrent → LTorrent)
- [x] Add magnet link support  
- [x] **Switch to SQLite (zero dependencies)**
- [ ] User testing of v1.1.0 release

### P1 - High Priority
- [ ] Test Windows release package
- [ ] Video assets for Kickstarter
- [ ] Full end-to-end testing of standalone app

### P2 - Playback Playlist Feature (Future)
User-requested features:
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

## Test Commands

```bash
# Test registration
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"password"}'

# Test login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}'

# Check health
curl http://localhost:8001/api/health
```

---

## External Integrations
- TMDB (The Movie Database)
- Google OAuth
- BeautifulSoup4 (scraping)
- Addic7ed (subtitles)
- LTorrent (torrents - pure Python, magnet + .torrent)

---

## Session Summary (2026-02-14)

### Problem
User reported timeout error when trying to create a user in the standalone release (v1.0.2). The error was:
```
pymongo.errors.ServerSelectionTimeoutError: localhost:27017: [Errno 111] Connection refused
```

### Root Cause
The application required MongoDB to be running externally, but for a truly self-contained application, this is unacceptable. Users shouldn't need to install Docker or MongoDB.

### Solution
Replaced MongoDB with SQLite:
1. Created `/app/backend/database.py` - A SQLite database layer that mimics MongoDB's motor interface
2. Modified `server.py` to use SQLite instead of MongoDB
3. Updated `requirements.txt` to remove MongoDB dependencies and add `aiosqlite`
4. Updated release scripts to reflect zero-dependency architecture

### Result
- **v1.1.0** release packages created
- Just Python required - no MongoDB, no Docker, no external databases
- User registration and login tested and working

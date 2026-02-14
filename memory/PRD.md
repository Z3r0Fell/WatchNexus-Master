# WatchNexus - Unified Media Pipeline

## Product Requirements Document

### Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single, fully self-contained application for requesting, acquiring, organizing, and watching media.

### Architecture
- **Frontend**: React (served by FastAPI at port 8001)
- **Backend**: FastAPI (port 8001)
- **Database**: MongoDB
- **Torrent Engine**: LTorrent (pure Python, v1.6.0)

---

## Current Status: v1.0.2 Release

### What's Working
- ✅ Server starts and serves frontend
- ✅ Static files (CSS, JS, images) load correctly
- ✅ API routes are accessible
- ✅ LTorrent (pure Python) installed - supports magnet links + .torrent files

### Current Issue
- **Timeout on user registration** - likely MongoDB connection issue on user's local machine
- User needs to ensure MongoDB is running: `docker run -d --name mongodb -p 27017:27017 mongo:7`

### Release Packages
- `/app/dist/watchnexus-v1.0.2-linux.zip`
- `/app/dist/watchnexus-v1.0.2-windows.zip`

---

## Key Files Modified This Session

1. **`/app/backend/fondue.py`** - Rewrote to use LTorrent (pure Python, magnet + .torrent support)
2. **`/app/backend/requirements.txt`** - Updated with LTorrent from GitHub
3. **`/app/backend/server.py`** - Added:
   - Static file serving for standalone mode
   - Root `/` route for SPA
   - Login logging for debugging
   - `/api/auth/clear-users` endpoint
4. **`/app/scripts/create_releases.py`** - Release package generator

---

## Debug Endpoints Added
- `POST /api/auth/clear-users` - Clears all users (for testing)
- Login now logs: "user not found" vs "wrong password"

---

## Backlog

### P0 - Critical
- [x] Fix torrent library (libtorrent → LTorrent)
- [x] Add magnet link support  
- [ ] **Resolve MongoDB timeout on user creation**

### P1 - High Priority
- [ ] Test full login flow on user's machine
- [ ] Test Windows release package
- [ ] Video assets for Kickstarter

### P2 - Playback Playlist Feature (Future)
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
# Clear users
curl -X POST http://localhost:8001/api/auth/clear-users

# Test registration
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"password"}'

# Test login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}'
```

---

## External Integrations
- TMDB (The Movie Database)
- Google OAuth
- BeautifulSoup4 (scraping)
- Addic7ed (subtitles)
- LTorrent (torrents - pure Python, magnet + .torrent)

---

## Notes for Next Session
1. User got timeout on registration - check MongoDB connectivity
2. Ensure `start-watchnexus.sh` checks if MongoDB is running
3. Frontend loads correctly, API routes work, issue is DB connection

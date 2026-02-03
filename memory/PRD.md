# WatchNexus - Product Requirements Document

## Project Status: ALPHA / DEVELOPMENT

**NOT PRODUCTION READY** - See README.md for detailed assessment.

---

## Core Architecture

WatchNexus uses **Marmalade** as its media server core - a custom fork based on the Emby/Jellyfin protocol. This provides:
- Media library scanning and organization
- Video transcoding
- User profile management
- Live TV/IPTV support

---

## What's Been Built

### Frontend (React)
- Custom UI with glassmorphism, violet theme
- TMDB discovery (trending, search, genres)
- Watchlist, watch progress tracking
- Sidebar navigation
- User auth (JWT)
- **Media Health Checker UI** (Settings → Media Health tab)

### Backend (FastAPI)
- TMDB API proxy with caching
- User auth endpoints
- **Marmalade API proxy** at `/api/marmalade/*`
- **Media Health Checker API**:
  - `POST /api/media/health-check` - Check single file
  - `POST /api/media/repair` - Attempt repair
  - `POST /api/media/scan-library` - Scan directory
- MongoDB for user data

### Marmalade Server Fork
- Rebranded from Jellyfin
- Custom theme CSS with animations
- Server runs on port 8096

---

## What's NOT Done
- Video playback in React UI
- Local library browsing in React UI
- User sync between systems
- IPTV setup wizard
- Real download integration (currently mocked)
- Desktop packaging
- Installers

---

## Files Structure
```
/app/
├── frontend/              # React UI
│   └── src/
│       ├── services/
│       │   ├── api.js           # FastAPI backend calls
│       │   └── marmaladeApi.js  # Marmalade server calls
│       └── pages/
│           └── SettingsPage.js  # Has Media Health tab
├── backend/               # FastAPI
│   ├── server.py          # Main server with Marmalade proxy
│   └── media_health_checker.py  # File validation module
└── watchnexus/            # Marmalade server fork
    └── server/            # C# server
```

---

## Key API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### TMDB Proxy
- `GET /api/tmdb/search`
- `GET /api/tmdb/trending/{type}/{window}`
- `GET /api/tmdb/movie/{id}`
- `GET /api/tmdb/tv/{id}`

### Marmalade Proxy
- `* /api/marmalade/{path}` - Proxies to Marmalade server

### Media Health Checker
- `POST /api/media/health-check` - Check single file health
- `POST /api/media/repair` - Attempt to repair corrupted file
- `POST /api/media/scan-library` - Scan directory for issues

---

## Roadmap

### Phase 1 (Completed) ✅
- [x] Custom React UI
- [x] TMDB integration
- [x] User authentication
- [x] Marmalade server setup
- [x] API proxy layer
- [x] **Media Health Checker** - Detect corrupted/incomplete files
- [x] **Rebranded from Jellyfin to Marmalade**

### Phase 2 - Local Media (Next)
- [ ] Connect UI to Marmalade libraries
- [ ] Video player component
- [ ] Transcoding status display
- [ ] Library management UI

### Phase 3 - Live TV
- [ ] IPTV setup wizard
- [ ] Channel browser
- [ ] EPG display
- [ ] DVR recording

### Phase 4 - Acquisition
- [ ] Indexer integration
- [ ] Download client (real integration)
- [ ] Automatic organization
- [ ] Subtitle fetching (Bazarr-like)

### Phase 5 - Polish
- [ ] Desktop apps (Electron)
- [ ] Mobile optimization
- [ ] Installer packages
- [ ] Documentation

---

## Recent Changes (Feb 2026)

### Rebranding: Jellyfin → Marmalade
- Renamed `jellyfinApi.js` to `marmaladeApi.js`
- Updated all API endpoints from `/api/jellyfin/*` to `/api/marmalade/*`
- Updated all variable/function names (jellyfinClient → marmaladeClient, etc.)
- Updated README.md and documentation

### Media Health Checker Feature
- Created `/app/backend/media_health_checker.py` with:
  - MediaHealthChecker class using FFprobe/FFmpeg
  - File integrity checks (container, codecs, keyframes, sync)
  - Repair functionality (remux, faststart, re-encode)
- Added API endpoints in server.py
- Added UI in Settings → Media Health tab
- Features:
  - Scan directory for media files
  - Display issues/warnings per file
  - Repair button for fixable issues
  - Summary stats (healthy/warning/error counts)

---

## Test Results
- Backend: 24/24 tests passed (100%)
- Frontend: All UI flows working (100%)
- Test credentials: test@test.com / password

---

## Known Limitations
- Download client integration is **MOCKED**
- Video playback not yet implemented
- Marmalade server needs .NET runtime (not available in preview)

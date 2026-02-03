# WatchNexus - Product Requirements Document

## Project Status: ALPHA / DEVELOPMENT

**NOT PRODUCTION READY** - See README.md for detailed assessment.

## Core Architecture

WatchNexus uses **Marmalade** as its media server core - a custom fork based on the Emby/Jellyfin protocol. This provides:
- Media library scanning and organization
- Video transcoding
- User profile management
- Live TV/IPTV support

## What's Been Built

### Frontend (React)
- Custom UI with glassmorphism, violet theme
- TMDB discovery (trending, search, genres)
- Watchlist, watch progress tracking
- Sidebar navigation
- User auth (JWT)

### Backend (FastAPI)
- TMDB API proxy with caching
- User auth endpoints
- **Marmalade API proxy** at `/api/marmalade/*`
- **Media Health Checker API** - validate video files
- MongoDB for user data

### Marmalade Server Fork
- Rebranded from Jellyfin
- Custom theme CSS with animations
- Server runs on port 8096

## What's NOT Done
- Video playback in React UI
- Local library browsing in React UI
- User sync between systems
- IPTV setup wizard
- Real download integration
- Desktop packaging
- Installers

## Files Structure
```
/app/
├── frontend/              # React UI
│   └── src/
│       ├── services/
│       │   ├── api.js           # FastAPI backend calls
│       │   └── marmaladeApi.js  # Marmalade server calls
│       └── pages/         # Page components
├── backend/               # FastAPI
│   ├── server.py          # Main server with Marmalade proxy
│   └── media_health_checker.py  # File validation module
└── watchnexus/            # Marmalade server fork
    └── server/            # C# server
```

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

## Roadmap

### Phase 1 (Completed)
- [x] Custom React UI
- [x] TMDB integration
- [x] User authentication
- [x] Marmalade server setup
- [x] API proxy layer
- [x] Media Health Checker

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
- [ ] Download client
- [ ] Automatic organization
- [ ] Subtitle fetching

### Phase 5 - Polish
- [ ] Desktop apps (Electron)
- [ ] Mobile optimization
- [ ] Installer packages
- [ ] Documentation

## Recent Changes
- Rebranded from "Jellyfin" to "Marmalade" throughout codebase
- Renamed `jellyfinApi.js` to `marmaladeApi.js`
- Updated all API endpoints from `/api/jellyfin/*` to `/api/marmalade/*`
- Added Media Health Checker API endpoints
- Updated README.md and PRD.md with new branding

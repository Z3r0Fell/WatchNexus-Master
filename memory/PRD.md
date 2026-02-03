# WatchNexus - Product Requirements Document

## Project Status: ALPHA

Last Updated: February 2026

---

## Core Architecture

WatchNexus is a unified media pipeline using:
- **React Frontend** - Custom glassmorphism UI
- **FastAPI Backend** - API gateway, auth, business logic
- **Marmalade Server** - Media server fork (Jellyfin-based)

---

## Implemented Features

### Authentication
- [x] JWT-based email/password login
- [x] User registration
- [x] Google OAuth (Emergent Auth)
- [x] Session management with httpOnly cookies
- [x] Logout endpoint

### Discovery
- [x] TMDB integration for movies/TV
- [x] Trending content
- [x] Search functionality
- [x] Genre filtering
- [x] Watchlist

### Media Health System
- [x] File health checking (FFprobe)
- [x] Container/codec validation
- [x] Keyframe distribution check
- [x] Audio/video sync detection
- [x] moov atom positioning check
- [x] Duration consistency validation
- [x] File repair (FFmpeg remux, faststart)
- [x] Scheduled scans (daily/weekly/monthly)
- [x] Scan notifications
- [x] Re-download queueing

### Settings
- [x] General settings
- [x] Media Health tab
- [x] Indexers configuration (mocked)
- [x] Download client config (mocked)
- [x] Subtitle settings
- [x] Streaming services
- [x] Authentication settings

---

## API Endpoints

### Auth
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/google/session
POST /api/auth/logout
```

### TMDB Proxy
```
GET  /api/tmdb/search
GET  /api/tmdb/trending/{type}/{window}
GET  /api/tmdb/movie/{id}
GET  /api/tmdb/tv/{id}
GET  /api/tmdb/discover/{type}
GET  /api/tmdb/genres/{type}
```

### Media Health
```
POST /api/media/health-check
POST /api/media/repair
POST /api/media/scan-library
GET  /api/media/scheduled-scans
POST /api/media/scheduled-scans
PUT  /api/media/scheduled-scans/{id}
DELETE /api/media/scheduled-scans/{id}
POST /api/media/scheduled-scans/{id}/run
GET  /api/media/notifications
PUT  /api/media/notifications/{id}/read
DELETE /api/media/notifications/{id}
POST /api/media/redownload
```

### Marmalade Proxy
```
* /api/marmalade/{path} → http://localhost:8096
```

---

## Files Structure

```
/app/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── AuthPage.js          # Login/Register + Google OAuth
│       │   ├── AuthCallback.js      # OAuth callback handler
│       │   ├── Dashboard.js         # Main dashboard
│       │   ├── SettingsPage.js      # All settings tabs
│       │   └── ...
│       ├── services/
│       │   ├── api.js               # Backend API client
│       │   └── marmaladeApi.js      # Media server API
│       └── context/
│           └── AuthContext.js       # Auth state
│
├── backend/
│   ├── server.py                    # Main FastAPI app
│   ├── media_health_checker.py      # FFprobe/FFmpeg integration
│   └── requirements.txt
│
└── watchnexus/
    └── server/                      # Marmalade .NET server
```

---

## What's NOT Done

### Critical (P0)
- Video playback in React UI
- Connect UI to Marmalade libraries

### Important (P1)
- Real download client integration
- Real indexer integration
- IPTV setup wizard

### Nice to Have (P2)
- Desktop packaging (Electron)
- Mobile optimization
- Installer packages

---

## Recent Changes

### February 2026
- Rebranded Jellyfin → Marmalade
- Added Google OAuth (Emergent Auth)
- Implemented scheduled health scans
- Added scan notifications
- Added re-download functionality
- Updated README for GitHub

---

## Test Results

- Backend: 45/45 tests passed (100%)
- Frontend: All UI flows working (100%)

### Test Credentials
- Email: test@test.com
- Password: password

---

## Known Limitations

1. **Download client is MOCKED** - Queues but doesn't download
2. **Indexers are MOCKED** - Configuration stored but not used
3. **Marmalade server** - Requires .NET runtime
4. **Video playback** - Not yet implemented

---

## Configuration

### Environment Variables

Backend:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
TMDB_API_KEY=your_key
JWT_SECRET=your_secret
MARMALADE_URL=http://localhost:8096
```

Frontend:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### OAuth
- Client ID: 392737972706-krhv8egv3jj8qrpd1ppri6712a16huno.apps.googleusercontent.com
- Provider: Emergent Auth (auth.emergentagent.com)

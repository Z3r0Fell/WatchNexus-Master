# WatchNexus - Product Requirements Document

## Project Status: ALPHA

Last Updated: February 2026

---

## The Preserve Theme 🍊🍇

WatchNexus uses preserve/jam themed naming:
- **Marmalade** = Media Server (Jellyfin fork)
- **Compote** = Indexer Manager (Prowlarr-inspired)

---

## Implemented Features

### Core UI
- [x] React frontend with glassmorphism design
- [x] Responsive sidebar navigation
- [x] TMDB discovery (movies, TV, search)
- [x] Watchlist functionality
- [x] **Video Player** - Custom HTML5 with controls
- [x] **Library Page** - Browse local media

### Authentication
- [x] JWT-based email/password login
- [x] User registration
- [x] Google OAuth (Emergent Auth)
- [x] Session management

### Media Health System
- [x] File health checking (FFprobe)
- [x] Container/codec validation
- [x] File repair (FFmpeg remux, faststart)
- [x] Scheduled scans (daily/weekly/monthly)
- [x] Scan notifications
- [x] Re-download queueing

### Compote - Indexer Manager
- [x] Torznab/Newznab protocol support
- [x] Multi-indexer concurrent search
- [x] Quality/codec parsing
- [x] Grab/download queueing
- [x] Default indexer configurations

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

### Compote
```
GET  /api/compote/indexers
POST /api/compote/indexers
DELETE /api/compote/indexers/{id}
POST /api/compote/indexers/{id}/test
GET  /api/compote/search
POST /api/compote/grab
```

### Media Health
```
POST /api/media/health-check
POST /api/media/repair
POST /api/media/scan-library
GET/POST/PUT/DELETE /api/media/scheduled-scans
GET/PUT/DELETE /api/media/notifications
POST /api/media/redownload
```

### Marmalade Proxy
```
* /api/marmalade/{path}
```

---

## Files Structure

```
/app/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── LibraryPage.js       # Local media browser
│       │   ├── SettingsPage.js      # All settings tabs
│       │   └── ...
│       ├── components/
│       │   └── VideoPlayer.jsx      # Custom video player
│       └── services/
│           ├── api.js               # Backend API
│           └── marmaladeApi.js      # Media server
│
├── backend/
│   ├── server.py                    # Main FastAPI app
│   ├── compote.py                   # Indexer manager
│   └── media_health_checker.py      # FFprobe validation
│
└── watchnexus/
    └── server/                      # Marmalade .NET server
```

---

## What's NOT Done

### P0 - Critical
- Connect video player to Marmalade streams
- Real download client integration

### P1 - Important
- IPTV/Live TV setup wizard
- Real indexer connectivity testing

### P2 - Future
- Desktop packaging (Electron)
- Mobile optimization

---

## Test Results

- Backend: All endpoints tested
- Frontend: UI verified working
- Test credentials: test@test.com / password

---

## Configuration

### Environment
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
TMDB_API_KEY=your_key
JWT_SECRET=your_secret
MARMALADE_URL=http://localhost:8096
```

### OAuth
- Client ID: 392737972706-krhv8egv3jj8qrpd1ppri6712a16huno.apps.googleusercontent.com
- Provider: Emergent Auth

---

## Known Limitations

1. **Download client is MOCKED** - Queue works, no actual downloads
2. **Indexers need API keys** - Default configs disabled
3. **Marmalade requires .NET** - Not running in preview
4. **Video playback needs Marmalade** - Player ready, server needed

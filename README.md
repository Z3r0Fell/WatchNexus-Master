# WatchNexus - Personal Media Command Center

<p align="center">
  <img src="frontend/public/watchnexus-logo.svg" alt="WatchNexus Logo" width="400">
</p>

<p align="center">
  <strong>Your unified media experience - Local libraries, streaming discovery, and more in one beautiful interface.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-production-status">Production Status</a>
</p>

---

## 🎯 Project Overview

WatchNexus is a unified media pipeline that combines the best features of:
- **Jellyfin/Emby** → **Marmalade** (Media Server)
- **Prowlarr** → **Compote** (Indexer Manager)
- Custom React UI with TMDB integration

### The Preserve Theme 🍊🍇
- **Marmalade** - Media Server (Jellyfin fork)
- **Compote** - Indexer Manager (Prowlarr-inspired)

---

## ⚠️ Production Status

### Current State: **ALPHA**

| Feature | Status | Notes |
|---------|--------|-------|
| Custom React UI | ✅ Complete | Glassmorphism design |
| TMDB Discovery | ✅ Complete | Movies, TV, search |
| Authentication | ✅ Complete | JWT + Google OAuth |
| Media Health Checker | ✅ Complete | FFprobe validation |
| Scheduled Scans | ✅ Complete | Daily/weekly/monthly |
| **Compote** (Indexers) | ✅ Complete | Torznab/Newznab support |
| **Video Player** | ✅ Complete | Custom HTML5 player |
| **Library UI** | ✅ Complete | Grid/list view |
| Marmalade Integration | 🟡 Proxy Ready | Needs server running |
| Download Client | 🟡 Mocked | Queue works, no actual downloads |

---

## 🚀 Features

### ✅ Implemented

#### Core Features
- **Modern UI** - Glassmorphism design with violet theme
- **TMDB Discovery** - Trending movies, TV shows, search
- **Video Player** - Custom HTML5 player with:
  - Play/pause, seek, volume control
  - Fullscreen support
  - Keyboard shortcuts
  - Playback speed control
  - Subtitle support
- **Library Browser** - Grid/list view of local media

#### Authentication
- **Email/Password** - JWT-based auth
- **Google OAuth** - One-click sign-in

#### Media Health System
- **File Validation** - FFprobe-based checking
- **Auto-Repair** - FFmpeg remux and faststart
- **Scheduled Scans** - Automatic library validation
- **Notifications** - Alert system for issues
- **Re-download** - Queue replacement downloads

#### Compote - Indexer Manager
- **Multi-indexer Search** - Aggregate results
- **Torznab/Newznab** - Standard protocol support
- **Quality Parsing** - Auto-detect 1080p, 4K, etc.
- **Grab/Download** - Queue releases

---

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB 6+
- FFmpeg (for health checks)
- (Optional) .NET 8 SDK for Marmalade

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/watchnexus.git
cd watchnexus

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (new terminal)
cd frontend
yarn install
yarn start
```

### Environment Variables

```env
# Backend
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
TMDB_API_KEY=your_key
JWT_SECRET=your_secret
MARMALADE_URL=http://localhost:8096

# Frontend
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 🏗️ Architecture

```
watchnexus/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LibraryPage.js    # Local media browser
│   │   │   └── ...
│   │   ├── components/
│   │   │   └── VideoPlayer.jsx   # Custom video player
│   │   └── services/
│   │       ├── api.js            # Backend API
│   │       ├── marmaladeApi.js   # Marmalade server
│   │       └── compoteApi.js     # Indexer search
│
├── backend/                  # FastAPI backend
│   ├── server.py            # Main application
│   ├── compote.py           # Indexer manager
│   └── media_health_checker.py
│
└── watchnexus/              # Marmalade server (optional)
    └── server/              # .NET media server
```

---

## 🔌 API Endpoints

### Compote (Indexer Manager)
```
GET  /api/compote/indexers          # List indexers
POST /api/compote/indexers          # Add indexer
DELETE /api/compote/indexers/{id}   # Remove indexer
POST /api/compote/indexers/{id}/test # Test connection
GET  /api/compote/search            # Search indexers
POST /api/compote/grab              # Grab release
```

### Marmalade Proxy
```
* /api/marmalade/{path} → Media server
```

### Media Health
```
POST /api/media/health-check
POST /api/media/repair
POST /api/media/scan-library
GET/POST/DELETE /api/media/scheduled-scans
GET /api/media/notifications
POST /api/media/redownload
```

---

## 🗺️ Roadmap

### Phase 1 (Complete) ✅
- [x] Custom React UI
- [x] TMDB integration
- [x] JWT + Google OAuth
- [x] Media Health Checker
- [x] Scheduled scans
- [x] **Compote indexer manager**
- [x] **Video player**
- [x] **Library UI**

### Phase 2 - Integration
- [ ] Connect video player to Marmalade streams
- [ ] Real download client (qBittorrent/SABnzbd)
- [ ] Real indexer connectivity

### Phase 3 - Live TV
- [ ] IPTV setup wizard
- [ ] Channel browser
- [ ] EPG display

### Phase 4 - Polish
- [ ] Desktop apps (Electron)
- [ ] Mobile optimization
- [ ] Installer packages

---

## 📄 License

GNU General Public License v2.0

---

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org/) - Media server foundation
- [Prowlarr](https://prowlarr.com/) - Indexer manager inspiration
- [TMDB](https://www.themoviedb.org/) - Metadata provider
- [Shadcn/UI](https://ui.shadcn.com/) - UI components

---

<p align="center">
  <strong>WatchNexus</strong> - Your Media, Your Way
</p>

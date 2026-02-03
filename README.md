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
  <a href="#-installation">Installation</a> •
  <a href="#-building-from-source">Building</a> •
  <a href="#-production-readiness">Production Status</a> •
  <a href="#-troubleshooting">Troubleshooting</a>
</p>

---

## ⚠️ Production Readiness Status

### Current State: **ALPHA**

**WatchNexus is in active development.** Here's an honest assessment:

#### ✅ What's Working
| Feature | Status | Notes |
|---------|--------|-------|
| Custom React UI | ✅ Complete | Glassmorphism design, violet theme |
| TMDB Discovery | ✅ Complete | Trending movies, TV shows, search |
| User Authentication | ✅ Complete | JWT + Google OAuth |
| Google OAuth | ✅ Complete | Emergent Auth integration |
| Watchlist | ✅ Complete | Add/remove items |
| **Media Health Checker** | ✅ Complete | Detect corrupted/incomplete files |
| **Scheduled Scans** | ✅ Complete | Daily/weekly/monthly automatic scans |
| **Scan Notifications** | ✅ Complete | Alerts for issues found |
| **Re-download** | ✅ Queuing | Queues re-download via indexers |
| Marmalade API Proxy | ✅ Ready | Proxy to media server |

#### 🚧 What Needs Work
| Component | Status | Work Needed |
|-----------|--------|-------------|
| Video Playback | 🔴 Not Done | Build player, connect to Marmalade streams |
| Local Library UI | 🟡 Partial | Connect React UI to Marmalade libraries |
| Download Client | 🟡 Mocked | Integrate real torrent/usenet client |
| Indexer Search | 🟡 Mocked | Wire up to real indexers |
| IPTV/Live TV UI | 🔴 Not Done | Build wizard and channel browser |
| Desktop Packaging | 🔴 Not Done | Electron wrapper needed |

---

## 🚀 Features

### ✅ Implemented

#### Core Features
- **Modern UI** - Glassmorphism design with violet/purple theme
- **TMDB Discovery** - Browse trending movies and TV shows
- **Search** - Multi-type search (movies, TV, people)
- **Watchlist** - Save items to watch later
- **Genre Filtering** - Filter by Action, Comedy, Drama, etc.

#### Authentication
- **Email/Password** - Traditional JWT-based auth
- **Google OAuth** - One-click sign-in with Google (via Emergent Auth)
- **Session Management** - Secure token handling

#### Media Health System
- **File Validation** - Check for corrupted, incomplete, or problematic files
- **Repair Function** - Automatically fix common issues (moov atom, remux)
- **Scheduled Scans** - Set up automatic daily/weekly/monthly scans
- **Notifications** - Get alerted when issues are found
- **Re-download** - Queue replacement downloads for bad files

### 🔜 Planned
- **Local Library** - Browse your personal media collection
- **Video Player** - Stream content with transcoding support
- **Live TV/IPTV** - Watch live channels with EPG
- **Downloads** - Automated content acquisition
- **Multi-user** - Family profiles with parental controls

---

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB 6+
- (Optional) .NET 8 SDK for Marmalade server

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/watchnexus.git
cd watchnexus

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings

# Start backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend setup (new terminal)
cd frontend
yarn install
cp .env.example .env
# Edit .env with your settings

# Start frontend
yarn start
```

### Environment Variables

#### Backend (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
TMDB_API_KEY=your_tmdb_api_key
JWT_SECRET=your_secret_key
MARMALADE_URL=http://localhost:8096  # Optional: your media server
```

#### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 🏗️ Architecture

```
watchnexus/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # UI components
│   │   ├── services/        # API clients
│   │   │   ├── api.js       # Backend API
│   │   │   └── marmaladeApi.js  # Media server API
│   │   └── context/         # Auth context
│   └── public/              # Static assets
│
├── backend/                  # FastAPI backend
│   ├── server.py            # Main application
│   ├── media_health_checker.py  # Health validation
│   └── requirements.txt
│
└── watchnexus/              # Marmalade server (optional)
    └── server/              # .NET media server fork
```

### Technology Stack
- **Frontend**: React 18, TailwindCSS, Framer Motion, Shadcn/UI
- **Backend**: FastAPI, Motor (MongoDB), httpx
- **Media Server**: Marmalade (Jellyfin fork)
- **Authentication**: JWT + Google OAuth (Emergent Auth)

---

## 🔐 Authentication

### Email/Password
Standard JWT-based authentication with 7-day token expiry.

### Google OAuth
WatchNexus integrates with Emergent Auth for seamless Google sign-in:

1. Click "Continue with Google" on the login page
2. Authenticate with your Google account
3. Automatically redirected back with session established

**Note**: Google OAuth is configured with Client ID `392737972706-krhv8egv3jj8qrpd1ppri6712a16huno.apps.googleusercontent.com`

---

## 🔧 Media Health Checker

### What It Checks
- **Container integrity** - Validates file structure
- **Video/Audio codecs** - Ensures compatibility
- **Keyframe distribution** - Checks for smooth seeking
- **Audio/Video sync** - Detects sync issues
- **moov atom position** - Affects streaming start time
- **Duration consistency** - Validates stream lengths

### Automated Scans
Set up scheduled scans in Settings → Media Health:
- **Daily**: Run every day at specified time
- **Weekly**: Run once per week
- **Monthly**: Run once per month

Enable notifications to receive alerts when issues are found.

### Re-download
When corrupted files are detected:
1. Click "Re-download" button on the file
2. WatchNexus will search configured indexers
3. Queue a replacement download

**Note**: Requires indexers to be configured in Settings → Indexers.

---

## 🛠️ Building from Source

### Frontend Production Build
```bash
cd frontend
yarn build
# Output in: frontend/build/
```

### Backend (Production)
```bash
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app
```

### Marmalade Server
```bash
cd watchnexus/server
dotnet restore
dotnet publish -c Release -o ./publish
```

---

## 🐳 Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://backend:8001

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongo:27017
      - DB_NAME=watchnexus
      - TMDB_API_KEY=${TMDB_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongo

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

---

## 🔍 Troubleshooting

### "Failed to connect to backend"
```bash
# Check backend is running
curl http://localhost:8001/api/health

# Check MongoDB
mongosh --eval "db.adminCommand('ping')"
```

### "TMDB data not loading"
Verify your TMDB API key in backend `.env`:
```bash
curl "https://api.themoviedb.org/3/movie/popular?api_key=YOUR_KEY"
```

### "Media health scan fails"
```bash
# Ensure FFmpeg/FFprobe is installed
ffprobe -version

# Check file permissions
ls -la /path/to/media/
```

### "Google OAuth not working"
- Ensure the redirect URL is correctly configured
- Check browser console for CORS errors
- Verify the OAuth client ID matches

---

## 🗺️ Roadmap

### Phase 1 (Complete) ✅
- [x] Custom React UI
- [x] TMDB integration
- [x] User authentication (JWT + Google OAuth)
- [x] Marmalade server setup
- [x] API proxy layer
- [x] Media Health Checker
- [x] Scheduled scans & notifications
- [x] Re-download functionality

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
- [ ] Real indexer integration
- [ ] Real download client integration
- [ ] Automatic organization
- [ ] Subtitle fetching

### Phase 5 - Polish
- [ ] Desktop apps (Electron)
- [ ] Mobile optimization
- [ ] Installer packages

---

## 📄 License

WatchNexus is licensed under the **GNU General Public License v2.0**.

Marmalade (the media server component) is a fork based on the Emby/Jellyfin protocol.

---

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org/) - Open-source media server foundation
- [TMDB](https://www.themoviedb.org/) - Movie and TV metadata
- [Shadcn/UI](https://ui.shadcn.com/) - Beautiful UI components
- [Framer Motion](https://www.framer.com/motion/) - Smooth animations
- [Emergent Auth](https://emergentagent.com/) - OAuth integration

---

<p align="center">
  <strong>WatchNexus</strong> - Your Media, Your Way
</p>

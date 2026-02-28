# WatchNexus - Developer Setup Guide

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd watchnexus

# Backend
cd src/server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (new terminal)
cd src/web
yarn install && yarn start
```

Open http://localhost:3000

---

## Prerequisites

| Dependency | Version | Install |
|------------|---------|---------|
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Yarn | 1.22+ | `npm install -g yarn` |
| FFmpeg | Any | See below |

### FFmpeg Installation

**Linux:** `sudo apt install ffmpeg`
**macOS:** `brew install ffmpeg`
**Windows:** Download from [ffmpeg.org](https://ffmpeg.org/download.html), add to PATH

---

## Project Structure

```
src/
├── server/                  # FastAPI Backend
│   ├── server.py           # Main app (5800+ lines)
│   ├── database.py         # SQLite async wrapper
│   ├── marmalade_server.py # Media library engine
│   ├── compote.py          # Indexer manager
│   ├── fondue.py           # Download client
│   ├── relish.py           # IPTV handler
│   ├── garnish.py          # Subtitle manager
│   ├── gelatin.py          # Transcoding
│   └── requirements.txt
│
├── web/                    # React Frontend
│   ├── electron/           # Desktop app wrapper
│   ├── src/
│   │   ├── pages/         # Route pages
│   │   ├── components/    # UI components
│   │   ├── context/       # React contexts
│   │   └── services/      # API clients
│   ├── electron-builder.yml
│   └── package.json
│
└── WatchNexus.Common/      # Shared utilities
    ├── auth.py
    ├── config.py
    └── database.py
```

---

## Backend Development

### Environment Variables

Create `src/server/.env`:
```env
JWT_SECRET=dev-secret-change-in-production
TMDB_API_KEY=optional-for-metadata
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `marmalade_server.py` | Media library scanning, metadata |
| `compote.py` | Indexer/tracker integration |
| `fondue.py` | qBittorrent/download management |
| `relish.py` | IPTV/M3U playlist handling |
| `garnish.py` | Subtitle search/download |
| `gelatin.py` | FFmpeg transcoding |
| `zest.py` | Torrent search aggregation |

### Database

SQLite with async support (aiosqlite). File: `src/server/watchnexus.db`

Key tables: `users`, `libraries`, `media_items`, `watch_progress`, `watchlist`, `playlists`

---

## Frontend Development

### Key Dependencies

- **React 19** - UI framework
- **Radix UI** - Accessible primitives
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Axios** - HTTP client

### Electron (Desktop App)

```bash
# Dev mode (uses localhost backend)
yarn electron:dev

# Build installer
yarn electron:build
```

---

## Building Installers

See `/builds/README.md` for full instructions.

```bash
# Quick build for current platform
cd builds
./build.sh  # Linux/Mac
build.bat   # Windows
```

Outputs:
- **Windows:** `.exe` (NSIS installer)
- **macOS:** `.dmg` 
- **Linux:** `.AppImage`, `.deb`, `.rpm`

---

## API Testing

```bash
# Health check
curl http://localhost:8001/api/health

# Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}'

# Authenticated request
curl http://localhost:8001/api/libraries \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

### Backend won't start
```bash
# Check Python version
python3 --version  # Need 3.10+

# Reinstall deps
pip install -r requirements.txt --force-reinstall

# Check logs
tail -f logs/watchnexus.log
```

### Frontend issues
```bash
# Clear cache and reinstall
rm -rf node_modules yarn.lock
yarn install
yarn start
```

### Database reset
```bash
rm src/server/watchnexus.db
# Restart backend - will recreate tables
```

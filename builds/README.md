# WatchNexus - Developer Setup Guide

A unified, self-hosted media pipeline for requesting, acquiring, organizing, and streaming media.

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd watchnexus

# Backend setup
cd src/server
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Frontend setup
cd ../web
yarn install  # or npm install

# Run the application
# Terminal 1 - Backend
cd src/server && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend
cd src/web && yarn start
```

---

## Prerequisites

### All Platforms

| Dependency | Version | Purpose |
|------------|---------|---------|
| Python | 3.10+ | Backend runtime |
| Node.js | 18+ | Frontend runtime |
| Yarn | 1.22+ | Package manager (recommended) |
| Git | 2.0+ | Version control |

### Optional Dependencies

| Dependency | Purpose | Installation |
|------------|---------|--------------|
| FFmpeg | Media transcoding, metadata extraction | See platform-specific instructions below |
| yt-dlp | Web video extraction | `pip install yt-dlp` |
| Chromaprint (fpcalc) | Audio fingerprinting for intro detection | See platform-specific instructions below |

---

## Platform-Specific Setup

### Linux (Ubuntu/Debian)

```bash
# System dependencies
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nodejs npm ffmpeg

# Install yarn globally
sudo npm install -g yarn

# Optional: Chromaprint for audio fingerprinting
sudo apt install -y libchromaprint-tools
```

### Linux (Fedora/RHEL)

```bash
# System dependencies
sudo dnf install -y python3 python3-pip nodejs npm ffmpeg

# Install yarn globally
sudo npm install -g yarn

# Optional: Chromaprint
sudo dnf install -y chromaprint-tools
```

### Linux (Arch)

```bash
# System dependencies
sudo pacman -S python python-pip nodejs npm yarn ffmpeg

# Optional: Chromaprint
sudo pacman -S chromaprint
```

### macOS

```bash
# Using Homebrew
brew install python node yarn ffmpeg

# Optional: Chromaprint
brew install chromaprint
```

### Windows

1. **Python**: Download from [python.org](https://www.python.org/downloads/) (check "Add to PATH")
2. **Node.js**: Download from [nodejs.org](https://nodejs.org/) (LTS version)
3. **Yarn**: Run `npm install -g yarn` in Command Prompt/PowerShell
4. **FFmpeg**: 
   - Download from [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
   - Extract to `C:\ffmpeg`
   - Add `C:\ffmpeg\bin` to system PATH
5. **Chromaprint** (optional):
   - Download from [acoustid.org/chromaprint](https://acoustid.org/chromaprint)
   - Extract and add to PATH

---

## Backend Setup

### 1. Create Virtual Environment

```bash
cd src/server
python3 -m venv venv

# Activate:
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Create `.env` file in `src/server/`:

```env
# Required
JWT_SECRET=your-secret-key-here-change-in-production

# Optional - TMDB API for metadata (get free key at themoviedb.org)
TMDB_API_KEY=your-tmdb-api-key

# Optional - qBittorrent integration
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin
```

### 4. Run Backend

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The API will be available at `http://localhost:8001/api/`

### Backend Dependencies Explained

| Package | Purpose |
|---------|---------|
| fastapi | Web framework |
| uvicorn | ASGI server |
| aiosqlite | Async SQLite database |
| pydantic | Data validation |
| bcrypt | Password hashing |
| pyjwt | JWT authentication |
| httpx | Async HTTP client |
| feedparser | RSS/Podcast parsing |
| yt-dlp | YouTube/web video extraction |
| beautifulsoup4 | Web scraping |

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd src/web
yarn install
```

### 2. Environment Configuration

Create `.env` file in `src/web/`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 3. Run Frontend

```bash
yarn start
```

The UI will be available at `http://localhost:3000`

### Frontend Stack

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Tailwind CSS | Styling |
| Radix UI | Accessible components |
| Framer Motion | Animations |
| React Router | Navigation |
| Axios | API client |

---

## Project Structure

```
watchnexus/
├── src/
│   ├── server/              # Python backend
│   │   ├── server.py        # Main FastAPI application
│   │   ├── database.py      # SQLite database layer
│   │   ├── marmalade_server.py  # Media library management
│   │   ├── filesystem_browser.py  # OS-aware file browser
│   │   ├── compote.py       # Indexer integration
│   │   ├── fondue.py        # Download client
│   │   ├── relish.py        # IPTV handling
│   │   ├── garnish.py       # Subtitle management
│   │   └── requirements.txt
│   │
│   └── web/                 # React frontend
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── pages/       # Page components
│       │   ├── context/     # React context providers
│       │   └── services/    # API services
│       └── package.json
│
├── separated/               # Release source (synced copy)
│   ├── server/
│   └── web/
│
├── builds/                  # Platform-specific builds
│   ├── Linux/
│   ├── Windows/
│   ├── Mac/
│   ├── Docker/
│   └── README.md           # This file
│
└── releases/
    └── zips/               # Release packages
```

---

## Database

WatchNexus uses **SQLite** for zero-configuration, portable storage:

- Database file: `src/server/watchnexus.db`
- Automatic backups: `src/server/backups/`
- WAL mode enabled for concurrent access

No external database setup required!

---

## Development Tips

### Hot Reload

Both backend and frontend support hot reload:
- Backend: `--reload` flag with uvicorn
- Frontend: Built-in with React Scripts

### Running Tests

```bash
# Backend tests
cd src/server
pytest tests/

# Frontend tests
cd src/web
yarn test
```

### Code Linting

```bash
# Backend (Python)
ruff check src/server/

# Frontend (JavaScript/React)
cd src/web && yarn lint
```

---

## Troubleshooting

### Backend won't start

1. Check Python version: `python3 --version` (need 3.10+)
2. Ensure virtual environment is activated
3. Reinstall dependencies: `pip install -r requirements.txt --force-reinstall`

### Frontend build fails

1. Delete `node_modules` and `yarn.lock`
2. Run `yarn install` again
3. Clear cache: `yarn cache clean`

### Database errors

1. Delete `watchnexus.db` to reset (data will be lost)
2. Or restore from `backups/` folder

### FFmpeg not found

Ensure FFmpeg is in your system PATH:
```bash
ffmpeg -version  # Should show version info
```

---

## Building for Production

See platform-specific build guides in:
- `/builds/Linux/`
- `/builds/Windows/`
- `/builds/Mac/`
- `/builds/Docker/`

---

## License

MIT License - See LICENSE file for details.

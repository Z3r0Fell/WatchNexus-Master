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

### Current State: **DEVELOPMENT / ALPHA**

**WatchNexus is NOT yet production-ready.** Here's an honest assessment:

#### ✅ What's Working
- Beautiful custom React UI with glassmorphism design
- TMDB integration for movie/TV discovery and metadata
- User authentication (JWT-based)
- Watchlist and watch progress tracking
- **Marmalade** media server integration (backend proxy ready)
- Mock download queue system
- Responsive sidebar navigation
- **Media Health Checker** - Detect corrupted/incomplete video files

#### 🚧 What Needs Work Before Production
| Component | Status | Work Needed |
|-----------|--------|-------------|
| Local Library Browsing | 🟡 Partial | Connect React UI to Marmalade library endpoints |
| Video Playback | 🔴 Not Done | Build video player component, connect to Marmalade streams |
| User Auth Sync | 🔴 Not Done | Sync WatchNexus users with Marmalade users |
| IPTV/Live TV UI | 🔴 Not Done | Build setup wizard and channel browser |
| Download Client | 🔴 Not Done | Integrate real torrent/usenet client |
| Indexer Integration | 🔴 Not Done | Build Prowlarr-like search system |
| Desktop Packaging | 🔴 Not Done | Electron wrapper needed |
| Installer Creation | 🔴 Not Done | Need to create platform installers |

#### 🔴 What You Need to Know
WatchNexus uses **Marmalade** as its media server core. Marmalade is our custom fork of the Emby/Jellyfin protocol, providing:
- Media library scanning and organization
- Video transcoding
- User profile management
- Live TV/IPTV support

**Estimated work to production**: 2-4 weeks of development

---

## 🚀 Features

### Implemented
- **Modern UI**: Glassmorphism design with violet/purple theme
- **Hero Banners**: Featured content with backdrop images
- **Discovery**: Browse trending movies and TV shows via TMDB
- **Search**: Multi-type search (movies, TV, people)
- **Watchlist**: Save items to watch later
- **Genre Filtering**: Filter by Action, Comedy, Drama, etc.
- **Responsive Design**: Works on desktop and mobile
- **Dark Theme**: Eye-friendly dark interface
- **Media Health Checker**: Validate video files for corruption

### Planned
- **Local Library**: Browse your personal media collection
- **Video Player**: Stream content with transcoding support
- **Live TV/IPTV**: Watch live channels with EPG
- **Downloads**: Automated content acquisition
- **Extensions**: Plugin system for additional features
- **Multi-user**: Family profiles with parental controls

---

## 📋 Prerequisites

### Required Software
- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)
- **MongoDB** 6.0+ (database)
- **.NET 8 SDK** (for Jellyfin server)
- **FFmpeg** (for transcoding)

### Optional
- **Docker** & **Docker Compose** (for containerized deployment)

---

## 🏃 Quick Start

### Option 1: Docker (Recommended for Testing)

```bash
# Clone the repository
git clone https://github.com/yourusername/watchnexus.git
cd watchnexus

# Create environment file
cp .env.example .env
# Edit .env and add your TMDB API key

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:3000
```

### Option 2: Manual Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/watchnexus.git
cd watchnexus

# 2. Setup Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings

# 3. Setup Frontend
cd ../frontend
npm install  # or: yarn install

# 4. Start MongoDB
# Make sure MongoDB is running on localhost:27017

# 5. Start Services
# Terminal 1 - Backend:
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend:
cd frontend && npm start

# Access at http://localhost:3000
```

---

## 🔧 Installation by Platform

### 🐧 Linux (Arch Linux)

```bash
# Install dependencies
sudo pacman -S nodejs npm python python-pip mongodb ffmpeg dotnet-sdk-8.0

# Enable and start MongoDB
sudo systemctl enable --now mongodb

# Clone and setup
git clone https://github.com/yourusername/watchnexus.git
cd watchnexus

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install

# Jellyfin Server (optional - for local media)
cd ../watchnexus/server
dotnet restore
dotnet build --configuration Release
```

#### Creating an Arch Linux Package (PKGBUILD)

```bash
# Create PKGBUILD file
cat > PKGBUILD << 'EOF'
pkgname=watchnexus
pkgver=1.0.0
pkgrel=1
pkgdesc="Personal Media Command Center"
arch=('x86_64')
url="https://github.com/yourusername/watchnexus"
license=('GPL2')
depends=('nodejs' 'npm' 'python' 'python-pip' 'mongodb' 'ffmpeg' 'dotnet-runtime-8.0')
makedepends=('dotnet-sdk-8.0')
source=("$pkgname-$pkgver.tar.gz::$url/archive/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
    cd "$pkgname-$pkgver"
    
    # Build frontend
    cd frontend
    npm install
    npm run build
    
    # Build backend (no build needed for Python)
    
    # Build Jellyfin server
    cd ../watchnexus/server
    dotnet build --configuration Release
}

package() {
    cd "$pkgname-$pkgver"
    
    # Install to /opt/watchnexus
    install -dm755 "$pkgdir/opt/watchnexus"
    cp -r frontend/build "$pkgdir/opt/watchnexus/web"
    cp -r backend "$pkgdir/opt/watchnexus/backend"
    cp -r watchnexus/server/Jellyfin.Server/bin/Release/net8.0 "$pkgdir/opt/watchnexus/server"
    
    # Install systemd service
    install -Dm644 watchnexus.service "$pkgdir/usr/lib/systemd/system/watchnexus.service"
}
EOF

# Build the package
makepkg -si
```

#### Systemd Service File

```ini
# /etc/systemd/system/watchnexus.service
[Unit]
Description=WatchNexus Media Server
After=network.target mongodb.service

[Service]
Type=simple
User=watchnexus
WorkingDirectory=/opt/watchnexus
ExecStart=/opt/watchnexus/start.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 🪟 Windows 11

#### Prerequisites
1. Install [Node.js LTS](https://nodejs.org/)
2. Install [Python 3.11+](https://python.org/)
3. Install [MongoDB Community](https://www.mongodb.com/try/download/community)
4. Install [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
5. Install [FFmpeg](https://ffmpeg.org/download.html) and add to PATH

#### Manual Installation

```powershell
# Clone repository
git clone https://github.com/yourusername/watchnexus.git
cd watchnexus

# Backend setup
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env with notepad

# Frontend setup
cd ..\frontend
npm install

# Start services (use separate terminals)
# Terminal 1: cd backend && python -m uvicorn server:app --host 0.0.0.0 --port 8001
# Terminal 2: cd frontend && npm start
```

#### Creating Windows Installer (Recommended Tools)

1. **Inno Setup** (Free, recommended)
   ```
   Download from: https://jrsoftware.org/isinfo.php
   ```

2. **NSIS** (Nullsoft Scriptable Install System)
   ```
   Download from: https://nsis.sourceforge.io/
   ```

3. **WiX Toolset** (For MSI installers)
   ```
   Download from: https://wixtoolset.org/
   ```

4. **Electron Builder** (If wrapping in Electron)
   ```bash
   npm install electron-builder --save-dev
   ```

#### Sample Inno Setup Script

```iss
[Setup]
AppName=WatchNexus
AppVersion=1.0.0
DefaultDirName={autopf}\WatchNexus
DefaultGroupName=WatchNexus
OutputDir=installer
OutputBaseFilename=WatchNexus-Setup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "frontend\build\*"; DestDir: "{app}\web"; Flags: recursesubdirs
Source: "backend\*"; DestDir: "{app}\backend"; Flags: recursesubdirs
Source: "watchnexus\server\bin\Release\net8.0\*"; DestDir: "{app}\server"; Flags: recursesubdirs

[Icons]
Name: "{group}\WatchNexus"; Filename: "{app}\WatchNexus.exe"
Name: "{commondesktop}\WatchNexus"; Filename: "{app}\WatchNexus.exe"

[Run]
Filename: "{app}\WatchNexus.exe"; Description: "Launch WatchNexus"; Flags: postinstall nowait
```

### 🍎 macOS

#### Prerequisites
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node python@3.11 mongodb-community ffmpeg dotnet@8
brew services start mongodb-community
```

#### Installation
```bash
git clone https://github.com/yourusername/watchnexus.git
cd watchnexus

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

#### Creating macOS App Bundle

Use **electron-builder** or **Platypus**:

```bash
# With Electron
npm install electron electron-builder --save-dev

# Build
npm run electron:build
# Creates .dmg and .app in dist/
```

### 🐳 Docker

#### Dockerfile (Multi-stage)

```dockerfile
# Frontend build stage
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Backend stage
FROM python:3.11-slim AS backend
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Jellyfin server stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS jellyfin-builder
WORKDIR /app
COPY watchnexus/server/ ./
RUN dotnet restore && dotnet build -c Release

# Final stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=backend /app ./
COPY --from=jellyfin-builder /app/bin/Release/net8.0 ./server/
EXPOSE 3000 8001 8096
CMD ["./start.sh"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  watchnexus:
    build: .
    ports:
      - "3000:3000"
      - "8001:8001"
      - "8096:8096"
    volumes:
      - ./config:/app/config
      - ./data:/app/data
      - /path/to/your/media:/media:ro
    environment:
      - MONGO_URL=mongodb://mongo:27017
      - DB_NAME=watchnexus
      - TMDB_API_KEY=${TMDB_API_KEY}
    depends_on:
      - mongo

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongo_data:
```

---

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
CORS_ORIGINS=*
TMDB_API_KEY=your_tmdb_api_key_here
JWT_SECRET=your_secret_key_change_in_production
```

#### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Connecting to Existing Media Server

If you already have a Jellyfin/Emby-compatible server running:

1. Update backend `.env`:
   ```env
   MARMALADE_URL=http://localhost:8096  # Your media server address
   ```

2. The proxy endpoint `/api/marmalade/*` will forward requests to your media server.

**Note**: Full integration requires additional development (see Production Readiness section).

---

## 🛠️ Building from Source

### Frontend Production Build

```bash
cd frontend
npm run build
# Output in: frontend/build/
```

### Backend (No build needed)
Python runs directly. For production, use:
```bash
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app
```

### Marmalade Server Build

```bash
cd watchnexus/server
dotnet restore
dotnet publish -c Release -o ./publish
# Output in: watchnexus/server/publish/
```

---

## 📦 Installer Creation Tools

### Recommended by Platform

| Platform | Tool | Type | Difficulty |
|----------|------|------|------------|
| **Windows** | Inno Setup | EXE installer | Easy |
| **Windows** | WiX Toolset | MSI installer | Medium |
| **Windows** | NSIS | EXE installer | Medium |
| **macOS** | electron-builder | DMG/PKG | Easy |
| **macOS** | Platypus | App bundle | Easy |
| **macOS** | create-dmg | DMG | Easy |
| **Linux (Arch)** | makepkg | PKGBUILD | Easy |
| **Linux (Debian)** | dpkg-deb | DEB | Medium |
| **Linux (RPM)** | rpmbuild | RPM | Medium |
| **Linux (Universal)** | AppImage | AppImage | Medium |
| **Linux (Universal)** | Flatpak | Flatpak | Medium |
| **Linux (Universal)** | Snap | Snap | Medium |
| **Cross-platform** | electron-builder | All | Easy |

### Arch Linux Specific (AUR)

For distributing on AUR:
```bash
# 1. Create PKGBUILD (see above)
# 2. Generate .SRCINFO
makepkg --printsrcinfo > .SRCINFO

# 3. Create AUR repository
git clone ssh://aur@aur.archlinux.org/watchnexus.git
cd watchnexus
cp ../PKGBUILD ../watchnexus.install .
git add PKGBUILD .SRCINFO watchnexus.install
git commit -m "Initial upload"
git push
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "Cannot connect to MongoDB"
```bash
# Check if MongoDB is running
sudo systemctl status mongodb  # Linux
brew services list  # macOS
# Windows: Check Services app

# Start MongoDB
sudo systemctl start mongodb  # Linux
brew services start mongodb-community  # macOS
```

#### 2. "TMDB API errors"
- Verify your API key in `.env`
- Check rate limits (TMDB allows 40 requests/10 seconds)
- Ensure internet connectivity

#### 3. "Frontend won't start"
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version (need 18+)
node --version
```

#### 4. "Backend import errors"
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # Linux/macOS
.\venv\Scripts\Activate.ps1  # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

#### 5. "Marmalade server won't start"
```bash
# Check .NET installation
dotnet --version  # Should show 8.x

# Check logs
tail -f /var/log/supervisor/watchnexus-server.out.log

# Ensure FFmpeg is installed
ffmpeg -version
```

#### 6. "Port already in use"
```bash
# Find process using port
lsof -i :3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows
```

#### 7. "CORS errors in browser"
- Check `CORS_ORIGINS` in backend `.env`
- Ensure frontend is using correct `REACT_APP_BACKEND_URL`

### Getting Help

1. Check existing [GitHub Issues](https://github.com/yourusername/watchnexus/issues)
2. Create a new issue with:
   - Operating system and version
   - Node/Python/.NET versions
   - Complete error message
   - Steps to reproduce

---

## 📁 Project Structure

```
watchnexus/
├── frontend/                 # React frontend
│   ├── public/              # Static assets
│   │   ├── watchnexus-logo.svg
│   │   └── watchnexus-logo.png
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── context/         # React context
│   │   └── App.js           # Main app
│   └── package.json
├── backend/                  # FastAPI backend
│   ├── server.py            # Main server
│   ├── requirements.txt
│   └── .env
├── watchnexus/              # Jellyfin fork
│   ├── server/              # C# server
│   └── web/                 # Original web (not used)
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## 🗺️ Roadmap

### Phase 1 (Current) - Foundation
- [x] Custom React UI
- [x] TMDB integration
- [x] User authentication
- [x] Marmalade server setup
- [x] API proxy layer
- [x] Media Health Checker

### Phase 2 - Local Media
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

---

## 📄 License

WatchNexus uses Marmalade, a custom fork based on the Emby/Jellyfin protocol, licensed under the **GNU General Public License v2.0**.

All modifications and additions are also released under GPL v2.0.

See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org/) - The open-source media server foundation
- [TMDB](https://www.themoviedb.org/) - Movie and TV metadata
- [Shadcn/UI](https://ui.shadcn.com/) - Beautiful UI components
- [Framer Motion](https://www.framer.com/motion/) - Smooth animations

---

<p align="center">
  <strong>WatchNexus</strong> - Your Media, Your Way
</p>

# WatchNexus Build & Installation Guide

Complete guide for building and installing WatchNexus on Windows, Arch Linux, and other systems. Includes direct download links and commands for all dependencies.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Windows Installation](#windows-installation)
3. [Arch Linux Installation](#arch-linux-installation)
4. [Other Linux Distributions](#other-linux-distributions)
5. [macOS Installation](#macos-installation)
6. [Non-Git Installation (Release Downloads)](#non-git-installation)
7. [MongoDB Setup](#mongodb-setup)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

**Minimum Requirements:**
- 4GB RAM (8GB recommended)
- 2GB disk space (plus media storage)
- Node.js 18+ / Python 3.10+ / MongoDB 6+

---

## Windows Installation

### Option A: Automated Script (Recommended)

```powershell
# Run as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force
.\scripts\install-windows.ps1
```

### Option B: Manual Installation

#### Step 1: Install Dependencies

Download and install these components:

| Component | Download Link | Notes |
|-----------|--------------|-------|
| **Node.js 20 LTS** | [https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi](https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi) | Run installer with defaults |
| **Python 3.11** | [https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe](https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe) | Check "Add to PATH" during install |
| **Git** | [https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe](https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe) | Use defaults |
| **MongoDB 7** | [https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5-signed.msi](https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5-signed.msi) | Install as service |
| **FFmpeg** | [https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip) | Extract to `C:\ffmpeg`, add to PATH |
| **Visual C++ Redistributable** | [https://aka.ms/vs/17/release/vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe) | Required for some dependencies |

**Install Yarn:**
```powershell
npm install -g yarn
```

#### Step 2: Build WatchNexus

```powershell
# Clone or download repository
cd C:\Projects
git clone https://github.com/your-org/watchnexus.git
cd watchnexus

# Build frontend
cd frontend
yarn install
yarn build
cd ..

# Build backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

#### Step 3: Configure Environment

Create `backend\.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=C:\ProgramData\WatchNexus\plugins
WATCHNEXUS_THEMES_DIR=C:\ProgramData\WatchNexus\themes
```

#### Step 4: Run WatchNexus

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn server:app --host 127.0.0.1 --port 8001
```

Open: http://localhost:8001

---

## Arch Linux Installation

### Option A: Automated Script (Recommended)

```bash
chmod +x scripts/build-arch.sh
./scripts/build-arch.sh
```

### Option B: Manual Installation with pacman

#### Step 1: Install Dependencies

```bash
# Update system
sudo pacman -Syu

# Install core dependencies
sudo pacman -S --needed \
    base-devel \
    git \
    nodejs \
    npm \
    yarn \
    python \
    python-pip \
    python-virtualenv \
    ffmpeg \
    libvips

# Optional: Install MongoDB from AUR
# Using yay (install yay first if needed)
yay -S mongodb-bin

# OR using paru
paru -S mongodb-bin

# OR install yay first if you don't have an AUR helper
git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si
cd ..
rm -rf yay
yay -S mongodb-bin
```

**If you don't want to use AUR for MongoDB:**
```bash
# Use Docker instead
sudo pacman -S docker
sudo systemctl enable --now docker
sudo docker run -d --name mongodb -p 27017:27017 mongo:7
```

#### Step 2: Build WatchNexus

```bash
# Clone repository
git clone https://github.com/your-org/watchnexus.git
cd watchnexus

# Build frontend
cd frontend
yarn install
yarn build

# Build backend
cd ../backend
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

#### Step 3: Install to System

```bash
# Create directories
sudo mkdir -p /opt/watchnexus
sudo mkdir -p /var/lib/watchnexus/{themes,plugins,downloads,media}

# Copy files (determine frontend build dir first)
FRONTEND_DIR=$([ -d frontend/build ] && echo "build" || echo "dist")
sudo cp -r frontend/$FRONTEND_DIR /opt/watchnexus/frontend
sudo cp -r backend /opt/watchnexus/

# Create system user
sudo useradd -r -s /usr/bin/nologin -d /opt/watchnexus watchnexus

# Set permissions
sudo chown -R watchnexus:watchnexus /opt/watchnexus
sudo chown -R watchnexus:watchnexus /var/lib/watchnexus
```

#### Step 4: Create systemd Service

```bash
sudo tee /etc/systemd/system/watchnexus.service > /dev/null << 'EOF'
[Unit]
Description=WatchNexus Media Server
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=simple
User=watchnexus
WorkingDirectory=/opt/watchnexus/backend
Environment=MONGO_URL=mongodb://localhost:27017
Environment=DB_NAME=watchnexus
Environment=WATCHNEXUS_PLUGINS_DIR=/var/lib/watchnexus/plugins
Environment=WATCHNEXUS_THEMES_DIR=/var/lib/watchnexus/themes
ExecStart=/opt/watchnexus/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now watchnexus

# Check status
sudo systemctl status watchnexus
```

#### Step 5: Create Desktop Entry (Optional)

```bash
sudo tee /usr/share/applications/watchnexus.desktop > /dev/null << 'EOF'
[Desktop Entry]
Name=WatchNexus
Comment=Unified Media Pipeline
Exec=xdg-open http://localhost:8001
Icon=video-x-generic
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
EOF
```

Open: http://localhost:8001

---

## Other Linux Distributions

### Ubuntu/Debian

```bash
# Install dependencies
sudo apt update
sudo apt install -y \
    build-essential \
    git \
    curl \
    ffmpeg \
    libvips-dev

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Yarn
npm install -g yarn

# Install Python
sudo apt install -y python3 python3-pip python3-venv

# Install MongoDB
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### Fedora/RHEL

```bash
# Install dependencies
sudo dnf install -y \
    gcc gcc-c++ make \
    git \
    curl \
    ffmpeg \
    vips-devel

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Install Yarn
npm install -g yarn

# Install Python
sudo dnf install -y python3 python3-pip python3-virtualenv

# MongoDB (use Docker on Fedora)
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo docker run -d --name mongodb -p 27017:27017 mongo:7
```

---

## macOS Installation

### Using the Automated Script

```bash
chmod +x scripts/install-mac.sh
./scripts/install-mac.sh
```

### Manual Installation

```bash
# Install Homebrew if needed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node yarn python@3.11 ffmpeg vips mongodb-community

# Start MongoDB
brew services start mongodb-community

# Build and run (same as Linux)
cd frontend && yarn install && yarn build && cd ..
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8001
```

---

## Non-Git Installation

For users who cannot or prefer not to clone the repository.

### Method 1: Download Release ZIP

1. Go to: `https://github.com/your-org/watchnexus/releases`
2. Download the latest `watchnexus-vX.X.X.zip`
3. Extract to your desired location
4. Follow the manual installation steps for your OS

### Method 2: Download via curl/wget

**Windows (PowerShell):**
```powershell
# Download latest release
$releaseUrl = "https://github.com/your-org/watchnexus/archive/refs/heads/main.zip"
$downloadPath = "$env:TEMP\watchnexus.zip"
$extractPath = "C:\Projects\watchnexus"

Invoke-WebRequest -Uri $releaseUrl -OutFile $downloadPath
Expand-Archive -Path $downloadPath -DestinationPath $extractPath -Force
Remove-Item $downloadPath

cd "$extractPath\watchnexus-main"
# Continue with manual installation steps...
```

**Linux/macOS:**
```bash
# Download latest release
curl -L https://github.com/your-org/watchnexus/archive/refs/heads/main.tar.gz -o watchnexus.tar.gz
tar -xzf watchnexus.tar.gz
cd watchnexus-main

# Continue with manual installation steps...
```

### Method 3: Pre-built Binaries (Coming Soon)

We plan to provide pre-built binaries for:
- Windows: `.exe` installer and portable version
- Linux: `.AppImage` universal binary
- macOS: `.dmg` disk image

Check the releases page for availability.

---

## MongoDB Setup

### Quick Setup Options

**Option 1: Local Installation (Recommended)**
- Windows: Use the MSI installer linked above
- Arch Linux: `yay -S mongodb-bin`
- Ubuntu: Follow the apt instructions above
- macOS: `brew install mongodb-community`

**Option 2: Docker (Cross-platform)**
```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  --restart unless-stopped \
  mongo:7
```

**Option 3: MongoDB Atlas (Cloud)**
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a free M0 cluster
3. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/watchnexus`
4. Update your `.env` file with the connection string

### Verify MongoDB is Running

```bash
# Check if MongoDB is accepting connections
mongosh --eval "db.runCommand({ ping: 1 })"

# Or using curl
curl -s http://localhost:27017 | head -c 100
```

---

## Troubleshooting

### Common Issues

**"yarn: command not found"**
```bash
npm install -g yarn
# Or on Arch: sudo pacman -S yarn
```

**"python: command not found" (Windows)**
- Reinstall Python and check "Add Python to PATH"
- Or use `py` instead of `python`

**"EACCES: permission denied" (Linux/macOS)**
```bash
# Fix npm permissions
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**MongoDB connection refused**
```bash
# Check if MongoDB is running
sudo systemctl status mongodb  # or mongod

# Start if not running
sudo systemctl start mongodb
```

**"Module not found" Python errors**
```bash
cd backend
source venv/bin/activate  # or .\venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
```

**Frontend build fails with memory error**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
yarn build
```

**Port 8001 already in use**
```bash
# Find and kill process using port
# Linux/macOS:
lsof -i :8001 | grep LISTEN | awk '{print $2}' | xargs kill

# Windows:
netstat -ano | findstr :8001
taskkill /PID <PID> /F
```

### Getting Help

- GitHub Issues: `https://github.com/your-org/watchnexus/issues`
- Discord: `https://discord.gg/watchnexus`
- Documentation: `https://docs.watchnexus.ca`

---

## Appendix: Complete Dependency List

### Windows Direct Downloads

| Package | Version | Direct Link |
|---------|---------|-------------|
| Node.js LTS | 20.11.0 | https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi |
| Python | 3.11.7 | https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe |
| Git | 2.43.0 | https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe |
| MongoDB | 7.0.5 | https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5-signed.msi |
| FFmpeg | Latest | https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip |
| VC++ Redist | 2022 | https://aka.ms/vs/17/release/vc_redist.x64.exe |

### Arch Linux pacman Packages

```bash
# All required packages in one command
sudo pacman -S --needed \
    base-devel \
    git \
    nodejs \
    npm \
    yarn \
    python \
    python-pip \
    python-virtualenv \
    ffmpeg \
    libvips \
    docker
```

### Ubuntu/Debian apt Packages

```bash
sudo apt install -y \
    build-essential \
    git \
    curl \
    ffmpeg \
    libvips-dev \
    python3 \
    python3-pip \
    python3-venv
```

---

*Last Updated: February 2026*

# WatchNexus Server v1.0.0 - macOS

Welcome to **WatchNexus** - Your Unified Media Pipeline!

## Quick Start

1. **Double-click** `start-watchnexus.command` to launch
2. Open http://localhost:8001 in your browser
3. Create your account and start adding media!

## Requirements

- **macOS** 10.15 (Catalina) or newer
- **Python 3.9+** (Install via [Homebrew](https://brew.sh): `brew install python3`)
- **4GB RAM** minimum (8GB recommended)
- **500MB** disk space for application

## Installation

### Option 1: Double-Click Launch
Simply double-click `start-watchnexus.command`. macOS may ask for permission - click "Open" to allow.

### Option 2: Terminal Launch
```bash
cd /path/to/watchnexus-v1.0.0-macos
chmod +x start-watchnexus.command
./start-watchnexus.command
```

### Option 3: Background Service
```bash
# Start in background
./start-watchnexus.command --no-browser &

# Or use the provided launchd service
cp com.watchnexus.server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.watchnexus.server.plist
```

## First Run Setup

1. Launch WatchNexus
2. Create your admin account
3. Go to **Settings → Library**
4. Add your media folders (Movies, TV Shows, Music, etc.)
5. Click "Scan Library"

## Default Ports

| Service | Port | URL |
|---------|------|-----|
| Web Interface | 8001 | http://localhost:8001 |
| API | 8001 | http://localhost:8001/api |
| Jellyfin API | 8001 | http://localhost:8001/api/emby |

## Directory Structure

```
watchnexus-v1.0.0-macos/
├── start-watchnexus.command  # Launch script (double-click)
├── backend/                   # Python backend
│   ├── server.py             # Main server
│   ├── data/                 # Application data
│   ├── logs/                 # Log files
│   └── backups/              # Database backups
├── frontend/                  # Web interface
│   └── build/                # Production build
├── tray_app.py               # System tray app (optional)
└── tiramisu.py               # Auto-updater
```

## System Tray App (Beacon)

For a native macOS experience, use the system tray app:

```bash
pip install pystray pillow requests psutil
python tray_app.py
```

This adds a menu bar icon for:
- Start/Stop server
- Open web interface
- View logs
- Check for updates

## Troubleshooting

### "Cannot be opened because it is from an unidentified developer"
Right-click → Open → Click "Open" in the dialog

### Port already in use
```bash
# Find and kill process on port 8001
lsof -i :8001
kill -9 <PID>
```

### Python not found
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python
brew install python3
```

### Logs
Check `backend/logs/watchnexus.log` for detailed error messages.

## Client Apps

Connect these apps to your WatchNexus server:

| App | Platform | Status |
|-----|----------|--------|
| Tanzanite | Roku | Ready |
| Diamond | Kodi | Ready |
| Ruby | Android TV | Source |
| Sapphire | Android | Source |
| Ember | Fire TV | Source |

## Support

- **Documentation**: Settings → Help
- **Logs**: Settings → Logs & Health
- **GitHub**: github.com/watchnexus/watchnexus

## License

GPL-2.0 - Free and open source!

---

**WatchNexus v1.0.0** | Built with ❤️ for media enthusiasts

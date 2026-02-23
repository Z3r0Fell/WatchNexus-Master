# WatchNexus Beacon - System Tray App 🔦

**Codename:** Beacon  
**Version:** 1.0.0

Cross-platform system tray application for controlling WatchNexus server.

## Features

- Start/Stop/Restart server
- Server health monitoring
- Quick access to web interface
- System resource display (CPU/RAM)
- Auto-start on launch
- Update checking (via Tiramisu)
- Notifications

## Installation

```bash
pip install pystray pillow requests psutil
```

## Usage

```bash
# Start with defaults
python tray_app.py

# Custom port
python tray_app.py --port 9000

# No auto-start
python tray_app.py --no-auto-start

# Disable update checking
python tray_app.py --no-update-check
```

## Platforms

- **Windows**: Double-click `START-WATCHNEXUS-TRAY.bat`
- **macOS/Linux**: Run `./start-watchnexus-tray.sh`

## Menu Options

```
Right-click:
├── Status indicator
├── 🌐 Open Interface
├── ▶️ Start Server
├── ⏹️ Stop Server  
├── 🔄 Restart Server
├── 📋 View Logs
├── 🍰 Check for Updates
├── More → (Library, Downloads, Settings...)
└── ❌ Quit
```

## License

GPL-2.0

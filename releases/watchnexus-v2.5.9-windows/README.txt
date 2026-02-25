# WatchNexus v2.5.9 - Unified Media Pipeline
# Release: February 25, 2025

## What's New in 2.5.9: Settings UX Overhaul

This release brings a complete overhaul of the Settings interface with tabbed 
navigation throughout, making it easier to find and configure options.

### New Tabbed Settings Pages:
- **General Settings**: Paths & Storage | Sidebar Tabs | Preferences
- **Playback**: Skip Intro/Credits | Auto-Play | Detection Engine | Player Options
- **Users & Access**: User Management | Access & API | Activity Log
- **IPTV**: IPTV Sources | EPG Guide | Recording
- **Streaming Services**: Service Logins | Deep Links | Watch Tracking
- **Theme Forge**: Light/Dark Mode | Theme Presets | Custom Theme
- **External Access (Gelatin)**: Server Status | Network Tunnels | Access Tokens
- **Maintenance**: System Status | Database | Cache & Services | Server Logs
- **Subtitles (Garnish)**: Providers | Languages | Preferences
- **About & Releases**: Overview | Release History | Credits | Legal & Trademarks

### Previous Release Highlights (2.5.7):
- Removed non-functional gadget pages
- Added Legal & Trademarks section
- Replaced streaming service logos with generic icons (copyright safe)

## Installation Instructions

### Requirements:
- Python 3.9 or higher
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Quick Start:
1. Extract this archive to your preferred location
2. Open a terminal in the extracted folder
3. Run: `chmod +x start-watchnexus.sh && ./start-watchnexus.sh`
4. Open http://localhost:8001 in your browser
5. Create your admin account on first run

### Default Login:
- First user created becomes admin
- Or use test credentials: test@test.com / password

## Directory Structure:
```
watchnexus-v2.5.9-linux/
├── backend/           # Python FastAPI server
│   ├── server.py      # Main server
│   ├── marmalade_server.py  # Media library engine
│   ├── fondue.py      # Torrent download engine
│   ├── garnish.py     # Subtitle service
│   ├── milk.py        # Theme system
│   └── ...
├── frontend/          # React web application
└── start-watchnexus.sh
```

## Support
- GitHub: https://github.com/watchnexus/watchnexus
- Documentation: https://docs.watchnexus.com

Enjoy your unified media experience!

# WatchNexus v2.5.13 - Unified Media Pipeline

## What's New in v2.5.13
- Theme mode (dark/light) now syncs across all devices
- IPTV sources persist to database (cross-device sync)
- Sidebar tab visibility syncs to your account
- Download client mode preference syncs
- Code audit fixes and improvements

## Quick Start (Linux)

1. Make the start script executable:
   ```bash
   chmod +x start-watchnexus.sh
   ```

2. Run the start script:
   ```bash
   ./start-watchnexus.sh
   ```

3. Open your browser to: http://localhost:8001

## Requirements
- Python 3.9 or higher
- pip3 (Python package manager)

## Directory Structure
```
watchnexus-v2.5.13-linux/
├── start-watchnexus.sh    # Start script
├── README.txt             # This file
├── server/                # Backend server
│   ├── server.py          # Main server file
│   ├── requirements.txt   # Python dependencies
│   └── ...
└── web/                   # Frontend source (for development)
    ├── src/
    └── ...
```

## Default Credentials
- Email: admin@watchnexus.local
- Password: admin

## Support
For issues and feature requests, visit the project repository.

---
WatchNexus - Your unified media pipeline

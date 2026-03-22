# WatchNexus v2.8.2.2-alpha

> **ALPHA BUILD — CONFIDENTIAL — NOT FOR PUBLIC DISTRIBUTION**

This is a pre-release alpha build for internal testing purposes only. Do not redistribute or share publicly.

## Release Artifacts

| Platform | Archive | Size |
|----------|---------|------|
| Windows x64 | `WatchNexus-v2.8.2.2-win-x64.zip` | ~72MB |
| Linux x64 | `WatchNexus-v2.8.2.2-linux-x64.zip` | ~59MB |

Both archives are **self-contained** — no .NET runtime installation required.

## Quick Start

### Windows
```
1. Extract WatchNexus-v2.8.2.2-win-x64.zip
2. Double-click WatchNexus.Core.exe
3. A system tray icon will appear — double-click it or open http://localhost:8002
```

### Linux
```bash
unzip WatchNexus-v2.8.2.2-linux-x64.zip
cd linux-x64
chmod +x WatchNexus.Core
./WatchNexus.Core
# Open http://localhost:8002
```

For tray icon support on Linux, install:
```bash
# Ubuntu/Debian
sudo apt install gir1.2-ayatanaappindicator3-0.1 python3-gi

# Fedora
sudo dnf install libayatana-appindicator-gtk3 python3-gobject
```

## Pre-Seeded Admin Accounts

These accounts are created automatically on first launch:

| Email | Password | Role |
|-------|----------|------|
| `admin@watchnexus.local` | `admin` | admin |

You can also create additional accounts via the "Sign Up" page.

## What's New in v2.8.2.2

- **System Tray Icon** — Tray icon now loads on launch (Windows: native NotifyIcon; Linux: GTK AppIndicator3)
- **Help & Documentation** — Searchable `/help` page with 40+ topics across 13 categories
- **Help Tooltips** — Question-mark icons on every settings page with detailed descriptions
- **Sidebar Fix** — Scroll position persists across navigation
- **7 New Gadgets** — Analytics, Notifications, Requests, Parental Controls, Processing, Usenet (Brine + Ladle)
- **Critical Bug Fixes** — Dropdown readability, settings saving, media playback pipeline, and more

See `CHANGELOG.md` for full details.

## What to Test

- **System Tray Icon** — Verify the icon appears in the system tray on launch (both Windows and Linux)
  - Right-click should show context menu (Open WatchNexus / Quit)
  - Double-click (Windows) should open browser
- **Authentication** — Register, login, session persistence
- **Library Management** — Add libraries, scan media, browse
- **Settings** — Change settings and verify they save correctly
- **Media Playback** — Play media files, check progress tracking
- **Help Page** — Navigate to `/help`, search for topics
- **Help Tooltips** — Click `?` icons on settings pages for contextual help
- **All Gadgets** — Analytics, Notifications, Requests, Parental Controls, Processing, Usenet
- **API Management (Crumbs)** — Service key storage, test connections
- **Weather / Radio / Podcasts** — Real-time data from external APIs

## Architecture

```
WatchNexus.Core(.exe)     # Self-contained .NET 10 server
├── web/build/            # React frontend (served as static files)
├── data/                 # SQLite database (created on first run)
├── logs/                 # Application logs
└── appsettings.json      # Configuration
```

- **Backend**: C#/.NET 10 ASP.NET Core (self-contained, no runtime needed)
- **Database**: SQLite (auto-created in `data/watchnexus.db`)
- **Frontend**: React SPA served from `web/build/`
- **Default Port**: 8002 (set `WATCHNEXUS_PORT` env var to change)

## Reporting Issues

When filing a bug, include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser + OS version
4. Screenshots if applicable
5. Console output from the server

## Version Identification

All banners, endpoints, and module manifests are tagged `2.8.2.2`. 

Verify via: `GET /api/health` or `GET /api/system/info`

## System Requirements

| | Windows | Linux |
|--|---------|-------|
| OS | Windows 10/11 or Server 2019+ | Any x86_64 with glibc 2.17+ |
| RAM | 512MB min, 1GB recommended | 512MB min, 1GB recommended |
| Disk | ~150MB for installation | ~120MB for installation |
| Dependencies | None (self-contained) | None (self-contained; python3 + GTK for tray icon) |

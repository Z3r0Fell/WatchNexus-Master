# WatchNexus - Unified Media Pipeline

## Product Requirements Document

### Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces multiple applications (Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, Jellyfin) with a single, **fully self-contained application** for requesting, acquiring, organizing, and watching media.

---

## Current Version: 2.5.5

### Code Name Legend
| Code Name | Feature | Description |
|-----------|---------|-------------|
| 🍋 **Zest** | Log Viewer | Adds flavor to debugging - real-time log viewing and system health |
| 🥛 **Milk** | Theme Engine | Smooth, consistent theming across the entire application |
| 🌿 **Garnish** | Subtitles | The finishing touch for media - subtitle provider management |
| 🍨 **Cream** | Streaming Services | Smooth integration with streaming service credentials |
| 🔧 **Gadgets** | Plugins | Extensible plugin system with Kodi addon support |
| 🍯 **Marmalade** | Media Server | Core media library management and scanning |
| 🍮 **Compote** | Indexers | Sweet media discovery through indexer integration |
| 💧 **Drizzle** | Playlists | Playlist and queue management |
| 🧪 **Sieve** | Media Health | Media file health checking and validation |
| 🧈 **Gelatin** | External Access | Jellyfin-compatible API layer |
| 🍭 **Relish** | IPTV | Live TV and IPTV integration |
| 🥣 **Syrup** | Scrapers | Web scraping utilities |
| 🍲 **Potluck** | qBittorrent | Torrent client integration |
| 🧀 **Fondue** | Fingerprinting | Audio fingerprinting for intro detection |
| 📦 **Preserve** | Quality Profiles | Sonarr/Radarr-style download quality preferences |
| 💎 **Ruby** | Android TV Client | Leanback interface for Android TV/Google TV |
| 💎 **Sapphire** | Android Mobile Client | Material Design 3 for phones/tablets |
| 🔥 **Ember** | Fire TV Client | Optimized for Amazon Fire TV devices |
| 💎 **Diamond** | Kodi Addon | Native Kodi integration with library sync |
| 💜 **Tanzanite** | Roku Client | BrighterScript Roku channel |
| 🔦 **Beacon** | System Tray | Desktop tray app for server control |
| 🍰 **Tiramisu** | Auto-Updater | Check, download, and install updates |

---

### Recent Changes (v2.5.4 - Feb 23, 2026)

#### User-Reported Bug Fixes (v2.4.0 Arch Linux Testing):

- **🗂️ Directory Browser Enhancement**
  - Fixed: User directories not visible when browsing for media folders
  - Now automatically includes all user directories from `/home` in quick access
  - Improved handling of /home browsing for library path selection

- **📊 Show/Hide Sidebar Tabs**
  - New: Settings > General now has "Sidebar Tabs" section
  - Toggle visibility of: Library, Movies, TV Shows, Anime, Playlists, Music, Audiobooks, Live TV, Streaming, Indexers
  - Home, Downloads, and Settings are always visible (cannot be hidden)
  - Changes persist via localStorage (`watchnexus_visible_tabs`)

- **📝 Log Files Section (Zest)**
  - Fixed: Logs & Health section now properly accessible in Settings
  - Shows real-time system metrics: CPU, Memory, Disk, Process Memory
  - Log viewer with search, level filtering, download, and clear functions

- **🔄 Database Version Detection & Reset**
  - New: `/api/db/stats` returns `db_version`, `app_version`, `version_mismatch`
  - New: `/api/db/reset` endpoint to clear all tables and start fresh
  - New: "Reset Database" button in Settings > Maintenance
  - Database version tracked in `db_meta` table
  - Creates backup before any reset operation

---

### Recent Changes (v2.5.3 - Feb 23, 2026)

#### CRITICAL Security Fixes:

- **🔒 `/api/auth/clear-users`** - Was completely unprotected! Added admin-only authentication
- **🔒 `/api/media/health-check`** - Allowed arbitrary file access without auth. Fixed.
- **🔒 `/api/media/repair`** - Same issue. Fixed.
- **🔒 `/api/media/scan-library`** - Same issue. Fixed.
- **🔒 `/api/downloads` (POST/PATCH/DELETE)** - Missing auth. Fixed.

#### Bug Fixes:

- **🐛 Token storage inconsistency** - Quick login was saving to `watchnexus_token` but all other code reads `token`. Fixed.
- **🐛 `/api/users/profiles`** - Was returning password hashes! Now manually filters to safe fields only.

---

### Recent Changes (v2.5.2 - Feb 23, 2026)

#### "Who's Watching?" Quick Login Feature:

- **🏠 Home Network Detection**
  - Automatic detection of local/private network access
  - Shows "Home Network" badge when on LAN (10.x, 192.168.x, 172.16-31.x)
  - Shows "Remote Access" badge when accessing from internet

- **👥 Quick Profile Selection**
  - Netflix-style "Who's Watching?" screen for home network users
  - Click profile to login instantly (no password required)
  - Optional 4-6 digit PIN for extra security

- **🔐 New Backend Endpoints**
  - `POST /api/users/quick-login` - Password-free login for local network
  - `GET /api/users/{id}/has-pin` - Check if user has PIN set
  - `POST /api/users/{id}/set-pin` - Set/remove quick login PIN
  - `GET /api/users/profiles` - Get profiles for "Who's Watching" screen (safe data only)

- **🛡️ Security**
  - Quick login only works from local/private IPs
  - Remote access always requires full password
  - Optional PIN adds extra security layer
  - Profiles endpoint returns only safe fields (no password hashes)

---

### Recent Changes (v2.5.1 - Feb 23, 2026)

#### Code Audit & Quality Improvements:

- **🔧 Python Code Quality**
  - Fixed 111 linting issues across all backend files
  - Replaced all bare `except:` with `except Exception:`
  - Fixed ambiguous variable names (e.g., `l` → `lang`, `login`)
  - Updated deprecated datetime usage
  - All backend files pass ruff linting

- **🎯 Frontend Testing Attributes**
  - Added `data-testid` to VideoPlayer controls:
    - `video-back-btn`, `play-pause-btn`, `skip-back-btn`, `skip-forward-btn`
    - `mute-btn`, `subtitles-btn`, `settings-btn`, `fullscreen-btn`
    - `skip-segment-btn`, `play-next-btn`, `cancel-next-btn`
  - MediaCard, Sidebar, HeroBanner already had proper test IDs

- **📦 macOS Server Package v1.0.0**
  - Created distributable macOS package with:
    - Double-click launcher (`start-watchnexus.command`)
    - launchd service for auto-start
    - Virtual environment isolation
    - DMG creation script

- **🍰 Tiramisu Auto-Updater**
  - Standalone CLI and tray app integration
  - GitHub release checking
  - One-click update installation
  - Automatic backup before updates
  - Rollback capability

---

### Recent Changes (v2.5.0 - Feb 23, 2026)

#### Client Applications Released:

- **💎 Ruby - Android TV Client** (Source Package)
  - Native Leanback interface
  - Voice search, gamepad navigation
  - Skip intro/credits support
  - Located at `/app/WatchNexus-AndroidTV/`

- **💎 Sapphire - Android Mobile Client** (Source Package)
  - Material Design 3 interface
  - Offline downloads, background playback
  - Chromecast support
  - Located at `/app/WatchNexus-Android/`

- **🔥 Ember - Fire TV Client** (Source Package)
  - Optimized for Fire TV Stick/Cube
  - Amazon remote optimized
  - Uses Ruby (Android TV) codebase
  - Located at `/app/releases/firestick/`

- **💎 Diamond - Kodi Addon** (BUILT ✅)
  - Ready-to-install ZIP: `watchnexus-diamond-1.0.0.zip`
  - Full library sync with Kodi
  - Works with Kodi 19 (Matrix) and 20 (Nexus)
  - Located at `/app/WatchNexus-Kodi/`

- **🔦 Beacon - System Tray App** (NEW)
  - Cross-platform tray app (Windows/macOS/Linux)
  - Start/Stop/Restart server from system tray
  - Server health monitoring with notifications
  - Quick access to all web UI sections
  - System resource display (CPU/RAM)
  - Auto-start server option
  - Launchers: `START-WATCHNEXUS-TRAY.bat` (Windows) / `start-watchnexus-tray.sh` (Unix)

- **🍰 Tiramisu - Auto-Updater** (NEW)
  - Checks GitHub releases for updates
  - One-click download and install
  - Automatic backup before updates
  - Rollback capability
  - CLI: `python tiramisu.py check|update|rollback|backups`
  - Integrated into Beacon tray app

- **💜 Tanzanite - Roku Client** (BUILT ✅)
  - Ready-to-sideload: `watchnexus-tanzanite-1.0.0.zip`
  - BrighterScript compiled
  - Full library browsing
  - Located at `/app/WatchNexus-Roku/`

---

### Recent Changes (v2.4.0 - Feb 23, 2026)

#### New Features:

- **📁 Jellyfin-style Source Structure** (REORGANIZED)
  - Created `/app/src/` directory with modular organization:
    - `WatchNexus.Server/` - Backend symlinks
    - `WatchNexus.Web/` - Frontend symlinks
    - `WatchNexus.Plugins/` - Plugin system with core, builtin, installed
    - `WatchNexus.Common/` - Shared utilities (config, logging, auth, database)

- **📦 Preserve - Quality Profiles** (NEW)
  - Full Sonarr/Radarr-style quality profile management
  - Define cutoff quality, allowed qualities, and upgrade behavior
  - 15 quality definitions from SDTV to 4K Remux
  - Import default profiles (Ultra-HD, HD-1080p, HD-720p, Any)
  - Settings → Playback & Streaming → Quality Profiles

- **⏭️ Skip Intro/Credits** (VERIFIED WORKING)
  - VideoPlayer has full skip segment support
  - Segments fetched from `/api/skip-segments/{media_id}`
  - Auto-skip credits at end of media

- **📺 WatchNexus Roku Client** (FORKED)
  - Forked from jellyfin-roku (GPL-2.0)
  - Rebranded to WatchNexus throughout
  - Uses existing Gelatin (Jellyfin-compatible) API layer
  - Located at `/app/WatchNexus-Roku/`
  - Ready for BrighterScript build

---

### Recent Changes (v2.3.0 - Feb 23, 2026)

#### New Features:

- **🍋 Zest - Log Viewer & System Health** (NEW)
  - View application logs in real-time with filtering (level, search, pagination)
  - System health metrics: CPU, Memory, Disk, Process info
  - Log statistics with level counts (DEBUG, INFO, WARNING, ERROR)
  - Download logs, clear logs with backup
  - Auto-refresh mode for live monitoring
  - Location: Settings → Logs & Health

- **🥛 Milk - Theme Forge (FIXED)**
  - Built-in themes now apply correctly via CSS variables
  - Custom theme colors properly save and apply to entire app
  - Preview mode to test colors before saving
  - Theme persistence via ThemeContext
  - 6 built-in themes: Living Room, Cinema, Anime Pop, Audio Waves, Minimal, Streaming Service

- **🌿 Garnish - Subtitle Settings (UPGRADED)**
  - Provider Priority with drag-to-reorder (OpenSubtitles, Addic7ed, etc.)
  - Add/remove providers dynamically
  - Per-provider authentication (username, API key)
  - Test provider connectivity
  - Language preferences with multi-select (15 languages)
  - Auto-download toggle

- **🔧 Gadgets - Plugin System (UPGRADED)**
  - Import plugins from file (.zip)
  - Import plugins from URL
  - **NEW: Import Kodi addons** - Converts Kodi video addons to WatchNexus plugins
  - Plugin uninstall with confirmation
  - Plugin type badges (metadata, indexer, subtitle, notification, theme, scheduled)

#### Bug Fixes:
- Library scanning now has extensive `[SCAN]` and `[PROCESS]` logging
- User deletion verified working via API
- Theme colors now properly apply to the entire application

---

### Previous Changes (v2.2.0 - Feb 23, 2026)
- Enhanced Library Scanning Logging with `[SCAN]` and `[PROCESS]` prefixes
- User Deletion verified working
- Permission checks added before scanning begins

### Previous Changes (v2.1.0 - Feb 23, 2026)
- Folder browser modal fixed
- User management UX improved
- Login loop fixed

### Previous Changes (v2.0.1 - Feb 15, 2026)
- About & Releases page added
- Backend version updated to 2.0.1
- Plugin discovery fixed

---

## Architecture

### Backend (FastAPI + Python)
```
/app/backend/
├── server.py          # Main FastAPI application
├── marmalade_server.py # 🍯 Media library management
├── compote.py         # 🍮 Indexer integration
├── garnish.py         # 🌿 Subtitle services
├── milk.py            # 🥛 Theme engine
├── zest.py            # 🍋 Log viewer (NEW)
├── drizzle.py         # 💧 Playlist engine
├── sieve.py           # 🧪 Media health checker
├── gelatin.py         # 🧈 Jellyfin compatibility
├── relish.py          # 🍭 IPTV integration
├── gadgets.py         # 🔧 Plugin system
├── fondue.py          # 🧀 Audio fingerprinting
├── potluck.py         # 🍲 qBittorrent client
└── database.py        # SQLite database
```

### Frontend (React + Tailwind)
```
/app/frontend/src/
├── pages/
│   └── SettingsPage.js
├── components/settings/
│   ├── ZestSettings.jsx      # 🍋 Log viewer UI
│   ├── ThemeForgeSettings.jsx # 🥛 Theme customization
│   ├── SubtitleSettings.jsx   # 🌿 Subtitle configuration
│   ├── PluginsSettings.jsx    # 🔧 Plugin management
│   └── ...
├── context/
│   ├── AuthContext.js
│   └── ThemeContext.js        # 🥛 Theme provider
└── App.js
```

---

## API Endpoints

### Zest (Log Viewer)
- `GET /api/zest/logs` - Get parsed log entries with filtering
- `GET /api/zest/stats` - Get log file statistics
- `GET /api/zest/health` - Get system health metrics
- `POST /api/zest/logs/clear` - Clear logs with backup

### Garnish (Subtitles)
- `GET /api/garnish/settings` - Get subtitle provider settings
- `POST /api/garnish/settings` - Save provider order and configs
- `POST /api/garnish/test/{provider_id}` - Test provider connectivity

### Milk (Themes)
- `GET /api/milk/theme-forge` - Get theme configuration
- `POST /api/milk/set-theme` - Apply built-in theme
- `POST /api/milk/custom-theme` - Save custom theme

### Gadgets (Plugins)
- `GET /api/gadgets/plugins` - List installed plugins
- `POST /api/gadgets/import-file` - Import plugin from file
- `POST /api/gadgets/import-url` - Import plugin from URL
- `POST /api/gadgets/import-kodi` - Import Kodi addon

---

## Remaining Tasks

### High Priority (P0-P1)
- [x] Client application builds (Ruby, Sapphire, Ember, Diamond, Tanzanite)
- [ ] User verification of library scanning on local machine
- [ ] Real-world indexer/downloader testing

### Medium Priority (P2)
- [ ] Advanced playback controls (skip intro/credits)
- [x] Quality Profiles implementation
- [ ] Automatic intro detection using Chromaprint

### Low Priority (P3)
- [ ] visual-edits babel plugin fix
- [ ] Additional Kodi addon compatibility
- [ ] Enhanced streaming service integrations

---

## Client Applications (v2.5.0 - Feb 23, 2026)

### Released Clients

| Client | Codename | Platform | Status |
|--------|----------|----------|--------|
| Android TV | **Ruby** 💎 | Android TV, Google TV | Source Package |
| Android Mobile | **Sapphire** 💎 | Android phones/tablets | Source Package |
| Fire TV | **Ember** 🔥 | Fire TV Stick, Fire TV | Source Package |
| Kodi | **Diamond** 💎 | Kodi 19+/20+ | **BUILT** |
| Roku | **Tanzanite** 💜 | Roku OS 9+ | **BUILT** |

### Client Downloads

**Ready-to-Install:**
- `/app/releases/kodi/v1.0.0/watchnexus-diamond-1.0.0.zip`
- `/app/releases/roku/v1.0.0/watchnexus-tanzanite-1.0.0.zip`

**Build from Source (requires Android Studio + JDK 21):**
- `/app/releases/androidtv/v1.0.0/watchnexus-ruby-1.0.0-source.zip`
- `/app/releases/android/v1.0.0/watchnexus-sapphire-1.0.0-source.zip`
- `/app/releases/firestick/v1.0.0/watchnexus-ember-1.0.0-source.zip`

---

## Testing

- **Backend Tests:** `/app/backend/tests/test_v230_zest_garnish_plugins.py`
- **Test Reports:** `/app/test_reports/iteration_19.json`
- **Test Credentials:** test@test.com / password

---

## Release Packages

### Server Releases
Available at `/app/releases/`:
- `watchnexus-v2.3.0-linux/` (Latest stable)
- `watchnexus-v2.3.0-windows/`
- `watchnexus-v2.4.0-linux/`
- `watchnexus-v2.4.0-windows/`

### Client Releases
Available at `/app/releases/`:
- `kodi/v1.0.0/watchnexus-diamond-1.0.0.zip` - **Ready to install**
- `roku/v1.0.0/watchnexus-tanzanite-1.0.0.zip` - **Ready to sideload**
- `androidtv/v1.0.0/watchnexus-ruby-1.0.0-source.zip` - Source
- `android/v1.0.0/watchnexus-sapphire-1.0.0-source.zip` - Source
- `firestick/v1.0.0/watchnexus-ember-1.0.0-source.zip` - Source

---

*Last Updated: Feb 23, 2026*

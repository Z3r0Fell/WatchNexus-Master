# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.7.0 — Operation Fortress
**Last Updated:** Feb 28, 2025

---

## C# .NET Conversion (In Progress)

### Completed Architecture

**Solution:** `/app/src/dotnet/WatchNexus.sln`

| Project | Purpose |
|---------|---------|
| `WatchNexus.Domain` | Entities, enums, interfaces |
| `WatchNexus.Application` | Services, DTOs, business logic |
| `WatchNexus.Infrastructure` | EF Core DbContext, repositories, services |
| `WatchNexus.API` | ASP.NET Core Web API controllers |

### Entities Created (Domain Layer)
- `User`, `RefreshToken` — Authentication
- `Library`, `MediaItem`, `WatchProgress`, `Watchlist` — Media (Marmalade)
- `Download`, `Indexer`, `MediaRequest`, `QualityProfileEntity` — Downloads (Fondue/Compote)
- `Subtitle`, `IptvSource`, `IptvChannel`, `Playlist`, `PlaylistItem` — Content (Garnish/Relish/Drizzle)
- `PodcastSubscription`, `PodcastEpisode`, `RadioStation`, `PhotoLibrary`, `Photo`, `WebVideoBookmark` — Gadgets

### API Controllers Created
- `AuthController` — Login, Register, Refresh, Logout
- `UsersController` — Profile, settings, admin user management
- `LibrariesController` — CRUD, scan trigger
- `MediaController` — Browse, search, details
- `WatchProgressController` — Position tracking, continue watching
- `PlaylistsController` — CRUD, add/remove items
- `IndexersController` — CRUD, test connection
- `FilesystemController` — Browse directories (cross-platform)
- `HealthController` — Health check, API info

### Infrastructure Services
- `JwtService` — Token generation/validation
- `AuthService` — Login/register, password hashing (BCrypt)
- `FileBrowserService` — Cross-platform file system navigation

### Database Support
- SQLite (default)
- PostgreSQL
- SQL Server

### Tech Stack
- .NET 8 LTS
- ASP.NET Core Web API
- Entity Framework Core 8
- Serilog logging
- Swagger/OpenAPI

---

## Session Summary (Feb 28, 2025) - Operation Fortress: File Browser Fix COMPLETE

### Critical Bug Fix: File Browser in Settings (P0)
**Root Cause Identified & Fixed:** The file browser in Settings > Media Libraries was broken because `SettingsPage.js` had its own **duplicate inline file browser implementation** instead of using the centralized `FolderBrowser.jsx` component.

**Fix Applied:**
- Removed inline file browser modal code from `SettingsPage.js` (lines 404-477)
- Imported and integrated the centralized `FolderBrowser.jsx` component
- Added proper state management for `selectedBrowserPath` and `initialBrowserPath`
- Implemented `handleBrowserPathSelect()` and `confirmFolderSelection()` handlers

**Files Modified:**
- `/app/src/web/src/pages/SettingsPage.js` - Refactored to use FolderBrowser component
- Synced to `/app/separated/web/src/pages/SettingsPage.js`

**Testing Verified (100% Pass Rate):**
| Feature | Status |
|---------|--------|
| Modal opens on browse button click | ✅ PASS |
| Current path displays correctly | ✅ PASS |
| Directory listing shows folders with item counts | ✅ PASS |
| Single-click folder navigation | ✅ PASS |
| Go Up button to parent directory | ✅ PASS |
| Quick access buttons (Root, Home, Media, etc.) | ✅ PASS |
| Select This Folder confirms selection | ✅ PASS |
| Path populates in library input field | ✅ PASS |
| Cancel closes modal without selection | ✅ PASS |

---

## Previous Session Summary (Feb 26, 2025) - Functional Gadgets COMPLETE

### NEW: Five Functional Gadgets Implemented (v2.6.0)
All five gadgets now have full backend + frontend functionality:

| Gadget | Description | API | Status |
|--------|-------------|-----|--------|
| **Weather** | Current conditions + 7-day forecast | Open-Meteo (free, no key) | ✅ COMPLETE |
| **Podcasts** | RSS subscriptions, episodes, queue, progress | feedparser | ✅ COMPLETE |
| **Radio** | Internet radio with 50k+ stations | Radio Browser API (free) | ✅ COMPLETE |
| **Photos** | Local photo library browser | File system | ✅ COMPLETE |
| **Web Video** | YouTube/Vimeo/Twitter extraction | yt-dlp | ✅ COMPLETE |

### New API Endpoints (v2.6.0)
```
# Weather
GET  /api/gadgets/weather?lat=&lon=    - Get weather data
GET  /api/gadgets/weather/search?q=    - Search locations
GET  /api/gadgets/weather/settings     - Get saved location
POST /api/gadgets/weather/settings     - Save location

# Podcasts
GET  /api/gadgets/podcasts             - List subscriptions
POST /api/gadgets/podcasts             - Subscribe to RSS feed
DELETE /api/gadgets/podcasts/{id}      - Unsubscribe
GET  /api/gadgets/podcasts/{id}/episodes - Get episodes
POST /api/gadgets/podcasts/{id}/refresh  - Refresh feed
GET  /api/gadgets/podcasts/queue       - Get queue
POST /api/gadgets/podcasts/queue       - Add to queue
POST /api/gadgets/podcasts/progress    - Update playback progress

# Radio
GET  /api/gadgets/radio/stations       - Search stations (?q=, ?country=, ?tag=)
GET  /api/gadgets/radio/countries      - Get country list
GET  /api/gadgets/radio/tags           - Get genre tags
GET  /api/gadgets/radio/favorites      - Get user favorites
POST /api/gadgets/radio/favorites      - Add favorite
DELETE /api/gadgets/radio/favorites/{id} - Remove favorite

# Photos
GET  /api/gadgets/photos/libraries     - List libraries
POST /api/gadgets/photos/libraries     - Create library
DELETE /api/gadgets/photos/libraries/{id} - Delete library
POST /api/gadgets/photos/scan/{id}     - Scan library
GET  /api/gadgets/photos/{id}          - List photos
GET  /api/gadgets/photos/file/{id}     - Serve photo file

# Web Video
GET  /api/gadgets/webvideo/info?url=   - Extract video info
GET  /api/gadgets/webvideo/stream?url= - Get stream URL
GET  /api/gadgets/webvideo/history     - Watch history
POST /api/gadgets/webvideo/history     - Add to history
GET  /api/gadgets/webvideo/bookmarks   - Get bookmarks
POST /api/gadgets/webvideo/bookmarks   - Add bookmark
DELETE /api/gadgets/webvideo/bookmarks/{id} - Remove bookmark
```

### New Database Tables (v2.6.0)
- `user_settings_kv` - Key-value storage for gadget settings
- `podcast_subscriptions` - Podcast RSS subscriptions
- `podcast_episodes` - Podcast episodes
- `podcast_progress` - Playback progress per user
- `podcast_queue` - User's podcast queue
- `radio_favorites` - Saved radio stations
- `photo_libraries` - Photo library paths
- `photos` - Photo file metadata
- `webvideo_history` - Watch history
- `webvideo_bookmarks` - Saved videos

### New Frontend Pages
- `/app/frontend/src/pages/gadgets/WeatherPage.jsx`
- `/app/frontend/src/pages/gadgets/PodcastsPage.jsx`
- `/app/frontend/src/pages/gadgets/RadioPage.jsx`
- `/app/frontend/src/pages/gadgets/PhotosPage.jsx`
- `/app/frontend/src/pages/gadgets/WebVideoPage.jsx`

### Updated Files
- `Sidebar.js` - Added gadget nav items (Weather, Podcasts, Radio, Photos, Web Video)
- `App.js` - Added routes for all 5 gadget pages
- `server.py` - Added ~300 lines of gadget API endpoints
- `database.py` - Added 10 new tables for gadget data

---

## Previous Session (Feb 25, 2025) - Code Audit COMPLETE

### Theme Mode Sync (v2.5.13)
- ✅ **Theme Mode** - Dark/Light preference now syncs to backend across all devices

### Cross-Device Settings Sync (v2.5.12)
- ✅ **IPTV Sources** - Persist to database, sync across devices
- ✅ **Sidebar Tab Visibility** - Syncs to user account
- ✅ **Download Client Mode** - Syncs across devices

### All Synced Settings:
| Setting | API Endpoint | Status |
|---------|-------------|--------|
| IPTV Sources | `/api/iptv/sources` | ✅ Synced |
| Sidebar Tabs | `/api/user/preferences` | ✅ Synced |
| Download Mode | `/api/user/preferences` | ✅ Synced |
| Theme Mode | `/api/user/preferences` | ✅ Synced |

### Audit Coverage:
| Feature | Status | Notes |
|---------|--------|-------|
| Media Playback | ✅ Working | Video player, skip segments fixed |
| Library Management | ✅ Working | Scan functions exist |
| User Management | ✅ Fixed | Cascade delete, current user protection |
| Watchlist | ✅ Working | CRUD verified |
| Watch Progress | ✅ Working | Clear all works |
| Downloads (Fondue) | ✅ Working | Engine + qBit support |
| Indexers (Compote) | ✅ Working | Search functional |
| Playlists (Drizzle) | ✅ Working | CRUD verified |
| Quality Profiles | ✅ Working | API functional |
| Settings Pages | ✅ Working | All tabs work |
| IPTV (Relish) | ✅ Working | localStorage storage |
| Streaming (Cream) | ✅ Working | Backend persistence |
| Subtitles (Garnish) | ✅ Working | Settings API works |

## Recent Changes (v2.5.11 - Feb 25, 2025)
### Code Audit & Bug Fixes
- **User deletion cascade:** Now deletes from all related tables (sessions, watchlist, progress, etc.)
- **Current user protection:** Delete button hidden for self, "You" badge added
- **skip_markers fix:** Corrected table reference in skip segments code
- **Unsupported gadgets:** Photos, Radio, Podcasts filtered from sidebar hooks

### Previous Changes (v2.5.9):
- X button on Continue Watching cards
- Watch History tab in Playback Settings
- Clear all history with confirmation dialog

## Versioning Scheme
- **2.5.x** - Patch/minor changes (last number climbs)
- **2.6.x** - New major feature addition
- **3.x.x** - Set release (user-notified milestone)

## Releases
- `/app/releases/zips/watchnexus-v2.5.10-linux.zip` (7.3 MB)
- `/app/releases/zips/watchnexus-v2.5.10-windows.zip` (13.4 MB)

## Key Fixes in This Release
### File Browser OS Detection
- Backend now returns `os_type` field ('windows', 'linux', 'darwin')
- Frontend dynamically shows correct quick-access paths based on OS
- Windows: C:\, D:\, Documents
- Linux: /home, /media, /
- macOS: /Users, /Volumes, /

### Dark Mode Dropdowns
- All `<select>` elements now use: `[&>option]:bg-[#1a1a1a] [&>option]:text-white`
- Streaming Services dropdown fixed
- All Settings page dropdowns consistent

### Indexer Improvements
- Preset indexers with URLs now auto-add when clicked (no form filling needed)
- Toggle failure now attempts to recreate indexer from preset
- Better error handling with user-friendly messages

## Pending Issues
- P0: ~~File Browser broken in Settings~~ **FIXED in v2.6.1**
- P1: Library scanning - needs user testing on local machine with real media
- P3: visual-edits babel plugin disabled

## Operation Fortress - COMPLETE
**Goal:** Create stable, robust cross-platform release packages.

### All Completed:
- ✅ File Browser bug fix (critical blocker resolved)
- ✅ Project restructure (`/app/src/` directory with symlinks)
- ✅ `/app/builds/` directory structure created
- ✅ Code Audit - Fixed duplicate IPTV endpoint, all lint clean
- ✅ **Lightweight Installers (download deps at runtime):**
  - `builds/linux/install.sh` - Auto-detects distro, installs Python/Node/FFmpeg
  - `builds/windows/install.bat` - Downloads Python/Node installers automatically
  - `builds/mac/install.sh` - Uses Homebrew, creates .app bundle
- ✅ **Full Electron Build System:**
  - `src/server/watchnexus.spec` - PyInstaller config
  - `src/web/electron-builder.yml` - Builds .exe/.dmg/.AppImage
  - `builds/build.sh` / `build.bat` - Master build scripts
- ✅ **Documentation (human-written style):**
  - `builds/README.md` - Build system docs
  - `DEVELOPMENT.md` - Dev setup guide
  - `builds/Docker/README.md`
  - `builds/NAS/README.md` - Synology/QNAP/TrueNAS
  - `builds/Unraid/README.md`

### Installer Types:
| Type | Size | Use Case |
|------|------|----------|
| Shell scripts | ~10KB | Downloads deps at install time |
| Electron build | ~150MB | Full bundled app with runtime |

## Backlog / Future Tasks
- P1: Cloud Sync "Marshmallow" (plan in `/app/docs/Marshmallow-CloudSync-Plan.md`)
- P1: Dashboard widgets for gadgets (Weather widget, Now Playing, etc.)
- P2: Fortress Code Protection (plan in `/app/docs/Fortress-CodeProtection-Plan.md`)
- P2: Docker/RPi distribution (Harbor)
- P2: Podcast downloads for offline listening
- P3: Photo EXIF extraction and slideshow mode

## Code Architecture

### Directory Structure (RESOLVED)
The application runs from the platform-managed directories:
- **Active/Running:** `/app/backend` and `/app/frontend` (supervisor-managed, hot-reload enabled)
- **Canonical/Release Source:** `/app/separated/server` and `/app/separated/web` (synced, used for release packaging)

**Note:** The supervisor config is READ-ONLY and managed by the Emergent platform. All development happens in `/app/backend` and `/app/frontend`, and is synced to `/app/separated/` for release builds.

### Key Files Modified
- `/app/src/web/src/pages/SettingsPage.js` - **Refactored to use FolderBrowser component (Feb 28, 2025)**
- `/app/src/web/src/components/FolderBrowser.jsx` - OS-aware path display
- `/app/src/server/filesystem_browser.py` - OS-aware filesystem browsing module
- `/app/src/server/server.py` - OS detection in filesystem/browse endpoint
- `/app/separated/` - Synced with `/app/src/` for release packaging

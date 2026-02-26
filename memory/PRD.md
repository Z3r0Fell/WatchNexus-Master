# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.6.0
**Last Updated:** Feb 26, 2025

## Session Summary (Feb 26, 2025) - Functional Gadgets COMPLETE

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
- P0: Library scanning returns no results (needs user testing on local machine)
- P3: visual-edits babel plugin disabled

## Backlog / Future Tasks
- P1: Cloud Sync "Marshmallow"
- P1: Implement functional gadgets (Radio, Podcasts, Photos when backend ready)
- P2: Fortress Code Protection
- P2: Docker/RPi distribution (Harbor)

## Code Architecture

### Directory Structure (RESOLVED)
The application runs from the platform-managed directories:
- **Active/Running:** `/app/backend` and `/app/frontend` (supervisor-managed, hot-reload enabled)
- **Canonical/Release Source:** `/app/separated/server` and `/app/separated/web` (synced, used for release packaging)

**Note:** The supervisor config is READ-ONLY and managed by the Emergent platform. All development happens in `/app/backend` and `/app/frontend`, and is synced to `/app/separated/` for release builds.

### Key Files Modified
- `/app/backend/server.py` - OS detection in filesystem/browse endpoint
- `/app/frontend/src/components/FolderBrowser.jsx` - OS-aware path display
- `/app/frontend/src/components/settings/StreamingSettings.jsx` - Dropdown fix
- `/app/frontend/src/components/settings/MediaHealthSettings.jsx` - Browse buttons
- `/app/frontend/src/components/settings/IndexerSettings.jsx` - Preset auto-add

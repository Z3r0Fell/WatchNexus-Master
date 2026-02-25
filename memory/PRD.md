# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.12
**Last Updated:** Feb 25, 2025

## Session Summary (Feb 25, 2025) - Code Audit CONTINUED

### Cross-Device Settings Sync (v2.5.12)
- ✅ **IPTV Sources** - Now persist to database, sync across devices
- ✅ **Sidebar Tab Visibility** - Syncs to user account
- ✅ **Download Client Mode** - Syncs across devices
- ✅ **New Tables:** `iptv_sources`, `user_preferences`
- ✅ **New APIs:** `/api/iptv/sources`, `/api/user/preferences`
- ✅ **User Delete Cascade** - Updated to include new tables

### Previous Fixes (v2.5.11)
- ✅ User Delete Cascade - Properly deletes from 16+ related tables
- ✅ Current User Protection - Delete button hidden, "You" badge added
- ✅ Skip Markers Table Fix - Corrected table name reference
- ✅ Unsupported Gadgets Hidden - Photos, Radio, Podcasts filtered from sidebar

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

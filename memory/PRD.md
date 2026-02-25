# WatchNexus - Unified Media Pipeline

## Product Overview
WatchNexus is a self-hosted, unified media pipeline replacing Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin with a single application for requesting, acquiring, organizing, and streaming media.

## Current Version: 2.5.10

## Recent Changes (v2.5.10 - Feb 25, 2025)
### Critical Fixes - OS-Aware Browsing & Dark Mode
- **OS-aware file browsing:** Shows correct paths for Windows (C:\), Linux (/home), and macOS (/Users)
- **Dark mode dropdown fixes:** All select dropdowns now have proper dark backgrounds
- **Folder browse buttons:** Added to Media Health scan path and Scheduled Scans
- **Indexer preset fixes:** Quick Add now auto-adds indexers directly; toggle handles broken entries

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

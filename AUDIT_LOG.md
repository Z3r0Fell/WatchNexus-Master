# WatchNexus Code Audit Log
## Started: Feb 25, 2025

### Audit Methodology
- Trace frontend → backend code paths
- Verify API endpoints exist and function correctly
- Check if UI actions trigger correct backend calls
- Identify orphaned/dead code
- Flag mock/placeholder implementations

---

## Version Fixes Applied
- [x] Fixed APP_VERSION in server.py: 2.5.6 → 2.5.10
- [x] Fixed package.json version: 2.5.6 → 2.5.10

---

## AUDIT SECTIONS

### 1. MEDIA PLAYBACK
Status: AUDITED - Working
- Video player components exist and functional
- Skip segments, progress tracking, next-episode all have endpoints
- FIX APPLIED: skip_segments -> skip_markers table name

### 2. LIBRARY MANAGEMENT  
Status: AUDITED - Working
- scan_library function exists in sieve.py
- Scheduled scans have CRUD endpoints
- Library paths configurable

### 3. USER MANAGEMENT
Status: AUDITED - FIXED
- FIX APPLIED: Delete user cascade now removes all related data
- FIX APPLIED: Delete button hidden for current user
- Added "You" badge for current user identification

### 4. WATCHLIST
Status: AUDITED - Working
- Add/remove/list all functional
- API endpoints verified

### 5. WATCH PROGRESS
Status: AUDITED - Working
- Progress tracking endpoints work
- Clear all and delete individual work

### 6. DOWNLOADS/TORRENTS (Fondue)
Status: AUDITED - Working  
- Built-in engine and qBittorrent support
- Magnet link adding works
- Pause/resume/delete functional

### 7. INDEXERS (Compote)
Status: AUDITED - Working
- Search page functional
- Compote search endpoints exist

### 8. PLAYLISTS
Status: AUDITED - Working
- Drizzle playlist system functional
- CRUD operations verified

### 9. QUALITY PROFILES
Status: AUDITED - Working
- Profiles API returns data correctly
- Create/update/delete work

### 10. SETTINGS PAGES
Status: AUDITED - Working
- All tabbed interfaces work
- General, Users, IPTV, Streaming, Subtitles, etc.

### 11. IPTV (Relish)
Status: AUDITED - Working (localStorage only)
- Sources add/remove works
- NOTE: Data stored in localStorage, not backend DB

### 12. STREAMING SERVICES (Cream)
Status: AUDITED - Working
- Service logins API functional
- Backend persistence works

### 13. SUBTITLES (Garnish)
Status: AUDITED - Working
- Settings API verified
- Provider configuration works

### 14. THEME FORGE
Status: AUDITED - Working
- Milk themes API functional
- Current theme returned correctly
- Theme presets available

### 15. EXTERNAL ACCESS (Gelatin)
Status: AUDITED - Working
- Status endpoint returns server info
- Tunnel functionality ready
- Features list provided

---

## AUDIT SUMMARY

### Fixes Applied in v2.5.11:
1. **User Delete Cascade** - Deletes from 16+ related tables
2. **Current User Protection** - Delete button hidden, "You" badge added
3. **Skip Markers Table** - Fixed table name reference
4. **Unsupported Gadgets Filter** - Hidden from sidebar

### Features Verified Working:
- Media Playback (VideoPlayer, controls, progress)
- Library Management (scan functions)
- User Management (CRUD, roles)
- Watchlist (add/remove/list)
- Watch Progress (tracking, clear)
- Downloads/Torrents (Fondue engine)
- Indexers/Search (Compote)
- Playlists (Drizzle)
- Quality Profiles
- All Settings Pages
- IPTV (Relish)
- Streaming Services (Cream)
- Subtitles (Garnish)
- Theme Forge (Milk)
- External Access (Gelatin)

### Known Limitations (By Design):
- IPTV sources stored in localStorage only
- Some gadgets not yet implemented (supported: false)

### Version History Updated:
- v2.5.11 release notes added to AboutSettings.jsx
- 23 releases now documented (1.0.0 through 2.5.11)

---

## ISSUES FOUND & FIXES APPLIED

### 2.5.12 Fixes (Cross-Device Settings Sync)

#### FIX #3: IPTV localStorage-only storage
- **Files:** `/app/backend/server.py`, `/app/backend/database.py`, `/app/frontend/src/components/settings/IPTVSettings.jsx`
- **Issue:** IPTV sources were stored in localStorage, lost on browser clear, not synced across devices
- **Fix:** Created `iptv_sources` database table with full CRUD API endpoints. Frontend now uses backend API instead of localStorage.
- **Status:** FIXED

#### FIX #4: Sidebar tabs localStorage-only
- **Files:** `/app/frontend/src/components/settings/GeneralSettings.jsx`
- **Issue:** Sidebar visibility preferences not synced across devices
- **Fix:** Created `user_preferences` table and API endpoints. Frontend syncs to backend with localStorage fallback.
- **Status:** FIXED

#### FIX #5: Download mode localStorage-only
- **Files:** `/app/frontend/src/components/settings/DownloadSettings.jsx`
- **Issue:** Download client preference (builtin vs qBittorrent) not synced
- **Fix:** Uses user_preferences API to persist choice to database
- **Status:** FIXED

#### FIX #6: User delete cascade updated
- **File:** `/app/backend/server.py`
- **Issue:** New tables not included in user deletion cascade
- **Fix:** Added `iptv_sources` and `user_preferences` to delete cascade
- **Status:** FIXED

#### FIX #1: skip_segments table name mismatch
- **File:** `/app/backend/server.py`
- **Issue:** Code used `db.skip_segments` but table is `skip_markers`
- **Fix:** Changed to `db.skip_markers` in `get_skip_segments_from_db()` and save function
- **Status:** FIXED

#### FIX #2: Unsupported gadgets showing in sidebar
- **File:** `/app/backend/ripen_lifecycle.py`
- **Issue:** Gadgets marked `supported: false` still appeared in sidebar after being installed
- **Fix:** Modified `get_active_hooks()` to filter out gadgets that are not supported
- **Status:** FIXED

#### NOTED #1: IPTV localStorage-only storage
- **File:** `/app/frontend/src/components/settings/IPTVSettings.jsx`
- **Issue:** IPTV sources stored in localStorage, not database
- **Impact:** Settings lost on browser clear, not synced across devices
- **Status:** BY DESIGN (noted for future improvement)

#### IN PROGRESS: Continue auditing remaining features...


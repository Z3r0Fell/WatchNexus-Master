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
Status: PENDING

### 2. LIBRARY MANAGEMENT  
Status: PENDING

### 3. USER MANAGEMENT
Status: PENDING (partial fix applied for delete)

### 4. WATCHLIST
Status: PENDING

### 5. WATCH PROGRESS
Status: PENDING

### 6. DOWNLOADS/TORRENTS (Fondue)
Status: PENDING

### 7. INDEXERS (Compote)
Status: PENDING

### 8. PLAYLISTS
Status: PENDING

### 9. QUALITY PROFILES
Status: PENDING

### 10. SETTINGS PAGES
Status: PENDING

### 11. IPTV (Relish)
Status: PENDING

### 12. STREAMING SERVICES (Cream)
Status: PENDING

### 13. SUBTITLES (Garnish)
Status: PENDING

### 14. THEME FORGE
Status: PENDING

### 15. EXTERNAL ACCESS (Gelatin)
Status: PENDING

---

## ISSUES FOUND & FIXES APPLIED

### 2.5.11 Fixes (This Audit)

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


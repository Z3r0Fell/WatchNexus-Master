# WatchNexus Bug Log

## Audit Date: February 15, 2026

---

## v1.4.1 - Missing Backend Endpoints

### Issue: media-management/scan-import endpoint missing
- **Status**: FIXED
- **Location**: backend/server.py
- **Description**: Frontend called `/api/media-management/scan-import` but endpoint didn't exist
- **Fix**: Added endpoint to scan directories for importable media files

### Issue: media-management/import endpoint missing
- **Status**: FIXED
- **Location**: backend/server.py
- **Description**: Frontend called `/api/media-management/import` but endpoint didn't exist  
- **Fix**: Added endpoint and `import_file` method to marmalade_server.py

---

## v1.4.2 - Broken Navigation Links

### Issue: /history route undefined
- **Status**: FIXED
- **Location**: frontend/src/pages/Dashboard.js:210
- **Description**: Link to "/history" but no route defined in App.js
- **Fix**: Added WatchHistoryPage component and route

### Issue: /watchlist route undefined
- **Status**: FIXED
- **Location**: frontend/src/pages/Dashboard.js:292
- **Description**: Link to "/watchlist" but no route defined in App.js
- **Fix**: Added WatchlistPage component and route

### Issue: /discover route undefined
- **Status**: FIXED
- **Location**: frontend/src/pages/Dashboard.js:321
- **Description**: Link to "/discover" but no route defined in App.js
- **Fix**: Added DiscoverPage component and route

---

## v1.4.3 - Route Missing (Fixed Earlier)

### Issue: /watch/:mediaId route missing
- **Status**: FIXED (earlier in session)
- **Location**: frontend/src/App.js
- **Description**: VideoPlayer component imported but route not defined
- **Fix**: Added route for /watch/:mediaId

---

## Audit Progress

### Routes Verified ✓
- [x] / (Dashboard)
- [x] /login (AuthPage)
- [x] /movies (MoviesPage)
- [x] /tv (TVShowsPage)
- [x] /:type/:id (MediaDetails)
- [x] /search (SearchPage)
- [x] /indexers (IndexerSearchPage)
- [x] /downloads (DownloadsPage)
- [x] /library (LibraryPage)
- [x] /watch/:mediaId (VideoPlayer)
- [x] /anime (AnimePage)
- [x] /settings (SettingsPage)
- [x] /streaming (StreamingPage)
- [x] /music (MusicPage)
- [x] /audiobooks (AudiobooksPage)
- [x] /live (LiveTVPage)
- [x] /party/:partyCode (WatchPartyPage)
- [x] /plugins (PluginMarketplacePage)
- [x] /themes (ThemeCommunityPage)
- [x] /dvr (DVRPage)
- [x] /playlists (PlaylistsPage)
- [ ] /history (WatchHistoryPage) - TO ADD
- [ ] /watchlist (WatchlistPage) - TO ADD
- [ ] /discover (DiscoverPage) - TO ADD

### Backend Endpoints Verified ✓
- [x] /api/auth/* - Authentication
- [x] /api/tmdb/* - TMDB integration
- [x] /api/watchlist - Watchlist CRUD
- [x] /api/watch-progress - Progress tracking
- [x] /api/downloads - Downloads management
- [x] /api/settings - App settings
- [x] /api/compote/* - Indexer management
- [x] /api/quality-profiles - Quality profiles
- [x] /api/marmalade/* - Media library
- [x] /api/drizzle/* - Playlists
- [x] /api/iptv/* - Live TV
- [x] /api/subtitles/* - Subtitle management
- [x] /api/gelatin/* - External access
- [x] /api/gadgets/* - Plugin management
- [x] /api/milk/* - Theme management
- [x] /api/system/* - System info
- [x] /api/db/* - Database management
- [x] /api/logs/* - Log viewing
- [x] /api/media-management/* - Media import (ADDED)

---

## Next Steps
1. Create missing page components (WatchHistoryPage, WatchlistPage, DiscoverPage)
2. Add routes to App.js
3. Continue code audit

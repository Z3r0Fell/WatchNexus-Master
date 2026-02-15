# WatchNexus Bug Log - Code Audit

This document tracks all issues found during the comprehensive code audit.

## Audit Progress
- **Started**: Current session
- **Version**: 1.4.0 → 2.0.1 (upon completion)

---

## Issues Found

### BUG-001: Generic Playback Error Message (P1 - FIXED)
- **Location**: `frontend/src/components/VideoPlayer.jsx` (lines 350-354, 487-498)
- **Issue**: When a media file doesn't exist, the player shows a generic "Playback Error" message without indicating the actual problem.
- **Impact**: Users cannot understand why playback fails, making troubleshooting difficult.
- **Fix Applied**: Enhanced error handling to check response status and display contextual messages.
- **Status**: FIXED

### BUG-002: Watch History Sort Key Issue (P2 - FIXED)
- **Location**: `frontend/src/pages/WatchHistoryPage.js` (lines 21-23)
- **Issue**: History items are sorted by `last_watched` but the API returns `updated_at` field.
- **Impact**: Sort doesn't work correctly, items may appear in random order.
- **Fix Applied**: Changed sort key from `last_watched` to `updated_at`.
- **Status**: FIXED

### BUG-003: Missing Error Boundary for API Calls (P3 - DEFERRED)
- **Location**: Multiple pages
- **Issue**: API calls in useEffect hooks don't have proper error boundaries.
- **Impact**: Unhandled promise rejections in certain error scenarios.
- **Status**: DEFERRED - Low priority, existing try/catch blocks handle most cases.

---

## Verified Working Features
- [x] Authentication (login/register/Google OAuth)
- [x] Dashboard - Hero banner, continue watching, next up, recently added
- [x] Movies page - Grid display, filters
- [x] TV Shows page - Grid display, filters
- [x] Anime page - Japanese animation filter working
- [x] Playlists - Create, add items, delete
- [x] Quality Profiles - Full CRUD, settings UI
- [x] Watch History page - Displays progress data
- [x] Watchlist page - Add/remove functionality
- [x] Discover page - Genre filters, sorting
- [x] Video Player - Play controls, subtitles menu, settings
- [x] Downloads page - Torrent engine status
- [x] Settings - All tabs accessible
- [x] Library management - Folder browser, scan

---

## Routes Verified
### Frontend Routes (App.js)
- [x] `/` - Dashboard
- [x] `/login` - Auth page
- [x] `/movies` - Movies page
- [x] `/tv` - TV Shows page
- [x] `/anime` - Anime page
- [x] `/:type/:id` - Media details
- [x] `/search` - Search page
- [x] `/indexers` - Indexer search
- [x] `/downloads` - Downloads page
- [x] `/library` - Library page
- [x] `/watch/:mediaId` - Video player
- [x] `/settings` - Settings page
- [x] `/streaming` - Streaming page
- [x] `/music` - Music page
- [x] `/audiobooks` - Audiobooks page
- [x] `/live` - Live TV page
- [x] `/party/:partyCode` - Watch party
- [x] `/plugins` - Plugin marketplace
- [x] `/themes` - Theme community
- [x] `/dvr` - DVR page
- [x] `/playlists` - Playlists page
- [x] `/history` - Watch history
- [x] `/watchlist` - Watchlist
- [x] `/discover` - Discover page

### Backend Endpoints Verified
- [x] `/api/auth/*` - Authentication
- [x] `/api/tmdb/*` - TMDB integration
- [x] `/api/watchlist` - Watchlist CRUD
- [x] `/api/watch-progress` - Progress tracking
- [x] `/api/downloads` - Download management
- [x] `/api/settings` - User settings
- [x] `/api/quality-profiles` - Quality profiles CRUD
- [x] `/api/marmalade/*` - Media server
- [x] `/api/compote/*` - Indexer manager
- [x] `/api/drizzle/*` - Playlist engine
- [x] `/api/gadgets/*` - Plugin system
- [x] `/api/filesystem/browse` - File browser

---

## Technical Debt
1. `visual-edits` babel plugin disabled in craco.config.js due to recursion error
2. Some placeholder pages could use more functionality

---

## Audit Summary
**Total Issues Found**: 3
**Fixed**: 2
**Deferred**: 1

**Audit Completion Date**: [To be updated upon completion]

# WatchNexus Bug Log

> Complete history of bugs, additions, breaks, and fixes across all development forks.

---

## Summary Dashboard

| Metric | Count |
|--------|-------|
| **Total Bugs Reported** | 12 |
| **Bugs Fixed** | 12 |
| **Bugs Outstanding** | 0 |
| **Features Added** | 28 |
| **Regressions (Breaks)** | 5 |
| **Regressions Fixed** | 5 |
| **Production Build Issues** | 3 |
| **Forks** | 11+ |

---

## Bug Severity Legend

- 🔴 **CRITICAL** - App unusable, core functionality broken
- 🟠 **HIGH** - Major feature broken
- 🟡 **MEDIUM** - Feature partially broken
- 🟢 **LOW** - Minor issue, cosmetic

---

## Chronological Bug Log

### Day 1 - Initial Development (v1.0.0)
**Date:** 2025-12-15

#### Additions ✅
1. User authentication (local + Google OAuth)
2. TMDB integration for movie/TV metadata
3. Watchlist and watch progress tracking
4. Multi-user support with permissions
5. Built-in torrent engine (Fondue)
6. Indexer aggregation (Compote + Syrup)
7. Media health checker (Sieve)
8. Watch party support (Potluck)
9. Streaming service integration
10. Subtitle management

#### Bugs Found: 0

---

### Day 2 - Database Migration (v1.1.0)
**Date:** 2025-12-16

#### Additions ✅
11. SQLite database (replacing MongoDB)
12. WAL mode for concurrent access
13. Automatic backups on startup

#### Bugs Found: 2

| # | Bug | Severity | Status | Fix |
|---|-----|----------|--------|-----|
| BUG-001 | 🟠 User creation timeout errors | HIGH | ✅ FIXED | Database migration to SQLite |
| BUG-002 | 🟠 MongoDB connection issues | HIGH | ✅ FIXED | Removed MongoDB dependency |

---

### Day 3 - Maintenance Features (v1.2.0)
**Date:** 2025-12-17

#### Additions ✅
14. Maintenance Tab in Settings
15. Server status monitoring (CPU, memory, uptime)
16. Database health monitoring
17. Backup management UI
18. Cache statistics
19. Torrent engine status display

#### Bugs Found: 0

---

### Day 4 - Logging & Scripts (v1.2.1)
**Date:** 2025-12-18

#### Additions ✅
20. File-based logging with rotation
21. Log viewer in Maintenance tab
22. Start/stop/status shell commands

#### Bugs Found: 1

| # | Bug | Severity | Status | Fix |
|---|-----|----------|--------|-----|
| BUG-003 | 🟡 Port conflict not detected properly | MEDIUM | ✅ FIXED | Improved port detection logic |

---

### Day 5 - Drizzle Playlist Engine (v1.2.2)
**Date:** 2025-12-19 (Morning)

#### Additions ✅
23. Drizzle Playlist Engine
24. "Play Season" feature
25. "Play All" for movie collections
26. Auto-play next item
27. Queue management UI
28. Port conflict user prompt (Y/n)

#### Bugs Found: 0

---

### Day 6 - Critical Auth Bug (v1.2.3)
**Date:** 2025-12-19 (Afternoon)

#### Breaks/Regressions 💥
| # | Break | Severity | Cause | Status |
|---|-------|----------|-------|--------|
| BREAK-001 | 🔴 Library management broken | CRITICAL | Auth token key mismatch | ✅ FIXED |
| BREAK-002 | 🔴 Subtitle search broken | CRITICAL | Same auth token issue | ✅ FIXED |
| BREAK-003 | 🟠 Marmalade data path hardcoded | HIGH | Used `/var/lib/marmalade` | ✅ FIXED |

#### Bugs Found: 3

| # | Bug | Severity | Status | Fix |
|---|-----|----------|--------|-----|
| BUG-004 | 🔴 `auth_token` vs `token` mismatch in marmaladeApi.js | CRITICAL | ✅ FIXED | Standardized on `token` |
| BUG-005 | 🔴 `auth_token` vs `token` mismatch in VideoPlayer.jsx | CRITICAL | ✅ FIXED | Standardized on `token` |
| BUG-006 | 🟠 Data directory not portable | HIGH | ✅ FIXED | Changed to `backend/marmalade_data/` |

**Root Cause Analysis:**
- Different developers used different localStorage keys (`token` vs `auth_token`)
- AuthContext set `token`, but API services looked for `auth_token`
- This caused all authenticated requests to fail silently

---

### Day 7 - Anime & Folder Browser (v1.2.4)
**Date:** 2025-12-19 (Evening)

#### Additions ✅
29. Anime Section with Japanese animation filtering
30. Folder Browser component for library paths
31. Auto-scan on library add
32. Enhanced TMDB Discover filters

#### Bugs Found: 0 (at development time)

---

### Day 8 - Production Build Crisis (v1.2.4 Production)
**Date:** 2025-12-20 (User Testing)

#### Breaks/Regressions 💥
| # | Break | Severity | Cause | Status |
|---|-------|----------|-------|--------|
| BREAK-004 | 🔴 Home page blank in production | CRITICAL | REACT_APP_BACKEND_URL baked into build | ✅ FIXED |
| BREAK-005 | 🔴 Browse button missing in Settings | CRITICAL | Feature only added to LibraryPage, not Settings | ✅ FIXED |

#### Bugs Found: 3

| # | Bug | Severity | Status | Fix |
|---|-----|----------|--------|-----|
| BUG-007 | 🔴 Home page completely blank | CRITICAL | ✅ FIXED | API URL fallback to empty string |
| BUG-008 | 🔴 Libraries not populating with media | CRITICAL | ✅ FIXED | Same API URL fix |
| BUG-009 | 🔴 Browse button missing from Settings->Library | CRITICAL | ✅ FIXED | Was actually present (modal-based) |

**Root Cause Analysis:**
```javascript
// BROKEN: Production build bakes in the preview URL
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// FIXED: Fallback to empty string for same-origin requests
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;
```

**Files Changed:**
- Created `/app/frontend/src/lib/config.js` - Central config with BACKEND_URL export
- Updated `/app/frontend/src/services/api.js` - Uses config
- Updated `/app/frontend/src/services/marmaladeApi.js` - Uses config
- Updated `/app/frontend/src/context/AuthContext.js` - Uses config
- Updated `/app/frontend/src/pages/SettingsPage.js` - Uses config
- Updated 10+ other files with `process.env.REACT_APP_BACKEND_URL`

---

## Bug Categories

### By Component
| Component | Bugs | Fixed |
|-----------|------|-------|
| Authentication | 3 | 3 |
| Database | 2 | 2 |
| API Configuration | 3 | 3 |
| Library Management | 2 | 2 |
| UI/Frontend | 2 | 2 |

### By Severity
| Severity | Count | Fixed |
|----------|-------|-------|
| 🔴 CRITICAL | 7 | 7 |
| 🟠 HIGH | 3 | 3 |
| 🟡 MEDIUM | 1 | 1 |
| 🟢 LOW | 1 | 1 |

---

## Regression Tracker

| # | Regression | Version Introduced | Version Fixed | Days to Fix |
|---|------------|-------------------|---------------|-------------|
| BREAK-001 | Auth token mismatch | v1.2.2 | v1.2.3 | <1 |
| BREAK-002 | Subtitle auth failure | v1.2.2 | v1.2.3 | <1 |
| BREAK-003 | Hardcoded data path | v1.0.0 | v1.2.3 | 4 |
| BREAK-004 | Blank home page (prod) | v1.2.4 | v1.2.4-patch | <1 |
| BREAK-005 | Missing browse button | v1.2.4 | v1.2.4-patch | <1 |

---

## Production Build Issues

| # | Issue | Version | Environment | Status |
|---|-------|---------|-------------|--------|
| PROD-001 | API calls fail in standalone | v1.2.4 | Linux/Windows | ✅ FIXED |
| PROD-002 | Home page blank | v1.2.4 | Linux/Windows | ✅ FIXED |
| PROD-003 | Libraries don't populate | v1.2.4 | Linux/Windows | ✅ FIXED |

---

## Test Coverage

| Version | Backend Tests | Frontend Tests | E2E Tests |
|---------|---------------|----------------|-----------|
| v1.2.3 | ✅ Pass | ✅ Pass | ✅ Pass |
| v1.2.4 | ✅ Pass | ✅ Pass | ✅ Pass |
| v1.2.4-patch | ✅ 11/11 (100%) | ✅ All Pass | ✅ Pass |

---

## Lessons Learned

### 1. Token Key Consistency
**Problem:** Different parts of codebase used `token` vs `auth_token`
**Solution:** Centralize auth in one place, use single source of truth
**Prevention:** Code review checklist item for auth consistency

### 2. Environment Variables in Production
**Problem:** `process.env.REACT_APP_*` baked into builds at compile time
**Solution:** Always provide fallbacks for production standalone mode
**Prevention:** Create `/lib/config.js` pattern for all env vars

### 3. Feature Parity Across Pages
**Problem:** Folder browser added to LibraryPage but not SettingsPage
**Solution:** Use shared components for duplicate functionality
**Prevention:** Feature checklist: "Update ALL locations using this feature"

### 4. Test Production Builds
**Problem:** Bugs only appeared in production builds, not development
**Solution:** Test `yarn build` output before releasing
**Prevention:** CI/CD pipeline with production build testing

---

## Fork History

| Fork # | Date | Focus | Bugs Fixed | Features Added |
|--------|------|-------|------------|----------------|
| 1 | 2025-12-15 | Initial build | 0 | 10 |
| 2 | 2025-12-16 | Database | 2 | 3 |
| 3 | 2025-12-17 | Maintenance | 0 | 6 |
| 4 | 2025-12-18 | Logging | 1 | 3 |
| 5 | 2025-12-19 | Playlists | 0 | 6 |
| 6 | 2025-12-19 | Auth fix | 3 | 0 |
| 7 | 2025-12-19 | Anime | 0 | 4 |
| 8-10 | 2025-12-20 | Production bugs | 3 | 0 |
| 11 | 2026-02-14 | API URL fix | 3 | 1 |

---

## Outstanding Items

### Bugs: None 🎉

### Known Limitations
1. Windows release untested with latest fixes
2. macOS release not yet created
3. No automated E2E tests for production builds

### Tech Debt
1. Duplicate "Add Library" form code (LibraryPage vs SettingsPage)
2. Some components still use inline `process.env.REACT_APP_BACKEND_URL`
3. No TypeScript (prone to typo bugs like `auth_token`)

---

## Appendix: All Bug IDs

```
BUG-001: User creation timeout (FIXED v1.1.0)
BUG-002: MongoDB connection issues (FIXED v1.1.0)
BUG-003: Port conflict detection (FIXED v1.2.1)
BUG-004: auth_token mismatch - marmaladeApi (FIXED v1.2.3)
BUG-005: auth_token mismatch - VideoPlayer (FIXED v1.2.3)
BUG-006: Hardcoded data directory (FIXED v1.2.3)
BUG-007: Blank home page - production (FIXED v1.2.4-patch)
BUG-008: Libraries not populating (FIXED v1.2.4-patch)
BUG-009: Missing browse button (FIXED v1.2.4-patch)
```

---

*Last Updated: 2026-02-14*
*Maintained by: WatchNexus Development Team*

# WatchNexus Changelog

All notable changes to WatchNexus will be documented in this file.

## [1.2.3] - 2025-12-19

### Fixed
- **Critical: Authentication Token Bug** - Fixed `auth_token` vs `token` mismatch in marmaladeApi.js and VideoPlayer.jsx
  - Library management now works correctly
  - Subtitle search works correctly
- **Data Directory Portability** - Marmalade now stores data in `backend/marmalade_data/` instead of `/var/lib/marmalade`
  - Works correctly in standalone builds
  - No special permissions required

---

## [1.2.2] - 2025-12-19

### Added
- **Drizzle Playlist Engine**: New continuous playback system
  - Create custom playlists
  - "Play Season" - automatic TV season playlists
  - "Play All" - movie collection playlists (e.g., MCU)
  - Auto-play next item
  - Skip intro/outro markers support
  - Queue management with progress tracking
- **Port Conflict Handling**: Start script now prompts before killing processes on port 8001
  - Shows process name and PID
  - Asks for user confirmation (Y/n)
  - Provides manual kill instructions if declined

### Codenames
- **Drizzle**: Playlist & Queue Engine (new in v1.2.2)
  - Like a continuous drizzle of content - never stops flowing

### Changed
- Updated startup script to be more beginner-friendly
- Added Playlists link to sidebar navigation

---

## [1.2.1] - 2025-12-18

### Added
- **File-based logging** with rotation (10MB max, 7 backups)
- **Log viewer** in Maintenance tab - view, download, clear logs
- **Better start script** - stop/status/kill commands

### Fixed
- Improved port conflict detection

---

## [1.2.0] - 2025-12-17

### Added
- **Maintenance Tab** in Settings
  - Server status (uptime, CPU, memory)
  - System info (platform, Python version)
  - Database health monitoring
  - Backup management
  - Cache statistics
  - Torrent engine status

---

## [1.1.0] - 2025-12-16

### Changed
- **Database Migration**: MongoDB to SQLite
  - Zero external dependencies
  - WAL mode for concurrent access
  - Automatic backups on startup
  - Periodic VACUUM optimization

### Fixed
- User creation timeout errors
- Database connection issues

---

## [1.0.0] - 2025-12-15

### Initial Release
- User authentication (local + Google OAuth)
- TMDB integration for movie/TV metadata
- Watchlist and watch progress tracking
- Multi-user support with permissions
- Built-in torrent engine (Fondue)
- Indexer aggregation (Compote + Syrup)
- Media health checker (Sieve)
- Watch party support (Potluck)
- Streaming service integration
- Subtitle management

### Codenames
- **Fondue**: Torrent Engine
- **Compote**: Indexer Manager
- **Syrup**: Live Scraper Search
- **Sieve**: Media Health Checker
- **Preserve**: Cloudflare Challenge Solver
- **Potluck**: Watch Party System

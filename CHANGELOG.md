# WatchNexus Changelog

All notable changes to WatchNexus will be documented in this file.

The format follows [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH**
- **MAJOR**: Breaking changes or major architecture shifts
- **MINOR**: New features, significant enhancements
- **PATCH**: Bug fixes, minor improvements, code changes

---

## [1.2.0] - 2026-02-14

### Added
- **Maintenance Tab** in Settings with comprehensive system monitoring
  - Server status: uptime, CPU usage, memory usage
  - System information: platform, architecture, Python version
  - Disk usage with visual progress bar
  - Database health monitoring with WAL mode indicator
  - Backup management: view, create, and manage rolling backups
  - Cache statistics and clear cache functionality
  - Torrent engine (Fondue) status monitoring
- New API endpoints:
  - `GET /api/system/info` - Basic app info
  - `GET /api/system/stats` - Detailed system statistics
  - `GET /api/db/backups` - List all database backups
  - `GET /api/cache/stats` - TMDB cache statistics
  - `POST /api/cache/clear` - Clear TMDB cache
  - `GET /api/torrent/status` - Torrent engine status
- Semantic versioning for all releases

### Changed
- Version number format now follows semver (MAJOR.MINOR.PATCH)

---

## [1.1.0] - 2026-02-14

### Added
- **SQLite database** - Zero external dependencies!
- **WAL mode** for concurrent read/write access
- **Automatic backups** on every server startup (keeps 7 rolling backups)
- **Scheduled VACUUM** every 24 hours for database optimization
- Database maintenance API endpoints:
  - `GET /api/db/stats` - Database statistics
  - `POST /api/db/vacuum` - Manual optimization
  - `POST /api/db/backup` - Manual backup creation

### Removed
- MongoDB dependency - no longer required!

### Changed
- Database from MongoDB to SQLite
- Start scripts updated to remove MongoDB checks
- README simplified for beginner-friendly setup

### Fixed
- User creation timeout error (was caused by missing MongoDB)

---

## [1.0.2] - 2026-02-14

### Added
- **LTorrent** integration for torrent downloads (pure Python)
- Magnet link support
- .torrent file support
- Sequential download for streaming

### Removed
- libtorrent dependency (had system-level requirements)
- torrentp, aiotorrent libraries

### Fixed
- Torrent library system dependency issues

---

## [1.0.1] - 2026-02-13

### Added
- Self-contained server with static file serving
- Frontend served by FastAPI backend
- Release package generator script

### Changed
- Frontend build process for standalone deployment
- API URL handling for relative paths

---

## [1.0.0] - Initial Release

### Added
- Core media browsing and discovery (TMDB integration)
- User authentication (local + Google OAuth)
- Watchlist management
- Watch progress tracking
- Multi-user support with permissions
- Library management with media scanning
- Indexer configuration (torrent sites)
- Built-in torrent engine (Fondue)
- Subtitle management (Addic7ed, OpenSubtitles)
- Streaming service integration
- IPTV support (Relish)
- Media health checker (Sieve)
- Jellyfin/Emby API compatibility layer
- Theme customization (Theme Forge)
- Plugin system architecture

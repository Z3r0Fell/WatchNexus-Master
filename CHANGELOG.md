# WatchNexus Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Google OAuth Integration** - One-click sign-in with Google via Emergent Auth
  - OAuth button on login page
  - Session management with httpOnly cookies
  - Automatic user creation for new OAuth users
  
- **Scheduled Health Scans** - Automatic media library validation
  - Create daily/weekly/monthly scan schedules
  - Configure scan time and notification preferences
  - Auto-repair option for fixable issues
  - Run scheduled scans immediately with "Run Now" button
  
- **Scan Notifications** - Alert system for media issues
  - Badge indicator showing unread notifications
  - Detailed issue breakdown per scan
  - Mark as read / delete functionality
  
- **Re-download Functionality** - Replace corrupted files
  - Queue re-downloads for files with issues
  - Integrates with indexer configuration
  - Shows in downloads queue with "searching" status
  
- **Marmalade Rebranding** - Renamed internal media server from "Jellyfin" to "Marmalade"
  - Updated API endpoints from `/api/jellyfin/*` to `/api/marmalade/*`
  - Renamed service files and variables
  - Updated documentation

### Changed
- Settings page now has 7 tabs including Media Health
- Auth context exposes setUser and setIsAuthenticated for OAuth flow
- Media Health tab shows scheduled scans section below scan results

### Fixed
- N/A

## [0.1.0] - February 2026

### Added
- Initial release of WatchNexus
- Custom React frontend with glassmorphism design
- FastAPI backend with MongoDB
- TMDB integration for movie/TV discovery
- JWT-based authentication
- Watchlist functionality
- Media Health Checker with FFprobe
- File repair with FFmpeg
- Marmalade (Jellyfin fork) server integration
- Basic settings pages
- Responsive sidebar navigation

### Architecture
- React 18 frontend
- FastAPI backend
- MongoDB database
- Marmalade media server (optional)
- Supervisor for process management

---

## Legend
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes

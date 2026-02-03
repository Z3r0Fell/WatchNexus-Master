# WatchNexus Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Compote Indexer Manager** - Python-based aggregator inspired by Prowlarr
  - Torznab/Newznab protocol support
  - Multi-indexer search with concurrent requests
  - Quality/codec parsing from release names
  - Grab functionality to queue downloads
  - Pre-configured public indexers (disabled by default)
  
- **Video Player Component** - Custom HTML5 player
  - Play/pause, seek, volume controls
  - Fullscreen toggle
  - Keyboard shortcuts (space, arrows, f, m)
  - Playback speed control (0.5x - 2x)
  - Subtitle track support
  - Progress bar with buffering indicator
  - Loading and error states
  
- **Library Page** - Local media browser
  - Grid and list view modes
  - Library folders display
  - Continue watching section
  - Recently added section
  - Search within library
  - Connection status handling for Marmalade

- **Google OAuth Integration** - One-click sign-in via Emergent Auth
  
- **Scheduled Health Scans** - Automatic media validation
  
- **Scan Notifications** - Alert system for issues
  
- **Re-download Functionality** - Replace corrupted files

### Changed
- Rebranded "Jellyfin" to "Marmalade" throughout codebase
- Added "Library" link to sidebar navigation
- Settings page has 7 tabs including Media Health

## [0.1.0] - February 2026

### Added
- Initial release of WatchNexus
- Custom React frontend with glassmorphism design
- FastAPI backend with MongoDB
- TMDB integration
- JWT-based authentication
- Watchlist functionality
- Media Health Checker
- Marmalade server integration

---

## Legend
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Fixed` - Bug fixes

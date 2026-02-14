# Changelog

All notable changes to WatchNexus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Theme Forge UI tab in Settings
- Plugin marketplace browser
- Live theme CSS injection
- Sample plugins for Gadgets

---

## [1.2.0] - 2025-02-11

### Added

#### New Modules
- **Gadgets** 🔧 (`gadgets.py`) - Complete plugin/extension system
  - Plugin base classes and interfaces
  - Provider types: Metadata, Indexer, Subtitle, Notification, Theme, ScheduledTask
  - JSON manifest system for plugin metadata
  - Dynamic plugin loading/unloading
  - Settings management per plugin
  - API route registration from plugins

- **Milk** 🥛 (`milk.py`) - Theme engine with Theme Forge
  - 6 built-in themes:
    - **TV** (Living Room) - Blue media center aesthetic
    - **Movie** (Cinema) - Gold/red theater experience
    - **Anime Pop** - Vibrant pink/cyan anime style
    - **Music** (Audio Waves) - Spotify-inspired green/purple
    - **Minimalist** - Clean light mode design
    - **Service** - Netflix/Disney+ professional look
  - Custom theme support with full color customization
  - CSS variable generation
  - Theme import/export
  - Background image support with blur

- **Juice** 🧃 (`JuiceColorPicker.jsx`) - Advanced color picker component
  - Color spectrum canvas picker
  - Hue/Saturation/Lightness sliders
  - RGB/HEX input modes
  - Preset color palettes
  - Color history tracking
  - Accessibility contrast checker (WCAG)
  - Alpha/opacity slider (optional)

#### Build & Installation Scripts
- `scripts/build-arch.sh` - Arch Linux build script
  - Automatic dependency detection and installation
  - AUR helper support (yay/paru)
  - Python venv setup
  - Frontend build with yarn
  - Test runner integration
  - Distribution package creator

- `scripts/install-linux.sh` - Universal Linux installer
  - Supports Ubuntu/Debian, Fedora/RHEL, Arch, openSUSE
  - Automatic distro detection
  - System user creation
  - Systemd service configuration
  - MongoDB setup
  - Configuration file generation

- `scripts/install-mac.sh` - macOS installer
  - Homebrew dependency management
  - LaunchAgent for auto-start
  - Application bundle creation
  - Uninstaller script

- `scripts/install-windows.ps1` - Windows installer
  - Chocolatey package manager integration
  - NSSM service creation
  - Start Menu shortcuts
  - Desktop shortcut
  - PowerShell-based uninstaller

#### Documentation
- `docs/WN-SPLIT-STRUCTURE.md` - Modular repository structure guide
  - Repository breakdown for each module
  - Contributing guidelines
  - Version synchronization strategy
  - Split script template

### Changed

#### Module Renaming (Food Theme 🍯)
- `watch_party.py` → `potluck.py` 🍲
  - Class: `WatchParty` → `Potluck`
  - Class: `WatchPartyManager` → `PotluckManager`
  - Function: `get_party_manager()` → `get_potluck_manager()`

- `subtitle_service.py` → `garnish.py` 🌿
  - Class: `SubtitleService` → `GarnishService`
  - Function: `get_subtitle_service()` → `get_garnish_service()`

- `torrent_engine.py` → `fondue.py` 🫕
  - Class: `TorrentEngine` → `FondueEngine`
  - Function: `get_torrent_engine()` → `get_fondue_engine()`
  - Function: `shutdown_torrent_engine()` → `shutdown_fondue_engine()`

- `media_health_checker.py` → `sieve.py` 🫗
  - Class: `MediaHealthChecker` → `SieveChecker`

#### Updated Imports
- All imports in `server.py` updated to use new module names
- Backward compatibility maintained through function aliases

### Fixed
- Watch party code generation (Python 3 bytes iteration fix)

---

## [1.1.0] - 2025-02-11

### Added

#### Core Features
- **Gelatin** 🍮 - External access module
  - LAN server discovery via UDP broadcast
  - Tunnel creation for internet access
  - Access token generation for secure sharing
  - Share link generation for watch parties
  - Server status API

- **Potluck** 🍲 - Watch party service
  - WebSocket-based real-time synchronization
  - 6-character party codes
  - Host controls (play/pause/seek)
  - Live chat with message history
  - Emoji reactions (👍❤️😂😮😢🔥🎉👏)
  - Member ready status
  - System messages for join/leave events

- **Streaming Service Logins**
  - Encrypted credential storage (Fernet)
  - 11 supported services:
    - Netflix, Disney+, Amazon Prime Video
    - Crunchyroll, YouTube Premium
    - HBO Max, Hulu, Peacock
    - Paramount+, Apple TV+, Funimation
  - Deep linking to service search
  - Secure credential retrieval API

- **Garnish** 🌿 - Subtitle service
  - Addic7ed scraper with session management
  - OpenSubtitles API support
  - TV show search (by season/episode)
  - Movie search (by title/year/IMDB)
  - Language preference settings
  - Auto-download option

#### UI Enhancements
- **Settings Page** - New tabs:
  - External Access (Gelatin)
  - Streaming Services (with encrypted storage)
  - Subtitles (Garnish configuration)
- **Watch Party Page** (`/party/:partyCode`)
  - Video player placeholder with controls
  - Member sidebar with ready status
  - Live chat panel
  - Floating emoji reactions
  - Share button with clipboard copy

#### API Endpoints
- `/api/gelatin/*` - External access management
- `/api/watch-party/*` - Watch party CRUD
- `/api/streaming-logins/*` - Streaming service credentials
- `/api/subtitles/*` - Subtitle search and download
- `/ws/party/{code}` - WebSocket for watch party sync

### Changed
- Updated sidebar logo to use `watchnexus-logo.svg`
- Added gradient text effect to sidebar title
- Expanded framer-motion animations

### Removed
- Deleted obsolete `/app/watchnexus` directory (Jellyfin fork)

---

## [1.0.0] - 2025-02-03

### Added

#### Initial Release
- **Marmalade** 🍊 - Python media server
  - Library scanning and organization
  - Multiple media types (movies, TV, music, audiobooks)
  - Watch progress tracking
  - Streaming with HTTP range support
  - Thumbnail generation

- **Compote** 🍇 - Indexer manager
  - Syrup (indexer aggregator)
  - Preserve (Cloudflare bypass)
  - Pulp (Usenet handler placeholder)

- **Syrup Scrapers**
  - 1337x scraper
  - YTS scraper
  - EZTV scraper

- **Fondue** 🫕 - Torrent engine
  - libtorrent integration
  - Magnet link support
  - .torrent file support
  - Sequential download for streaming
  - Bandwidth management
  - Seeding limits

- **Sieve** 🫗 - Media health checker
  - FFprobe validation
  - Corruption detection
  - Repair with FFmpeg
  - Scheduled scans

#### Authentication
- JWT-based authentication
- Google OAuth integration
- User registration/login

#### UI
- React frontend with Tailwind CSS
- Shadcn/UI components
- Framer Motion animations
- Responsive sidebar
- Dark theme

#### Infrastructure
- FastAPI backend
- MongoDB database
- Electron packaging support
- TMDB metadata integration

---

## Module Reference

| Version | Modules Added |
|---------|---------------|
| 1.0.0 | Marmalade, Compote, Syrup, Preserve, Pulp, Fondue, Sieve |
| 1.1.0 | Gelatin, Potluck, Garnish, Streaming Logins |
| 1.2.0 | Gadgets, Milk, Juice |

---

## Contributors

- WatchNexus Team

---

[Unreleased]: https://github.com/watchnexus/watchnexus/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/watchnexus/watchnexus/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/watchnexus/watchnexus/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/watchnexus/watchnexus/releases/tag/v1.0.0

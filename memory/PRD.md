# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Migrated from .NET 8 to .NET 10. All features must be fully functional with real-world APIs (no stubs). A "Crumbs" module provides centralized API management. The system should include native C# ports of Matrix/Jellyfin bot automation.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Image Processing:** SixLabors.ImageSharp 3.1.12
- **External APIs:** Open-Meteo, Radio Browser, iTunes Search, TMDB, OMDB, Matrix CS API, Jellyfin API, Synapse Admin API

## Core Requirements
- All features fully functional, no stubs
- Centralized API key management (Crumbs module)
- Native C# ports of Python maubot system (Matrix, Jellyfin, OMDB, Synapse Admin, GameBot, Background Services)
- Release builds for Windows x64 and Arch Linux x64
- QA link: https://z3r0fell.github.io/watchnexus-qa/

## User Personas
- Self-hosted media enthusiast managing movies, TV, podcasts, radio, IPTV
- Matrix homeserver admin managing rooms, users, registration tokens
- Jellyfin user wanting unified media dashboard

## Architecture
```
/app/src/watchnexus/core/Controllers/  (25+ controllers, refactored from monolith)
/app/src/watchnexus/core/Services/     (BotBackgroundService)
/app/src/watchnexus/core/Data/         (AppDbContext, EF Core models)
/app/src/web/src/                      (React frontend)
/app/release/                          (Built release packages)
/app/scripts/build-release.sh          (Release build script)
```

## What's Been Implemented
### P0 - Crumbs API Management (COMPLETED)
- Full CRUD backend for 12 services (TMDB, OpenSubtitles, Addic7ed, Subscene, Podnapisi, YIFY, qBittorrent, OpenWeatherMap, Matrix, Jellyfin, Synapse Admin, OMDB)
- Frontend CrumbsSettings.jsx with categorized service list, editor panel, test/save/delete
- Integrated into Settings page replacing old Integrations tab

### P1 - Controller Refactoring (COMPLETED)
- Split 1970-line ExtendedControllers.cs into 12+ individual files
- WeatherController, PodcastsController, RadioController, PhotosController, WebVideoController, IptvController, SubtitlesController, DrizzleController, SystemController, QBittorrentController, FeatureControllers, MediaControllers, UtilityControllers

### Matrix/Jellyfin Bot System (COMPLETED)
- **MatrixController** - Full Matrix CS API: rooms, messaging, sync, user search, invites
- **JellyfinController** - Library browsing, items, sessions, users, latest/resume, OMDB integration
- **SynapseAdminController** - Users, rooms, media, purge, registration tokens
- **GameBotController** - Poster blur/reveal/pixelate/grayscale via SixLabors.ImageSharp
- **BotBackgroundService** - Inactivity checks, token drip, featured film rotation (30-min cycle)
- **BotController** - Status endpoint, inactive rooms report, featured film data

### Release Builds (COMPLETED)
- Windows x64 self-contained package with .bat launcher and PowerShell service installer
- Arch Linux x64 package with systemd service, install.sh, and PKGBUILD for AUR

### Testing
- iteration_4.json: 24/24 backend + all frontend = 100%
- iteration_5.json: 31/31 backend + all frontend = 100%

## Backlog (Prioritized)
### P0 (Critical)
- None - all P0 items completed

### P1 (Important)
- [ ] EF Core Migrations (replace EnsureCreated with proper migration strategy)
- [ ] Full Module Separation & Dynamic Loading (ModuleLoader DLL compilation)

### P2 (Nice to Have)
- [ ] Re-implement "Marshmallow" (Cloud Sync)
- [ ] Re-implement "Fortress" (Code Protection)
- [ ] Subtitle integrations (OpenSubtitles download, Addic7ed, Subscene scrapers)
- [ ] Consolidate installer scripts
- [ ] Docker container support

## Testing Credentials
- Email: test@test.com
- Password: password
- TMDB API Key: 8c860bcb88494f598008480abfe24d13

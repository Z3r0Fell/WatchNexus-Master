# WatchNexus Changelog

## 2026-03-16 - v2.7.3 (Code Cleanup & Media Bridge)

### Jellyfin Removal & Media Bridge Recoding
- Complete removal of all "Jellyfin" references from source code and documentation
- **JellyfinController** recoded as **MediaBridgeController** (codename: **Custard**)
  - Route: `api/gadgets/media-bridge`
  - Full Emby-compatible proxy: config, libraries, items, search, images, sessions, users, OMDB
  - Added to: gadgets plugins, ripen installed, crumbs services, core info modules
- CrumbsController: added `media-bridge` service entry with test endpoint
- Updated all documentation files (COMPETITIVE_ANALYSIS, KICKSTARTER-*, PLUGIN-DEVELOPMENT-GUIDE, GADGETS-GUIDE)
- Alpha directory fully synced with same changes
- Fresh framework-dependent release packages created:
  - `watchnexus-2.7.3-linux-x64.tar.gz` (main)
  - `watchnexus-2.7.3-alpha-linux-x64.tar.gz` (alpha with pre-seeded admin accounts)

### Infrastructure (Dev Environment)
- Python FastAPI reverse proxy on port 8001 → C# server on port 8002
- .NET 10 SDK installed and builds verified
- Fixed BotBackgroundService.cs duplicate closing braces

### Testing
- iteration_9.json: 11/11 backend tests = 100%
- Global Jellyfin scan: 0 references found across 11 API endpoints
- Media Bridge (custard) confirmed in all registries

## 2026-03-15 - v2.7.3

### P0: EF Core Migrations
- Replaced `EnsureCreated()` with proper EF Core migration strategy
- Added `Microsoft.EntityFrameworkCore.Design` package
- Created initial migration (`20260315_InitialCreate`) in `Data/Migrations/`
- Startup now uses `Database.Migrate()` for versioned, incremental schema management

### P1: Dynamic Module Loading
- Enhanced `ModuleLoader` to compile and load separated modules from `/app/separated/`
- Automatic `dotnet build` of module `.csproj` files at startup
- Isolated `AssemblyLoadContext` per module to prevent type conflicts
- Module status API (`GetModuleStatus()`) for health/diagnostic endpoints
- All 10 separated modules now compile and load successfully

### P2: Fortress Code Protection
- Assembly integrity verification via SHA-256 hash baselines
- Runtime anti-tampering checks (periodic on every 100th API request)
- License/activation validation with machine-specific instance IDs
- Auto-lockout middleware blocks API access if tampering detected
- **Fortress Audit Log** — persistent event log (in-memory + JSONL on disk)
- Endpoints: `/api/fortress/status`, `/api/fortress/verify`, `/api/fortress/audit`, `/api/fortress/audit/export`
- Persistent config and baseline storage in `data/fortress/`

### P3: Version Bump
- Updated all module manifests and source files to v2.7.3
- Updated `Program.cs` startup banner to v2.7.3
- Updated CoreController, SystemController, CrumbsController, SubtitlesController User-Agent

### Codename Directory
- Assigned codenames to all 16 previously unnamed components
- Gadgets: Sorbet (Weather), Brioche (Podcasts), Nectar (Radio), Ganache (Photos), Bisque (Web Video), Marzipan (Matrix), Cinnamon (Synapse), Waffle (Movie Quiz), Yeast (Background Automation)
- Core: Sourdough (Auth), Taffy (IPTV), Churro (qBittorrent), Saffron (Subtitles), Pantry (Filesystem), Nutmeg (System Stats)
- All codenames exposed via `/api/ripen/installed` and `/api/info` endpoints
- Frontend gadget settings now display codename badges

### Release Builds
- Fresh Windows x64 and Linux x64 self-contained archives at `/app/release_builds/`
- Includes separated modules, frontend, installer scripts, systemd service, PKGBUILD

## 2026-03-15 - v2.6.5 (Fork Session)

### P0: Crumbs API Management Module
- Created CrumbsSettings.jsx frontend with categorized service list, editor panel, test/save/delete
- Fixed CrumbsController.cs build error (anonymous type mismatch in service registry)
- Replaced IntegrationsSettings with CrumbsSettings in SettingsPage.js
- Renamed "TMDB & Downloads" tab to "API Management"
- 11 services: TMDB, OpenSubtitles, Addic7ed, Subscene, Podnapisi, YIFY, qBittorrent, OpenWeatherMap, Matrix, Synapse Admin, OMDB

### P1: Controller Refactoring
- Split 1970-line ExtendedControllers.cs into 12+ individual files:
  - Helpers.cs, WeatherController.cs, PodcastsController.cs, RadioController.cs
  - PhotosController.cs, WebVideoController.cs, GadgetsCatalogueController.cs
  - IptvController.cs, SubtitlesController.cs, DrizzleController.cs
  - SystemController.cs, FeatureControllers.cs, MediaControllers.cs
  - QBittorrentController.cs, UtilityControllers.cs
- Removed ExtendedControllers.cs monolith

### Matrix Bot System (Python → C# Port)
- **MatrixController.cs** - Matrix Client-Server API: config, rooms, messaging, sync, members, user search
- **BotController.cs** - Bot management: featured film (via TMDB), inactivity checks
- **SynapseAdminController.cs** - Synapse Admin API: users, rooms, media, purge, registration tokens
- **GameBotController.cs** - Image processing via SixLabors.ImageSharp: blur, progressive reveal, pixelate, grayscale, resize, quiz generation
- **BotBackgroundService.cs** - IHostedService with 30-min loop: inactivity check, token drip, featured film rotation
- **BotController.cs** - Status/data endpoints for background service results

### Release Builds
- Created /app/scripts/build-release.sh for Windows x64 and Arch Linux x64
- Windows: self-contained .exe, start-watchnexus.bat, install-service.ps1
- Arch Linux: self-contained binary, systemd service, install.sh, PKGBUILD
- Both include QA link in READMEs

### Testing
- iteration_4.json: 24/24 backend + frontend = 100%
- iteration_5.json: 31/31 backend + frontend = 100%
- Added SixLabors.ImageSharp 3.1.12 NuGet package

### Infrastructure
- Installed .NET 10 SDK/runtime in forked environment
- Added BotBackgroundService registration in Program.cs
- Updated GadgetsCatalogue to 10 plugins
- Updated Ripen installed list to 10 gadgets
- README.md updated with QA link at top and bottom

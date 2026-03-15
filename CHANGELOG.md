# WatchNexus Changelog

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

### Release Builds
- Fresh Windows x64 and Linux x64 self-contained archives at `/app/release_builds/`
- Includes separated modules, frontend, installer scripts, systemd service, PKGBUILD

## 2026-03-15 - v2.6.5 (Fork Session)

### P0: Crumbs API Management Module
- Created CrumbsSettings.jsx frontend with categorized service list, editor panel, test/save/delete
- Fixed CrumbsController.cs build error (anonymous type mismatch in service registry)
- Replaced IntegrationsSettings with CrumbsSettings in SettingsPage.js
- Renamed "TMDB & Downloads" tab to "API Management"
- 12 services: TMDB, OpenSubtitles, Addic7ed, Subscene, Podnapisi, YIFY, qBittorrent, OpenWeatherMap, Matrix, Jellyfin, Synapse Admin, OMDB

### P1: Controller Refactoring
- Split 1970-line ExtendedControllers.cs into 12+ individual files:
  - Helpers.cs, WeatherController.cs, PodcastsController.cs, RadioController.cs
  - PhotosController.cs, WebVideoController.cs, GadgetsCatalogueController.cs
  - IptvController.cs, SubtitlesController.cs, DrizzleController.cs
  - SystemController.cs, FeatureControllers.cs, MediaControllers.cs
  - QBittorrentController.cs, UtilityControllers.cs
- Removed ExtendedControllers.cs monolith

### Matrix/Jellyfin Bot System (Python → C# Port)
- **MatrixController.cs** - Matrix Client-Server API: config, rooms, messaging, sync, members, user search
- **JellyfinController.cs** - Jellyfin API: config, library, items, images, sessions, users, OMDB lookup
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

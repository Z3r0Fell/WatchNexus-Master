# WatchNexus Changelog

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

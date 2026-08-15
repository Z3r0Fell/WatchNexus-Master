# WatchNexus Changelog

## 2026-08-15 — v1.0.2 (Security Audit, Modularity, WatchParty)

### Security
- **Fixed StrudelController command injection** — validated `OutputPath` with `MediaPaths.IsAllowedPath`, clamped `DriveIndex` 0-9, replaced string-interpolated `ProcessStartInfo` arguments with `ArgumentList` for `makemkvcon` and `HandBrakeCLI`.
- **Fixed VpnController.PeerQr private key leak** — removed `PrivateKey` from QR config response; only public config is returned.
- **Fixed SettingsController.TestQbit SSRF** — blocks loopback and validates host format before connecting to qBittorrent.
- **Clamped log read endpoints** — `SettingsController.GetLatest` and `UtilityControllers.Logs` now cap `lines` at 1000 to prevent memory pressure.
- **Added rate limiting to CellarController** — `/api/cellar/activate`, `/activate-first-launch`, and `/first-launch` now limited to 5 attempts per 5 minutes per IP.
- **Fixed rate-limit state memory leak** — empty IP entries are removed from `_activationAttempts` after their timestamps expire.
- **Fixed Fortress integrity coverage** — `SealBuild` now hashes all `.dll` and `.json` files in `AppContext.BaseDirectory`, not just 3 hardcoded files.
- **Added pagination to Fortress audit export** — `limit` (max 5000) and `offset` query params prevent unbounded response payloads.
- **Fixed NSIS ACL** — grants `NT AUTHORITY\NetworkService` (SID `S-1-5-20`) read access to `%PROGRAMDATA%\WatchNexus`.
- **Fixed Windows batch installer privilege escalation** — scheduled task now runs as `NT AUTHORITY\NetworkService` instead of the installing user.
- **Fixed Linux uninstall pkill patterns** — narrowed from broad `WatchNexus.Core` to exact `WatchNexus.Core.dll` to avoid killing unrelated processes.
- **Added integrity check to Linux installer** — `dotnet-install.sh` is validated before execution.
- **Fixed FPM after-install binary ownership** — binaries remain root-owned; only data directories are chowned to the service user.
- **Fixed Linux systemd service port** — respects `WATCHNEXUS_PORT` env var with fallback to `8001`.

### Bug Fixes
- **Fixed all hardcoded version strings** — replaced ~196 occurrences of `1.0.0` with `1.0.1` across C# controllers, docs, press kit, and build scripts.
- **Fixed MIT license claims** — corrected docs to reflect proprietary licensing (`LicenseRef-OWN`) instead of MIT.
- **Fixed GitHub URL inconsistency** — replaced `WN-Admin/WatchNexus` with `Z3r0Fell/WatchNexus-Master` in UPDATE-SYSTEM docs.
- **Fixed Docker Compose port mismatch** — standard tier now maps `8001:8001` instead of `8002:8002`.
- **Fixed WN_Releases data directory paths** — changed `/data` to `/app/data` to match Docker image VOLUME declaration.
- **Added `appsettings.json` to `.dockerignore`** — prevents secrets from being baked into Docker images.
- **Fixed NSIS uninstaller dead code** — removed deletion of non-existent `license.key`.
- **Fixed module manifests** — added `tier`, `api_route_prefix`, `api_routes`, and correct versions to all 9 module manifests.
- **Fixed frontend gadget page imports** — corrected `../../../lib/config` to `../../lib/config` and created symlink for gadget pages.
- **Fixed Curve25519 implementation** — switched from non-existent `System.Security.Cryptography.Curve25519` to BouncyCastle `X25519PrivateKeyParameters` for .NET 10 compatibility.
- **Fixed SecretProtector test alignment** — corrupt payloads now preserve original value (fail-open) instead of returning empty string.
- **Fixed Dockerfile base image tags** — changed `22-alpine3.20` to `node:22-alpine` and `.NET 10.0.4-noble` to `10.0`/`10.0-noble` for valid pullable images.
- **Fixed missing docs files** — created `docs/INSTALLBUILDER-STEPS.md` and `docs/installbuilder.md`.
- **Fixed press kit image references** — updated README to match existing image files.

### Implemented
- **Real module plugin architecture** — added `ModuleRegistry` for dynamic tier lookup from manifests, updated `ModuleLoader` with `BuiltInModule` wrapper, and made `FortressFilter` use registry for tier enforcement.
- **Module SDK and template** — created `src/watchnexus/module-sdk/` with working template, `module.json`, and README for third-party developers.
- **WatchParty WebSocket** — added `WatchPartyConnectionManager` and `/api/watch-party/{partyCode}/ws` endpoint with broadcast support.
- **WatchParty frontend page** — new `/watch-party` route with create/join flow and real-time WebSocket chat.
- **Roadmap page** — new `/roadmap` route and `GET /api/system/roadmap` endpoint displaying all 501 Not Implemented features with tier and status.
- **macOS Homebrew formula** — added `installers/macos/watchnexus.rb`.
- **Docker multi-arch support** — added `--multiarch` flag to `docker-build.sh` for `linux/amd64,linux/arm64` builds.
- **Privacy Policy and Terms of Service** — created `website/privacy.html` and `website/terms.html`, updated all footer links.
- **Added `SystemController.Roadmap`** — structured endpoint returning all planned 501 endpoints with metadata.
- **Replaced stub endpoints with 501** — `SecurityController` (sessions, revoke), `VpnController` (wg-up, wg-down, logs), and `WatchPartyController` (chat) now return honest `501 Not Implemented`.

### Versioning
- All version strings standardized to `1.0.1` across backend, frontend, docs, press kit, Docker tags, and installer filenames.


## 2026-02 — v3.0.0 → Release to Public **v1.0.1** (RTP)

> **Issued Release to Public version 1.0.1** — internal build `3.0.0` is the basis of the first general-availability release. From this point on, the public version line resets to `v1.0.1` (RTP) while the internal build sequence continues independently.

### Headline
- **First Release To Public (RTP) of WatchNexus.** Standard, Pro, and Ultra tiers are now generally available.
- Scaffolding/placeholder purge across backend and frontend — 697 of 706 route handlers are real implementations or honest catalogues/501s (see `docs/CONTROLLER-AUDIT.md`). The 5 remaining known stubs (Kodi addons, built-in torrent engine, subtitle-ext toggle, FFmpeg adapter endpoint, next-up) return honest empty/`not_implemented` responses rather than fake data.
- License key activation against `https://licenses.watchnexus.ca` is the single source of tier truth.
- Fortress Protocol integrity verification active on startup for every tier.

### What's new vs. 2.x dev line
- **Physical tier separation** — three independent installers per platform (Standard / Pro / Ultra) produced via `build-tiers.sh` + BitRock InstallBuilder 26.
- **Cross-platform installers** — Windows EXE, Fedora RPM, Debian DEB, Arch `pkg.tar.zst`, and Docker image, all tier-aware.
- **System tray icon** (Windows + Linux) with quick web-UI launch and graceful quit.
- **Searchable Help & Documentation page** at `/help` aggregating 40+ topics.
- **Tooltip-driven UX** for new-user guidance across all modules.
- **73 fully wired modules** end-to-end (Standard 31 / +Pro 18 / +Ultra 24).
- **Strudel** MakeMKV + HandBrake pipeline with hardware-transcoding profiles (NVENC, QSV, VAAPI, AMF, VideoToolbox).
- **Chowder** multi-server Jellyfin/Emby sync with queue + scheduling (Ultra).
- **Parfait** (Jellyseerr-based) + **Menu** (Seerr-style discovery) + **Pretzel** retro-console emulator (Ultra).
- **Biscotti / Treacle / Sage / Terrine / Popsicle / Preserves / Marshmallow** backlog modules all completed.
- **Fortress Protocol** sealed-build script: stripped PDBs/source-maps, SHA-256 manifest, runtime integrity check, license-server hash registry (`fortress-build.sh sign /app/release`).

### Operations
- `prepare-installers.sh` — new staging script for the Arch laptop build flow.
- `INSTALLBUILDER-STEPS.md` — explicit step-by-step InstallBuilder 26 guide.
- Production `README.md` + `LICENSE.txt` + `LICENSE.html` shipped with every installer.

### Version Bump
- All internal version strings moved from `2.9.0` → `v1.0.1` across backend controllers, frontend, build scripts, Docker artifacts, Unraid templates, InstallBuilder project, and press kit.

---

## 2026-03-22 - v2.8.2.2 (System Tray Icon)

### New Features
- **System Tray Icon** — WatchNexus now loads a system tray icon on launch for both Windows and Linux, providing quick access to the web UI and a graceful quit option
  - **Windows**: Native WinForms `NotifyIcon` on a dedicated STA thread with branded "W" icon, double-click to open browser, and right-click context menu (Open / Quit)
  - **Linux**: Embedded Python helper using GTK `AppIndicator3` (supports both `AyatanaAppIndicator3` and legacy `AppIndicator3`), with context menu and SIGTERM-based shutdown
  - Headless/server environments are detected and gracefully skipped (no display = no tray)
  - Icon resolves from the bundled `watchnexus-logo.png` in the web build, with a procedurally generated fallback on Windows

### Technical
- New `TrayIconService` registered as a `BackgroundService` in the ASP.NET Core host
- Conditional `UseWindowsForms` + `WINDOWS_BUILD` define in `.csproj` for Windows RID builds
- Linux tray helper script is generated at runtime and launched as a managed subprocess

### Version Bump
- All modules updated from 2.8.2.1 to 2.8.2.2

## 2026-03-22 - v2.8.2.1 (Searchable Help & Documentation Page)

### New Features
- **Help & Documentation Page** (`/help`) — A dedicated, searchable reference guide that aggregates all help content into one browsable page. Features full-text search across 40+ topics organized into 13 categories with expandable/collapsible sections and practical examples
- **Help sidebar link** — Quick-access Help link added to the sidebar navigation, visible from any page

### Version Bump
- All modules updated from 2.8.2 to 2.8.2.1

## 2026-03-22 - v2.8.2 (Help Tooltips & Sidebar UX Fix)

### New Features
- **Help Tooltips** — Added visible question-mark help icons next to every settings section heading and key individual settings. Clicking the icon opens a popover with a detailed description of the feature, what it does, and setup examples. Covers General, Playback, Downloads, Subtitles, Streaming, IPTV, Integrations, Gelatin, Theme Forge, Users, Maintenance, API Management, Indexers, Libraries, Media Health, Quality Profiles, and Gadgets settings
- **Reusable HelpTooltip component** — New `HelpTooltip` and `SectionHelp` components at `/components/ui/HelpTooltip.jsx` for easy addition of help content throughout the app

### Bug Fixes
- **Sidebar scroll persistence** — Fixed the sidebar jumping back to the top every time a menu item is clicked. The scroll position is now preserved across navigation using a ref-based approach

### Improvements
- **SettingsTabHeader** now accepts an optional `help` prop, making it easy to add help content to any tabbed settings page
- All module versions bumped to 2.8.2

## 2026-03-22 - v2.8.1 (Bug Fixes & New Frontend Pages)

### Bug Fixes
- **Dropdown CSS** — Fixed unreadable select dropdowns (white text on white background) with global CSS rule ensuring dark backgrounds and light text on all platforms
- **Settings Not Saving** — Backend `PUT /api/settings/{key}` now accepts both `{"value":"..."}` wrapper and raw JSON objects. Added bulk `PUT /api/settings` endpoint
- **User Preferences** — Fixed frontend sending preferences as query params instead of JSON body
- **Media Playback Pipeline** — Added 10 missing Marmalade endpoints: `/status`, `/media/{id}`, `/media/search`, `/continue-watching`, `/tv-series`, `/libraries/{id}/refresh-metadata`, `/media/{id}/progress`, `/media/{id}/watched`, `/stream/{id}`, `/stream/{id}/file`
- **Meringue Requests** — `tmdb_id` no longer required; users can now submit requests by title only
- **Pepper Notifications** — Added missing `POST /api/pepper/channels` endpoint for channel creation
- **Version Mismatch** — Fixed SystemController still reporting v2.7.3

### New Frontend Pages
- **Analytics** (`/analytics`) — View watch stats, top genres, recent activity with configurable time periods
- **Notifications** (`/notifications`) — Manage notification channels (webhook, email, discord, pushover), view history
- **Requests** (`/requests`) — Submit and track media requests with status workflow
- **Parental Controls** (`/parental-controls`) — Configure PIN, max rating, blocked genres
- **Processing** (`/processing`) — Submit and monitor transcode jobs
- **Usenet** (`/usenet`) — Configure Brine indexer (Prowlarr) and Ladle downloader (SABnzbd), search Usenet

### Version Bump
- All modules updated from 2.8.0 → 2.8.1
- User-Agent strings updated to v2.8.1
- Sidebar navigation updated with 6 new gadget items

### Testing
- iteration_11.json: 16/16 backend + all frontend = 100%
- All 45 API endpoints verified via curl

## 2026-03-19 - v2.8.0 (Five New Native Features)

### New Features
- **Truffle** (Watch Analytics & Year Wrapped) — Play event tracking, viewing stats (by type, hour, day), top titles, Year Wrapped endpoint with streaks & monthly trends, admin overview
- **Pepper** (Notification Hub) — Multi-channel alerts: Discord webhooks, Telegram bots, Slack webhooks, Pushover. 7 event types. Channel management, test, and history log
- **Meringue** (User Request System) — Users request movies/TV via TMDB ID. Admin approve/reject/fulfill workflow. Duplicate detection. Request statistics
- **Rind** (Parental Controls) — Content rating filters (G→NC-17), genre restrictions, PIN lock with BCrypt hashing, per-user profiles, library access controls, content access check API
- **Crucible** (Media Processing Pipeline) — 7 transcode profiles (H.265, H.264, subtitle extraction/burning, audio normalize), job queue, FFprobe file analysis, FFmpeg status detection, space savings tracking

### Version Bump
- All modules updated from 2.7.3 → 2.8.0
- Alpha updated from 2.7.3-alpha → 2.8.0-alpha

### Usenet Support (Alpha User Feedback)
- **Brine** (Usenet Indexer) — Prowlarr and Newznab-compatible proxy: NZB search (general, movie, TV), indexer management, category browsing, grab/download NZBs
- **Ladle** (Usenet Downloader) — SABnzbd proxy: queue management (add/pause/resume/delete), download history, server stats, speed limit control, category management, priority setting
- Both registered in Crumbs service registry with full configuration fields
- 31 total modules

### Architecture
- 4 new EF Core entities: PlayEvent, NotificationLog, MediaRequest, TranscodeJob
- EF Core migration: AddNewFeatureEntities
- 29 total modules registered
- 3 notification services added to Crumbs: discord-webhook, telegram-bot, pushover

### Codename Assignments (All 15 Future Features)
| Feature | Codename |
|---------|----------|
| Watch Analytics | Truffle |
| Notification Hub | Pepper |
| User Requests | Meringue |
| Trakt/Last.fm Scrobbling | Glaze |
| Collections & Smart Playlists | Roux |
| Scheduled Tasks | Simmer |
| Parental Controls | Rind |
| RSS Feeds | Sprout |
| Ebook/Audiobook/Comics | Biscotti |
| Music Library | Treacle |
| AI Metadata | Sage |
| Media Processing | Crucible |
| Live TV DVR | Terrine |
| Offline Sync | Popsicle |
| S3/Cloud Backup | Preserves |

### Testing
- iteration_10.json: 34/34 backend tests = 100%
- All 5 feature CRUD flows tested end-to-end

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

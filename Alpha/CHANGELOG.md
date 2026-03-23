# WatchNexus Changelog

## 2026-03-23 - v2.8.3 (Full Module Audit + Poster Fix)

### Critical Bug Fixes
- **136 Endpoints Verified** — Most comprehensive audit in WatchNexus history. Every single API endpoint returns 200 OK
- **32 Codename Status Endpoints** — EVERY registered module now resolves to a `/api/{codename}/status` endpoint
- **33 Modules Active** — System info reports all 33 modules loaded and active
- **28 Plugins in Catalogue** — All plugins listed with proper codenames, descriptions, and categories
- **TMDB Proxy Fix** — Trending, Search, Discover now work (was only checking DB for key, not env/config)
- **Poster Generation** — Both scan paths fetch TMDB metadata. Fixed title parsing for TV shows
- **Dashboard Fix** — Recently Added shows poster art, Continue Watching shows proper progress

### New Controllers (9 Core Modules)
- **Bastion** — Advanced Auth: LDAP, SSO, 2FA, session management
- **Tunnel** — Network Config: reverse proxy, UPnP, SSL certificates, dynamic DNS
- **Fondue** — Movie Automation: auto-grab, monitor, upgrade (Radarr equivalent)
- **Sourdough** — Backup & Restore: full backups, scheduled snapshots, config export/import
- **Taffy** — Metadata Agents: TMDB, TVDB, IMDb, MusicBrainz provider management
- **Churro** — Download Clients: qBittorrent, SABnzbd, Transmission management
- **Saffron** — Scheduled Tasks: library scans, metadata refresh, cleanup jobs
- **Pantry** — Storage Manager: disk monitoring, file cleanup, path mappings
- **Nutmeg** — Smart Recommendations: AI-powered picks from TMDB based on watch history

### New Features
- **Glaze** — Trakt.tv and Last.fm scrobbling, watch history sync
- **Setup Wizard** — Jellyfin-style first-run configuration wizard
- **Playlists API** — Backend for playlist creation and management
- **Marzipan** — Playlists & Collections management endpoint

### Codename Alias Routes (10 Gadgets)
All gadgets now resolve via codename: sorbet, brioche, nectar, ganache, bisque, marzipan, cinnamon, waffle, custard, yeast

### Improvements
- **System Info** now includes full module list with 33 active modules
- **Gadgets Catalogue** expanded to 28 plugins across all categories
- Added `/status` endpoints to: crumbs, truffle, pepper, meringue, rind, crucible, brine, ripen

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
- All modules updated from 2.8.2.1 to 2.8.3

## 2026-03-22 - v2.8.2.1 (Searchable Help & Documentation Page)

### New Features
- **Help & Documentation Page** (`/help`) — A dedicated, searchable reference guide that aggregates all help content into one browsable page. Features full-text search across 40+ topics organized into 13 categories with expandable/collapsible sections and practical examples
- **Help sidebar link** — Quick-access Help link added to the sidebar navigation, visible from any page

### Version Bump
- All modules updated from 2.8.2 to 2.8.2.1

## 2026-03-22 - v2.8.2 (Help Tooltips & Sidebar UX Fix)

### New Features
- **Help Tooltips** — Added visible question-mark help icons next to every settings section heading and key individual settings. Clicking the icon opens a popover with a detailed description of the feature, what it does, and setup examples. Covers General, Playback, Downloads, Subtitles, Streaming, IPTV, Integrations, Gelatin, Theme Forge, Users, Maintenance, API Management, Indexers, Libraries, Media Health, Quality Profiles, and Gadgets settings
- **Reusable HelpTooltip component** — New `HelpTooltip` and `SectionHelp` components for easy addition of help content throughout the app

### Bug Fixes
- **Sidebar scroll persistence** — Fixed the sidebar jumping back to the top every time a menu item is clicked. The scroll position is now preserved across navigation

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
- All modules updated from 2.8.0 to 2.8.1

## 2026-03-19 - v2.8.0 (Five New Native Features)

### New Features
- **Truffle** (Watch Analytics & Year Wrapped) — Play event tracking, viewing stats, top titles, Year Wrapped endpoint
- **Pepper** (Notification Hub) — Multi-channel alerts: Discord, Telegram, Slack, Pushover, email, webhooks
- **Meringue** (User Request System) — Media request + admin approval workflow via TMDB
- **Rind** (Parental Controls) — Content rating filters, genre restrictions, PIN lock, per-user profiles
- **Crucible** (Media Processing Pipeline) — FFmpeg-based transcode jobs with 7 profiles
- **Brine** (Usenet Indexer) — Prowlarr-compatible Usenet search proxy
- **Ladle** (Usenet Downloader) — SABnzbd-compatible download proxy

## 2026-03-15 - v2.7.3-alpha

### P0: EF Core Migrations
- Replaced `EnsureCreated()` with proper EF Core migration strategy

### P1: Dynamic Module Loading
- Enhanced `ModuleLoader` to compile and load separated modules

### P2: Fortress Code Protection
- Assembly integrity verification, runtime anti-tampering, license validation, audit log

### P3: Version Bump
- Updated all module manifests and source files to v2.7.3-alpha

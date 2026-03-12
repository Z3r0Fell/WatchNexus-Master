# WatchNexus - Product Requirements Document

## Original Problem Statement
WatchNexus is a unified, self-hosted media pipeline. C#/.NET 10 backend with React frontend.

## Architecture
- **Backend:** C#/.NET 10 (ASP.NET Core) at `/app/src/watchnexus/core/`
- **Frontend:** React at `/app/frontend` -> `/app/src/web`
- **Database:** SQLite via Entity Framework Core
- **Auth:** JWT Bearer Tokens
- **Supervisor:** `watchnexus-server` program

## Implemented Features (All REAL - No Stubs)

### Core
- Auth (register, login, JWT), User profiles
- Dashboard with REAL TMDB content (key: stored in settings)
- Media libraries CRUD, scanning, metadata
- Cross-platform folder browsing (Linux/macOS/Windows)
- Settings (general, integrations, 22 toggleable sidebar tabs in 3 groups)

### Gadgets (ALL REAL APIs)
- **Weather** - Open-Meteo (geocoding + forecast, no key needed)
- **Podcasts** - iTunes Search API + RSS feed parsing (SyndicationFeed)
- **Radio** - Radio Browser API (stations, countries, tags, favorites DB-backed)
- **Photos** - Filesystem-based photo library (scan, browse, serve images)
- **Web Video** - Bookmarks + History (DB-backed), YouTube thumbnail extraction

### Media Features
- **IPTV** - Full M3U/M3U8 parser, channel management, group browsing, export
- **Subtitles** - OpenSubtitles API, Podnapisi, Addic7ed, Subscene, YifySubtitles (configurable)
- **Playlists** - Full CRUD with items, DB-backed (Drizzle module)
- **Downloads** - Built-in download manager
- **qBittorrent** - Real WebUI client (auth, torrents, add, pause, resume, delete, files)
- **Indexers** - Compote module with DB-backed indexer management

### Admin/System
- **Security** - Audit logs, IP rules, API keys (all DB-backed)
- **VPN Portal** - WireGuard config, peer management, QR codes
- **System** - Real process metrics (memory, CPU, uptime, threads)
- **Logs** - Real log file viewer
- **Cache/DB** - Real stats, backup creation
- **Themes** - 6 built-in themes + custom CSS (DB-backed)

### Sidebar
- Admin items (Security, VPN Portal, Lib Manager, Browse Media, Log Viewer, System, Marketplace) under collapsible Settings submenu
- 22 toggleable tabs in 3 groups (Media: 10, Gadgets: 5, Admin: 7)

## Testing
- Iteration 3: 100% pass (22/22 backend, all frontend verified)
- Real API verification: Weather, Radio, Podcasts, TMDB, Filesystem, System, Playlists, Subtitles

## Test Credentials
- Email: test@test.com / Password: password
- TMDB Key: 8c860bcb88494f598008480abfe24d13

## Infrastructure-Dependent Features
- VPN WireGuard activate/deactivate: Requires wg tools + root on real server
- qBittorrent: Requires user to configure connection to their qBit WebUI

## Backlog
### P1
- [ ] Full module separation & dynamic DLL loading
- [ ] EF Core migrations (replace Database.EnsureCreated)
### P2
- [ ] Re-implement Cloud Sync (Marshmallow)
- [ ] Re-implement Code Protection (Fortress)
- [ ] Consolidate installer scripts

# WatchNexus v1.0.0 — Project Cellar Module Audit

> Compiled for tier assignment (Standard / Pro / Ultra).
> Each module classified as **FUNCTIONAL** (real logic, DB, external APIs) or **STUB** (placeholder/scaffold).

---

## Summary

| Status | Count |
|--------|-------|
| Fully Functional Modules | 50+ |
| Stub/Placeholder Modules | 2 |
| Codename Alias Redirects | 9 |
| **Total Controllers** | **42 files, ~11,000 lines** |

---

## A. CORE PLATFORM (Always Required)

These modules form the base server and cannot be tiered — they are essential for WatchNexus to function.

| # | Codename | Name | File | Lines | Status | Description |
|---|----------|------|------|-------|--------|-------------|
| 1 | **core** | Health & Info | `CoreController.cs` | 105 | FUNCTIONAL | `/api/health`, `/api/info` — version, runtime, module listing |
| 2 | **auth** | Authentication | `CoreController.cs` | 56 | FUNCTIONAL | JWT register, login, logout, `/api/auth/me` |
| 3 | **users** | User Profiles | `CoreController.cs` | 22 | FUNCTIONAL | `/api/users/me`, `/api/users/profiles` |
| 4 | **settings** | Settings Manager | `SettingsController.cs` | 145 | FUNCTIONAL | Key-value settings CRUD, TMDB/qBit integration endpoints |
| 5 | **setup** | Setup Wizard | `CodeNameAliasControllers.cs` | 80 | FUNCTIONAL | 7-step first-run wizard with DB state tracking |
| 6 | **dashboard** | Dashboard Stats | `BridgeController.cs` | 22 | FUNCTIONAL | Library counts, recent media, total sizes |
| 7 | **preferences** | User Preferences | `BridgeController.cs` | 25 | FUNCTIONAL | Per-user preference storage |
| 8 | **logs** | Log Viewer | `SettingsController.cs` | 40 | FUNCTIONAL | Real filesystem log reading, system health |
| 9 | **system** | System Info | `SystemController.cs` | 177 | FUNCTIONAL | CPU, memory, disk, network, process stats |

---

## B. MEDIA MANAGEMENT (Library Core)

The heart of WatchNexus — library scanning, streaming, metadata.

| # | Codename | Name | File | Lines | Status | Description |
|---|----------|------|------|-------|--------|-------------|
| 10 | **marmalade** | Media Library Engine | `BridgeController.cs` | 543 | FUNCTIONAL | Full library CRUD, filesystem scanning with TMDB metadata fetch, video streaming with range support, TV series grouping, continue-watching, mark watched |
| 11 | **libraries** | Library Manager | `LibrariesController.cs` | 406 | FUNCTIONAL | Library CRUD, media item management, background scanning |
| 12 | **compote** | Indexer Search Engine | `MediaControllers.cs` | 600 | FUNCTIONAL | Real search across Nyaa.si (RSS), YTS (JSON), EZTV (JSON), Torznab/Newznab, Generic RSS. Quality/codec detection, magnet extraction, grab-to-queue |
| 13 | **tmdb** | TMDB Proxy | `ContentController.cs` | 125 | FUNCTIONAL | Full TMDB API proxy — search, trending, popular, details, discover, genres, seasons |
| 14 | **media-ops** | Media Operations | `MediaControllers.cs` | 52 | FUNCTIONAL | File health check, scan-library, scheduled scans, notifications |
| 15 | **downloads** | Download Manager | `SettingsController.cs` | 115 | FUNCTIONAL | Download queue CRUD, built-in torrent engine (add magnet, pause, resume, settings) |
| 16 | **filesystem** | File Browser | `FilesystemController.cs` | 206 | FUNCTIONAL | Directory browsing, file info, path validation |
| 17 | **indexers** | Indexer Store | `MediaControllers.cs` | 75 | FUNCTIONAL | Indexer CRUD (delegates to Compote indexer store) |
| 18 | **quality-profiles** | Quality Profiles | `MediaControllers.cs` | 20 | FUNCTIONAL | SD/HD/FHD/UHD profile definitions |
| 19 | **watchlist** | Watchlist | `ContentController.cs` | 48 | FUNCTIONAL | Per-user TMDB watchlist with add/remove |
| 20 | **watch-progress** | Continue Watching | `ContentController.cs` | 70 | FUNCTIONAL | Per-user progress tracking, clear all |
| 21 | **playlists** | Playlists | `CodeNameAliasControllers.cs` | 42 | FUNCTIONAL | Playlist CRUD with items |

---

## C. NAMED MODULES (Tierable)

### C1. Security & Network

| # | Codename | Name | File | Lines | Status | Key Capabilities |
|---|----------|------|------|-------|--------|-----------------|
| 22 | **bastion** | Advanced Auth | `CoreModuleControllers.cs` | 208 | FUNCTIONAL | LDAP test, TOTP 2FA (real crypto — Base32 secret, QR URI, backup codes), session management (real user-agent/IP parsing), password strength validation, audit log |
| 23 | **tunnel** | Network Config | `CoreModuleControllers.cs` | 207 | FUNCTIONAL | Real network interface enumeration, external IP detection via ipify.org, WireGuard peer management (crypto key generation), SSL cert tracking, bandwidth history, Dynamic DNS |
| 24 | **security** | Security Center | `SecurityController.cs` | 131 | FUNCTIONAL | IP block/allow rules (DB), audit logging (DB), API key generation (SHA256 hashed, `wnx_` prefix), session management |
| 25 | **vpn** | VPN Manager | `VpnController.cs` | 164 | FUNCTIONAL | VPN server config, peer management with DB persistence |
| 26 | **rind** | Parental Controls | `RindController.cs` | 181 | FUNCTIONAL | Content rating filters (G→NC-17 hierarchy), PIN lock (bcrypt hashed), per-user genre/library restrictions, admin multi-user profile management |

### C2. Automation & Scheduling

| # | Codename | Name | File | Lines | Status | Key Capabilities |
|---|----------|------|------|-------|--------|-----------------|
| 27 | **fondue** | Movie Automation | `CoreModuleControllers.cs` | 106 | FUNCTIONAL | Radarr-like — TMDB movie add/remove with DB persistence, monitoring, queue, calendar, history, custom quality formats (Remux/BluRay/WEB-DL), config |
| 28 | **saffron** | Scheduled Tasks | `CoreModuleControllers.cs` | 53 | FUNCTIONAL | 8 built-in task types (library scan, metadata refresh, cache cleanup, log cleanup, DB optimize, chapter extraction, subtitle download, backup), run/stop/trigger |
| 29 | **sourdough** | Backup & Restore | `CoreModuleControllers.cs` | 68 | FUNCTIONAL | Real filesystem backup listing, create/restore, config export/import (DB), scheduled backup with retention policy |
| 30 | **churro** | Download Clients | `CoreModuleControllers.cs` | 57 | FUNCTIONAL | Multi-client management (qBittorrent, SABnzbd, Transmission, Deluge), add/update/delete/test, category management |

### C3. Content Discovery & Social

| # | Codename | Name | File | Lines | Status | Key Capabilities |
|---|----------|------|------|-------|--------|-----------------|
| 31 | **nutmeg** | Recommendations | `CoreModuleControllers.cs` | 94 | FUNCTIONAL | TMDB trending API integration, similar titles lookup, configurable refresh |
| 32 | **truffle** | Watch Analytics | `TruffleController.cs` | 185 | FUNCTIONAL | Real play event recording (DB), stats by media type/hour/day, top titles, Year Wrapped with monthly trends/longest streak, admin overview |
| 33 | **glaze** | Scrobbling | `CodeNameAliasControllers.cs` | 98 | FUNCTIONAL | Trakt.tv OAuth flow, Last.fm auth flow, config management, sync history |
| 34 | **meringue** | User Requests | `MeringueController.cs` | 148 | FUNCTIONAL | Full request lifecycle — submit (with dupe detection), my-requests, admin approve/reject/fulfill, delete, stats |
| 35 | **roux** | Collections | `RouxController.cs` | 162 | FUNCTIONAL | Smart collections (auto-filtered from DB), manual collections, presets (top-rated, new, unwatched, 4K, short), filter engine with min/max year/rating |
| 36 | **sprout** | RSS Feeds | `SproutController.cs` | 270 | FUNCTIONAL | Real RSS 2.0 XML generation from DB media, API key auth, custom feed creation, per-type feeds (movies/TV/recent) |
| 37 | **drizzle** | Playlists Engine | `DrizzleController.cs` | 140 | FUNCTIONAL | Full playlist CRUD with ordered items, DB persistence, play-collection, play-season |
| 38 | **marzipan** | Playlists & Matrix | `CodeNameAliasControllers.cs` | 56 | FUNCTIONAL | Playlist/collection CRUD via DB |

### C4. Media Processing

| # | Codename | Name | File | Lines | Status | Key Capabilities |
|---|----------|------|------|-------|--------|-----------------|
| 39 | **crucible** | Media Processing | `CrucibleController.cs` | 243 | FUNCTIONAL | 7 transcode profiles (H.265/H.264/extract subs/burn subs/audio normalize), job submit/queue/cancel/retry, real FFprobe integration (binary detection + JSON output), stats with space savings, FFmpeg version detection |
| 40 | **strudel** | Optical Disc Ripping | `StrudelController.cs` | 857 | FUNCTIONAL | Full MakeMKV robot mode parser, HandBrake transcode pipeline, drive detection via lsscsi, async rip/transcode with progress, 7 profiles (Direct/HEVC/H.264/720p/4K/NVENC/QSV), history, eject |
| 41 | **subtitles** | Subtitle Manager | `SubtitlesController.cs` | 230 | FUNCTIONAL | Multi-provider subtitle search (OpenSubtitles API, Addic7ed, Subscene, Podnapisi, YIFY), download, settings per provider |

### C5. Notifications & Integration

| # | Codename | Name | File | Lines | Status | Key Capabilities |
|---|----------|------|------|-------|--------|-----------------|
| 42 | **pepper** | Notification Hub | `PepperController.cs` | 246 | FUNCTIONAL | Real HTTP dispatch to Discord webhooks, Telegram bot API, Slack webhooks, Pushover API. Channel CRUD, event preferences, test, send, history logging (DB) |
| 43 | **crumbs** | API & Integration Hub | `CrumbsController.cs` | 675 | FUNCTIONAL | 15+ service registry (TMDB, OpenSubtitles, qBittorrent, Matrix, Synapse, OMDB, Discord, Telegram, Pushover, Prowlarr, SABnzbd), per-user config with masked display, real connection testing for each, usage tracking, key rotation, legacy sync |
| 44 | **taffy** | Metadata Agents | `CoreModuleControllers.cs` | 84 | FUNCTIONAL | Provider management (TMDB, TVDB, IMDb, MusicBrainz, Fanart.tv, OpenSubtitles, AudioDB), priority ordering, language config |

### C6. Gadgets (Installable Features)

| # | Codename | Name | File | Lines | Status | Key Capabilities |
|---|----------|------|------|-------|--------|-----------------|
| 45 | **ripen** | Gadget Manager | `FeatureControllers.cs` | 138 | FUNCTIONAL | 27 gadget registry, install/uninstall/activate/deactivate with DB persistence, hooks system |
| 46 | **milk** | Theme Engine | `FeatureControllers.cs` | 76 | FUNCTIONAL | 6 built-in themes (Default Dark, Ocean, Forest, Sunset, Midnight, Rose), custom CSS, custom color variables |
| 47 | **sorbet** | Weather Dashboard | `WeatherController.cs` | 95 | FUNCTIONAL | Open-Meteo API integration for location search and weather data |
| 48 | **brioche** | Podcasts | `PodcastsController.cs` | 121 | FUNCTIONAL | iTunes Search API integration, podcast RSS feed parsing, subscription management |
| 49 | **nectar** | Internet Radio | `RadioController.cs` | 94 | FUNCTIONAL | Radio Browser API integration for station search/discovery |
| 50 | **ganache** | Photo Gallery | `PhotosController.cs` | 115 | FUNCTIONAL | Photo library management, thumbnail generation, browsing |
| 51 | **bisque** | Web Video | `WebVideoController.cs` | 118 | FUNCTIONAL | Video bookmarks (DB), watch history, YouTube info integration |
| 52 | **marzipan-chat** | Matrix Chat | `MatrixController.cs` | 293 | FUNCTIONAL | Full Matrix Client-Server API proxy — rooms (list/create/join/leave/invite), messaging (send/read), member management, event sync, user search |
| 53 | **cinnamon** | Synapse Admin | `SynapseAdminController.cs` | 270 | FUNCTIONAL | Synapse homeserver admin — server version, user management (list/create/deactivate), room management (list/delete), media admin, registration tokens |
| 54 | **waffle** | Movie Quiz | `GameBotController.cs` | 259 | FUNCTIONAL | Real image processing via ImageSharp — Gaussian blur, pixelation, grayscale, progressive reveal, TMDB-powered quiz generation with wrong answers |
| 55 | **custard** | Media Bridge | `MediaBridgeController.cs` | 254 | FUNCTIONAL | Full Emby-compatible server proxy — library browse, item details, images, sessions, users, latest/resume, OMDB lookup |
| 56 | **yeast** | Background Automation | `BotController.cs` | 63 | FUNCTIONAL | Room inactivity monitoring, token drip, featured film rotation |
| 57 | **brine** | Usenet Indexer | `BrineController.cs` | 255 | FUNCTIONAL | Prowlarr/Newznab proxy — search (general/movie/TV), indexer management, grab NZB, categories |
| 58 | **ladle** | Usenet Downloader | `LadleController.cs` | 246 | FUNCTIONAL | SABnzbd proxy — queue management, add NZB, pause/resume, history, categories, speed limit, priority |

### C7. Streaming & Live Content

| # | Codename | Name | File | Lines | Status | Key Capabilities |
|---|----------|------|------|-------|--------|-----------------|
| 59 | **gelatin** | External Access | `FeatureControllers.cs` | 26 | FUNCTIONAL | LAN URL, tunnel creation, access tokens, share links |
| 60 | **streaming-logins** | Streaming Logins | `FeatureControllers.cs` | 62 | FUNCTIONAL | Credential storage for Netflix/Disney+/HBO/Amazon/etc (encrypted via DB) |
| 61 | **streaming-services** | Service Toggle | `FeatureControllers.cs` | 12 | FUNCTIONAL | Enable/disable streaming service entries |
| 62 | **watch-party** | Watch Party | `FeatureControllers.cs` | 22 | FUNCTIONAL | Party creation with media link, room codes |
| 63 | **iptv** | Live TV / IPTV | `IptvController.cs` | 211 | FUNCTIONAL | M3U/XMLTV source management, EPG parsing, channel listing, DVR |
| 64 | **qbittorrent** | qBittorrent Client | `QBittorrentController.cs` | 166 | FUNCTIONAL | Direct qBittorrent WebUI proxy — status, torrents, add/remove, speed limits |
| 65 | **pantry** | Storage Manager | `CoreModuleControllers.cs` | 68 | FUNCTIONAL | Real DriveInfo disk monitoring, root folders from DB, orphan detection, cleanup, path mappings |

---

## D. STUBS (Placeholder / No Real Logic)

| # | Codename | Name | File | Lines | Status | Notes |
|---|----------|------|------|-------|--------|-------|
| S1 | **kodi** | Kodi Addons | `UtilityControllers.cs` | 8 | STUB | Returns empty arrays for addons, categories, popular. No real logic. |
| S2 | **adapter** | FFmpeg Adapter | `UtilityControllers.cs` | 4 | STUB | Returns `"not_implemented"`. Single endpoint. |
| S3 | **garnish** | Subtitle Ext. | `MediaControllers.cs` | 5 | STUB | Returns `enabled: false` and empty providers. |
| S4 | **torrent** | Torrent Status | `MediaControllers.cs` | 3 | STUB | Returns static `"connected": true, "active_downloads": 0`. |
| S5 | **next-up** | Next Episode | `ContentController.cs` | 4 | STUB | Returns empty array. |

---

## E. CODENAME ALIASES (Thin Redirects — Not Real Modules)

These are status + redirect controllers that map codenames to their actual gadget routes. They contain no business logic.

| Alias | Target Route | File |
|-------|-------------|------|
| sorbet | `/api/gadgets/weather` | `CodeNameAliasControllers.cs` |
| brioche | `/api/gadgets/podcasts` | `CodeNameAliasControllers.cs` |
| nectar | `/api/gadgets/radio` | `CodeNameAliasControllers.cs` |
| ganache | `/api/gadgets/photos` | `CodeNameAliasControllers.cs` |
| bisque | `/api/gadgets/webvideo` | `CodeNameAliasControllers.cs` |
| cinnamon | `/api/gadgets/synapse-admin` | `CodeNameAliasControllers.cs` |
| waffle | `/api/gadgets/gamebot` | `CodeNameAliasControllers.cs` |
| custard | `/api/gadgets/media-bridge` | `CodeNameAliasControllers.cs` |
| yeast | `/api/gadgets/bot` | `CodeNameAliasControllers.cs` |

---

## F. SEPARATED DLL MODULES (Pre-existing in `/app/separated/`)

These were previously separated into standalone DLLs with `module.json` manifests:

| Module | DLL Exists | Manifest |
|--------|-----------|----------|
| bastion | Yes | Yes |
| beacon | Yes | Yes |
| compote | Yes | Yes |
| drizzle | Yes | Yes |
| fondue | Yes | Yes |
| gelatin | Yes | Yes |
| marmalade | Yes | Yes |
| syrup | Yes | Yes |
| tunnel | Yes | Yes |
| zest | Yes | Yes |

---

## G. FRONTEND PAGES (Reference)

Every module below has a corresponding frontend page in `/app/frontend/src/pages/`:

| Page File | Maps To |
|-----------|---------|
| Dashboard.js | core |
| LibraryManagerPage.js | marmalade, libraries |
| LibraryPage.js | marmalade |
| MediaDetails.js | marmalade, tmdb |
| MoviesPage.js | fondue, marmalade |
| TVShowsPage.js | marmalade |
| DiscoverPage.js | tmdb, nutmeg |
| SearchPage.js | tmdb |
| IndexerSearchPage.js | compote |
| DownloadsPage.js | downloads, churro |
| MediaBrowserPage.js | marmalade |
| PlaylistsPage.js | playlists, drizzle |
| WatchlistPage.js | watchlist |
| WatchHistoryPage.js | truffle |
| StreamingPage.js | streaming-logins |
| AnimePage.js | marmalade |
| MusicPage.js | marmalade |
| SecurityPage.js | security, bastion |
| SettingsPage.js | settings, crumbs |
| SystemPage.js | system |
| LogViewerPage.js | logs |
| VpnPage.js | vpn, tunnel |
| DVRPage.js | iptv |
| LiveTVPage.js | iptv |
| WatchPartyPage.js | watch-party, gelatin |
| PluginMarketplacePage.js | ripen |
| ThemeCommunityPage.js | milk |
| HelpPage.jsx | core |
| FonduePage.jsx | fondue |
| ChurroPage.jsx | churro |
| SaffronPage.jsx | saffron |
| SourdoughPage.jsx | sourdough |
| GlazePage.jsx | glaze |
| RouxPage.jsx | roux |
| SproutPage.jsx | sprout |
| StrudelPage.jsx | strudel |
| gadgets/AnalyticsPage.jsx | truffle |
| gadgets/NotificationsPage.jsx | pepper |
| gadgets/ParentalControlsPage.jsx | rind |
| gadgets/PhotosPage.jsx | ganache |
| gadgets/PodcastsPage.jsx | brioche |
| gadgets/ProcessingPage.jsx | crucible |
| gadgets/RadioPage.jsx | nectar |
| gadgets/RequestsPage.jsx | meringue |
| gadgets/UsenetPage.jsx | brine, ladle |
| gadgets/WeatherPage.jsx | sorbet |
| gadgets/WebVideoPage.jsx | bisque |

---

## H. RECOMMENDED TIER ASSIGNMENT (Draft)

> **Your call.** Below is a suggested starting point. Move modules between tiers as you see fit.

### STANDARD (Free/Base Install)
- Core Platform (A1-A9)
- Media Library Engine (marmalade)
- TMDB Proxy
- Library Management
- Watchlist & Progress
- Dashboard, Settings, Logs, System
- Setup Wizard
- Basic Playlists
- File Browser
- Theme Engine (milk)

### PRO
- Compote (Indexer Search)
- Fondue (Movie Automation)
- Saffron (Scheduled Tasks)
- Sourdough (Backup & Restore)
- Churro (Download Clients)
- Downloads Engine
- Truffle (Watch Analytics)
- Roux (Collections)
- Glaze (Scrobbling)
- Sprout (RSS Feeds)
- Drizzle (Playlist Engine)
- Meringue (User Requests)
- Nutmeg (Recommendations)
- Quality Profiles
- Streaming Logins
- IPTV/Live TV

### ULTRA
- Bastion (Advanced Auth — LDAP, 2FA)
- Tunnel (Network Config — VPN, SSL, DDNS)
- Security Center (IP rules, API keys, Audit)
- Rind (Parental Controls)
- Pepper (Notification Hub)
- Crucible (Media Processing)
- Strudel (Disc Ripping)
- Crumbs (Integration Hub)
- Taffy (Metadata Agents)
- All Gadgets (Weather, Podcasts, Radio, Photos, Web Video, Matrix, Synapse Admin, Movie Quiz, Media Bridge, Bot, Usenet)
- Watch Party
- External Access (Gelatin)
- VPN Manager
- qBittorrent Client
- Subtitles Manager

---

*Document generated for Project Cellar tier assignment review.*
*WatchNexus v1.0.0 — 42 controller files, ~11,000 lines of C#.*

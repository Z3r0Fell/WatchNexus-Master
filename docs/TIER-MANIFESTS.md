# WatchNexus Tier Manifests — Build Packaging Guide

## Standard Tier (Free/Base Install)
All installs start here. Controllers always included.

### Controllers (Standard)
- `CoreController.cs` — Health, auth, users, setup wizard
- `ContentController.cs` — TMDB proxy, watchlist, watch-progress, next-up
- `BridgeController.cs` — Dashboard, marmalade library, streaming, user preferences
- `SettingsController.cs` — Settings CRUD, downloads, log viewer
- `FilesystemController.cs` — File browser
- `LibrariesController.cs` — Library management
- `FeatureControllers.cs` (partial) — milk (themes), gelatin, ripen, streaming-logins, watch-party, playlists
- `CodeNameAliasControllers.cs` (partial) — Setup wizard, glaze, playlists, aliases for standard gadgets
- `CoreModuleControllers.cs` (partial) — churro, roux, quality-profiles
- `WeatherController.cs` — sorbet
- `PodcastsController.cs` — brioche
- `RadioController.cs` — nectar
- `PhotosController.cs` — ganache
- `WebVideoController.cs` — bisque
- `SystemController.cs` — System info
- `UtilityControllers.cs` — Zest health

### Frontend Pages (Standard)
- Dashboard, Library, Movies, TV, Anime, Music, Audiobooks
- Playlists, Collections, Discover, Search, Help
- Watchlist, Downloads, Browse Media, Settings
- Gadgets: Weather, Podcasts, Radio, Photos, Web Video
- Scrobbling, Download Clients, Themes, Marketplace

---

## Pro Tier (Standard + Pro modules)
Unlocked via serial number containing "pro" plan from license server.

### Additional Controllers (Pro)
- `CoreModuleControllers.cs` (partial) — fondue, saffron, sourdough, bastion, tunnel, taffy, nutmeg, pantry
- `MediaControllers.cs` — compote (indexer search engine), garnish, torrent status
- `TruffleController.cs` — Watch analytics
- `SproutController.cs` — RSS feed generation
- `DrizzleController.cs` — Playlist engine
- `MeringueController.cs` — User requests
- `IptvController.cs` — Live TV / IPTV

### Additional Frontend Pages (Pro)
- Indexers, Automation, Streaming Logins
- Analytics, Requests, Tasks, Backups, RSS Feeds
- Live TV, DVR

---

## Ultra Tier (Standard + Pro + Ultra modules)
Unlocked via serial number containing "ultra"/"ult" plan from license server.

### Additional Controllers (Ultra)
- `SecurityController.cs` — IP rules, audit, API keys
- `RindController.cs` — Parental controls
- `PepperController.cs` — Notification hub
- `CrucibleController.cs` — Media processing / FFmpeg
- `StrudelController.cs` — Optical disc ripping
- `CrumbsController.cs` — Integration hub
- `BrineController.cs` — Usenet indexer (Prowlarr)
- `LadleController.cs` — Usenet downloader (SABnzbd)
- `BotController.cs` — Background automation (yeast)
- `GameBotController.cs` — Movie quiz (waffle)
- `MatrixController.cs` — Matrix chat (cinnamon)
- `SynapseAdminController.cs` — Synapse admin
- `MediaBridgeController.cs` — Emby bridge (custard)
- `VpnController.cs` — VPN manager
- `QBittorrentController.cs` — qBittorrent client
- `SubtitlesController.cs` — Subtitle manager
- `ParfaitController.cs` — Jellyseerr integration
- `MenuController.cs` — Built-in Seerr (discover & requests)
- `UtilityControllers.cs` (partial) — Adapter (FFmpeg convert)

### Additional Frontend Pages (Ultra)
- Security, VPN, Parental Controls, Processing
- Notifications, Usenet, Disc Ripping
- Jellyseerr, Requests Manager (Menu)

---

## Upgrade Paths
| From | To | Action |
|------|-----|--------|
| Standard | Pro | Enter Pro serial → validates against license server → unlocks Pro modules |
| Standard | Ultra | Enter Ultra serial → validates → unlocks Pro + Ultra modules |
| Pro | Ultra | Enter Ultra serial → validates → unlocks Ultra modules on top of Pro |

## License Server Integration
- URL: Configured via `LICENSE_SERVER_URL` in appsettings.json
- API Key: Configured via `LICENSE_SERVER_API_KEY` in appsettings.json
- Endpoint: `POST /api/integrate/activate` with `{ license_key, hardware_id, device_name }`
- Response `license.plan` determines tier mapping
- Activation tokens stored locally for periodic validation
- Falls back to format-based validation if server unavailable

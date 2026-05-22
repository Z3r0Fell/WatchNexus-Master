# WatchNexus - Product Requirements Document

## Overview
WatchNexus is a self-hosted media management pipeline combining features from Jellyfin and the *arr ecosystem into a unified platform. C#/.NET 10 backend + React frontend.

## Current Version: 2.8.4

## Architecture
- **Backend**: C#/.NET 10 (ASP.NET Core) on port 8002
- **Proxy**: FastAPI on port 8001 (forwards /api/* to .NET backend)
- **Frontend**: React (CRA) on port 3000
- **Database**: SQLite via Entity Framework Core
- **Auth**: JWT-based (admin@watchnexus.local / admin)

## Implemented Features

### Core Media
- Library management with TV show grouping
- TMDB integration for content discovery
- Media streaming and transcoding pipeline

### Compote Search Engine (REAL)
- Nyaa.si RSS, YTS JSON, EZTV JSON, Torznab/Newznab, Generic RSS
- Quality/codec detection, size parsing, magnet extraction, grab endpoint

### P1 Modules (Full)
| Module | Codename | Description |
|--------|----------|-------------|
| Scrobbling | glaze | Trakt.tv & Last.fm |
| Scheduled Tasks | saffron | 8 task types with history |
| Movie Automation | fondue | Radarr-like monitoring |
| Backup & Restore | sourdough | Config backups, scheduling |
| Download Clients | churro | Torrent/Usenet management |
| Collections | roux | Smart & manual collections |
| RSS Feeds | sprout | RSS/Atom feed generator |

### Security (Bastion) & Network (Tunnel)
- TOTP 2FA, LDAP, IP filtering, audit logging, sessions
- WireGuard VPN, SSL certs, bandwidth monitoring

### Strudel — Optical Disc Ripping (NEW - April 9, 2026)
Full investigation + scaffold + prototype for DVD/Blu-ray ripping module:
- **Investigation doc**: `/app/docs/STRUDEL-INVESTIGATION.md` — 8-section deep analysis of MakeMKV CLI, HandBrake CLI, robot mode parsing, pipeline architecture, data models, 17 API endpoints, legal considerations, 5 implementation phases
- **Backend controller**: `/app/src/watchnexus/core/Controllers/StrudelController.cs` — 17 endpoints: status, drives, scan (async w/ makemkvcon robot mode parser), rip (full pipeline: rip → transcode → import), jobs CRUD, profiles, history, config, eject
- **Frontend page**: `/app/frontend/src/pages/StrudelPage.jsx` — 4-tab UI (Rip Disc, Job Queue, Profiles, History), drive panel, scan results with expandable title/stream info, profile selector, progress bars, legal disclaimer
- **7 built-in transcode profiles**: Direct Copy, 1080p HEVC CRF20, 1080p H.264 CRF18, 720p Compact, 4K Passthrough, NVENC GPU, QuickSync
- **Tested**: 13/13 backend tests passed, all frontend elements verified

## Press Kit (COMPLETED)
- `/app/docs/press-kit/` — README, 13 images, 8 targeted articles, submission tracker

## Marketing Website (COMPLETED)
- `/app/website/` — 5-page static site (landing, features, download, FAQ, press)

## Release Builds
- Linux x64 (58MB), Windows x64 (72MB) self-contained binaries

## Project Cellar — Tiered Licensing Pivot (In Progress)
- **Module Audit:** COMPLETED — `/app/docs/CELLAR-MODULE-AUDIT.md`
  - 65+ modules audited across 42 controller files (~11,000 LOC)
  - 5 stubs identified (Kodi, Adapter, Garnish, Torrent status, Next-up)
  - 9 codename alias redirects documented
- **Tier Assignments:** CONFIRMED by user
  - Standard (31 modules): Core platform, media library, basic gadgets, downloads, collections, scrobbling
  - Pro (14 modules): Indexer search, movie automation, scheduled tasks, backup, advanced auth, analytics, network, RSS, playlists, requests, recommendations, streaming, IPTV
  - Ultra (18 modules): Security, parental controls, notifications, media processing, disc ripping, integrations, metadata agents, Synapse, Quiz, Media Bridge, Bot, Usenet, Watch Party, VPN, qBittorrent, Subtitles, Pretzel (Gaming Console)
- **Cellar Controller:** IMPLEMENTED — `/app/src/watchnexus/core/Controllers/CellarController.cs`
  - `GET /api/cellar/status` — Current license tier and unlocked modules
  - `POST /api/cellar/activate` — Serial number activation (WNX-PRO-/WNX-ULT- format)
  - `POST /api/cellar/deactivate` — Revert to Standard
  - `GET /api/cellar/tiers` — Full tier manifest with module lists
  - `GET /api/cellar/check/{module}` — Check if specific module is unlocked
- **Activation UI:** IMPLEMENTED — Settings > Activation tab
  - Current tier banner with module count
  - Serial number input with format validation
  - Tier comparison grid (Standard/Pro/Ultra)
  - Activate/Deactivate flow
- **Pretzel:** Registered as codename for Gaming Console module (Ultra tier)
- **UI Tier Locking:** IMPLEMENTED
  - Created `LicenseContext.js` with route-to-module mapping for 50+ routes
  - Created `TierGate.jsx` upgrade prompt component (shows lock, tier name, "Enter Serial Number" button)
  - Sidebar.js shows lock icons on tier-locked items (dimmed text + lock icon)
  - App.js wraps Pro/Ultra routes with `TierRoute` (auth + tier gate)
  - License changes propagate instantly via event system
- **Stub Removal:** COMPLETED
  - Kodi controller: DELETED (dead-end, no Kodi integration)
  - Adapter (FFmpeg): Now delegates to Crucible transcode pipeline with real file validation
  - Garnish (Subtitle providers): Now queries DB for configured providers with real test endpoints
  - Torrent status: Now queries actual download counts from DB
  - Next-up: Now computes from watch progress data (5%-95% completion filter)
  - Zest health: Now returns real process uptime, memory, thread count
- **Parfait (Jellyseerr):** IMPLEMENTED — Ultra tier
  - Backend: `ParfaitController.cs` — Full Jellyseerr API proxy (status, config, requests CRUD, approve/decline, discover, search, movie/TV details, users, stats)
  - Frontend: `ParfaitPage.jsx` — Config panel, request management with approve/decline/delete, discover tab with trending, search with request buttons, stats bar
  - Route: `/jellyseerr` → `/api/parfait/*`
- **Menu (Built-in Seerr):** IMPLEMENTED — Ultra tier (codename: Menu)
  - Backend: `MenuController.cs` — TMDB discovery (trending/popular/upcoming/search), request management (CRUD + approve/decline/fulfill), Sonarr/Radarr integration (config, add, profiles, root folders), automatic fulfillment pipeline
  - Frontend: `MenuPage.jsx` — Discover tab with poster grid, request management with filters, Sonarr/Radarr config panel, search
  - Route: `/requests-manager` → `/api/menu/*`
- **WN-License-Server Integration:** IMPLEMENTED
  - CellarController talks to external license server at `LICENSE_SERVER_URL` via `POST /api/integrate/activate`
  - Validates license key → gets `plan` field → maps to Standard/Pro/Ultra tier
  - Stores activation_id and activation_token for periodic validation
  - Falls back to format-based validation (WNX-PRO-/WNX-ULT-) when server unavailable
- **Upgrade Paths:** IMPLEMENTED
  - Standard → Pro, Standard → Ultra, Pro → Ultra (only upgrades allowed, downgrades blocked)
  - Previous tier tracked in license data
- **First-Launch Unlock:** IMPLEMENTED
  - `GET /api/cellar/first-launch` (no auth) — checks if license exists
  - `POST /api/cellar/activate-first-launch` (no auth) — enter serial or skip to Standard
  - `FirstLaunchGate.jsx` wraps entire app — shows welcome screen with serial input on first launch
- **Tier Manifests:** Created `/app/docs/TIER-MANIFESTS.md` — maps every controller to its tier for build packaging
- **Next:** Configure `LICENSE_SERVER_URL` and `LICENSE_SERVER_API_KEY` in appsettings.json to connect to https://github.com/Z3r0Fell/WN-License-Server

## Future Tasks (P2)
- Docker image publication per tier (Standard/Pro/Ultra)
- Hardware transcoding integration
- Strudel Phase 2-5: Real async MakeMKV/HandBrake pipeline, udev automation

## Completed Backlog (This Session)
- **Pretzel (Gaming Console):** 15 retro systems, ROM library, scan/import, save states, play tracking, favorites, EmulatorJS integration
- **Biscotti (Ebooks/Audiobooks/Comics):** Library management, scan, progress tracking, epub/pdf/cbz/m4b support
- **Treacle (Music):** Track library, artist/album management, scan, mp3/flac/ogg/m4a support
- **Sage (AI Recommendations):** TMDB-powered, filters out watched content, trending + top-rated sources
- **Terrine (Live TV DVR):** Recording scheduler, EPG integration, status tracking
- **Popsicle (Offline Sync):** Download queue, quality selection, expiry management
- **Preserves (S3 Backup):** S3/object storage config, backup creation/listing, multi-provider support
- **Marshmallow (Cloud Sync):** Cross-device sync for watchlist/progress/settings, sync history

# WatchNexus - Product Requirements Document

## Overview
WatchNexus is a self-hosted media management pipeline combining features from Jellyfin and the *arr ecosystem into a unified platform. C#/.NET 10 backend + React frontend.

## Current Version: 2.9.0

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
- Automated testing suite per tier
- Helm chart for Kubernetes deployment

## Update System — COMPLETE
- **UpdateController.cs** — 7 endpoints at `/api/system/updates/*`:
  - `GET /check` — Dual-source check: license server manifest + GitHub private repo for hotfix patches
  - `GET /current` — Current version, tier, last check time, channel status
  - `GET /settings` & `POST /settings` — Auto-check, interval, auto-install patches, channel (stable/beta/nightly)
  - `GET /history` — Update application log
  - `POST /apply-patch` — Apply GitHub-hosted silent hotfix patches
  - `POST /dismiss` — Dismiss update notification
- **UpdateSettings.jsx** — Settings > Updates sub-tab with:
  - Version card (v2.9.0, Ultra Edition, tier icon)
  - "Check for Updates" button with loading state
  - Update available banner with release notes, download URL, docker pull command
  - Hotfix patch banner with severity coloring and one-click apply
  - "You're up to date" green confirmation
  - Update Preferences panel (auto-check, interval, auto-install patches, channel)
  - Update History log
- **Config**: `PATCH_REPO_URL` and `PATCH_REPO_TOKEN` in appsettings.json for private GitHub repo
- **GitHub Container Registry:** Images published to `ghcr.io/<owner>/watchnexus:{version}-{tier}`
- **docker-publish.yml:** Triggered by `v*.*.*` tags or manual dispatch. Builds all 3 tiers in parallel, multi-arch (amd64+arm64), with GHA build cache. Tags ultra as `latest`. Auto-creates GitHub Release with tier comparison table and install instructions.
- **pr-check.yml:** Validates all 3 tiers compile on PRs to main/develop.
- **Release flow:** `git tag v2.9.0 && git push --tags` → builds 6 images (3 tiers x 2 archs) → pushes to GHCR → creates release

## Completed Backlog (This Session)
- **Pretzel (Gaming Console):** 15 retro systems, ROM library, scan/import, save states, play tracking, favorites, EmulatorJS integration
- **Biscotti (Ebooks/Audiobooks/Comics):** Library management, scan, progress tracking, epub/pdf/cbz/m4b support. Frontend: BiscottiPage.jsx at /ebooks
- **Treacle (Music):** Track library, artist/album management, scan, mp3/flac/ogg/m4a support. Frontend: TreaclePage.jsx at /music-library
- **Sage (AI Recommendations):** TMDB-powered, filters out watched content, trending + top-rated sources. Frontend: SagePage.jsx at /for-you
- **Terrine (Live TV DVR):** Recording scheduler, EPG integration, status tracking. Frontend: TerrinePage.jsx at /dvr
- **Popsicle (Offline Sync):** Download queue, quality selection, expiry management. Frontend: PopsiclePage.jsx at /offline
- **Preserves (S3 Backup):** S3/object storage config, backup creation/listing, multi-provider (S3/B2/MinIO/Wasabi/R2). Frontend: PreservesPage.jsx at /cloud-backup
- **Marshmallow (Cloud Sync):** Cross-device sync for watchlist/progress/settings, sync history. Frontend: MarshmallowPage.jsx at /cloud-sync
- **Strudel Phase 2-5:** Async job queue with background processing, real MakeMKV robot mode + progress parsing, HandBrake CLI integration with progress, auto-import to library, udev auto-detection rules + install, pipeline stats
- **Hardware Transcoding:** GPU detection (NVIDIA/Intel QSV/VAAPI/AMD AMF/Apple VideoToolbox), 8 HW encode profiles, FFmpeg encoder enumeration, hardware transcode job submission

- **Chowder (Media Sync — JellyLooter Pro):** IMPLEMENTED — Ultra tier (codename: Chowder)
  - Backend: `ChowderController.cs` — Multi-server Jellyfin/Emby connection with API test, library browsing with poster/rating/resolution/codec metadata, download queue (add/remove/pause/resume), auto-sync mappings with scheduling, download history, bandwidth scheduling, per-server worker pools, duplicate detection
  - Frontend: `ChowderPage.jsx` at `/media-sync` — 4-tab UI (Servers/Browse/Queue/History), remote library poster grid with download buttons, server config panel, queue management with pause/resume, stats dashboard
  - 17 API endpoints at `/api/chowder/*`
  - Pro features included: Unlimited servers, download resume, scheduling, bandwidth control, *arr integration hooks

## All Frontend Pages Complete
Every module now has a working frontend page — zero scaffolding remaining.

## Docker Image Publication — COMPLETE
- **Dockerfile:** Multi-stage build (node:20-alpine → .NET 10 SDK → .NET 10 runtime). Accepts `TIER` build arg.
- **docker-compose.yml:** Three services with profiles (standard/pro/ultra). Volume mounts for data, media, rips, transcoded, offline. NVIDIA GPU passthrough for Ultra.
- **build/docker-build.sh:** Build + push all tiers. Tags: `watchnexus/watchnexus:2.9.0-{tier}`, `latest-{tier}`, ultra = `latest`.
- **build/copy-tier-controllers.sh:** Selectively copies controllers per tier during Docker build.
- **build/build-tiers.sh:** Local tier packaging (non-Docker). Standard: 14 controllers/26 pages. Pro: 23/41. Ultra: 46/57.
- **.dockerignore:** Excludes node_modules, .git, docs, website, build artifacts.
- Images: `watchnexus/watchnexus:2.9.0-standard`, `watchnexus/watchnexus:2.9.0-pro`, `watchnexus/watchnexus:2.9.0-ultra`


## InstallBuilder Packaging — COMPLETE (2026-02)
- **/app/docs/installbuilder.md**: Canonical packaging guide. Three separate installers per platform per tier (Standard/Pro/Ultra × Windows/Fedora/Debian/Arch/Docker). Includes prerequisites, dotnet publish + yarn build prep stages, InstallBuilder CLI matrix, signing (osslsigncode), Arch PKGBUILD wrapper flow, Docker save flow, verification checklist, and CI snippet for the self-hosted Arch runner. macOS intentionally excluded per directive.
- **/app/build/installbuilder/watchnexus.xml**: Real BitRock InstallBuilder project. Tier-aware via `--setvars tier=`. Validated well-formed XML. Components: backend payload (linux-x64 / win-x64), web bundle, tier.json manifest. Post-install hooks register systemd unit (Linux) and Windows service + tier registry key. Pre-uninstall hooks tear them down.
- **/app/build/installbuilder/scripts/{post-install,pre-uninstall}.sh**: Idempotent service-user creation, systemd unit emission, tier.lock + version.lock files (Fortress integrity check inputs).
- **/app/build/installbuilder/docker/Dockerfile**: Consumes the InstallBuilder `linux-x64-installer.run` payload, runs unattended, exposes 8001, tini entrypoint, tier/version as labels + env vars.
- **/app/build/installbuilder/arch/{PKGBUILD.in,build-arch.sh}**: Renders a per-tier PKGBUILD that wraps the InstallBuilder Linux tarball and produces `.pkg.tar.zst` via `makepkg`.
- **/app/build/installbuilder/resources/{EULA.txt,README.txt}**: Required installer assets (icons/PNGs to be supplied alongside).

### Release matrix (12 artifacts per release)
| Tier | Windows EXE | Fedora RPM | Debian DEB | Arch pkg.tar.zst | Docker tar |
|---|---|---|---|---|---|
| Standard | ✓ | ✓ | ✓ | ✓ | ✓ (note: only 3 platform installers per tier, not 4 — Docker is separate flow) |
| Pro | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ultra | ✓ | ✓ | ✓ | ✓ | ✓ |


## InstallBuilder — Branding Assets + Ubuntu Host + Sign Step (2026-02 follow-up)
- **Branded installer assets dropped into `/app/build/installbuilder/resources/`:**
  - `watchnexus.ico` — multi-resolution Windows icon (16/24/32/48/64/128/256), generated from `website/assets/images/watchnexus-icon-light.png`
  - `installer-left.png` — 164×314 InstallBuilder side panel (dark slate backdrop + centred brand mark)
  - `watchnexus-logo.png` — 400×377 wizard header logo (downsized from the 4088×3848 master)
  - `watchnexus-banner.png` — 300×70 wordmark strip (auxiliary)
- **Build host switched from Arch → Ubuntu 22.04/24.04 LTS** throughout `installbuilder.md` (apt-based prerequisites, NodeSource repo, Microsoft `dotnet-sdk-10.0` repo). Arch packaging now flows through a disposable `archlinux:latest` Docker container (Ubuntu cannot run `makepkg` natively).
- **`fortress-build.sh sign <release_dir>` subcommand added.** Walks `*.exe / *.rpm / *.deb / *.pkg.tar.zst / *.tar / *.run` under `/app/release/<tier>/`, emits `SHA256SUMS.txt` per tier. When `WN_UPLOAD_HASHES=1` + `WN_LICENSE_TOKEN=...` are set, POSTs the hashes to `https://licenses.watchnexus.ca/api/releases/hashes`. Smoke-tested end-to-end.
- Windows signing flow documented via `osslsigncode` against `/opt/signing/watchnexus.pfx`.

## RTP 1.0.0 Release Cut (2026-02)
- **Version bump**: Internal `Dev 3.0` build line released as **Release to Public v1.0.0**. All `2.9.0` strings replaced with `1.0.0` across 56 operational files (controllers, frontend, build scripts, InstallBuilder XML, Docker, Unraid templates, press kit, docs). Verified live: `/api/system/updates/current` reports `1.0.0`, all 35 backend module versions report `1.0.0`.
- **Side-fix**: `FortressController.cs` was missing `using WatchNexus.Shared;` — added (pre-existing build break unrelated to version bump).
- **Changelog**: New `v3.0.0 → RTP 1.0.0` entry prepended to `/app/CHANGELOG.md` with headline features and migration note.
- **New artifacts shipped**
  - `/app/build/prepare-installers.sh` — Arch laptop staging script: runs `build-tiers.sh`, `dotnet publish win-x64+linux-x64`, `yarn build` (tier-baked), writes `tier.json`, copies LICENSE/README into `stage/<tier>/`. Validated via `bash -n`.
  - `/app/docs/INSTALLBUILDER-STEPS.md` — 8-step InstallBuilder 26 runbook (setup → stage → build matrix → Arch → sign → hash/upload → smoke → rsync to Ubuntu VPS), plus troubleshooting cheatsheet.
  - `/app/LICENSE.txt` + `/app/LICENSE.html` — 10-section EULA, plain text + branded HTML (print-friendly CSS).
  - `/app/README.md` — production README (old dev README archived to `docs/README-DEV-ARCHIVED.md`).
  - `/app/build/installbuilder/watchnexus.xml` — now accepts `--setvars payload_root=...` from `prepare-installers.sh` (overrides default `stage/<tier>` path).
- **Architecture clarified**: Arch laptop = build host (runs InstallBuilder 26 natively, `makepkg` works directly). Ubuntu VPS = storage/distribution only (rsync target).

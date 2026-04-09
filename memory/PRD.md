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

## Future Tasks (P2)
- Strudel Phase 2-5: Job queue async processing, real MakeMKV/HandBrake pipeline, library auto-import, udev automation
- Biscotti (Ebook/Audiobook/Comics), Treacle (Music), Sage (AI Recommendations)
- Terrine (Live TV DVR), Popsicle (Offline Sync), Preserves (S3 Backup), Marshmallow (Cloud Sync)
- Docker image publication, hardware transcoding

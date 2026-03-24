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

## Implemented Features (Production-Ready)

### Core Media
- Library management with TV show grouping (Series > Season > Episode)
- TMDB integration for content discovery, search, trending
- Media streaming and transcoding pipeline

### Compote Search Engine (REAL - queries live indexers)
- Nyaa.si RSS feed parsing with magnet link extraction
- YTS JSON API integration
- EZTV JSON API integration
- Torznab/Newznab standard API support
- Generic RSS fallback search
- Quality detection (2160p/1080p/720p/480p)
- Codec detection (HEVC/x264/AV1/VP9)
- Size parsing (TiB/GiB/MiB/KiB)
- Grab endpoint stores downloads in DB

### P1 Modules (Full Implementation)
| Module | Codename | Description |
|--------|----------|-------------|
| Scrobbling | glaze | Trakt.tv & Last.fm with config-driven OAuth |
| Scheduled Tasks | saffron | 8 task types with run/history |
| Movie Automation | fondue | Radarr-like monitoring, search, queue |
| Backup & Restore | sourdough | Config backups, scheduling, export |
| Download Clients | churro | Torrent/Usenet client management |
| Collections | roux | Smart & manual collections, filter engine |
| RSS Feeds | sprout | RSS/Atom feed generator with API key auth |

### Enhanced Security (Bastion)
- Real TOTP 2FA (Base32 secrets, QR URIs, 8 backup codes)
- LDAP connection testing
- Password policy validation with strength scoring
- Audit log tracking
- Session management with device/browser detection

### Network Management (Tunnel)
- Real network interface detection
- WireGuard peer CRUD with key generation
- SSL certificate management
- Bandwidth monitoring with history
- Dynamic DNS, Tailscale support
- External connectivity testing

## System Page
Shows: Version 2.8.4, Runtime (.NET 10.0.5), OS, Architecture, Server Details, 8 Security Features, 35 Modules

## Release Builds
- `/app/release_builds/WatchNexus-v2.8.4-linux-x64.tar.gz` (58MB)
- `/app/release_builds/WatchNexus-v2.8.4-win-x64.zip` (72MB)

## Documentation & Press Kit (COMPLETED)
- Press Kit created at `/app/docs/press-kit/` with:
  - Comprehensive README.md (product overview, features, specs, module ecosystem, brand guidelines)
  - 13 images: 9 app screenshots + 3 brand assets (logo, banner, icon)
- Root README.md updated to v2.8.4
- All install/build scripts updated to v2.8.4
- CHANGELOG.md updated with press kit entry
- USER-GUIDE.md updated with v2.8.4 reference
- Outdated docs deleted (BETA_TESTING_REPORT.md, WN-SPLIT-STRUCTURE.md)

## Future Tasks (P2)
- Biscotti (Ebook/Audiobook/Comics)
- Treacle (Music Library & Player)
- Sage (AI Metadata & Recommendations)
- Terrine (Live TV DVR)
- Popsicle (Offline Sync / Mobile)
- Preserves (S3/Cloud Backup)
- Marshmallow (Cloud Sync)
- Full implementation of Taffy, Pantry, Nutmeg

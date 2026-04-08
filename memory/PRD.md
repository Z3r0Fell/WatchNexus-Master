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
- YTS JSON API integration, EZTV JSON API integration
- Torznab/Newznab standard API support, Generic RSS fallback
- Quality detection (2160p/1080p/720p/480p), Codec detection (HEVC/x264/AV1/VP9)
- Size parsing (TiB/GiB/MiB/KiB), Grab endpoint stores downloads in DB

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
- LDAP, IP filtering, audit logging, session management

### Network Management (Tunnel)
- WireGuard peer CRUD, SSL certs, bandwidth monitoring, DNS, Tailscale

## Press Kit (COMPLETED - March 24, 2026)
Located at `/app/docs/press-kit/`:
- Comprehensive README.md with product overview, specs, brand guidelines
- 13 images: 9 app screenshots + 3 AI-generated brand assets
- **8 targeted articles** for high-exposure publications:
  1. Hacker News (Show HN) - Technical launch post
  2. Reddit r/selfhosted - Community post, replaces 6 apps angle
  3. Dev.to - .NET 10 architecture deep-dive with code snippets
  4. It's FOSS / LinuxHandbook - Linux installation tutorial
  5. Product Hunt / BetaList / OpenHunts - Product launch copy
  6. Smashing Magazine / CSS-Tricks - Frontend engineering case study
  7. ServeTheHome / r/homelab - Infrastructure/resource comparison
  8. The Hacker News (THN) / DarkReading - Security architecture article
- Submission tracker with URLs, guidelines, and cross-promotion strategy

## Marketing Website (COMPLETED - April 8, 2026)
Located at `/app/website/` - static site ready for upload to watchnexus.ca:
- **index.html**: Landing page (hero, screenshot showcase with tabs, 6 feature cards, 4 stats, replacement grid, tech specs table, CTA, footer)
- **features.html**: All 35 modules organized by category with codenames and badges
- **download.html**: Linux/Windows download cards (placeholder), Docker preview, quick start guide, system requirements, release history
- **faq.html**: 14 FAQ items in 4 categories with accordion behavior
- **press.html**: Brand guidelines, color swatches, screenshot gallery, logo assets
- Consistent dark theme, Font Awesome icons, scroll animations, responsive design
- GitHub link disabled, downloads show placeholder alerts, issue reporting links to QA site
- **Tested: 100% pass rate** across all pages

## Release Builds
- `/app/release_builds/WatchNexus-v2.8.4-linux-x64.tar.gz` (58MB)
- `/app/release_builds/WatchNexus-v2.8.4-win-x64.zip` (72MB)

## Future Tasks (P2)
- Biscotti (Ebook/Audiobook/Comics)
- Treacle (Music Library & Player)
- Sage (AI Metadata & Recommendations)
- Terrine (Live TV DVR)
- Popsicle (Offline Sync / Mobile)
- Preserves (S3/Cloud Backup)
- Marshmallow (Cloud Sync)
- Full implementation of Taffy, Pantry, Nutmeg
- Docker image publication
- Hardware transcoding (QSV/NVENC)

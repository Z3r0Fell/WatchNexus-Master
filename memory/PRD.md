# WatchNexus - Product Requirements Document

## Overview
WatchNexus is a self-hosted media management pipeline combining features from Jellyfin and the *arr ecosystem into a unified platform. It uses a C#/.NET 10 backend with React frontend.

## Current Version: 2.8.4

## Architecture
- **Backend**: C#/.NET 10 (ASP.NET Core) on port 8002
- **Proxy**: FastAPI on port 8001 (forwards /api/* to .NET backend)
- **Frontend**: React (CRA) on port 3000
- **Database**: SQLite via Entity Framework Core
- **Auth**: JWT-based (admin@watchnexus.local / admin)

## Module Status (35 Total)

### Core Media (Active - Full Implementation)
| Module | Codename | Description |
|--------|----------|-------------|
| Libraries | marmalade | Media library management, TV grouping |
| Media Server | media | Streaming, transcoding |
| Content Discovery | content | TMDB integration, search, trending |
| Downloads | crucible | Download processing pipeline |

### P1 Modules (Active - Full Implementation)
| Module | Codename | Description |
|--------|----------|-------------|
| Scrobbling | glaze | Trakt.tv & Last.fm with config-driven OAuth |
| Scheduled Tasks | saffron | 8 task types with run/history |
| Movie Automation | fondue | Radarr-like monitoring, search, queue |
| Backup & Restore | sourdough | Config backups, scheduling, export |
| Download Clients | churro | Torrent/Usenet client management |
| Collections | roux | Smart & manual collections, filter engine |
| RSS Feeds | sprout | RSS/Atom feed generator with API key auth |

### Enhanced Modules (Active - Real Functionality)
| Module | Codename | Description |
|--------|----------|-------------|
| Advanced Auth | bastion | TOTP 2FA, LDAP test, password policy, audit log, sessions |
| Network/VPN | tunnel | WireGuard peers, SSL certs, bandwidth, Dynamic DNS, Tailscale |

### Remaining Scaffolded Modules (Active - Placeholder)
| Module | Codename | Description |
|--------|----------|-------------|
| Subtitles | taffy | Multi-language subtitles |
| Path Management | pantry | Storage path mappings |
| Recommendations | nutmeg | AI-powered suggestions |

## System Page
Shows: Version, Runtime, OS, Architecture, Server Time, Hostname, CPU Cores, Memory, Uptime, 8 Security Features, 35 Modules

## Key Files
- `/app/src/watchnexus/core/Controllers/` - All backend controllers
- `/app/frontend/src/pages/` - All frontend pages
- `/app/frontend/src/components/layout/Sidebar.js` - Navigation
- `/app/frontend/src/App.js` - Router configuration
- `/app/release_builds/` - v2.8.4 builds (linux-x64, win-x64)

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
- Full implementation of Taffy (Subtitles), Pantry (Storage), Nutmeg (AI)

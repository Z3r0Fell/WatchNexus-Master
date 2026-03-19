# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". All features must be fully functional with real-world APIs. Every component has a codename following a food/kitchen/pantry theme.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Dev Proxy:** Python FastAPI reverse proxy (port 8001 → C# server port 8002)

## Current Version: 2.8.0 | Total Modules: 31

## Implemented Features

### Core Modules (Built-in)
| Codename | Module | Route |
|----------|--------|-------|
| Marmalade | Bridge/Dashboard | /api/bridge |
| Bastion | Security | /api/security |
| Tunnel | VPN/WireGuard | /api/vpn |
| Zest | Utility/Adapter | /api/utility |
| Fondue | Settings/Logs | /api/settings |
| Sourdough | Auth | /api/auth |
| Taffy | IPTV/M3U/EPG | /api/iptv |
| Churro | qBittorrent | /api/gadgets/qbit |
| Saffron | Subtitles | /api/subs |
| Pantry | Filesystem | /api/files |
| Nutmeg | System Stats | /api/system |
| Crumbs | API Management | /api/crumbs |
| Fortress | Code Protection | /api/fortress |
| Custard | Media Bridge | /api/gadgets/media-bridge |
| Ripen | Plugin Manager | /api/ripen |

### Gadgets
| Codename | Gadget | Route |
|----------|--------|-------|
| Sorbet | Weather | /api/gadgets/weather |
| Brioche | Podcasts | /api/gadgets/podcasts |
| Nectar | Internet Radio | /api/gadgets/radio |
| Ganache | Photo Gallery | /api/gadgets/photos |
| Bisque | Web Video | /api/gadgets/webvideo |
| Marzipan | Matrix Chat | /api/gadgets/matrix |
| Cinnamon | Synapse Admin | /api/gadgets/synapse |
| Waffle | Movie Quiz | /api/gadgets/gamebot |
| Yeast | Background Automation | /api/gadgets/bot |

### New Features (v2.7.3)
| Codename | Feature | Route | Status |
|----------|---------|-------|--------|
| Truffle | Watch Analytics & Year Wrapped | /api/truffle | Active |
| Pepper | Notification Hub (Discord/Telegram/Slack/Pushover) | /api/pepper | Active |
| Meringue | User Request System | /api/meringue | Active |
| Rind | Parental Controls | /api/rind | Active |
| Crucible | Media Processing Pipeline (FFmpeg) | /api/crucible | Active |
| Brine | Usenet Indexer (Prowlarr/Newznab) | /api/gadgets/brine | Active |
| Ladle | Usenet Downloader (SABnzbd) | /api/gadgets/ladle | Active |

## Backlog (Codenames Assigned)

### P1 — Next Up
| Codename | Feature | Description |
|----------|---------|-------------|
| Glaze | Trakt + Last.fm Scrobbling | Sync watch/listen history to external tracking |
| Roux | Collections & Smart Playlists | Dynamic auto-generated collections with overlay badges |
| Simmer | Scheduled Tasks Engine | User-configurable cron with visual scheduler UI |

### P2 — Strong Differentiators
| Codename | Feature | Description |
|----------|---------|-------------|
| Sprout | RSS Feed Generator | Publish/subscribe RSS feeds for library additions |
| Biscotti | Ebook/Audiobook/Comics | OPDS server, chapter tracking, manga support |
| Treacle | Music Library & Player | Full music library with playlists, gapless playback |

### P3 — Future
| Codename | Feature | Description |
|----------|---------|-------------|
| Sage | AI Metadata & Recommendations | Local LLM auto-tagging, smart recommendations |
| Terrine | Live TV DVR | EPG recording, timeshift, commercial skip |
| Popsicle | Offline Sync / Mobile | Download for offline viewing, device transcoding |
| Preserves | S3/Cloud Backup | One-click metadata backup to S3/Backblaze/NAS |
| Marshmallow | Cloud Sync | Re-implement cloud sync on .NET stack |

## Testing Status
- iteration_10: 34/34 tests passed (100%) — all 5 new features
- iteration_9: 11/11 tests passed — Jellyfin removal verification
- Zero Jellyfin references in any source, docs, or API response

## Credentials
- Source: admin@watchnexus.local / admin (seeded if no users)
- Alpha: admin@watchnexus.ca / password123, admin@friendlymedia.net / password123
- Test: test@test.com / password

## Release Packages
- Main: `/app/release_builds/` (linux-x64 + win-x64, self-contained)
- Alpha: `/app/Alpha/release_builds/` (linux-x64 + win-x64, self-contained)

## Architecture
- Dev: Python FastAPI proxy (8001) → C# WatchNexus server (8002)
- Release: C# server directly on 8001 (no proxy)
- DB: SQLite with EF Core Migrations
- Modules: 10 separated DLLs loaded dynamically at startup

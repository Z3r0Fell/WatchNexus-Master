# WatchNexus - Product Requirements Document

## Overview
WatchNexus is a self-hosted media pipeline application (C#/.NET 10 + React) modeled after Jellyfin/Emby with full *arr ecosystem integration. It manages personal media libraries with TMDB metadata, torrenting, streaming, and a comprehensive set of 33 active modules.

## Current Version: 2.8.3

## Architecture
- **Backend**: C#/.NET 10, ASP.NET Core, EF Core + SQLite
- **Frontend**: React (Create React App), served as static files via Kestrel
- **Proxy**: FastAPI proxy on port 8001 → .NET backend on port 8002
- **Build**: Self-contained single-file executables for Windows and Linux

## Module Registry (33 Active Modules)

### Core Modules
| Codename | Name | Description |
|----------|------|-------------|
| marmalade | Media Server | Libraries, scanning, streaming |
| bastion | Advanced Auth | LDAP, SSO, 2FA, session management |
| tunnel | Network Config | Reverse proxy, UPnP, SSL, dynamic DNS |
| fondue | Movie Automation | Auto-grab, monitor, upgrade (Radarr-like) |
| sourdough | Backup & Restore | Snapshots, config export/import |
| taffy | Metadata Agents | TMDB, TVDB, IMDb, MusicBrainz |
| churro | Download Clients | qBittorrent, SABnzbd, Transmission |
| saffron | Scheduled Tasks | Library scans, metadata refresh, cleanup |
| pantry | Storage Manager | Disk monitoring, path mappings |
| nutmeg | Recommendations | AI-powered picks from TMDB |
| crumbs | API Management | Third-party integration keys |
| fortress | Security | Code protection, obfuscation |
| zest | Health Monitor | Logs, system health |
| glaze | Scrobbling | Trakt.tv + Last.fm integration |
| setup | Setup Wizard | First-run configuration |

### Gadget Modules
| Codename | Name | Route |
|----------|------|-------|
| sorbet | Weather | /api/gadgets/weather |
| brioche | Podcasts | /api/gadgets/podcasts |
| nectar | Internet Radio | /api/gadgets/radio |
| ganache | Photo Gallery | /api/gadgets/photos |
| bisque | Web Video | /api/gadgets/webvideo |
| marzipan | Playlists/Collections | /api/marzipan |
| cinnamon | Synapse Admin | /api/gadgets/synapse-admin |
| waffle | Movie Quiz | /api/gadgets/gamebot |
| custard | Media Bridge | /api/gadgets/media-bridge |
| yeast | Background Bot | /api/gadgets/bot |

### Analytics & Social
| Codename | Name |
|----------|------|
| truffle | Watch Analytics |
| pepper | Notification Hub |
| meringue | User Requests |
| rind | Parental Controls |
| crucible | Media Processing |
| brine | Usenet Indexer |
| ladle | Usenet Downloader |
| ripen | Plugin Marketplace |

## Verification Status
- **136/136 endpoints passing** (comprehensive curl audit)
- **32/32 codename status endpoints** resolving correctly
- **33 modules** reported active in system info
- **28 plugins** listed in gadget catalogue
- **Frontend: 100%** pass rate on testing agent
- **TMDB integration**: Trending, Search, Discover, poster generation all working
- **Poster generation**: Both LibrariesController and MarmaladeBridgeController scan paths fetch TMDB metadata
- **Tray icon**: Fully wired (Stop/Restart/Preferences/Quit all functional)
- **Alpha builds**: Available at /app/release_builds/

## Alpha Build Credentials
- Email: admin@watchnexus.local
- Password: admin

## Upcoming Tasks (P1)
- Glaze deeper integration (actual Trakt OAuth flow)
- Roux — Collections & Smart Playlists (deeper implementation)
- Simmer/Saffron — Execute scheduled tasks (currently task definitions only)

## Future Tasks (P2)
- Sprout (RSS Feed Generator)
- Biscotti (Ebook/Audiobook/Comics Support)
- Treacle (Music Library & Player)
- Sage (AI Metadata & Recommendations)
- Terrine (Live TV DVR)
- Popsicle (Offline Sync / Mobile)
- Preserves (S3/Cloud Backup)
- Marshmallow Cloud Sync

## Key Files
- `/app/src/watchnexus/core/Controllers/CoreModuleControllers.cs` — 9 new core modules
- `/app/src/watchnexus/core/Controllers/CodeNameAliasControllers.cs` — Aliases + Setup + Glaze + Playlists
- `/app/src/watchnexus/core/Controllers/SystemController.cs` — System info with 33 modules
- `/app/src/watchnexus/core/Controllers/FeatureControllers.cs` — 28-plugin catalogue
- `/app/release_builds/` — Alpha builds

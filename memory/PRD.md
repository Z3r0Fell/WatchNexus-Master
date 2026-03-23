# WatchNexus - Product Requirements Document

## Overview
WatchNexus is a self-hosted media management pipeline combining features from Jellyfin and the *arr ecosystem into a unified platform. It uses a C#/.NET 10 backend with React frontend.

## Current Version: 2.8.3

## Architecture
- **Backend**: C#/.NET 10 (ASP.NET Core) on port 8002
- **Proxy**: FastAPI on port 8001 (forwards /api/* to .NET backend)
- **Frontend**: React (CRA) on port 3000
- **Database**: SQLite via Entity Framework Core
- **Auth**: JWT-based (admin@watchnexus.local / admin)

## Module Codenames & Status

### Core Media (Active)
| Module | Codename | Status | Description |
|--------|----------|--------|-------------|
| Libraries | marmalade | Active | Media library management, TV grouping |
| Media Server | media | Active | Streaming, transcoding |
| Content Discovery | content | Active | TMDB integration, search, trending |
| Downloads | crucible | Active | Download processing pipeline |

### Newly Implemented P1 Modules (Active)
| Module | Codename | Status | Description |
|--------|----------|--------|-------------|
| Scrobbling | glaze | Active | Trakt.tv & Last.fm integration |
| Scheduled Tasks | saffron | Active | Library scans, metadata refresh, cleanup |
| Movie Automation | fondue | Active | Radarr-like movie monitoring & auto-grab |
| Backup & Restore | sourdough | Active | Config backups, scheduled backups |
| Download Clients | churro | Active | Torrent/Usenet client management |
| Collections | roux | Active | Smart & manual collections, presets |
| RSS Feeds | sprout | Active | RSS/Atom feed generator for library |

### Scaffolded Modules (Placeholder)
| Module | Codename | Status | Description |
|--------|----------|--------|-------------|
| Advanced Auth | bastion | Placeholder | LDAP, 2FA |
| VPN | tunnel | Placeholder | VPN portal |
| Subtitles | taffy | Placeholder | Multi-language subtitles |
| Path Management | pantry | Placeholder | Storage path mappings |
| Recommendations | nutmeg | Placeholder | AI-powered suggestions |

### Future Modules (Not Started)
- Biscotti (Ebook/Audiobook/Comics)
- Treacle (Music Library & Player)
- Sage (AI Metadata & Recommendations)
- Terrine (Live TV DVR)
- Popsicle (Offline Sync / Mobile)
- Preserves (S3/Cloud Backup)
- Marshmallow (Cloud Sync)

## Key Files
- `/app/src/watchnexus/core/Controllers/` - All backend controllers
- `/app/frontend/src/pages/` - All frontend pages
- `/app/frontend/src/components/layout/Sidebar.js` - Navigation
- `/app/frontend/src/App.js` - Router configuration

## Bug Fixes Completed
1. Gadgets tab populated (GadgetsCatalogueController.cs)
2. YTS indexer URL updated (MediaControllers.cs)
3. Theme tab functional (FeatureControllers.cs)
4. TV shows grouped by Series > Season > Episode (BridgeController.cs)
5. AppSetting UserId composite key fix (all controllers)

## API Endpoints
- Auth: POST /api/auth/login
- System: GET /api/system/info
- Libraries: GET /api/marmalade/tv-series, /api/marmalade/media/recent
- Roux: GET/POST /api/roux/collections, GET /api/roux/presets, POST /api/roux/filter
- Sprout: GET/PUT /api/sprout/config, GET /api/sprout/feeds, POST /api/sprout/generate-key, GET /api/sprout/feed/{type}
- Glaze: GET/PUT /api/glaze/config, POST /api/glaze/trakt/sync
- Saffron: GET /api/saffron/tasks, POST /api/saffron/tasks/{id}/run
- Fondue: GET /api/fondue/movies, GET /api/fondue/queue, GET /api/fondue/config
- Sourdough: GET /api/sourdough/backups, POST /api/sourdough/backup, GET /api/sourdough/config/export
- Churro: GET /api/churro/clients, POST /api/churro/clients/{id}/test

## Known Issues
- .NET SDK not persistent across environment restarts (workaround: reinstall + restart supervisor)
- RSS feed URLs show internal hostname (expected in preview; correct in production)

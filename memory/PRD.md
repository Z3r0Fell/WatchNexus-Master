# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Migrated from .NET 8 to .NET 10. All features must be fully functional with real-world APIs (no stubs). A "Crumbs" module provides centralized API management. The system includes native C# ports of Matrix/Jellyfin bot automation. Architecture supports EF Core Migrations, dynamic module loading, and Fortress code protection. Every component has a codename following a food/kitchen/pantry theme.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Image Processing:** SixLabors.ImageSharp 3.1.12
- **External APIs:** Open-Meteo, Radio Browser, iTunes Search, TMDB, OMDB, Matrix CS API, Jellyfin API, Synapse Admin API

## Current Version: 2.7.3

## Complete Codename Directory (28 components)

### Modules (10 — separated DLLs)
| Component | Codename |
|---|---|
| Media Library | Marmalade |
| Security | Bastion |
| VPN Portal | Tunnel |
| Downloads | Fondue |
| Playlists | Drizzle |
| Indexers | Compote |
| Transcoding | Gelatin |
| Log Viewer | Zest |
| Scrapers | Syrup |
| System Tray | Beacon |

### Gadgets (10 — built-in)
| Component | Codename |
|---|---|
| Weather | Sorbet |
| Podcasts | Brioche |
| Internet Radio | Nectar |
| Photo Gallery | Ganache |
| Web Video | Bisque |
| Matrix Chat | Marzipan |
| Jellyfin Bridge | Praline |
| Synapse Admin | Cinnamon |
| Movie Quiz | Waffle |
| Background Automation | Yeast |

### Core Controllers (6)
| Component | Codename |
|---|---|
| Auth | Sourdough |
| IPTV | Taffy |
| qBittorrent | Churro |
| Subtitles | Saffron |
| Filesystem | Pantry |
| System Stats | Nutmeg |

### Infrastructure (4)
| Component | Codename |
|---|---|
| API Management | Crumbs |
| Code Protection | Fortress |
| Gadget Manager | Ripen |

## What's Been Implemented
- P0 EF Core Migrations (replace EnsureCreated with Database.Migrate)
- P1 Dynamic Module Loading (compile & load 10 separated modules from /app/separated/)
- P2 Fortress Code Protection (assembly integrity, anti-tampering, license validation, audit log)
- P3 Version bump to 2.7.3 across all files
- Complete codename directory (28 components, all named)
- Codename badges in frontend gadget settings UI
- Codenames exposed via /api/ripen/installed and /api/info endpoints
- Alpha build folder (/app/Alpha/) with 2.7.3-alpha tagged releases
- Release builds for Windows x64 and Linux x64 (self-contained)
- Crumbs API Management (11 services)
- Controller Refactoring (monolith split into 12+ files)
- Matrix/Jellyfin Bot System (C# ports)
- Gadget proper names, icons, categories, descriptions (10 gadgets)
- Toggle activate/deactivate with DB persistence
- Library CRUD (add/scan/delete via /api/marmalade/libraries)

## Testing Status
- iteration_8: 12/12 backend + all frontend = 100% (v2.7.3 P0-P3)

## Backlog
### P1
- [ ] Re-implement "Marshmallow" (Cloud Sync) on .NET stack

### P2
- [ ] Subtitle download integrations
- [ ] Docker container support
- [ ] Browse Catalogue UI improvements

## Credentials
- Email: test@test.com | Password: password

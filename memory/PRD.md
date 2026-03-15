# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Migrated from .NET 8 to .NET 10. All features must be fully functional with real-world APIs (no stubs). A "Crumbs" module provides centralized API management. The system includes native C# ports of Matrix/Jellyfin bot automation. Architecture supports EF Core Migrations, dynamic module loading, and Fortress code protection.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Image Processing:** SixLabors.ImageSharp 3.1.12
- **External APIs:** Open-Meteo, Radio Browser, iTunes Search, TMDB, OMDB, Matrix CS API, Jellyfin API, Synapse Admin API

## Current Version: 2.7.3

## What's Been Implemented
- P0 EF Core Migrations (replace EnsureCreated with Database.Migrate)
- P1 Dynamic Module Loading (compile & load 10 separated modules from /app/separated/)
- P2 Fortress Code Protection (assembly integrity, anti-tampering, license validation, audit log)
- P3 Version bump to 2.7.3 across all files
- Release builds for Windows x64 and Linux x64 (self-contained)
- Crumbs API Management (11 services)
- Controller Refactoring (monolith split into 12+ files)
- Matrix/Jellyfin Bot System (C# ports)
- Gadget proper names, icons, categories, descriptions (10 gadgets)
- Toggle activate/deactivate with DB persistence
- Library CRUD (add/scan/delete via /api/marmalade/libraries)

## Fortress Endpoints
- `GET /api/fortress/status` — Security status, assembly count, license info
- `POST /api/fortress/verify` — Manual integrity re-check of all assemblies
- `GET /api/fortress/audit` — Security event log (?limit=50&offset=0)
- `GET /api/fortress/audit/export` — Full audit log as JSON download

## Testing Status
- iteration_4: 24/24 = 100%
- iteration_5: 31/31 = 100%
- iteration_6: 14/14 = 100%
- iteration_7: 14/14 = 100%
- iteration_8: 12/12 backend + all frontend = 100% (v2.7.3 P0-P3)

## Architecture
- 20 modules: 10 built-in + 10 separated (compiled at startup)
- Fortress tracks 12 assemblies with SHA-256 baselines
- EF Core Migrations for versioned schema management
- Isolated AssemblyLoadContext per dynamically loaded module

## Release Builds
- `/app/release_builds/watchnexus-2.7.3-win-x64.tar.gz` (229M, self-contained)
- `/app/release_builds/watchnexus-2.7.3-linux-x64.tar.gz` (229M, self-contained)

## Backlog
### P1
- [ ] Re-implement "Marshmallow" (Cloud Sync) on .NET stack

### P2
- [ ] Subtitle download integrations
- [ ] Docker container support
- [ ] Browse Catalogue UI improvements (gadget tiles show placeholder)

## Credentials
- Email: test@test.com | Password: password

# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Migrated from .NET 8 to .NET 10. All features must be fully functional with real-world APIs (no stubs). A "Crumbs" module provides centralized API management. The system includes native C# ports of Matrix/Jellyfin bot automation.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Image Processing:** SixLabors.ImageSharp 3.1.12
- **External APIs:** Open-Meteo, Radio Browser, iTunes Search, TMDB, OMDB, Matrix CS API, Jellyfin API, Synapse Admin API

## What's Been Implemented
- P0 Crumbs API Management (11 services, no Jellyfin)
- P1 Controller Refactoring (monolith split into 12+ files)
- Matrix/Jellyfin Bot System (C# ports)
- Release Builds (Windows x64, Arch Linux x64)
- Gadget proper names, icons, categories, descriptions (10 gadgets)
- Toggle activate/deactivate with DB persistence
- Library CRUD (add/scan/delete via /api/marmalade/libraries)
- Settings sidebar: "Users" (not "Users & Access")
- Jellyfin removed from API Management Crumbs

## Testing Status
- iteration_4: 24/24 = 100%
- iteration_5: 31/31 = 100%
- iteration_6: 14/14 = 100%
- iteration_7: 14/14 = 100% (gadget names/icons/toggles, no Jellyfin in Crumbs)

## Backlog
### P1
- [ ] EF Core Migrations (replace EnsureCreated)
- [ ] Full Module Separation & Dynamic Loading

### P2
- [ ] Re-implement "Marshmallow" (Cloud Sync) and "Fortress" (Code Protection)
- [ ] Subtitle download integrations
- [ ] Docker container support

## Credentials
- Email: test@test.com | Password: password

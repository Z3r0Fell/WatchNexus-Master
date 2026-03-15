# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Migrated from .NET 8 to .NET 10. All features must be fully functional with real-world APIs (no stubs). A "Crumbs" module provides centralized API management. The system includes native C# ports of Matrix/Jellyfin bot automation.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Image Processing:** SixLabors.ImageSharp 3.1.12
- **External APIs:** Open-Meteo, Radio Browser, iTunes Search, TMDB, OMDB, Matrix CS API, Jellyfin API, Synapse Admin API

## Core Requirements
- All features fully functional, no stubs
- Centralized API key management (Crumbs module — 11 services, no Jellyfin)
- Native C# ports of Python maubot system
- Release builds for Windows x64 and Arch Linux x64
- QA link: https://z3r0fell.github.io/watchnexus-qa/

## What's Been Implemented
### P0 - Crumbs API Management (COMPLETED)
- 11 services: TMDB, OpenSubtitles, Addic7ed, Subscene, Podnapisi, YIFY, qBittorrent, OpenWeatherMap, Matrix, Synapse Admin, OMDB
- Frontend CrumbsSettings.jsx with categorized list, editor, test/save/delete

### P1 - Controller Refactoring (COMPLETED)
- Split 1970-line monolith into 12+ individual controller files

### Matrix/Jellyfin Bot System (COMPLETED)
- MatrixController, JellyfinController, SynapseAdminController, GameBotController, BotBackgroundService, BotController

### Release Builds (COMPLETED)
- Windows x64 + Arch Linux x64 packages

### User-Requested Fixes (2026-03-15)
- Settings > "Users & Access" renamed to "Users"
- Library add/scan/delete fully working via /api/marmalade/libraries (POST with query params, DELETE, scan)
- Gadgets have proper names, descriptions, icons (plugin_type + category fields)
- Jellyfin removed from Crumbs API Management Gadgets section

### Testing
- iteration_4: 24/24 = 100%
- iteration_5: 31/31 = 100%
- iteration_6: 14/14 = 100% (all 4 user fixes verified)

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
- TMDB API Key: 8c860bcb88494f598008480abfe24d13

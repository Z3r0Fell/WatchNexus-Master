# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Migrated from .NET 8 to .NET 10. All features must be fully functional with real-world APIs (no stubs). Every component has a codename following a food/kitchen/pantry theme.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Dev Proxy:** Python FastAPI reverse proxy (port 8001 → C# server port 8002)

## Current Version: 2.7.3

## What's Been Implemented
- P0 EF Core Migrations (Database.Migrate on startup)
- P1 Dynamic Module Loading (10 separated modules compiled at startup)
- P2 Fortress Code Protection (integrity, anti-tampering, license, audit log)
- P3 Version bump to 2.7.3
- All 28+ components have codenames
- Account seeding on startup (default admin for source, hardcoded alpha testers for Alpha)
- Alpha build with pre-seeded accounts: admin@watchnexus.ca, admin@friendlymedia.net (password123)
- Registration and login verified working
- Release builds for Linux x64 (framework-dependent)
- **Jellyfin Removal Complete**: All references replaced with "Media Bridge" (codename: Custard)
  - MediaBridgeController at /api/gadgets/media-bridge/*
  - Full Emby-compatible media server proxy retained
  - Zero Jellyfin references in any source, docs, or API response

## Alpha Build
- Location: `/app/Alpha/`
- Pre-seeded accounts: admin@watchnexus.ca, admin@friendlymedia.net (password123, admin role)
- All versions tagged 2.7.3-alpha
- Release package: `/app/Alpha/release_builds/watchnexus-2.7.3-alpha-linux-x64.tar.gz`

## Testing Status
- iteration_9: 11/11 tests passed (100%) - Jellyfin removal verification
- iteration_7-8: Previous sessions 100% pass
- Registration: verified via curl
- Login: verified via curl
- Global Jellyfin scan: 0 references across 11 endpoints

## Backlog
### P1
- [ ] Re-implement "Marshmallow" (Cloud Sync) on .NET stack

### P2
- [ ] Subtitle download integrations
- [ ] Docker container support
- [ ] Browse Catalogue UI improvements

## Credentials
- Source: admin@watchnexus.local / admin (seeded if no users exist)
- Alpha: admin@watchnexus.ca / password123, admin@friendlymedia.net / password123
- Test: test@test.com / password

## Architecture Notes
- Dev environment: Python FastAPI proxy (8001) → C# WatchNexus server (8002)
- Release builds: C# server directly on port 8001 (no proxy needed)
- Release packages: `/app/release_builds/` (main), `/app/Alpha/release_builds/` (alpha)

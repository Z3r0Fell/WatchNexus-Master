# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus". Migrated from .NET 8 to .NET 10. All features must be fully functional with real-world APIs (no stubs). Every component has a codename following a food/kitchen/pantry theme.

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens

## Current Version: 2.7.3

## What's Been Implemented
- P0 EF Core Migrations (Database.Migrate on startup)
- P1 Dynamic Module Loading (10 separated modules compiled at startup)
- P2 Fortress Code Protection (integrity, anti-tampering, license, audit log)
- P3 Version bump to 2.7.3
- All 28 components have codenames
- Account seeding on startup (default admin for source, hardcoded alpha testers for Alpha)
- Alpha build with pre-seeded accounts: admin@watchnexus.ca, admin@friendlymedia.net (password123)
- Registration and login verified working
- Release builds for Windows x64 and Linux x64

## Alpha Build
- Location: `/app/Alpha/`
- Pre-seeded accounts: admin@watchnexus.ca, admin@friendlymedia.net (password123, admin role)
- All versions tagged 2.7.3-alpha

## Testing Status
- iteration_8: 100% pass rate
- Registration: verified via curl + browser screenshot
- Login: verified via curl

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

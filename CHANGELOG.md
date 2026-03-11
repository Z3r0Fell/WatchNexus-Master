# WatchNexus Changelog

## v3.0.0-beta (March 11, 2026)

### BREAKING: Full C#/.NET 10 Migration
- **Replaced entire Python/FastAPI backend** with C#/.NET 10 ASP.NET Core
- Entity Framework Core 10 with SQLite database
- JWT Bearer authentication via Microsoft.AspNetCore.Authentication.JwtBearer
- All API endpoints ported and verified (25/25 tests passed)

### Unified Modular Architecture
- Created `watchnexus/` unified project structure
- `core/` - Main C# server with controllers, auth, DB
- `shared/` - IWatchNexusModule interface for plugin system
- `modules/` - Drop-in module directory with module.json manifests
- ModuleLoader: discovers and registers external .NET assembly modules
- 10 module manifests created (marmalade, bastion, tunnel, zest, fondue, drizzle, compote, gelatin, syrup, beacon)

### New Features
- **Netflix-style Media Browser** (`/browse`): Poster grid with TMDB art, search, detail modal with backdrop/overview/genres
- **Dashboard API** (`/api/dashboard`): Stats, recent media
- **Preferences API** (`/api/preferences`): User settings persistence
- **Marmalade Bridge** (`/api/marmalade/*`): Legacy endpoint compatibility

### Clean Database
- Production database wiped clean for v3.0.0-beta release
- No test data - fresh start

### Installers Updated for .NET
- Docker: Multi-stage build with dotnet SDK + aspnet runtime
- Linux: .NET 10 runtime installer with prerequisite checks
- Windows: .NET 10 runtime check + dotnet publish with prerequisite checks
- macOS: .NET 10 + .app bundle
- Unraid: Docker template

### File Cleanup
- Removed legacy Python capture/marketing scripts
- Removed duplicate /app/src/web, /app/src/dotnet directories
- Disabled broken dotnet supervisor entry
- Cleaned root directory

## v2.8.0 (March 11, 2026)
- TMDB integration, qBittorrent settings, library scanning
- Security module (Bastion), VPN module (Tunnel)
- Background scan jobs, system info endpoint
- Platform installers (Docker, Linux, Windows, macOS, Unraid)

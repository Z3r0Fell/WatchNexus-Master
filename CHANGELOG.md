# WatchNexus Changelog

## v2.6.5 (March 12, 2026)

### Auto-Start Service Registration
- **Linux:** systemd service (`watchnexus.service`) enabled at boot via `multi-user.target`
- **macOS:** LaunchDaemon (`ca.watchnexus.server.plist`) starts WatchNexus at system boot, before login
- **Windows:** Scheduled Task runs at startup under current user, with auto-restart on failure
- **Docker:** `restart: unless-stopped` ensures container survives reboots
- All platforms: service auto-recovers after power failure or unexpected shutdown

### .NET 10 Upgrade
- All C# projects target `net10.0`
- NuGet packages updated: EF Core 10.0.4, JwtBearer 10.0.4, OpenApi 10.0.4, Swashbuckle 10.1.5

### Installer Enhancements
- All platform installers now include prerequisite detection with clear status table
- Interactive prompts to auto-install missing dependencies
- Version unified to 2.6.5 across all platforms

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

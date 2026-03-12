# WatchNexus v2.6.5

> Unified, self-hosted media pipeline built with C#/.NET 10.

## Architecture

WatchNexus is a **unified modular monolith** — a single application with independently updateable modules.

```
watchnexus/
├── core/                    # C#/.NET 10 server (entry point)
│   ├── Program.cs          # Bootstrap, DI, middleware
│   ├── Auth/               # JWT authentication
│   ├── Controllers/        # API controllers (Core, Libraries, Security, VPN, Settings, Logs)
│   ├── Data/               # EF Core DbContext, entities
│   └── ModuleLoader.cs     # Dynamic module discovery
│
├── shared/                  # Shared interfaces & base types
│   └── Module.cs           # IWatchNexusModule interface
│
├── modules/                 # Self-contained modules (drop-in)
│   ├── marmalade/          # Library Manager - TMDB metadata scanning
│   ├── bastion/            # Security - audit, IP rules, API keys
│   ├── tunnel/             # VPN - WireGuard management
│   ├── zest/               # Log Viewer - diagnostics
│   ├── fondue/             # Downloads - qBittorrent integration
│   ├── drizzle/            # Playlists - queue engine
│   ├── compote/            # Indexers - torrent search
│   ├── gelatin/            # Transcoding - media conversion
│   ├── syrup/              # Scrapers - live content
│   └── beacon/             # System tray - desktop app
│
└── web/                     # React frontend (SPA)
    └── src/
        ├── pages/           # All page components
        ├── components/      # Reusable UI (Shadcn)
        └── services/        # API client layer
```

## Module System

Each module is a self-contained unit with a `module.json` manifest:

```json
{
  "name": "Marmalade",
  "codename": "marmalade",
  "version": "2.6.5",
  "description": "Media library scanning with TMDB metadata",
  "dependencies": ["core"]
}
```

**To add/update a module:** Drop the module folder into `modules/`, restart WatchNexus.
**To remove:** Delete the module folder.

## Quick Start

### From Source
```bash
cd watchnexus/core
dotnet run
# Dashboard: http://localhost:8001
```

### Docker
```bash
cd installers/docker
docker compose up -d
```

## Tech Stack
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Framer Motion, Shadcn UI
- **Auth:** JWT Bearer Tokens
- **Metadata:** TMDB API v3

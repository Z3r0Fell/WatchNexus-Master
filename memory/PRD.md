# WatchNexus - Product Requirements Document

## Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" with modular architecture where each module can be independently developed, updated, and released.

## Architecture (v2.6.5)
- **Backend:** C#/.NET 10, ASP.NET Core, Entity Framework Core 10, SQLite
- **Frontend:** React 18, TailwindCSS, Shadcn UI, Framer Motion
- **Auth:** JWT Bearer Tokens
- **Structure:** Modular monolith with separated module projects

```
src/
├── watchnexus/        # C#/.NET 10 backend
│   ├── core/          # ASP.NET Core server
│   ├── shared/        # Shared interfaces
│   └── modules/       # Module manifests
└── web/               # React SPA frontend

separated/             # Standalone buildable module projects
├── bastion/           # Security (full code)
├── tunnel/            # VPN Portal (full code)
├── marmalade/         # Library Manager (full code)
├── zest/              # Log Viewer (full code)
├── fondue/            # Downloads (full code)
├── drizzle/           # Playlists (stub)
├── compote/           # Indexers (stub)
├── gelatin/           # Transcoding (stub)
├── syrup/             # Scrapers (stub)
└── beacon/            # System Tray (stub)
```

## What's Implemented (v2.6.5 — March 12, 2026)
- C#/.NET 10 backend with 5 built-in modules
- React frontend with all pages (marketplace, security, VPN, browse, libraries, etc.)
- Platform installers (Linux, macOS, Windows, Docker, Unraid) with auto-start service
- Separated module projects under /separated/ — each independently buildable
- Project screenshots in docs/images/
- Clean repo structure

## Remaining Backlog
- P1: qBittorrent C# client integration
- P1: EF Core Migrations
- P2: Cloud Sync ("Marshmallow") module
- P2: Code Protection ("Fortress") module
- P2: Native code-signed installers (MSIX, DMG)
- P2: WebSocket real-time updates

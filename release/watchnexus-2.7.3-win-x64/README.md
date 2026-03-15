# WatchNexus v2.7.3 - Windows Release

## Quick Start

1. Run `start-watchnexus.bat` (or double-click `WatchNexus.Core.exe`)
2. Open `http://localhost:8001` in your browser
3. Create an account and start using WatchNexus

## Install as Windows Service

Run PowerShell as Administrator:
```powershell
.\install-service.ps1
```
This registers WatchNexus as a system service that auto-starts on boot.

## What's New in 2.7.3

- **EF Core Migrations** — Versioned, incremental database schema management
- **Dynamic Module Loading** — Modules in `separated/` are compiled and loaded at startup
- **Fortress Security** — Assembly integrity verification, runtime anti-tampering, license validation
- **Fortress Audit Log** — All integrity checks logged with timestamps at `/api/fortress/audit`

## Fortress Security Endpoints

- `GET /api/fortress/status` — Current security status
- `POST /api/fortress/verify` — Manual integrity re-check
- `GET /api/fortress/audit` — Security event log (supports `?limit=50&offset=0`)
- `GET /api/fortress/audit/export` — Full audit log as JSON

## Configuration

- Default port: `8001` (set `ASPNETCORE_URLS` env var to change)
- Database: SQLite, stored in `data/watchnexus.db` next to the executable
- Fortress data: `data/fortress/` (config, baseline hashes, audit log)
- Modules: `modules/` (built-in manifests), `separated/` (dynamic modules)

## System Requirements

- Windows 10/11 or Windows Server 2019+
- 512MB RAM minimum, 1GB recommended
- No additional dependencies (self-contained .NET 10 build)

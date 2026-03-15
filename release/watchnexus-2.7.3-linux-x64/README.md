# WatchNexus v2.7.3 - Linux x64 Release

## Quick Install

```bash
sudo bash install.sh
```
This installs WatchNexus to `/opt/watchnexus` and registers a systemd service.

## Arch Linux (makepkg)

```bash
makepkg -si
```

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

## Usage

```bash
# Start/stop
sudo systemctl start watchnexus
sudo systemctl stop watchnexus

# View logs
journalctl -u watchnexus -f

# Access
http://localhost:8001
```

## Configuration

- Default port: `8001` (edit `/etc/systemd/system/watchnexus.service` to change)
- Database: SQLite at `/opt/watchnexus/data/watchnexus.db`
- Fortress data: `/opt/watchnexus/data/fortress/`
- Modules: `/opt/watchnexus/modules/` (built-in), `/opt/watchnexus/separated/` (dynamic)
- Self-contained binary — no .NET runtime required

## System Requirements

- x86_64 architecture
- 512MB RAM minimum, 1GB recommended
- glibc 2.17+ (any modern distro)

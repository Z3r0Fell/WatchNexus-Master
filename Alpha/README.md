# WatchNexus v2.8.4-alpha

Self-hosted media management pipeline with Jellyfin + *arr ecosystem features.

## Downloads

| Platform | File | Size |
|----------|------|------|
| Windows x64 | `WatchNexus-v2.8.4-win-x64.zip` | ~72MB |
| Linux x64 | `WatchNexus-v2.8.4-linux-x64.tar.gz` | ~58MB |

## Quick Start

### Windows
1. Extract WatchNexus-v2.8.4-win-x64.zip
2. Run `WatchNexus.Core.exe`
3. Open browser to `http://localhost:8002`
4. Login: `admin@watchnexus.local` / `admin`

### Linux
```bash
tar -xzf WatchNexus-v2.8.4-linux-x64.tar.gz
chmod +x WatchNexus.Core
./WatchNexus.Core
```

## What's New in v2.8.4

### Implemented Modules (P1)
- **Glaze** — Trakt.tv & Last.fm scrobbling with TOTP-signed OAuth
- **Saffron** — 8 scheduled tasks (library scan, metadata, cleanup, etc.)
- **Fondue** — Movie automation with monitoring, search, queue
- **Sourdough** — Backup & restore with scheduling, config export
- **Churro** — Download client management (torrent/usenet)
- **Roux** — Smart & manual collections with filter engine
- **Sprout** — RSS/Atom feed generator with API key auth

### Enhanced Modules
- **Bastion** — Real TOTP 2FA (Base32 secrets, backup codes, QR URIs), LDAP test, password policy, audit log, session tracking
- **Tunnel** — Real network detection, WireGuard peer management, SSL certificates, bandwidth monitoring, Dynamic DNS, Tailscale support

### Fixes
- All `CONFIGURE_ME` strings replaced with config-driven values
- `AppSetting` UserId composite key fix across all controllers
- Trakt/Last.fm auth now reads client credentials from saved config

### System Page Overhaul
- Shows Runtime (.NET version), OS, Architecture
- Server Details: hostname, CPU cores, memory, uptime
- Security Features grid (8 features)
- Full 35-module listing with codenames and versions

### Version
All banners, endpoints, and module manifests are tagged `2.8.4`.

## Modules (35 Total)
All modules report `active` status at their `/api/{codename}/status` endpoints.

| Module | Codename | Category |
|--------|----------|----------|
| Marmalade | marmalade | Library |
| Bastion | bastion | Auth |
| Tunnel | tunnel | Network |
| Zest | zest | Metadata |
| Fondue | fondue | Automation |
| Sorbet | sorbet | Media |
| Brioche | brioche | Playback |
| Nectar | nectar | Content |
| Ganache | ganache | Themes |
| Bisque | bisque | Search |
| Marzipan | marzipan | Sync |
| Cinnamon | cinnamon | Analytics |
| Waffle | waffle | Streaming |
| Yeast | yeast | Scheduling |
| Sourdough | sourdough | Backup |
| Taffy | taffy | Subtitles |
| Churro | churro | Downloads |
| Saffron | saffron | Tasks |
| Pantry | pantry | Storage |
| Nutmeg | nutmeg | AI |
| Crumbs | crumbs | Integration |
| Fortress | fortress | Security |
| Custard | custard | Users |
| Truffle | truffle | Analytics |
| Pepper | pepper | Notifications |
| Meringue | meringue | Requests |
| Rind | rind | Parental |
| Crucible | crucible | Processing |
| Brine | brine | Usenet |
| Ladle | ladle | Torrents |
| Ripen | ripen | Marketplace |
| Glaze | glaze | Scrobbling |
| Roux | roux | Collections |
| Sprout | sprout | RSS |
| Setup Wizard | setup | System |

## Configuration
- Default port: `8002`
- Default credentials: `admin@watchnexus.local` / `admin`
- TMDB API key: Set via Settings > Integrations

# WatchNexus Changelog

## 2026-03-24 - v2.8.4 (P1 Module Implementation + System Overhaul)

### New Modules (Full Implementation)
- **Roux** (Collections & Smart Playlists) — Backend + Frontend
  - Smart collections with auto-refresh
  - Manual collections with CRUD
  - 5 preset templates (Top Rated, New Releases, Unwatched, 4K, Short Films)
  - Filter engine for media queries
- **Sprout** (RSS Feed Generator) — Backend + Frontend
  - RSS 2.0 feed generation (Recent, Movies, TV Shows)
  - API key authentication for feed access
  - Configurable feed settings
- **Glaze** (Scrobbling) — Frontend page added
  - Trakt.tv OAuth flow with config-driven client IDs
  - Last.fm integration
  - Scrobble history viewer
- **Saffron** (Scheduled Tasks) — Frontend page added
  - 8 task types with Run/History
- **Fondue** (Movie Automation) — Frontend page added
  - Movie grid with posters
  - Queue monitoring, search
- **Sourdough** (Backup & Restore) — Frontend page added
  - Backup creation & config export
  - Scheduled backup configuration
- **Churro** (Download Clients) — Frontend page added
  - Client management with test/remove
  - Category display

### Enhanced Modules
- **Bastion** — Real TOTP 2FA (Base32 encoding, QR URI, 8 backup codes), LDAP test, password policy validation, audit log, session management with device detection
- **Tunnel** — Real network interface detection, WireGuard peer CRUD with key generation, SSL certificate management, bandwidth monitoring, Dynamic DNS, Tailscale support, connectivity testing with external IP detection

### System Page Overhaul
- Health cards: Status, Runtime, OS, Server Time (all populated)
- Server Details section: Hostname, Architecture, .NET Version, CPU Cores, Memory, Uptime, Platform, Module Count
- Security Features grid: 8 features (JWT, Password Hashing, Rate Limiting, CORS, 2FA, Sessions, IP Filtering, API Keys)
- Full module listing with codenames and versions

### Bug Fixes
- Fixed `CONFIGURE_ME` hardcoded strings in Glaze Trakt/Last.fm auth — now reads from saved config
- Fixed `AppSetting` UserId composite key across all controllers
- Version bumped from 2.8.3 to 2.8.4 across all 35 modules, services, and build outputs

### Sidebar Updates
- Added Collections, Automation to media nav
- Added Tasks, DL Clients, Backups, Scrobbling, RSS Feeds to settings sub-menu

---

## 2026-03-23 - v2.8.3 (Full Module Audit + Poster Fix)

### Critical Bug Fixes
- Fixed Gadgets catalogue returning empty list
- Fixed YTS indexer domain (.mx → .am)
- Fixed Theme Forge data structure mismatch
- Fixed TV show episodes not grouping by series/season

### Feature Scaffolding
- Added 19 placeholder controllers for core modules
- All 32 module status endpoints returning 200 OK

### API Audit
- Tested 136 backend endpoints
- Fixed route prefixes and response formats

---

## Earlier versions
- v2.8.2.1: Initial deep dive fixes
- v2.8.2: Auth and indexer fixes
- All modules updated from 2.8.2.1 to 2.8.3

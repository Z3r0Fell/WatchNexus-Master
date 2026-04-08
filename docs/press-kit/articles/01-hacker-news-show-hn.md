# Show HN: WatchNexus -- A self-hosted media pipeline with 35 modules, built on .NET 10 + React

**Target:** Hacker News (Show HN)  
**Format:** Text post  
**Word Count:** ~600 (HN prefers concise)

---

## Post Title

> Show HN: WatchNexus -- Self-hosted media pipeline replacing Sonarr + Radarr + Prowlarr + Jellyfin in one app

## Post Body

Hi HN,

I've been building WatchNexus for the past year and wanted to share it. It's a self-hosted media management pipeline that consolidates what typically requires 5-6 separate applications (Sonarr, Radarr, Prowlarr, qBittorrent, a media server) into a single binary with a unified interface.

**Tech stack:**
- Backend: C#/.NET 10 (ASP.NET Core), SQLite via EF Core 10
- Frontend: React 18, TailwindCSS, Shadcn UI
- Single binary deployment (58 MB Linux, 72 MB Windows), no runtime dependencies

**What it does:**

The core idea is that every feature is a first-class module with its own codename. There are 35 modules total:

- **Compote** -- Multi-indexer search engine. Parses RSS from Nyaa.si, YTS, EZTV, plus Torznab/Newznab standard. Quality detection (4K/1080p/720p), codec parsing (HEVC/x264/AV1), size normalization, magnet extraction. Not a wrapper around Jackett -- it does its own XML/JSON parsing with LINQ.

- **Bastion** -- Security center with real TOTP 2FA (Base32 secret generation, otpauth:// QR URIs, 8 backup codes), LDAP integration, IP filtering, API key management, audit logging, and session tracking with UA/device detection.

- **Tunnel** -- Built-in WireGuard VPN management. Peer CRUD with automatic key generation, SSL cert management, bandwidth monitoring, Dynamic DNS, Tailscale support.

- **Fondue** -- Radarr-style movie automation with quality profile matching and queue management.

- **Fortress** -- Assembly integrity verification. SHA-256 baseline computation at startup, periodic runtime tamper checks, auto-lockdown on detection.

All 35 modules share a single SQLite database, which eliminates the sync problems you get when running Sonarr + Radarr + Prowlarr separately. The composite key pattern is `(Key, UserId)` for settings, so multi-user configurations work without collision.

**Architecture decision I'm happy with:** Building on .NET 10 instead of the typical Node/Python stack for this space. The self-contained publish gives you a single binary with zero runtime dependencies. EF Core migrations handle schema versioning cleanly. The module controllers follow a standard pattern that made it straightforward to scaffold 35 of them without a plugin system adding indirection.

**Architecture decision I'd reconsider:** SQLite over Postgres. It's great for single-instance deployments (which is 95% of the use case), but it makes any future clustering story complicated.

The frontend is a standard React SPA with a dark theme. Nothing revolutionary there, but the sidebar navigation scales well to 35+ modules without becoming unwieldy.

**What's production-ready today:**
- Library scanning with TMDB metadata
- Multi-indexer search with real results
- Download management (qBittorrent integration + built-in engine)
- TOTP 2FA, JWT auth, session management
- WireGuard VPN management
- System health dashboard with 35-module status

**What's still in progress:**
- Hardware transcoding (QSV/NVENC)
- Skip intro/credits detection
- Native mobile apps (web-only for now)

Self-contained release builds are available for Linux x64 and Windows x64. Docker support is planned.

Happy to answer questions about the architecture, the module system design, or the indexer search implementation.

---

## Submission Notes
- Post between 9-11 AM EST on a weekday
- Don't use marketing language in the title
- Be prepared to answer technical architecture questions in comments
- Link to GitHub repo if public, or provide a demo URL

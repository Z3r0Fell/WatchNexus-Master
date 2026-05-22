# WatchNexus - Product Launch Copy

**Target:** Product Hunt, OpenHunts, BetaList, DevHunt, Indie Hackers  
**Format:** Varies by platform (see sections below)  
**Tone:** Enthusiastic, product-focused, accessible

---

## Product Hunt Launch

### Tagline (60 chars max)
> Self-hosted media pipeline that replaces 6 apps

### Description (260 chars max)
> WatchNexus unifies media search, downloads, library management, playback, VPN, and security into one self-hosted app. 35 modules, .NET 10 backend, React UI. One binary, zero dependencies. Replace your Sonarr + Radarr + Prowlarr + Jellyfin stack today.

### Maker Comment
Hey Product Hunt! I'm the creator of WatchNexus.

I got frustrated running 6-7 separate apps for my home media setup. Every server rebuild meant hours of reconfiguration. API keys between Sonarr, Radarr, and Prowlarr never worked right the first time. Updates broke cross-app communication.

So I built WatchNexus -- one application that handles the entire media pipeline:

**Search** -- The Compote module searches Nyaa.si, YTS, EZTV, and Torznab indexers simultaneously, with quality detection (4K/1080p/720p) and codec parsing (HEVC/x264/AV1).

**Download** -- Churro manages your torrent clients. Built-in download engine or integrate with qBittorrent.

**Organize** -- Marmalade scans your directories, fetches TMDB metadata, and organizes everything into libraries with poster art.

**Watch** -- Built-in video player with subtitle support and continue-watching across devices.

**Secure** -- Bastion provides real TOTP 2FA, audit logging, IP filtering, and API key management. Not the typical "just JWT" approach.

**Connect** -- Tunnel gives you built-in WireGuard VPN management. No more editing config files over SSH.

It's a 58 MB download for Linux, 72 MB for Windows. No runtime dependencies. Install in 2 minutes.

I'd love your feedback on what modules to prioritize next!

### First Comment (for engagement)
If anyone's curious about the technical architecture: it's C#/.NET 10 with 35 ASP.NET Core controllers (one per module), SQLite via EF Core 10, and a React 18 frontend with TailwindCSS and Shadcn UI. Happy to answer any questions!

### Topics/Categories
- Productivity
- Developer Tools
- Open Source
- Self-Hosted
- Media

### Screenshots to Include
1. Dashboard with hero banner and continue watching
2. Library page with poster art grid
3. Indexer search with results
4. System dashboard showing 35 modules
5. Security center with 2FA setup

---

## BetaList Submission

### Product Name
WatchNexus

### URL
[Your demo/landing page URL]

### One-liner
Self-hosted media pipeline with 35 modules -- replaces Sonarr, Radarr, Prowlarr, and Jellyfin in one app.

### Description
WatchNexus is a self-hosted media management pipeline that consolidates what typically requires 5-6 separate applications into a single binary. Search across multiple indexers, automate downloads, manage your library with TMDB metadata, and play content -- all with enterprise-grade security (TOTP 2FA, audit logging, WireGuard VPN).

Built on .NET 10 with a React frontend. 35 integrated modules. 58 MB self-contained binary for Linux. No runtime dependencies.

### Category
Developer Tools / Self-Hosted Software

---

## OpenHunts Submission

### Title
WatchNexus - Unified Self-Hosted Media Pipeline

### Short Description
One app. 35 modules. Replace your entire media stack: indexer search, download automation, library management, playback, VPN, and security. Built with .NET 10 + React. Self-contained binary, zero dependencies.

### Long Description
Setting up a self-hosted media system traditionally requires installing and configuring 5-7 separate applications that barely communicate with each other. WatchNexus changes this by providing a unified platform with 35 first-class modules:

**Core Modules:**
- Compote: Multi-indexer search engine (Nyaa.si, YTS, EZTV, Torznab)
- Fondue: Movie automation with quality profile matching
- Marmalade: Library management with TMDB metadata
- Churro: Download client management
- Bastion: Security center with TOTP 2FA, audit logging, session management
- Tunnel: WireGuard VPN management with peer CRUD

**Technical Highlights:**
- C#/.NET 10 backend, React 18 frontend
- SQLite database with Entity Framework Core 10
- Self-contained binaries (58 MB Linux, 72 MB Windows)
- 136 tested API endpoints
- JWT + TOTP 2FA authentication

**What makes it different:**
1. Single database eliminates sync issues between apps
2. Built-in WireGuard VPN (no separate VPN setup)
3. Real security (TOTP 2FA, not just passwords)
4. Assembly integrity verification (Fortress module)
5. One binary, zero dependencies

### Tags
self-hosted, media-server, .NET, react, open-source, homelab

---

## DevHunt Submission

### Title
WatchNexus

### Description
Self-hosted media pipeline consolidating 6+ apps into 35 modules. .NET 10 + React. Multi-indexer search, download automation, library management, TOTP 2FA, WireGuard VPN. One binary, zero dependencies.

### Category
Developer Tools

### GitHub URL
[Your GitHub URL]

---

## Indie Hackers Post

### Title
I replaced 6 self-hosted apps with one -- here's how I built WatchNexus

### Body

I've been running a self-hosted media server for years. My stack was:
- Sonarr (TV automation)
- Radarr (Movie automation)
- Prowlarr (Indexer management)
- qBittorrent (Downloads)
- Bazarr (Subtitles)
- Jellyfin (Playback)

Six apps. Six configurations. Six update cycles. Six potential points of failure.

Every time I rebuilt my server, it took 4-6 hours to get everything configured and talking to each other. The API key dance between Sonarr, Radarr, and Prowlarr was the worst part.

So I decided to build what I wished existed: **WatchNexus** -- a single application with 35 modules that handles the entire media lifecycle.

**The journey:**
- Started 18 months ago as a weekend project
- Chose .NET 10 for the self-contained binary story (58 MB, no runtime deps)
- React 18 + TailwindCSS + Shadcn UI for the frontend
- SQLite via EF Core 10 for zero-config database
- Currently at v2.9.0 with 136 API endpoints

**What makes it sticky (for me at least):**
1. **One database.** Sonarr and Radarr duplicating indexer configs is infuriating. In WatchNexus, indexer settings are configured once and shared across all modules.
2. **Real security.** TOTP 2FA with QR code setup and backup codes. Not just a JWT token and hope for the best.
3. **Built-in VPN.** WireGuard management from the web UI. No more SSHing to edit wg0.conf.

**Current status:**
- Library management: working
- Multi-indexer search: working (tested with 75 results from Nyaa.si)
- Download management: working
- 2FA: working
- VPN management: working
- Hardware transcoding: not yet

**What's next:**
- Docker image publication
- Hardware transcoding (QSV/NVENC)
- Mobile-optimized views
- Community plugin SDK

Would love feedback from other self-hosters. What would convince you to switch from your current stack?

---

## Submission Notes
- **Product Hunt**: Schedule launch for Tuesday-Thursday, 12:01 AM PST. Have 5+ hunters ready.
- **BetaList**: Free submission, focuses on waitlist building. Good for pre-launch validation.
- **OpenHunts**: Evergreen listing, great SEO. 14.3% conversion rate reported.
- **DevHunt**: Dev-focused. Upvote-based ranking for 1 week on homepage.
- **Indie Hackers**: Post in "Show IH" section. Be personal and transparent about the journey.
- For all platforms: Prepare an animated GIF showing the search -> results -> grab flow.

# WatchNexus: One App to Replace Your Entire Media Stack

**Target:** r/selfhosted, r/homelab, r/datahoarder, r/mediaserver  
**Format:** Reddit text post with markdown  
**Word Count:** ~1,200  
**Tone:** Enthusiast, conversational, transparent

---

## Post Title

> I built a single self-hosted app that replaces Sonarr + Radarr + Prowlarr + qBittorrent + Jellyfin. Here's what 18 months of development looks like.

## Post Body

**TL;DR:** WatchNexus is a self-hosted media pipeline -- one app, 35 modules, handles everything from indexer search to playback. .NET 10 backend, React frontend, SQLite database. 58 MB binary, runs on Linux x64 and Windows. No Docker required (but Docker support coming).

---

### The Problem I Got Tired Of

My self-hosted media stack looked like this:

| Service | Purpose | RAM Usage |
|---------|---------|-----------|
| Sonarr | TV show automation | ~200 MB |
| Radarr | Movie automation | ~200 MB |
| Prowlarr | Indexer management | ~150 MB |
| qBittorrent | Downloads | ~100 MB |
| Bazarr | Subtitles | ~150 MB |
| Jellyfin | Playback | ~500 MB |
| Overseerr | Requests | ~200 MB |

**Total: 7 apps, 7 configs, 7 update cycles, ~1.5 GB RAM**

Every time I set this up on a new machine, it took 4-6 hours. Getting all the API keys cross-configured between Sonarr, Radarr, and Prowlarr was always the worst part. And syncing settings across them? Forget it.

### What WatchNexus Does Differently

Everything runs in a single process with a shared database. Here's how the modules map:

| Replaces | WatchNexus Module | Codename |
|----------|------------------|----------|
| Sonarr | TV Automation | Saffron |
| Radarr | Movie Automation | Fondue |
| Prowlarr | Indexer Search | Compote |
| qBittorrent | Download Engine | Churro |
| Bazarr | Subtitles | Saffron |
| Jellyfin | Library + Playback | Marmalade |
| Overseerr | Request Management | Requests |
| Tautulli | Analytics | Analytics |

Plus 27 more modules for things like VPN management (WireGuard), backup scheduling, RSS feed generation, scrobbling (Trakt.tv/Last.fm), collections, scheduled tasks, and a full security center with real TOTP 2FA.

### The Indexer Search Actually Works

This was the feature I was most anxious about. **Compote** (the indexer module) does real RSS feed parsing against live indexers:

- **Nyaa.si** -- Anime/Asian media. RSS XML parsing with XDocument + LINQ
- **YTS** -- Movies. JSON API integration
- **EZTV** -- TV shows. JSON API integration
- **Torznab/Newznab** -- Standard protocol support for Jackett-compatible indexers
- **Generic RSS** -- Fallback for anything else

Search results include:
- Quality detection: 4K, 1080p, 720p, 480p (regex parsing from title)
- Codec info: HEVC, x264, AV1, VP9
- File size normalization (TiB/GiB/MiB/KiB)
- Seeder/leecher counts
- One-click grab with magnet link extraction

I tested it with "Jobless Reincarnation" on Nyaa.si and got 75 results back with full metadata. It's not wrapping Jackett -- it's doing its own parsing.

### Security That's Not an Afterthought

The **Bastion** module handles security, and it's not the typical "JWT auth and call it a day" setup:

- **Real TOTP 2FA**: Base32 secret generation, `otpauth://` QR code URIs, 8 backup codes
- **LDAP integration**: Connect to existing directory services
- **IP filtering**: Whitelist/blacklist rules
- **API key management**: Per-key permissions, usage tracking
- **Audit logging**: Every action logged with search and JSON export
- **Session management**: Active session list with device/browser detection, remote kill

There's also **Fortress**, which computes SHA-256 hashes of all assemblies at startup and does periodic runtime integrity checks. If something's been tampered with, it auto-locks the API.

### Built-in VPN (WireGuard)

The **Tunnel** module lets you manage a WireGuard VPN directly from the UI:

- Add/remove peers with auto-generated keys
- SSL certificate management
- Bandwidth monitoring with historical graphs
- Dynamic DNS configuration
- Tailscale integration
- External connectivity testing with real IP detection

No more SSHing into your server to edit `wg0.conf`.

### System Dashboard

The system page shows real metrics, not placeholder data:
- Server health: status, runtime, OS, uptime
- .NET version, architecture, CPU cores, memory usage
- 8 security features with green/red status indicators
- All 35 modules listed with codenames and version numbers

### Tech Stack

- **Backend**: C#/.NET 10 (ASP.NET Core)
- **Frontend**: React 18, TailwindCSS, Shadcn UI
- **Database**: SQLite via Entity Framework Core 10
- **Auth**: JWT + TOTP 2FA
- **Release**: Self-contained binaries (58 MB Linux, 72 MB Windows)

### What's Honest-to-God Working Right Now (v2.9.0)

- Library management with TMDB metadata
- Multi-indexer search returning real results
- Download management
- TOTP 2FA setup and verification
- WireGuard VPN management
- System health monitoring
- Backup scheduling
- RSS feed generation
- Scrobbling configuration
- 136 API endpoints tested and verified

### What's Not Done Yet

I'm being transparent:
- Hardware transcoding (QSV/NVENC) -- not implemented
- Skip intro/credits -- not implemented
- Mobile apps -- web-only
- Docker image -- not published yet (bare metal and release builds work)
- Custom quality formats like TRaSH guides -- planned

### System Requirements

- **Minimum**: 4 GB RAM, 2 GB disk (plus media storage)
- **Runs on**: Linux x64, Windows 10+, macOS 12+
- **No runtime dependencies**: The release build includes .NET 10

### Installation

```bash
# Linux
tar xzf WatchNexus-v2.9.0-linux-x64.tar.gz
cd WatchNexus-v2.9.0-linux-x64
sudo bash install.sh
# Visit http://localhost:8001
```

That's it. One command. Default login is `admin@watchnexus.local` / `admin`.

---

Happy to answer questions, take feature requests, or hear what I'm missing. I built this because I wanted it to exist, and I figure some of you might want it too.

---

## Submission Notes
- Post on weekday evenings (US time) or Saturday mornings for r/selfhosted
- Cross-post to r/homelab, r/datahoarder with slightly different titles
- For r/homelab, emphasize hardware requirements and single-binary deployment
- For r/datahoarder, emphasize indexer search and automation features
- Include screenshots as imgur album links
- Respond to every comment for the first 24 hours

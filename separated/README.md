# WatchNexus

**One app to rule them all.** Request, download, organize, and stream your media library.

```
v2.7.0 — Operation Fortress
```

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#installation)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](#docker)

---

## What is this?

WatchNexus replaces your entire media stack:

| Replaces | With |
|----------|------|
| Sonarr + Radarr | **Marmalade** — Smart library management |
| Prowlarr + Jackett | **Compote** — Unified indexer hub |
| qBittorrent | **Fondue** — Download orchestration |
| Bazarr | **Garnish** — Subtitle fetching |
| Jellyfin + Plex | **Gelatin** — Streaming & transcoding |

One interface. One database. No more juggling 6 different apps.

---

## Features

### Core Modules

| Module | Codename | What it does |
|--------|----------|--------------|
| Library Manager | **Marmalade** | Scans folders, fetches metadata from TMDB, organizes movies/TV/anime/music |
| Indexer Hub | **Compote** | Connects to Torznab/Newznab indexers, aggregates search results |
| Download Engine | **Fondue** | Built-in torrent client + qBittorrent integration |
| Subtitle Manager | **Garnish** | Auto-downloads subs from OpenSubtitles, Addic7ed, Subscene |
| Transcoder | **Gelatin** | FFmpeg-powered streaming, HLS adaptive bitrate |
| Torrent Search | **Zest** | Multi-tracker search aggregation |
| IPTV Player | **Relish** | M3U playlist support, EPG guide |
| Playlist Engine | **Drizzle** | Custom playlists, smart collections |
| Stream Links | **Cream** | External streaming service integration |
| Audio Fingerprint | **Fprint** | Chromaprint-based intro/outro detection |
| Request System | **Potluck** | Multi-user media requests with approval workflow |
| Content Filter | **Sieve** | Quality profiles, release filtering |
| Scraper Engine | **Syrup** | Metadata scrapers for edge cases |

### Gadgets (v2.6+)

| Gadget | Description |
|--------|-------------|
| **Weather** | Current conditions + 7-day forecast |
| **Podcasts** | RSS subscriptions, queue, progress sync |
| **Radio** | 50,000+ internet radio stations |
| **Photos** | Local photo library browser |
| **Web Video** | YouTube/Vimeo/Twitter extraction via yt-dlp |

### Platform Features

- **Cross-device sync** — Settings, watch progress, and preferences sync to your account
- **Multi-user** — Separate profiles with permission levels
- **Jellyfin/Kodi compatible** — API compatibility layer for existing apps
- **Plugin system** — Extend functionality with custom plugins
- **Dark/Light themes** — System-aware theming

---

## Installation

### One-liner install

**Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/watchnexus/watchnexus/main/builds/linux/install.sh | bash
```

**macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/watchnexus/watchnexus/main/builds/mac/install.sh | bash
```

**Windows (PowerShell as Admin):**
```powershell
iwr -useb https://raw.githubusercontent.com/watchnexus/watchnexus/main/builds/windows/install.ps1 | iex
```

### Docker

```bash
docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v /path/to/data:/data \
  -v /path/to/media:/media:ro \
  -e JWT_SECRET=change-me \
  watchnexus/watchnexus:latest
```

### Manual

See [DEVELOPMENT.md](DEVELOPMENT.md) for full setup instructions.

---

## Screenshots

```
[Dashboard]     [Library]      [Player]       [Settings]
    📊              📚            ▶️              ⚙️
```

---

## Tech Stack

**Backend:** Python 3.11, FastAPI, SQLite, FFmpeg
**Frontend:** React 19, Tailwind CSS, Radix UI, Framer Motion
**Desktop:** Electron (optional)

---

## Version History

### v2.7.0 — Operation Fortress *(Current)*
- ✅ Complete installer system for all platforms
- ✅ Lightweight installers (download deps at runtime)
- ✅ Full Electron build pipeline
- ✅ PyInstaller backend bundling
- ✅ Cross-platform build scripts

### v2.6.1 — The Browser Fix
- ✅ Fixed file browser in Settings (critical bug)
- ✅ Refactored to use centralized FolderBrowser component
- ✅ Code audit — fixed duplicate endpoints, lint cleanup

### v2.6.0 — Gadget Drop
- ✅ Weather gadget with 7-day forecast
- ✅ Podcast subscriptions and playback
- ✅ Internet radio with 50k+ stations
- ✅ Photo library browser
- ✅ Web video extraction (YouTube, etc.)

### v2.5.x — Polish & Sync
- ✅ Cross-device settings sync
- ✅ Theme mode persistence
- ✅ Watch history management
- ✅ User deletion cascade fix
- ✅ Quality profiles

---

## What Works (v2.7.0)

| Feature | Status |
|---------|--------|
| User auth & multi-user | ✅ Working |
| Library scanning | ✅ Working |
| TMDB metadata | ✅ Working |
| Video playback | ✅ Working |
| Watch progress | ✅ Working |
| Watchlist | ✅ Working |
| Playlists | ✅ Working |
| Indexer search | ✅ Working |
| Download management | ✅ Working |
| qBittorrent integration | ✅ Working |
| Subtitle search | ✅ Working |
| IPTV/M3U playback | ✅ Working |
| Settings sync | ✅ Working |
| File browser | ✅ Working |
| Weather gadget | ✅ Working |
| Podcast player | ✅ Working |
| Radio streaming | ✅ Working |
| Photo browser | ✅ Working |
| Web video | ✅ Working |
| Transcoding | ✅ Working |
| Quality profiles | ✅ Working |

---

## Roadmap

- [ ] **Marshmallow** — Cloud sync & backup
- [ ] **Harbor** — Raspberry Pi builds
- [ ] **Echo** — FFmpeg replacement research
- [ ] Spotify/Deezer integration
- [ ] Mobile apps (Android/iOS)
- [ ] Auto-update system

---

## Contributing

PRs welcome. See [DEVELOPMENT.md](DEVELOPMENT.md) to get started.

---

## License

MIT — do whatever you want with it.

---

## Links

- **Docs:** [docs.watchnexus.io](https://docs.watchnexus.io)
- **Discord:** [discord.gg/watchnexus](https://discord.gg/watchnexus)
- **Twitter:** [@watchnexus](https://twitter.com/watchnexus)

---

**Made with 🍿 for media hoarders everywhere.**

# WatchNexus - Product Requirements Document

## Original Problem Statement
Build a unified, self-hosted media pipeline called "WatchNexus" that replaces the need for multiple applications like Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin. The goal is a single, fully self-contained application that handles requesting, acquiring, organizing, and watching media.

## Module Code Names (Food Theme 🍯)

| Module | Code Name | Description | File |
|--------|-----------|-------------|------|
| Indexer Aggregator | **Syrup** 🍯 | Aggregates multiple indexers, live scrapers | `syrup_scrapers.py` |
| Challenge Solver | **Preserve** 🫙 | Cloudflare bypass / anti-bot protection | `compote.py` |
| Usenet Handler | **Pulp** 🍊 | Usenet/NZB download management | `compote.py` |
| Indexer Manager | **Compote** 🍇 | Central manager for Syrup, Preserve, Pulp | `compote.py` |
| Media Server | **Marmalade** 🍊 | Library management, streaming, progress | `marmalade_server.py` |
| External Access | **Gelatin** 🍮 | LAN discovery, tunneling, share links | `gelatin.py` |
| Watch Party | **Potluck** 🍲 | WebSocket sync, chat, reactions | `potluck.py` |
| Subtitle Service | **Garnish** 🌿 | Addic7ed/OpenSubtitles integration | `garnish.py` |
| Torrent Engine | **Fondue** 🫕 | Built-in libtorrent client | `fondue.py` |
| Media Health | **Sieve** 🫗 | File validation, repair, scans | `sieve.py` |
| Plugin System | **Gadgets** 🔧 | Extension/plugin framework | `gadgets.py` |
| Theme Engine | **Milk** 🥛 | Visual customization, Theme Forge | `milk.py` |
| Color Picker | **Juice** 🧃 | Color selection component | `JuiceColorPicker.jsx` |

## User Personas
- **Home Media Enthusiast**: Wants to manage their media library without running multiple applications
- **Tech-Savvy User**: Comfortable with self-hosting but wants a simpler setup
- **Watch Party Host**: Wants to share media experiences with friends remotely

## Core Requirements
1. **Unified & Self-Contained**: Single application with no external dependencies
2. **Branded Modules**: Syrup (indexer aggregator), Preserve (challenge solver), Pulp (usenet), Gelatin (external access)
3. **Cross-Platform**: Packageable for Mac, Linux, and Windows via Electron
4. **Rich Metadata**: TMDB integration
5. **Subtitles**: Addic7ed integration
6. **Authentication**: JWT and Google OAuth
7. **Watch Party**: Synchronized viewing with chat
8. **Streaming Services**: Credential management for Netflix, Disney+, Prime, Crunchyroll, YouTube

## Tech Stack
- **Frontend**: React, Electron, TailwindCSS, Shadcn UI, Framer Motion
- **Backend**: Python FastAPI, libtorrent
- **Database**: MongoDB
- **Real-time**: WebSockets for Watch Party

## Code Architecture
```
/app/
├── backend/
│   ├── server.py               # Main FastAPI app with all routes
│   ├── torrent_engine.py       # Built-in libtorrent client
│   ├── marmalade_server.py     # Python media server
│   ├── media_health_checker.py # Media file validation
│   ├── compote.py              # Indexer manager (Syrup, Preserve, Pulp)
│   ├── syrup_scrapers.py       # Live site scrapers
│   ├── subtitle_service.py     # Addic7ed/OpenSubtitles integration
│   ├── watch_party.py          # WebSocket synchronized viewing
│   └── gelatin.py              # External access module
├── frontend/
│   ├── electron/               # Electron packaging
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SettingsPage.js # Settings with 9 tabs
│   │   │   ├── WatchPartyPage.js # Watch party UI
│   │   │   └── ...
│   │   ├── components/
│   │   └── services/api.js     # API service layer
│   └── public/
│       └── watchnexus-logo.svg # App logo
└── memory/
    └── PRD.md                  # This file
```

## What's Implemented (as of Feb 2025)

### ✅ Completed Features

#### Core Infrastructure
- [x] Full-stack React + FastAPI + MongoDB architecture
- [x] JWT Authentication with Google OAuth support
- [x] TMDB API integration for metadata
- [x] Built-in torrent engine (libtorrent)

#### Media Management (Marmalade)
- [x] Library scanning and organization
- [x] Multiple media type support (movies, TV, music, audiobooks)
- [x] Watch progress tracking
- [x] Media health checker with repair capabilities
- [x] Streaming with range request support

#### Download Management
- [x] Built-in torrent client
- [x] Direct magnet link submission
- [x] Queue management
- [x] qBittorrent integration (optional)

#### Indexer Management (Compote)
- [x] Syrup - Indexer aggregator with live scrapers (1337x, YTS, EZTV)
- [x] Preserve - Cloudflare bypass module
- [x] Pulp - Usenet handler placeholder
- [x] Torznab/RSS feed support

#### External Access (Gelatin)
- [x] LAN server discovery
- [x] Tunnel creation for external access
- [x] Access token generation
- [x] Share link generation for Watch Party

#### Watch Party
- [x] Real-time WebSocket synchronization
- [x] Party creation with 6-character codes
- [x] Host controls (play/pause/seek)
- [x] Live chat with emoji reactions
- [x] Member ready status

#### Streaming Service Logins
- [x] Encrypted credential storage
- [x] Support for 11 services: Netflix, Disney+, Prime, Crunchyroll, YouTube, HBO Max, Hulu, Peacock, Paramount+, Apple TV+, Funimation
- [x] Deep linking to services

#### Subtitles
- [x] Addic7ed scraper implementation
- [x] OpenSubtitles API support (requires API key)
- [x] Language preference settings
- [x] Search by TV show (season/episode) or movie

#### UI/UX
- [x] Custom sidebar with WatchNexus logo
- [x] Framer Motion animations
- [x] 9 settings tabs: General, Library, Media Health, Indexers, Download Client, IPTV, Streaming Services, Subtitles, External Access
- [x] Dark theme with violet/pink accents

### 🔄 In Progress / Known Limitations

#### Network Restrictions
- Syrup live scrapers (1337x, YTS, EZTV) are blocked in preview environment
- Addic7ed scraper returns 0 results in preview environment
- These will work in production/self-hosted environments

### 📋 Backlog (P2)

1. **IPTV Integration**
   - M3U playlist parsing
   - EPG data support
   - Live TV channel management

2. **Full Pulp (Usenet) Implementation**
   - NZB handling
   - Usenet provider connections

3. **VideoPlayer Subtitle Integration**
   - Subtitle selection overlay in player
   - Auto-download on play

4. **Watch Party Video Integration**
   - Connect to actual video sources
   - Sync with Marmalade library

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - JWT login
- `GET /api/auth/google/url` - Google OAuth URL
- `POST /api/auth/google/callback` - OAuth callback

### Gelatin (External Access)
- `GET /api/gelatin/status` - Server status
- `GET /api/gelatin/lan-url` - LAN URL
- `POST /api/gelatin/tunnel/create` - Create tunnel
- `GET /api/gelatin/tunnels` - List tunnels
- `DELETE /api/gelatin/tunnel/{id}` - Close tunnel
- `POST /api/gelatin/access-token` - Generate token
- `GET /api/gelatin/share-link` - Get share link

### Watch Party
- `POST /api/watch-party/create` - Create party
- `GET /api/watch-party/{code}` - Get party info
- `GET /api/watch-party/list` - List parties
- `WS /ws/party/{code}` - WebSocket connection

### Streaming Logins
- `GET /api/streaming-logins/services` - Available services
- `GET /api/streaming-logins` - User's logins
- `POST /api/streaming-logins` - Add login
- `DELETE /api/streaming-logins/{service_id}` - Remove login

### Subtitles
- `GET /api/subtitles/search/tv` - Search TV subs
- `GET /api/subtitles/search/movie` - Search movie subs
- `POST /api/subtitles/download` - Download subtitle
- `GET /api/subtitles/settings` - Get settings
- `PUT /api/subtitles/settings` - Update settings

### Marmalade (Media Server)
- `GET /api/marmalade/status` - Server status
- `GET/POST/DELETE /api/marmalade/libraries` - Library CRUD
- `GET /api/marmalade/media` - List media
- `GET /api/marmalade/stream/{id}/file` - Stream media

### Compote (Indexers)
- `GET /api/compote/indexers` - List indexers
- `POST /api/compote/indexers` - Add indexer
- `GET /api/compote/search` - Search content
- `GET /api/syrup/search` - Live scraper search

## Test Credentials
- **Email**: test@test.com
- **Password**: password

## Deployment Notes
- Backend runs on port 8001 (internal)
- Frontend runs on port 3000
- All API routes prefixed with `/api`
- MongoDB on default port
- Preview URL: https://nexusplay-1.preview.emergentagent.com

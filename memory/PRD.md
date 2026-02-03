# MediaHub - Personal Media Ops Platform

## Original Problem Statement
Build a unified self-hosted media platform that replaces multiple applications (Jellyfin, Sonarr, Radarr, qBittorrent, Prowlarr, Bazarr) into one single application. Features include:
- Media library/streaming interface (like Jellyfin)
- Catalog management for TV shows, movies, audiobooks, music, music videos, live TV
- Download manager with torrent support
- Indexer management for finding content
- Subtitle automation
- Streaming service connectors (Netflix, Disney+, Prime Video deep links)
- Settings to configure real integrations when ready
- JWT + configurable OAuth authentication

## User Personas
1. **Home Media Enthusiast** - Wants a unified interface to manage local media and streaming services
2. **Power User** - Needs fine-grained control over indexers, download quality, and organization
3. **Family User** - Wants Netflix-like browsing experience with simple access

## Core Requirements (Static)
- Single unified application replacing multiple tools
- Real TMDB metadata integration for movies/TV
- Mock download functionality with real integration ready
- Streaming service deep links
- JWT authentication with OAuth configuration option
- Dark cinematic UI/UX

## What's Been Implemented (MVP - Feb 3, 2026)

### Backend (FastAPI + MongoDB)
- ✅ User authentication (register, login, JWT tokens)
- ✅ TMDB API integration (search, trending, movie/TV details, seasons, genres, discover)
- ✅ Watchlist CRUD operations
- ✅ Watch progress tracking
- ✅ Downloads queue (mocked with realistic simulation)
- ✅ Settings management
- ✅ Indexers configuration (mock)
- ✅ Streaming services configuration

### Frontend (React + Tailwind)
- ✅ Login/Register pages with glassmorphism design
- ✅ Dashboard with hero banner, trending content, continue watching
- ✅ Movies browse page with genre filters and sorting
- ✅ TV Shows browse page with genre filters and sorting
- ✅ Media details page with trailer, cast, similar content
- ✅ Search with multi-type filtering (movies, TV, people)
- ✅ Downloads page with progress simulation
- ✅ Settings page (General, Indexers, Download Client, Subtitles, Streaming Services, Auth)
- ✅ Streaming services page with deep links
- ✅ Music page (coming soon placeholder)
- ✅ Audiobooks page (coming soon placeholder)
- ✅ Live TV page (coming soon placeholder)
- ✅ Responsive sidebar navigation
- ✅ Dark cinematic theme with violet accents

## Prioritized Backlog

### P0 (Critical for Production)
- [ ] Real torrent download integration (libtorrent/qBittorrent API)
- [ ] Real indexer integration (Jackett/Prowlarr APIs)
- [ ] File organization and renaming automation
- [ ] Local media scanning and library import

### P1 (High Priority)
- [ ] Video player with streaming support
- [ ] Subtitle fetching (OpenSubtitles API)
- [ ] Google OAuth integration
- [ ] User profiles and permissions
- [ ] Notifications for new content

### P2 (Medium Priority)
- [ ] Music library with metadata (MusicBrainz)
- [ ] Audiobook support with bookmarks
- [ ] Live TV/IPTV integration
- [ ] Mobile-optimized views
- [ ] PWA support

### P3 (Nice to Have)
- [ ] Recommendation engine
- [ ] Social features (share watchlists)
- [ ] Hardware transcoding settings
- [ ] Advanced analytics dashboard

## Tech Stack
- **Backend**: FastAPI, MongoDB, httpx, PyJWT, bcrypt
- **Frontend**: React 19, Tailwind CSS, Framer Motion, Shadcn/UI
- **APIs**: TMDB (implemented), OpenSubtitles (planned)

## Configuration
- TMDB API Key: Provided by user
- OAuth: Configurable via settings page
- Indexers: Configurable via settings (mock in MVP)

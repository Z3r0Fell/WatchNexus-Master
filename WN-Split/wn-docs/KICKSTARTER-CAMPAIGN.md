# WatchNexus - Kickstarter Campaign Document

## 🎬 One App to Rule Them All

**WatchNexus** is a unified, self-hosted media pipeline that replaces the need for 6+ separate applications. No more juggling between Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin. One beautiful app handles everything.

---

## 🎯 The Problem

Setting up a home media server today requires:

| App | Purpose | Complexity |
|-----|---------|------------|
| Sonarr | TV show management | High |
| Radarr | Movie management | High |
| Prowlarr | Indexer aggregation | Medium |
| qBittorrent | Downloads | Medium |
| Bazarr | Subtitles | Medium |
| Jellyfin/Plex | Playback | High |

**Total setup time: 4-8 hours** for a technical user. Non-technical users? Virtually impossible.

---

## ✨ The Solution: WatchNexus

A single, beautiful application that handles:

- 🔍 **Search & Discovery** - Find movies, TV shows, music
- 📥 **Acquisition** - Torrents, Usenet, direct downloads
- 📁 **Organization** - Automatic file management
- 🎬 **Playback** - Built-in video player with subtitle support
- 📺 **Live TV** - IPTV integration with EPG guide
- 🎉 **Watch Parties** - Synchronized viewing with friends

---

## 🏗️ What's Already Built

### Core Platform (100% Complete)
- ✅ React + FastAPI full-stack application
- ✅ User authentication (JWT + Google OAuth)
- ✅ MongoDB database integration
- ✅ TMDB integration for metadata
- ✅ Beautiful, responsive UI

### Media Management
- ✅ **Compote** - Indexer management (Torznab/Newznab)
- ✅ **Syrup** - Live site scrapers (YTS, EZTV)
- ✅ **Fondue** - Built-in torrent engine
- ✅ **Pulp** - Usenet/NZB support
- ✅ **Garnish** - Subtitle fetching (Addic7ed integration)

### Playback & Social
- ✅ **VideoPlayer** - HLS/DASH streaming with subtitle overlay
- ✅ **Potluck** - Watch parties with real-time sync
- ✅ **Relish** - IPTV/M3U playlist support
- ✅ **EPG Guide** - Electronic Program Guide for Live TV

### Customization
- ✅ **Milk** - Theme system with community sharing
- ✅ **Gadgets** - Plugin architecture
- ✅ Theme Forge - Visual theme editor
- ✅ Plugin Marketplace UI

### Platform Support
- ✅ **Electron** - Desktop app (Windows, macOS, Linux)
- ✅ **Build Scripts** - Arch Linux, general Linux, macOS, Windows
- ✅ **Marketing Website** - Full landing page, features, FAQ, download

### Legal & Compliance
- ✅ Terms of Service page
- ✅ Legal Disclaimer page
- ✅ MIT License

### Hidden Features
- ✅ **Jellyfin-Compatible API** - Connect existing Jellyfin/Emby clients

---

## 📱 Client App Roadmap

| Platform | Status | Effort |
|----------|--------|--------|
| Web App | ✅ Complete | - |
| Desktop (Electron) | ✅ Complete | - |
| Android Mobile | 🔜 Planned | 2-3 weeks |
| Fire TV Stick | 🔜 Planned | 2-3 weeks |
| Android TV | 🔜 Planned | 1-2 weeks |
| Chromecast | 🔜 Planned | 1 week |
| Kodi Addon | 🔜 Planned | 1-2 weeks |
| Roku | ⚠️ Deprioritized | 4-6 weeks |

---

## 🎨 Screenshots

### Dashboard
- Clean, modern interface
- Recently added media
- Continue watching
- Quick access to all features

### Search & Discovery
- Unified search across all sources
- TMDB metadata integration
- Filter by quality, source, size

### Live TV
- IPTV channel grid
- EPG timeline guide
- Multi-source support

### Watch Party
- Synchronized playback
- Real-time chat
- Host controls

### Theme Customization
- Visual theme editor
- Community theme sharing
- One-click theme application

---

## 🔧 Technical Architecture

```
WatchNexus
├── Frontend (React)
│   ├── Pages (15+ screens)
│   ├── Components (50+ reusable)
│   └── Shadcn UI + TailwindCSS
│
├── Backend (FastAPI)
│   ├── REST API (60+ endpoints)
│   ├── WebSocket (real-time sync)
│   └── MongoDB database
│
├── Media Modules
│   ├── Compote (indexers)
│   ├── Syrup (scrapers)
│   ├── Fondue (torrents)
│   ├── Pulp (usenet)
│   ├── Garnish (subtitles)
│   └── Relish (IPTV)
│
├── Desktop (Electron)
│   └── Cross-platform builds
│
└── Marketing Website
    └── Vite + React
```

---

## 💰 Funding Goals

### Tier 1: $5,000 - Mobile Apps
- Android mobile app
- Fire TV Stick app
- Android TV app

### Tier 2: $10,000 - Premium Features
- Cloud sync between devices
- Advanced DVR recording
- Multi-user household support

### Tier 3: $20,000 - Ecosystem
- Chromecast support
- Kodi addon
- Plugin SDK documentation
- Theme SDK documentation

### Stretch Goal: $35,000 - Roku
- Native Roku channel (BrightScript development)

---

## 🎁 Backer Rewards

| Tier | Amount | Rewards |
|------|--------|---------|
| **Supporter** | $10 | Name in credits, Discord access |
| **Early Adopter** | $25 | Above + Early access to mobile apps |
| **Power User** | $50 | Above + 5 premium themes |
| **Super Fan** | $100 | Above + Priority feature requests |
| **Founding Member** | $250 | Above + Lifetime updates, exclusive badge |
| **Sponsor** | $500 | Above + Logo on website, plugin dev support |

---

## 👨‍💻 About the Project

WatchNexus is:
- **Open Source** - MIT License
- **Self-Hosted** - Your data, your server
- **Privacy-First** - No tracking, no cloud dependency
- **Community-Driven** - Plugin & theme ecosystem

---

## 📊 Project Stats

- **Lines of Code**: 25,000+
- **API Endpoints**: 60+
- **Frontend Components**: 50+
- **Supported Platforms**: 6+
- **Development Time**: 6+ months

---

## 🚀 Timeline

| Milestone | Target |
|-----------|--------|
| Campaign Launch | Month 1 |
| Android Mobile App | Month 2-3 |
| Fire TV App | Month 3-4 |
| Chromecast Support | Month 4 |
| Kodi Addon | Month 5 |
| DVR System | Month 6 |

---

## 🔗 Links

- **Demo**: [Available on request]
- **GitHub**: [Coming after campaign]
- **Documentation**: [In progress]
- **Discord**: [Community server]

---

## 📜 Legal

WatchNexus is a media organization and playback tool. Users are responsible for ensuring they have the legal right to access and download any content. The software does not host, provide, or promote access to copyrighted material.

---

## 🙏 Thank You

Your support makes WatchNexus possible. Together, we're building the media server that should have existed years ago.

**One app. All your media. Your way.**

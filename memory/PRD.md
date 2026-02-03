# WatchNexus - Personal Media Command Center

## Overview
WatchNexus is a unified self-hosted media platform forked from Jellyfin, rebranded and customized to serve as the foundation for a complete media management solution that replaces multiple applications (Jellyfin, Sonarr, Radarr, qBittorrent, Prowlarr, Bazarr).

## Current Status (Feb 3, 2026)

### Completed
- ✅ Forked Jellyfin server v10.10.6 (C#/.NET 8)
- ✅ Forked Jellyfin web client v10.10.6 (TypeScript/React)
- ✅ Rebranded to "WatchNexus" throughout:
  - Header logo (purple/pink gradient)
  - Page titles
  - Welcome messages
  - App name in manifests
  - Assembly info
- ✅ Server running on port 3000
- ✅ FFmpeg installed for transcoding
- ✅ Media directories created at /var/lib/watchnexus/

### Architecture
```
/app/watchnexus/
├── server/          # Jellyfin server (C#/.NET 8)
│   └── Jellyfin.Server/bin/Release/net8.0/
├── web/             # Web client (TypeScript)
│   ├── src/         # Source files
│   └── dist/        # Built web assets

/var/lib/watchnexus/
├── config/          # Server configuration
├── data/            # Database and metadata
├── log/             # Server logs
├── cache/           # Transcoding cache
└── media/           # Media library root
    ├── movies/
    ├── tvshows/
    ├── music/
    └── audiobooks/
```

### Tech Stack
- **Backend**: C# / .NET 8 (Jellyfin server)
- **Frontend**: TypeScript, React (Jellyfin web)
- **Database**: SQLite (embedded)
- **Transcoding**: FFmpeg
- **Process Manager**: Supervisor

## Next Phase - Feature Integration

### P0 - Indexer Integration
- [ ] Build Prowlarr-like indexer management
- [ ] Integrate with public indexers (1337x, RARBG alternatives, etc.)
- [ ] Unified search interface

### P1 - Download Client
- [ ] Integrate torrent download capability
- [ ] Automatic file organization
- [ ] Progress tracking in UI

### P2 - Enhanced Features  
- [ ] Subtitle automation (OpenSubtitles)
- [ ] Streaming service deep links
- [ ] TMDB metadata enhancement

### P3 - Advanced
- [ ] Custom authentication (OAuth config)
- [ ] Multi-user management
- [ ] Mobile app support

## Running WatchNexus
```bash
# Server runs via supervisor
sudo supervisorctl status watchnexus

# Access
http://localhost:3000/web/
```

## License
Based on Jellyfin - GPL v2. All modifications must remain open source.

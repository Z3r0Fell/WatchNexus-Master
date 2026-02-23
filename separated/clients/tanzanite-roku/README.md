# WatchNexus Tanzanite - Roku Client 💜

The official WatchNexus Roku client.

**Codename:** Tanzanite  
**Version:** 1.0.0  
**Platform:** Roku OS

## Features

- Stream movies, TV shows, anime from your WatchNexus server
- Full library browsing with artwork
- Skip intro/credits support
- Subtitle selection
- Quality selection
- Continue watching
- Search functionality

## Installation

### Sideloading (Development)

1. Enable Developer Mode on your Roku:
   - Go to Settings → System → About
   - Press Home 3x, Up 2x, Right, Left, Right, Left, Right
   - Enable Developer Mode and note your IP

2. Package the app:
   ```bash
   cd WatchNexus-Roku
   npm install
   npm run build
   npm run package
   ```

3. Upload the .zip to your Roku via the Developer Application Installer

### Channel Store (Coming Soon)

Search for "WatchNexus" in the Roku Channel Store.

## Configuration

On first launch, enter your WatchNexus server URL:
- Example: `http://192.168.1.100:8001`
- Use the `/api/emby` endpoint for Jellyfin compatibility

## Requirements

- Roku OS 9.0 or higher
- WatchNexus Server 2.4.0 or higher

## License

GPL-2.0 (forked from jellyfin-roku)

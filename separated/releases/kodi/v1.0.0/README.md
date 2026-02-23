# WatchNexus Diamond - Kodi Addon 💎

**Codename:** Diamond  
**Version:** 1.0.0  
**Platform:** Kodi 19+ (Matrix/Nexus)

## Installation

### From ZIP (Recommended)

1. Download `watchnexus-diamond-1.0.0.zip`
2. In Kodi: Settings → Add-ons → Install from zip file
3. Select the downloaded file
4. Wait for "Add-on installed" notification

### From Repository (Coming Soon)

Add WatchNexus repository for automatic updates.

## Configuration

1. Go to Add-ons → WatchNexus Diamond
2. Open Settings (context menu or right-click)
3. Enter server URL: `http://your-server:8001`
4. Enter username and password
5. Select sync mode

## Sync Modes

### Addon Mode (Default)
- Browse WatchNexus library within the addon
- No changes to Kodi library
- Fastest setup

### Native Mode
- Sync to Kodi library for native browsing
- Media appears in Kodi's Movies/TV Shows
- Watch state syncs back to WatchNexus

## Features

- Full library browsing
- Watch state sync
- Artwork integration
- Skip intro/credits
- Direct play and transcoding
- Multiple user support
- Music and audiobook support

## Requirements

- Kodi 19 (Matrix) or Kodi 20 (Nexus)
- WatchNexus Server 2.4.0+

## Troubleshooting

### Connection Failed
- Verify server URL includes port: `http://ip:8001`
- Check firewall allows port 8001
- Try with `/api/emby` endpoint for Jellyfin compat

### Library Not Showing
- Check user permissions on server
- Verify libraries are scanned
- Clear addon data and reconnect

## License

GPL-2.0 (forked from jellyfin-kodi)

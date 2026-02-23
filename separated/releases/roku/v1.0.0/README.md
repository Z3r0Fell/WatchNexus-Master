# WatchNexus Tanzanite - Roku Client 💜

**Codename:** Tanzanite  
**Version:** 1.0.0  
**Platform:** Roku OS 9.0+

## Installation

### Sideloading (Development Mode)

1. **Enable Developer Mode on Roku:**
   - Go to Settings → System → About
   - Press: Home 3x, Up 2x, Right, Left, Right, Left, Right
   - Enable Developer Mode and note your Roku's IP

2. **Upload the Package:**
   - Open browser to: `http://<roku-ip>`
   - Login with developer credentials
   - Upload `watchnexus-tanzanite-1.0.0.zip`
   - Click "Install"

### Roku Channel Store (Coming Soon)

Search for "WatchNexus" in the Roku Channel Store.

## Building from Source

```bash
# Install dependencies
cd WatchNexus-Roku
npm install

# Build
npm run build

# Package is at: out/WatchNexus-Roku.zip
```

## Configuration

1. Launch WatchNexus Tanzanite
2. Enter your server URL: `http://your-server:8001`
3. Login with your credentials
4. Select libraries to browse

## Features

- Full library browsing with artwork
- Continue watching
- Search functionality
- Skip intro/credits support
- Subtitle selection
- Quality selection
- Multiple user profiles

## Remote Controls

- **OK**: Select / Play/Pause
- **Back**: Go back / Exit
- **\***: Options menu
- **Play/Pause**: Toggle playback
- **Rewind/FF**: Seek 10s
- **Info**: Show media info

## Requirements

- Roku OS 9.0 or higher
- WatchNexus Server 2.4.0+

## Troubleshooting

### Cannot Connect
- Use `/api/emby` endpoint for Jellyfin compatibility
- Example: `http://192.168.1.100:8001/api/emby`

### Buffering Issues
- Lower video quality in settings
- Check network connection
- Verify server transcoding capability

## License

GPL-2.0 (forked from jellyfin-roku)

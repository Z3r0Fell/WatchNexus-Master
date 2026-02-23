# WatchNexus Ruby - Android TV Client 💎

The official WatchNexus Android TV client.

**Codename:** Ruby  
**Version:** 1.0.0  
**Platform:** Android TV (API 21+)

## Features

- Native Android TV interface with Leanback
- Voice search support
- Gamepad/remote navigation
- Picture-in-Picture mode
- Skip intro/credits
- Multiple audio/subtitle tracks
- Live TV support
- Continue watching row
- Recommendations integration

## Installation

### APK Sideloading

1. Download `watchnexus-ruby-1.0.0.apk`
2. Enable "Unknown Sources" on your Android TV
3. Install via USB, ADB, or file manager

### Google Play (Coming Soon)

Search for "WatchNexus Ruby" on Google Play for Android TV.

## Building

```bash
cd WatchNexus-AndroidTV
./gradlew assembleRelease
```

APK will be in `app/build/outputs/apk/release/`

## Configuration

1. Launch the app
2. Enter your server URL: `http://your-server:8001`
3. Login with your WatchNexus credentials

## Requirements

- Android TV with API 21+ (Lollipop)
- WatchNexus Server 2.4.0+

## License

GPL-2.0 (forked from jellyfin-androidtv)

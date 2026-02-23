# WatchNexus Sapphire - Android Mobile Client 💎

The official WatchNexus client for Android phones and tablets.

**Codename:** Sapphire  
**Version:** 1.0.0  
**Platform:** Android (API 21+)

## Features

- Material Design 3 interface
- Offline downloads
- Background playback
- Picture-in-Picture
- Chromecast support
- Skip intro/credits
- Multiple audio/subtitle tracks
- Music playback with lyrics
- Quick connect via QR code

## Installation

### APK Download

Download `watchnexus-sapphire-1.0.0.apk` and install.

### Google Play (Coming Soon)

Search for "WatchNexus Sapphire" on Google Play.

### F-Droid (Coming Soon)

Available in the WatchNexus F-Droid repository.

## Building

```bash
cd WatchNexus-Android
./gradlew assembleRelease
```

APK will be in `app/build/outputs/apk/release/`

## Configuration

1. Launch the app
2. Tap "Add Server"
3. Enter: `http://your-server:8001`
4. Login with your credentials

## Permissions

- Storage (for downloads)
- Network (for streaming)
- Notifications (for background playback)

## Requirements

- Android 5.0+ (Lollipop)
- WatchNexus Server 2.4.0+

## License

GPL-2.0 (forked from jellyfin-android)

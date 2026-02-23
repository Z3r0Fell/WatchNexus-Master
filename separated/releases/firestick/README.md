# WatchNexus Ember - Fire TV/Firestick Client 🔥

The official WatchNexus client for Amazon Fire TV devices.

**Codename:** Ember  
**Version:** 1.0.0  
**Platform:** Fire OS (Android-based)

## Features

- Optimized for Fire TV and Firestick
- Alexa voice search integration
- Fire TV remote navigation
- HDR/Dolby Vision support (on capable devices)
- Skip intro/credits
- Picture-in-Picture
- Continue watching
- Live TV support

## Installation

### Sideloading

1. Enable ADB debugging on your Fire TV:
   - Settings → My Fire TV → Developer Options → ADB Debugging

2. Install via ADB:
   ```bash
   adb connect <fire-tv-ip>
   adb install watchnexus-ember-1.0.0.apk
   ```

### Amazon Appstore (Coming Soon)

Search for "WatchNexus Ember" in the Amazon Appstore.

## Building

This uses the same codebase as Android TV (Prism) with Fire TV specific optimizations.

```bash
cd WatchNexus-AndroidTV
./gradlew assembleRelease -Pfiretv=true
```

## Supported Devices

- Fire TV Stick (2nd Gen+)
- Fire TV Stick 4K / 4K Max
- Fire TV Cube (all generations)
- Fire TV (3rd Gen+)
- Fire TV Edition TVs

## Requirements

- Fire OS 5.0+
- WatchNexus Server 2.4.0+

## License

GPL-2.0 (forked from jellyfin-androidtv)

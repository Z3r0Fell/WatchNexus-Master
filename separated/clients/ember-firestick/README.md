# WatchNexus Ember - Fire TV Client 🔥

**Codename:** Ember  
**Version:** 1.0.0  
**Platform:** Amazon Fire TV / Fire TV Stick

## About

Ember is the WatchNexus client for Amazon Fire TV devices. It shares the same codebase as Ruby (Android TV) but is optimized for Fire TV's remote and interface.

## Building

```bash
# Requires: Android Studio, JDK 21

./gradlew assembleRelease
```

## Installation

### ADB Sideload
```bash
adb connect <fire-tv-ip>:5555
adb install app/build/outputs/apk/release/app-release.apk
```

### Downloader App
1. Install "Downloader" from Amazon Appstore
2. Enter URL to APK
3. Install

## Supported Devices

- Fire TV Stick (all generations)
- Fire TV Stick 4K / 4K Max
- Fire TV Cube
- Fire TV (box)
- Fire TV Edition smart TVs

## License

GPL-2.0 (forked from jellyfin-androidtv)

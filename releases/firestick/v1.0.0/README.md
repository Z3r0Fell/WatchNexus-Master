# WatchNexus Ember - Fire TV Client 🔥

**Codename:** Ember  
**Version:** 1.0.0  
**Platform:** Amazon Fire TV / Fire TV Stick

## About

Ember is built from the same codebase as Ruby (Android TV) but optimized for Amazon Fire TV devices. It uses the Ruby source with Fire TV-specific configurations.

## Building from Source

### Prerequisites

1. **Android Studio** (Electric Eel or newer)
2. **Java JDK 21** 
3. **Android SDK** with:
   - Build Tools 34.0.0+
   - Amazon Fire TV SDK (optional for emulator)

### Build Steps

```bash
# Extract source (uses Android TV source)
unzip watchnexus-ember-1.0.0-source.zip
cd WatchNexus-AndroidTV

# Build release APK
./gradlew assembleRelease

# APK location
# app/build/outputs/apk/release/app-release-unsigned.apk

# Rename for Ember
mv app/build/outputs/apk/release/app-release-unsigned.apk watchnexus-ember-1.0.0.apk
```

## Installation

### Using Fire TV App

1. Install "Downloader" app from Amazon Appstore
2. Enter URL to your APK
3. Install and enjoy

### Using ADB

```bash
# Enable ADB Debugging on Fire TV
# Settings → Device → Developer Options → ADB Debugging → On

# Get Fire TV IP
# Settings → Device → About → Network

# Connect and install
adb connect <fire-tv-ip>:5555
adb install watchnexus-ember-1.0.0.apk
```

## Configuration

1. Launch WatchNexus Ember
2. Enter your server URL: `http://your-server:8001`
3. Login with your WatchNexus credentials

## Features

- Native Fire TV interface
- Amazon remote optimized
- Voice search via Alexa (search within app)
- Skip intro/credits
- Multiple audio/subtitle tracks
- Live TV support
- Continue watching

## Supported Devices

- Fire TV Stick (all generations)
- Fire TV Stick 4K / 4K Max
- Fire TV Cube
- Fire TV (box)
- Fire TV Edition smart TVs

## Requirements

- Fire OS 5.0+
- WatchNexus Server 2.4.0+

## License

GPL-2.0 (forked from jellyfin-androidtv)

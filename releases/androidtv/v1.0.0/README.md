# WatchNexus Ruby - Android TV Client 💎

**Codename:** Ruby  
**Version:** 1.0.0  
**Platform:** Android TV (API 21+)

## Building from Source

### Prerequisites

1. **Android Studio** (Electric Eel or newer)
2. **Java JDK 21** 
3. **Android SDK** with:
   - Build Tools 34.0.0+
   - Platform Tools
   - Android TV API 21+

### Build Steps

```bash
# Extract source
unzip watchnexus-ruby-1.0.0-source.zip
cd WatchNexus-AndroidTV

# Build release APK
./gradlew assembleRelease

# APK location
# app/build/outputs/apk/release/app-release-unsigned.apk
```

### Signing the APK

For distribution, sign the APK with your keystore:

```bash
# Generate keystore (first time only)
keytool -genkey -v -keystore watchnexus-ruby.keystore \
  -alias ruby -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore watchnexus-ruby.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk ruby

# Verify signature
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release-unsigned.apk
```

## Installation

### Sideloading

1. Enable "Unknown Sources" on your Android TV
2. Transfer APK via USB, ADB, or file manager app
3. Install and launch

### ADB Install

```bash
adb install watchnexus-ruby-1.0.0.apk
```

## Configuration

1. Launch WatchNexus Ruby
2. Enter your server URL: `http://your-server:8001`
3. Login with your WatchNexus credentials

## Features

- Native Android TV Leanback interface
- Voice search support
- Gamepad/remote navigation
- Skip intro/credits
- Multiple audio/subtitle tracks
- Live TV support
- Continue watching row

## Requirements

- Android TV with API 21+ (Lollipop)
- WatchNexus Server 2.4.0+

## License

GPL-2.0 (forked from jellyfin-androidtv)

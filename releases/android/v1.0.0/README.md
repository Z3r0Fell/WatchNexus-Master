# WatchNexus Sapphire - Android Mobile Client 💎

**Codename:** Sapphire  
**Version:** 1.0.0  
**Platform:** Android (API 21+)

## Building from Source

### Prerequisites

1. **Android Studio** (Electric Eel or newer)
2. **Java JDK 21** 
3. **Android SDK** with:
   - Build Tools 34.0.0+
   - Platform Tools
   - Android API 21+

### Build Steps

```bash
# Extract source
unzip watchnexus-sapphire-1.0.0-source.zip
cd WatchNexus-Android

# Build release APK
./gradlew assembleRelease

# APK location
# app/build/outputs/apk/release/app-release-unsigned.apk
```

### Signing the APK

For distribution, sign the APK with your keystore:

```bash
# Generate keystore (first time only)
keytool -genkey -v -keystore watchnexus-sapphire.keystore \
  -alias sapphire -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore watchnexus-sapphire.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk sapphire
```

## Installation

1. Enable "Unknown Sources" in Android Settings
2. Download and install the APK
3. Launch and configure server

## Configuration

1. Launch WatchNexus Sapphire
2. Tap "Add Server"
3. Enter: `http://your-server:8001`
4. Login with your credentials

## Features

- Material Design 3 interface
- Offline downloads
- Background playback
- Picture-in-Picture
- Chromecast support
- Skip intro/credits
- Multiple audio/subtitle tracks

## Requirements

- Android 5.0+ (Lollipop)
- WatchNexus Server 2.4.0+

## License

GPL-2.0 (forked from jellyfin-android)

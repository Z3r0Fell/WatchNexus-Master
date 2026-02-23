# WatchNexus Client Applications

Official client applications for WatchNexus media server.

## Available Clients

| Client | Codename | Platform | Status | Version |
|--------|----------|----------|--------|---------|
| Android TV | **Ruby** 💎 | Android TV, Google TV | Source | 1.0.0 |
| Android Mobile | **Sapphire** 💎 | Android phones/tablets | Source | 1.0.0 |
| Fire TV | **Ember** 🔥 | Fire TV Stick, Fire TV | Source | 1.0.0 |
| Kodi | **Diamond** 💎 | Kodi 19+/20+ | Built | 1.0.0 |
| Roku | **Tanzanite** 💜 | Roku OS 9+ | Built | 1.0.0 |

## Download Links

### Ready-to-Install

- **Kodi (Diamond)**: `releases/kodi/v1.0.0/watchnexus-diamond-1.0.0.zip`
- **Roku (Tanzanite)**: `releases/roku/v1.0.0/watchnexus-tanzanite-1.0.0.zip`

### Build from Source

These require Android Studio with Java 21:

- **Android TV (Ruby)**: `releases/androidtv/v1.0.0/watchnexus-ruby-1.0.0-source.zip`
- **Android Mobile (Sapphire)**: `releases/android/v1.0.0/watchnexus-sapphire-1.0.0-source.zip`
- **Fire TV (Ember)**: `releases/firestick/v1.0.0/watchnexus-ember-1.0.0-source.zip`

## Build Requirements

### Kodi (Diamond) ✅
- **Status**: Built and ready
- Python build script included
- Works with Kodi 19 (Matrix) and Kodi 20 (Nexus)

### Roku (Tanzanite) ✅
- **Status**: Built and ready
- BrighterScript compiled package
- Requires Developer Mode for sideloading

### Android Apps (Ruby, Sapphire, Ember) 📦
- **Status**: Source packages
- **Required**: 
  - Android Studio (Electric Eel+)
  - Java JDK 21
  - Android SDK 34+
- See individual README.md files for build instructions

## Jellyfin Compatibility

All clients connect via the Jellyfin-compatible API layer (`/api/emby`).
The WatchNexus server includes `jellyfin_compat.py` which translates API calls.

### Server Configuration

Clients should connect to: `http://<server-ip>:8001`

The server automatically routes:
- `/api/emby/*` → Jellyfin-compatible endpoints
- `/api/*` → Native WatchNexus endpoints

## Contributing

Each client is forked from the official Jellyfin repository:
- jellyfin-android → WatchNexus-Android (Sapphire)
- jellyfin-androidtv → WatchNexus-AndroidTV (Ruby) / WatchNexus-Firestick (Ember)
- jellyfin-kodi → WatchNexus-Kodi (Diamond)
- jellyfin-roku → WatchNexus-Roku (Tanzanite)

All clients are licensed under GPL-2.0.

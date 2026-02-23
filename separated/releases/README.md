# WatchNexus Releases

Pre-built release packages for WatchNexus.

## Structure

```
releases/
├── android/v1.0.0/          # Sapphire (Android Mobile)
├── androidtv/v1.0.0/        # Ruby (Android TV)
├── firestick/v1.0.0/        # Ember (Fire TV)
├── kodi/v1.0.0/             # Diamond (Kodi addon)
├── roku/v1.0.0/             # Tanzanite (Roku channel)
├── watchnexus-v1.0.0-macos/ # Server (macOS)
└── zips/                     # Compressed packages
```

## Client Apps

| App | Package | Status |
|-----|---------|--------|
| Diamond (Kodi) | `kodi/v1.0.0/watchnexus-diamond-1.0.0.zip` | ✅ Ready |
| Tanzanite (Roku) | `roku/v1.0.0/watchnexus-tanzanite-1.0.0.zip` | ✅ Ready |
| Ruby (Android TV) | `androidtv/v1.0.0/*-source.zip` | Source |
| Sapphire (Android) | `android/v1.0.0/*-source.zip` | Source |
| Ember (Fire TV) | `firestick/v1.0.0/*-source.zip` | Source |

## Server Packages

| Platform | Package |
|----------|---------|
| macOS | `watchnexus-v1.0.0-macos/` |
| Linux | Coming soon |
| Windows | Coming soon |

## Version Naming

- Server: `watchnexus-vX.Y.Z-{platform}`
- Clients: `watchnexus-{codename}-X.Y.Z`

## License

GPL-2.0

# WatchNexus Gadgets Guide

> **Quick reference for using and managing Gadgets (plugins) in WatchNexus**

---

## What are Gadgets?

**Gadgets** are WatchNexus's plugin system - modular extensions that add functionality to your media server. Think of them as "apps" for WatchNexus.

---

## Gadget Types

| Type | Icon | Description | Examples |
|------|------|-------------|----------|
| `metadata_provider` | 📊 | Fetches movie/TV info | TMDB, TVDB, AniDB |
| `indexer_provider` | 🔍 | Searches for content | Torrent sites, NZB indexers |
| `subtitle_provider` | 💬 | Downloads subtitles | OpenSubtitles, Addic7ed |
| `stream_provider` | 📺 | Provides video streams | YouTube, IPTV |
| `notification_provider` | 🔔 | Sends alerts | Discord, Telegram, Email |
| `theme_provider` | 🎨 | Custom UI themes | Color schemes, layouts |
| `scheduled_task` | ⏰ | Background jobs | Library scans, cleanup |
| `library_scanner` | 📁 | Custom scanning | Special folder structures |
| `player_extension` | ▶️ | Player enhancements | Intro skip, visualizers |
| `ui_extension` | 🖼️ | UI modifications | Custom pages, widgets |
| `integration` | 🔗 | External services | Trakt, Plex sync |

---

## Installing Gadgets

### From Plugin Marketplace

1. Go to **Plugins** in the sidebar
2. Browse **Featured** or search for plugins
3. Click **Install** on the desired gadget
4. Configure settings if prompted

### From Kodi Repository

1. Go to **Plugins** → **Kodi Browser** tab
2. Browse categories or search
3. Click on an addon to view details
4. Click **Install** to convert and install

### Manual Installation

1. Download the gadget `.zip` file
2. Go to **Settings** → **Plugins**
3. Click **Install from file**
4. Select the zip file

---

## Converting Plugins

WatchNexus can convert plugins from other platforms:

### Supported Ecosystems

| Platform | Format | Conversion Quality |
|----------|--------|-------------------|
| **Kodi** | `.zip` addon | ⭐⭐⭐⭐ Excellent |
| **Jellyfin/Emby** | `.dll` or `.js` | ⭐⭐⭐ Good |
| **Plex** | `.bundle` | ⭐⭐⭐ Good |

### How to Convert

1. Go to **Plugins** → **Convert Plugin** tab
2. Select the source ecosystem
3. Upload the plugin file
4. Click **Convert**
5. Review and install the converted gadget

---

## Managing Gadgets

### Settings → Plugins Tab

- **View installed**: See all active gadgets
- **Enable/Disable**: Toggle gadgets on/off
- **Configure**: Adjust gadget settings
- **Update**: Check for updates
- **Uninstall**: Remove gadgets

### Per-Gadget Settings

Each gadget may have its own settings:

```
Gadget Name
├── Enable/Disable toggle
├── API Key (if required)
├── Preferences
│   ├── Language
│   ├── Quality
│   └── Custom options
└── Actions
    ├── Test connection
    ├── Refresh data
    └── View logs
```

---

## Popular Gadgets

### Metadata

- **TMDB** - The Movie Database (built-in)
- **TVDB** - TV show database
- **AniDB** - Anime database
- **MusicBrainz** - Music metadata

### Subtitles

- **OpenSubtitles** - Largest subtitle database
- **Addic7ed** - TV show subtitles
- **Subscene** - Multi-language subtitles

### Notifications

- **Discord** - Discord webhook notifications
- **Telegram** - Telegram bot messages
- **Pushover** - Push notifications
- **Email** - SMTP email alerts

### Integrations

- **Trakt** - Watch history sync
- **Last.fm** - Music scrobbling
- **Simkl** - Anime tracking

---

## Troubleshooting

### Gadget Not Working

1. Check if gadget is enabled
2. Verify API keys are correct
3. Test connection in gadget settings
4. Check WatchNexus logs
5. Update to latest version

### Conversion Failed

1. Ensure file format is correct
2. Check if source plugin is compatible
3. Try with a different version
4. Check conversion logs for errors

### Performance Issues

1. Disable unused gadgets
2. Check if gadget is causing timeouts
3. Reduce concurrent operations
4. Update gadget to latest version

---

## Developer Resources

For creating your own gadgets, see:
- [Plugin Development Guide](/docs/PLUGIN-DEVELOPMENT-GUIDE.md)

---

*Last updated: December 2025*

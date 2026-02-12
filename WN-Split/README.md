# WatchNexus - Modular Media Pipeline 🎬

> One app to replace Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin

## Repositories

| Module | Description | Status |
|--------|-------------|--------|
| [wn-core](./wn-core) | 🎯 Core framework and utilities | ✅ |
| [wn-marmalade](./wn-marmalade) | 🍊 Media server & library | ✅ |
| [wn-compote](./wn-compote) | 🍇 Indexer manager + scrapers | ✅ |
| [wn-fondue](./wn-fondue) | 🫕 Torrent download engine | ✅ |
| [wn-garnish](./wn-garnish) | 🌿 Subtitle service | ✅ |
| [wn-potluck](./wn-potluck) | 🍲 Watch party service | ✅ |
| [wn-gelatin](./wn-gelatin) | 🍮 External access | ✅ |
| [wn-sieve](./wn-sieve) | 🫗 Media health checker | ✅ |
| [wn-milk](./wn-milk) | 🥛 Theme engine | ✅ |
| [wn-gadgets](./wn-gadgets) | 🔧 Plugin system | ✅ |
| [wn-relish](./wn-relish) | 🥒 IPTV/Live TV | ✅ |
| [wn-frontend](./wn-frontend) | 🖥️ React frontend | ✅ |
| [wn-electron](./wn-electron) | 💻 Desktop app | ✅ |
| [wn-docs](./wn-docs) | 📚 Documentation | ✅ |
| [wn-website](./wn-website) | 🌐 Marketing website | ✅ |

## Quick Start

```bash
# Clone all repositories
git clone https://github.com/WatchNexus/wn-core.git
git clone https://github.com/WatchNexus/wn-frontend.git
# ... etc

# Or use the meta package
pip install watchnexus
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   wn-frontend                        │
│                 (React + Tailwind)                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Marmalade │ │ Compote  │ │ Fondue   │ │Garnish │ │
│  │ (Media)  │ │(Indexers)│ │(Torrents)│ │ (Subs) │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Potluck  │ │ Gelatin  │ │  Milk    │ │Gadgets │ │
│  │ (Party)  │ │ (Remote) │ │ (Themes) │ │(Plugins│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
├─────────────────────────────────────────────────────┤
│                    wn-core                           │
│            (Database, Auth, Config)                  │
└─────────────────────────────────────────────────────┘
```

## License

MIT License - see individual repositories for details.

## Support

- [Documentation](./wn-docs)
- [Discord Community](https://discord.gg/watchnexus)
- [Kickstarter](https://kickstarter.com/watchnexus)

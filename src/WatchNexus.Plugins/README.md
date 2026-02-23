# WatchNexus.Plugins

This directory contains the WatchNexus plugin system and installed plugins.

## Structure

```
WatchNexus.Plugins/
├── core/                    # Core plugin infrastructure
│   ├── __init__.py
│   ├── base.py             # Base plugin classes
│   ├── loader.py           # Plugin loader
│   └── registry.py         # Plugin registry
├── builtin/                # Built-in plugins
│   ├── anidb_metadata/     # AniDB metadata provider
│   └── discord_notify/     # Discord notifications
└── installed/              # User-installed plugins
```

## Plugin Types

- **metadata_provider** - Provides media metadata (TMDB, AniDB, etc.)
- **indexer_provider** - Search indexers (torznab, newznab)
- **subtitle_provider** - Subtitle sources (OpenSubtitles, Addic7ed)
- **notification_provider** - Notifications (Discord, Telegram)
- **theme_provider** - Custom themes
- **scheduled_task** - Background tasks

## Creating a Plugin

See `/app/WN-Split/wn-docs/PLUGIN-DEVELOPMENT-GUIDE.md` for details.

```python
from WatchNexus.Plugins.core import GadgetPlugin, PluginType

class MyPlugin(GadgetPlugin):
    @property
    def name(self) -> str:
        return "My Plugin"
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.METADATA_PROVIDER
```

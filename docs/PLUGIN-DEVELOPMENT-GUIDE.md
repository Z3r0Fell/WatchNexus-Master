# WatchNexus Plugin Development Guide

> **Complete documentation for building, adapting, and publishing plugins for WatchNexus**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Native Plugin Development](#native-plugin-development)
3. [Adapting Kodi Addons](#adapting-kodi-addons)
4. [Adapting Jellyfin/Emby Plugins](#adapting-jellyfinemby-plugins)
5. [Adapting Plex Plugins](#adapting-plex-plugins)
6. [API Reference](#api-reference)
7. [Publishing Plugins](#publishing-plugins)

---

## Introduction

WatchNexus uses a modular plugin system called **Gadgets** that allows extending functionality through:

- **Native Plugins**: Built specifically for WatchNexus
- **Adapted Plugins**: Converted from Kodi, Jellyfin/Emby, or Plex

### Plugin Types

| Type | Description | Use Cases |
|------|-------------|-----------|
| `metadata_provider` | Fetches movie/TV metadata | TMDB, TVDB, AniDB |
| `indexer_provider` | Searches for content sources | Torrent indexers, NZB indexers |
| `subtitle_provider` | Downloads subtitles | OpenSubtitles, Addic7ed |
| `stream_provider` | Provides playable streams | YouTube, Twitch, IPTV |
| `notification_provider` | Sends notifications | Discord, Telegram, Email |
| `theme_provider` | Custom UI themes | Color schemes, layouts |
| `scheduled_task` | Background jobs | Library scanning, cleanup |
| `library_scanner` | Custom library scanning | Special folder structures |
| `player_extension` | Video player enhancements | Intro skip, visualizers |
| `ui_extension` | UI modifications | Custom pages, widgets |
| `integration` | External service integration | Trakt, Plex sync |

---

## Native Plugin Development

### Quick Start

Create a new plugin in minutes:

```
my-plugin/
├── manifest.json      # Plugin metadata (required)
├── main.py            # Entry point (required)
├── icon.png           # Plugin icon (recommended)
├── README.md          # Documentation
└── resources/         # Additional files
```

### manifest.json

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A brief description of what this plugin does",
  "author": "Your Name",
  "plugin_type": "metadata_provider",
  "entry_point": "main.py",
  "icon": "icon.png",
  "tags": ["movies", "metadata", "example"],
  "dependencies": [
    {"id": "requests", "version": ">=2.28.0"}
  ],
  "settings_schema": {
    "type": "object",
    "properties": {
      "api_key": {
        "type": "string",
        "title": "API Key",
        "description": "Your API key from the service"
      },
      "language": {
        "type": "string",
        "title": "Language",
        "default": "en",
        "enum": ["en", "es", "fr", "de", "ja"]
      }
    }
  },
  "permissions": ["network", "storage"],
  "min_version": "1.0.0",
  "homepage": "https://github.com/you/my-plugin",
  "license": "MIT"
}
```

### main.py - Basic Structure

```python
"""
My Plugin - WatchNexus Plugin
"""

from watchnexus.plugin import Plugin, PluginContext
from watchnexus import log, http, storage

class MyPlugin(Plugin):
    """
    Main plugin class. Must inherit from Plugin.
    """
    
    def __init__(self, context: PluginContext):
        super().__init__(context)
        # Initialize your plugin
        self.api_key = self.get_setting("api_key")
    
    def initialize(self):
        """Called when plugin is loaded."""
        log.info(f"{self.name} initialized")
    
    def shutdown(self):
        """Called when plugin is unloaded."""
        log.info(f"{self.name} shutting down")
    
    # Implement type-specific methods below...

# REQUIRED: Export your plugin class
plugin_class = MyPlugin
```

### Plugin Types - Implementation Examples

#### Metadata Provider

```python
from watchnexus.plugin import Plugin, PluginContext
from watchnexus.media import Movie, TVShow, Episode
from watchnexus import http

class MyMetadataProvider(Plugin):
    """Provides metadata from custom source."""
    
    def search_movie(self, title: str, year: int = None) -> list[Movie]:
        """
        Search for movies by title.
        
        Args:
            title: Movie title to search
            year: Optional release year filter
            
        Returns:
            List of Movie objects with metadata
        """
        results = http.get_json(f"{self.api_url}/search/movie", params={
            "query": title,
            "year": year
        })
        
        return [
            Movie(
                id=r["id"],
                title=r["title"],
                year=r["release_date"][:4],
                overview=r["overview"],
                poster=r["poster_path"],
                backdrop=r["backdrop_path"],
                rating=r["vote_average"],
                genres=r["genres"],
            )
            for r in results
        ]
    
    def get_movie_details(self, movie_id: str) -> Movie:
        """Get detailed metadata for a specific movie."""
        data = http.get_json(f"{self.api_url}/movie/{movie_id}")
        return Movie(
            id=data["id"],
            title=data["title"],
            original_title=data["original_title"],
            tagline=data["tagline"],
            overview=data["overview"],
            runtime=data["runtime"],
            # ... more fields
        )
    
    def search_tv(self, title: str) -> list[TVShow]:
        """Search for TV shows."""
        # Similar implementation
        pass
    
    def get_episode_details(self, show_id: str, season: int, episode: int) -> Episode:
        """Get episode metadata."""
        pass

plugin_class = MyMetadataProvider
```

#### Stream Provider

```python
from watchnexus.plugin import Plugin
from watchnexus.media import StreamItem, VideoQuality

class MyStreamProvider(Plugin):
    """Provides video streams from a service."""
    
    def get_categories(self) -> list[dict]:
        """Return browseable categories."""
        return [
            {"id": "movies", "name": "Movies", "icon": "🎬"},
            {"id": "shows", "name": "TV Shows", "icon": "📺"},
            {"id": "live", "name": "Live TV", "icon": "📡"},
        ]
    
    def get_category_items(self, category_id: str, page: int = 1) -> list[StreamItem]:
        """Get items in a category."""
        data = http.get_json(f"{self.api_url}/category/{category_id}", params={"page": page})
        
        return [
            StreamItem(
                id=item["id"],
                title=item["title"],
                thumbnail=item["thumb"],
                stream_url=item["url"],
                quality=VideoQuality.HD,
                is_live=category_id == "live",
            )
            for item in data["items"]
        ]
    
    def search(self, query: str) -> list[StreamItem]:
        """Search for content."""
        pass
    
    def get_stream_url(self, item_id: str) -> str:
        """Resolve final stream URL."""
        # May need to resolve redirects, extract from page, etc.
        data = http.get_json(f"{self.api_url}/resolve/{item_id}")
        return data["stream_url"]

plugin_class = MyStreamProvider
```

#### Subtitle Provider

```python
from watchnexus.plugin import Plugin
from watchnexus.media import Subtitle

class MySubtitleProvider(Plugin):
    """Downloads subtitles from a service."""
    
    def search_subtitles(
        self,
        title: str,
        year: int = None,
        imdb_id: str = None,
        season: int = None,
        episode: int = None,
        language: str = "en"
    ) -> list[Subtitle]:
        """
        Search for subtitles.
        
        Args:
            title: Movie/show title
            year: Release year
            imdb_id: IMDB ID (most reliable)
            season: Season number (for TV)
            episode: Episode number (for TV)
            language: ISO 639-1 language code
            
        Returns:
            List of available subtitles
        """
        params = {
            "query": title,
            "languages": language,
        }
        if imdb_id:
            params["imdb_id"] = imdb_id
        if season:
            params["season_number"] = season
            params["episode_number"] = episode
        
        results = http.get_json(f"{self.api_url}/subtitles", params=params)
        
        return [
            Subtitle(
                id=r["id"],
                title=r["release"],
                language=r["language"],
                format=r["format"],  # srt, vtt, ass
                download_url=r["url"],
                score=r["score"],
                hearing_impaired=r.get("hearing_impaired", False),
                forced=r.get("forced", False),
            )
            for r in results
        ]
    
    def download_subtitle(self, subtitle_id: str) -> str:
        """
        Download subtitle content.
        
        Returns:
            Subtitle file content as string
        """
        return http.get(f"{self.api_url}/download/{subtitle_id}").text

plugin_class = MySubtitleProvider
```

#### Notification Provider

```python
from watchnexus.plugin import Plugin
from watchnexus.events import Event

class MyNotificationProvider(Plugin):
    """Sends notifications to external service."""
    
    def send_notification(
        self,
        title: str,
        message: str,
        image_url: str = None,
        event_type: str = None
    ) -> bool:
        """
        Send a notification.
        
        Args:
            title: Notification title
            message: Main message body
            image_url: Optional image to include
            event_type: Type of event (download_complete, new_episode, etc.)
            
        Returns:
            True if sent successfully
        """
        webhook_url = self.get_setting("webhook_url")
        
        payload = {
            "title": title,
            "body": message,
        }
        if image_url:
            payload["image"] = image_url
        
        response = http.post_json(webhook_url, json=payload)
        return response.status_code == 200
    
    def on_event(self, event: Event):
        """
        Handle WatchNexus events.
        Called automatically for subscribed events.
        """
        if event.type == "download_complete":
            self.send_notification(
                title="Download Complete",
                message=f"{event.data['title']} has finished downloading",
                image_url=event.data.get("poster")
            )

plugin_class = MyNotificationProvider
```

#### Scheduled Task

```python
from watchnexus.plugin import Plugin
from watchnexus import schedule

class MyScheduledTask(Plugin):
    """Runs periodic background tasks."""
    
    def initialize(self):
        # Register scheduled jobs
        schedule.every(1).hours.do(self.hourly_task)
        schedule.every().day.at("03:00").do(self.daily_cleanup)
    
    def hourly_task(self):
        """Runs every hour."""
        log.info("Running hourly task...")
        # Your task logic
    
    def daily_cleanup(self):
        """Runs daily at 3 AM."""
        log.info("Running daily cleanup...")
        # Cleanup logic

plugin_class = MyScheduledTask
```

### Plugin Settings

Settings are defined in `manifest.json` and accessible via `self.get_setting()`:

```json
{
  "settings_schema": {
    "type": "object",
    "properties": {
      "api_key": {
        "type": "string",
        "title": "API Key",
        "description": "Your API key",
        "format": "password"
      },
      "enabled_features": {
        "type": "array",
        "title": "Enabled Features",
        "items": {"type": "string"},
        "default": ["feature1", "feature2"]
      },
      "max_results": {
        "type": "integer",
        "title": "Maximum Results",
        "default": 20,
        "minimum": 1,
        "maximum": 100
      },
      "quality": {
        "type": "string",
        "title": "Preferred Quality",
        "enum": ["4K", "1080p", "720p", "480p"],
        "default": "1080p"
      },
      "auto_download": {
        "type": "boolean",
        "title": "Auto Download",
        "default": false
      }
    },
    "required": ["api_key"]
  }
}
```

### Storage API

```python
from watchnexus import storage

class MyPlugin(Plugin):
    def save_data(self):
        # Save plugin-specific data
        storage.set("my_cache", {"key": "value"})
        storage.set("last_sync", "2024-01-01")
    
    def load_data(self):
        cache = storage.get("my_cache", default={})
        last_sync = storage.get("last_sync")
    
    def save_file(self):
        # Save files to plugin data directory
        storage.save_file("cache.json", json.dumps(data))
        content = storage.load_file("cache.json")
```

### HTTP API

```python
from watchnexus import http

# GET request
response = http.get("https://api.example.com/data")
data = response.json()

# GET with parameters
data = http.get_json("https://api.example.com/search", params={
    "q": "query",
    "limit": 10
})

# POST request
response = http.post_json("https://api.example.com/submit", json={
    "title": "Test",
    "value": 123
})

# With custom headers
response = http.get("https://api.example.com/data", headers={
    "Authorization": "Bearer token123",
    "X-Custom": "value"
})

# File download
http.download_file("https://example.com/file.zip", "/path/to/save.zip")
```

### Events System

```python
from watchnexus import events

class MyPlugin(Plugin):
    def initialize(self):
        # Subscribe to events
        events.subscribe("library_scan_complete", self.on_scan_complete)
        events.subscribe("download_started", self.on_download)
        events.subscribe("playback_started", self.on_play)
    
    def on_scan_complete(self, event):
        log.info(f"Scan complete: {event.data['items_added']} new items")
    
    def shutdown(self):
        events.unsubscribe_all(self)

# Available events:
# - library_scan_complete
# - library_item_added
# - library_item_removed
# - download_started
# - download_progress
# - download_complete
# - download_failed
# - playback_started
# - playback_stopped
# - playback_progress
# - user_login
# - user_logout
# - settings_changed
```

---

## Adapting Kodi Addons

### Overview

Kodi addons use Python with the `xbmc*` modules. WatchNexus provides a compatibility shim that maps these to native APIs.

### Automatic Conversion

```python
from plugin_adapter import convert_kodi_addon

# Convert a Kodi addon
manifest, output_path = convert_kodi_addon("/path/to/addon.zip")

if manifest:
    print(f"Converted: {manifest.name}")
    print(f"Output: {output_path}")
else:
    print(f"Error: {output_path}")
```

### Manual Conversion Guide

#### 1. Manifest Conversion

**Kodi addon.xml:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<addon id="plugin.video.example" name="Example Plugin" version="1.0.0" provider-name="Developer">
  <requires>
    <import addon="xbmc.python" version="3.0.0"/>
    <import addon="script.module.requests"/>
  </requires>
  <extension point="xbmc.python.pluginsource" library="main.py">
    <provides>video</provides>
  </extension>
  <extension point="xbmc.addon.metadata">
    <summary>An example video plugin</summary>
    <description>Longer description here</description>
  </extension>
</addon>
```

**WatchNexus manifest.json:**
```json
{
  "id": "wn.adapted.kodi.plugin_video_example",
  "name": "Example Plugin",
  "version": "1.0.0",
  "description": "An example video plugin",
  "author": "Developer",
  "plugin_type": "stream_provider",
  "entry_point": "main.py",
  "tags": ["video"],
  "dependencies": [
    {"id": "requests", "version": "*"}
  ],
  "source_ecosystem": "kodi",
  "source_id": "plugin.video.example"
}
```

#### 2. API Mapping

| Kodi API | WatchNexus API |
|----------|----------------|
| `xbmc.log()` | `watchnexus.log()` |
| `xbmc.Player()` | `watchnexus.player.Player()` |
| `xbmc.translatePath()` | `watchnexus.paths.translate()` |
| `xbmcgui.Dialog()` | `watchnexus.ui.Dialog()` |
| `xbmcgui.ListItem()` | `watchnexus.media.ListItem()` |
| `xbmcplugin.addDirectoryItem()` | `watchnexus.plugin.add_item()` |
| `xbmcplugin.setResolvedUrl()` | `watchnexus.plugin.set_resolved_url()` |
| `xbmcaddon.Addon()` | `watchnexus.plugin.Addon()` |
| `xbmcvfs.exists()` | `watchnexus.fs.exists()` |

#### 3. Code Conversion Example

**Original Kodi code:**
```python
import xbmc
import xbmcgui
import xbmcplugin
import xbmcaddon

addon = xbmcaddon.Addon()
addon_name = addon.getAddonInfo('name')

def list_videos():
    xbmc.log(f'{addon_name}: Listing videos', xbmc.LOGINFO)
    
    items = get_video_list()
    for item in items:
        li = xbmcgui.ListItem(label=item['title'])
        li.setInfo('video', {'title': item['title'], 'plot': item['plot']})
        li.setArt({'thumb': item['thumb'], 'fanart': item['fanart']})
        
        xbmcplugin.addDirectoryItem(
            handle=int(sys.argv[1]),
            url=item['url'],
            listitem=li,
            isFolder=False
        )
    
    xbmcplugin.endOfDirectory(int(sys.argv[1]))

def play_video(url):
    li = xbmcgui.ListItem(path=url)
    xbmcplugin.setResolvedUrl(int(sys.argv[1]), True, li)
```

**Converted WatchNexus code:**
```python
from watchnexus.compat.kodi import xbmc, xbmcgui, xbmcplugin, xbmcaddon
# Or use native API:
from watchnexus.plugin import Plugin
from watchnexus import log
from watchnexus.media import ListItem

class ExamplePlugin(Plugin):
    def list_videos(self):
        log.info(f'{self.name}: Listing videos')
        
        items = self.get_video_list()
        result = []
        for item in items:
            li = ListItem(
                title=item['title'],
                metadata={'plot': item['plot']},
                artwork={'thumb': item['thumb'], 'fanart': item['fanart']},
                url=item['url']
            )
            result.append(li)
        
        return result  # WatchNexus handles rendering
    
    def play_video(self, url):
        # Return playable URL
        return {"url": url, "resolved": True}

plugin_class = ExamplePlugin
```

### Kodi Settings Conversion

**Kodi resources/settings.xml:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<settings>
  <category label="General">
    <setting id="api_key" type="text" label="API Key" default=""/>
    <setting id="quality" type="enum" label="Quality" values="4K|1080p|720p" default="1080p"/>
    <setting id="adult_content" type="bool" label="Show Adult Content" default="false"/>
  </category>
</settings>
```

**WatchNexus settings_schema:**
```json
{
  "type": "object",
  "properties": {
    "api_key": {
      "type": "string",
      "title": "API Key",
      "default": ""
    },
    "quality": {
      "type": "string",
      "title": "Quality",
      "enum": ["4K", "1080p", "720p"],
      "default": "1080p"
    },
    "adult_content": {
      "type": "boolean",
      "title": "Show Adult Content",
      "default": false
    }
  }
}
```

---

## Adapting Jellyfin/Emby Plugins

### Overview

Jellyfin/Emby plugins are primarily C# or JavaScript. C# plugins require manual rewriting in Python, while JS plugins can be partially automated.

### Automatic Conversion

```python
from plugin_adapter import convert_jellyfin_plugin

manifest, output_path = convert_jellyfin_plugin("/path/to/plugin")
```

### Plugin Types Mapping

| Jellyfin Type | WatchNexus Type |
|---------------|-----------------|
| `Channel` | `stream_provider` |
| `MetadataProvider` | `metadata_provider` |
| `MetadataFetcher` | `metadata_provider` |
| `SubtitleProvider` | `subtitle_provider` |
| `Notification` | `notification_provider` |
| `Authentication` | `integration` |
| `LiveTv` | `stream_provider` |
| `Theme` | `theme_provider` |

### C# to Python Conversion Guide

#### Interface Mapping

| Jellyfin C# Interface | WatchNexus Python |
|----------------------|-------------------|
| `IMetadataProvider<Movie>` | `MetadataProvider.search_movie()` |
| `IRemoteMetadataProvider<Series>` | `MetadataProvider.search_tv()` |
| `ISubtitleProvider` | `SubtitleProvider.search_subtitles()` |
| `IChannel` | `StreamProvider.get_categories()` |
| `INotificationService` | `NotificationProvider.send_notification()` |

#### Example: Metadata Provider

**Jellyfin C#:**
```csharp
public class MyMetadataProvider : IRemoteMetadataProvider<Movie, MovieInfo>
{
    public async Task<IEnumerable<RemoteSearchResult>> GetSearchResults(
        MovieInfo searchInfo, CancellationToken cancellationToken)
    {
        var results = new List<RemoteSearchResult>();
        
        var response = await _httpClient.GetAsync($"{ApiUrl}/search?q={searchInfo.Name}");
        var data = await response.Content.ReadAsAsync<SearchResponse>();
        
        foreach (var item in data.Results)
        {
            results.Add(new RemoteSearchResult
            {
                Name = item.Title,
                ProductionYear = item.Year,
                ImageUrl = item.Poster
            });
        }
        
        return results;
    }
    
    public async Task<MetadataResult<Movie>> GetMetadata(
        MovieInfo info, CancellationToken cancellationToken)
    {
        // Fetch and return full metadata
    }
}
```

**WatchNexus Python:**
```python
from watchnexus.plugin import Plugin
from watchnexus.media import Movie
from watchnexus import http

class MyMetadataProvider(Plugin):
    def search_movie(self, title: str, year: int = None) -> list[Movie]:
        data = http.get_json(f"{self.api_url}/search", params={"q": title})
        
        return [
            Movie(
                title=item["Title"],
                year=item["Year"],
                poster=item["Poster"]
            )
            for item in data["Results"]
        ]
    
    def get_movie_details(self, movie_id: str) -> Movie:
        # Fetch and return full metadata
        pass

plugin_class = MyMetadataProvider
```

### JavaScript Plugin Conversion

Jellyfin JS plugins are typically UI extensions. Convert them to WatchNexus UI extension format:

**Jellyfin plugin.js:**
```javascript
export default function (view, params) {
    view.addEventListener('viewshow', function () {
        ApiClient.getJSON('/Items').then(function(items) {
            renderItems(view, items);
        });
    });
}
```

**WatchNexus (as UI extension with HTML template):**
```python
from watchnexus.plugin import Plugin
from watchnexus import http

class MyUIExtension(Plugin):
    def get_page_content(self):
        items = http.get_json(f"{self.context.api_url}/api/items")
        return self.render_template("page.html", items=items)

plugin_class = MyUIExtension
```

---

## Adapting Plex Plugins

### Overview

Plex plugins use the Plex Framework with special decorators and objects. They're Python-based but use a custom API.

### Automatic Conversion

```python
from plugin_adapter import convert_plex_plugin

manifest, output_path = convert_plex_plugin("/path/to/Plugin.bundle")
```

### Plex Framework to WatchNexus Mapping

| Plex Framework | WatchNexus |
|----------------|------------|
| `@handler(prefix, name)` | `@watchnexus.route(path)` |
| `@route(path)` | `@watchnexus.route(path)` |
| `ObjectContainer` | `list[StreamItem]` |
| `DirectoryObject` | `StreamItem(is_folder=True)` |
| `VideoClipObject` | `StreamItem` |
| `MovieObject` | `Movie` |
| `EpisodeObject` | `Episode` |
| `Prefs['key']` | `self.get_setting('key')` |
| `Dict['key']` | `storage.get('key')` |
| `HTTP.Request(url)` | `http.get(url)` |
| `JSON.ObjectFromURL(url)` | `http.get_json(url)` |
| `XML.ElementFromURL(url)` | `http.get_xml(url)` |

### Example Conversion

**Plex Framework:**
```python
PREFIX = '/video/example'
NAME = 'Example Channel'

@handler(PREFIX, NAME)
def MainMenu():
    oc = ObjectContainer(title1=NAME)
    
    oc.add(DirectoryObject(
        key=Callback(Categories),
        title='Categories',
        thumb=R('icon-categories.png')
    ))
    
    return oc

@route(PREFIX + '/categories')
def Categories():
    oc = ObjectContainer(title1='Categories')
    
    data = JSON.ObjectFromURL('https://api.example.com/categories')
    
    for cat in data['categories']:
        oc.add(DirectoryObject(
            key=Callback(CategoryItems, cat_id=cat['id']),
            title=cat['name'],
            thumb=cat['thumb']
        ))
    
    return oc

@route(PREFIX + '/category/{cat_id}')
def CategoryItems(cat_id):
    oc = ObjectContainer()
    
    data = JSON.ObjectFromURL(f'https://api.example.com/category/{cat_id}')
    
    for item in data['items']:
        oc.add(VideoClipObject(
            title=item['title'],
            summary=item['description'],
            thumb=item['thumbnail'],
            url=item['stream_url']
        ))
    
    return oc
```

**WatchNexus Native:**
```python
from watchnexus.plugin import Plugin
from watchnexus.media import StreamItem
from watchnexus import http

class ExampleChannel(Plugin):
    def get_categories(self):
        """Return main menu items."""
        return [
            StreamItem(
                id="categories",
                title="Categories",
                thumbnail=self.get_resource("icon-categories.png"),
                is_folder=True
            )
        ]
    
    def get_category_list(self):
        """Get all categories."""
        data = http.get_json("https://api.example.com/categories")
        
        return [
            StreamItem(
                id=cat["id"],
                title=cat["name"],
                thumbnail=cat["thumb"],
                is_folder=True
            )
            for cat in data["categories"]
        ]
    
    def get_category_items(self, cat_id):
        """Get items in a category."""
        data = http.get_json(f"https://api.example.com/category/{cat_id}")
        
        return [
            StreamItem(
                id=item["id"],
                title=item["title"],
                description=item["description"],
                thumbnail=item["thumbnail"],
                stream_url=item["stream_url"],
                is_folder=False
            )
            for item in data["items"]
        ]

plugin_class = ExampleChannel
```

### Converting Plex Preferences

**DefaultPrefs.json:**
```json
[
  {
    "id": "username",
    "type": "text",
    "default": "",
    "label": "Username"
  },
  {
    "id": "password",
    "type": "text",
    "default": "",
    "label": "Password",
    "option": "hidden"
  },
  {
    "id": "quality",
    "type": "enum",
    "default": "720",
    "label": "Quality",
    "values": "1080|720|480"
  }
]
```

**WatchNexus settings_schema:**
```json
{
  "type": "object",
  "properties": {
    "username": {
      "type": "string",
      "title": "Username",
      "default": ""
    },
    "password": {
      "type": "string",
      "title": "Password",
      "default": "",
      "format": "password"
    },
    "quality": {
      "type": "string",
      "title": "Quality",
      "enum": ["1080", "720", "480"],
      "default": "720"
    }
  }
}
```

---

## API Reference

### Core Modules

#### watchnexus.plugin

```python
from watchnexus.plugin import Plugin, PluginContext

class Plugin:
    """Base class for all plugins."""
    
    context: PluginContext  # Plugin context with paths, settings, etc.
    name: str               # Plugin name
    version: str            # Plugin version
    
    def get_setting(self, key: str, default=None) -> Any:
        """Get a plugin setting."""
    
    def set_setting(self, key: str, value: Any):
        """Save a plugin setting."""
    
    def get_resource(self, name: str) -> str:
        """Get path to a resource file."""
    
    def initialize(self):
        """Called when plugin loads. Override this."""
    
    def shutdown(self):
        """Called when plugin unloads. Override this."""

class PluginContext:
    """Context provided to plugins."""
    
    plugin_id: str          # Plugin identifier
    plugin_path: str        # Path to plugin directory
    data_path: str          # Path for plugin data storage
    api_url: str            # WatchNexus API base URL
```

#### watchnexus.http

```python
from watchnexus import http

# Basic requests
response = http.get(url, params=None, headers=None, timeout=30)
response = http.post(url, data=None, json=None, headers=None)
response = http.put(url, data=None, json=None, headers=None)
response = http.delete(url, headers=None)

# Convenience methods
data = http.get_json(url, params=None, headers=None)
data = http.post_json(url, json=None, headers=None)
xml = http.get_xml(url, params=None, headers=None)
html = http.get_html(url, params=None, headers=None)

# File operations
http.download_file(url, save_path, progress_callback=None)
```

#### watchnexus.storage

```python
from watchnexus import storage

# Key-value storage
storage.set(key, value)
value = storage.get(key, default=None)
storage.delete(key)

# File storage (in plugin's data directory)
storage.save_file(filename, content)
content = storage.load_file(filename)
exists = storage.file_exists(filename)
storage.delete_file(filename)
```

#### watchnexus.log

```python
from watchnexus import log

log.debug(message)
log.info(message)
log.warning(message)
log.error(message)
log.critical(message)
```

#### watchnexus.events

```python
from watchnexus import events

# Subscribe to events
events.subscribe(event_type, callback)
events.unsubscribe(event_type, callback)
events.unsubscribe_all(plugin_instance)

# Emit custom events
events.emit(event_type, data)
```

### Media Types

```python
from watchnexus.media import (
    Movie, TVShow, Episode, Season,
    Artist, Album, Track,
    StreamItem, ListItem, Subtitle
)

# Movie
movie = Movie(
    id="123",
    title="Movie Title",
    original_title="Original Title",
    year=2024,
    overview="Plot summary...",
    tagline="The tagline",
    runtime=120,  # minutes
    genres=["Action", "Drama"],
    rating=8.5,
    poster="/path/to/poster.jpg",
    backdrop="/path/to/backdrop.jpg",
    imdb_id="tt1234567",
    tmdb_id="12345",
)

# TV Show
show = TVShow(
    id="456",
    title="Show Title",
    year=2020,
    end_year=None,  # Still running
    overview="Series description",
    seasons=[Season(...)],
)

# Episode
episode = Episode(
    id="789",
    title="Episode Title",
    season_number=1,
    episode_number=5,
    air_date="2024-01-15",
    overview="Episode plot",
    runtime=45,
)

# Stream Item (for providers)
item = StreamItem(
    id="item_123",
    title="Video Title",
    description="Description",
    thumbnail="https://...",
    stream_url="https://...",
    quality=VideoQuality.HD_1080,
    is_folder=False,
    is_live=False,
    metadata={},
)

# Subtitle
sub = Subtitle(
    id="sub_123",
    title="English (SDH)",
    language="en",
    format="srt",
    download_url="https://...",
    hearing_impaired=True,
)
```

---

## Publishing Plugins

### Plugin Repository Structure

```
plugins/
├── metadata/
│   ├── index.json           # Plugin index
│   └── icons/               # Plugin icons
├── packages/
│   └── plugin-id/
│       ├── 1.0.0.zip        # Version packages
│       └── 1.1.0.zip
└── README.md
```

### index.json Format

```json
{
  "plugins": [
    {
      "id": "com.example.my-plugin",
      "name": "My Plugin",
      "description": "Plugin description",
      "author": "Your Name",
      "plugin_type": "metadata_provider",
      "latest_version": "1.1.0",
      "versions": [
        {
          "version": "1.1.0",
          "released": "2024-01-15",
          "download_url": "packages/com.example.my-plugin/1.1.0.zip",
          "changelog": "Bug fixes and improvements",
          "min_watchnexus_version": "1.0.0"
        },
        {
          "version": "1.0.0",
          "released": "2024-01-01",
          "download_url": "packages/com.example.my-plugin/1.0.0.zip"
        }
      ],
      "icon": "icons/my-plugin.png",
      "homepage": "https://github.com/you/my-plugin",
      "tags": ["movies", "metadata"]
    }
  ]
}
```

### Submitting to WatchNexus Repository

1. Fork the official plugin repository
2. Add your plugin to the appropriate category
3. Submit a pull request with:
   - Plugin package (.zip)
   - Updated index.json
   - Icon file
4. Wait for review and approval

### Best Practices

1. **Use semantic versioning** (major.minor.patch)
2. **Include comprehensive README** with setup instructions
3. **Handle errors gracefully** with user-friendly messages
4. **Respect rate limits** of external APIs
5. **Cache responses** where appropriate
6. **Test thoroughly** before publishing
7. **Keep dependencies minimal**
8. **Document all settings**

---

## Support & Resources

- **GitHub**: https://github.com/watchnexus
- **Discord**: https://discord.gg/watchnexus
- **Documentation**: https://docs.watchnexus.com

---

*Last updated: December 2024*

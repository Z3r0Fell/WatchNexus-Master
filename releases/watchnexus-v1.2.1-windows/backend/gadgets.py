"""
Gadgets - WatchNexus Plugin/Extension System
🔧 Extend WatchNexus functionality with custom plugins

Inspired by Jellyfin's plugin architecture but adapted for Python/FastAPI.

Plugin Types:
- MetadataProvider: Custom metadata sources (IMDB, AniDB, etc.)
- IndexerProvider: Additional torrent/usenet indexers
- SubtitleProvider: Custom subtitle sources
- NotificationProvider: Slack, Discord, Email notifications
- ThemeProvider: Custom UI themes (integrates with Milk)
- StreamProvider: External streaming sources (IPTV, etc.)
- AuthProvider: Custom authentication (LDAP, SSO, etc.)
- ScheduledTask: Background jobs and automation
"""

import os
import sys
import json
import uuid
import asyncio
import logging
import importlib
import importlib.util
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional, Any, Type
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class PluginType(Enum):
    """Types of plugins supported by Gadgets."""
    METADATA_PROVIDER = "metadata_provider"
    INDEXER_PROVIDER = "indexer_provider"
    SUBTITLE_PROVIDER = "subtitle_provider"
    NOTIFICATION_PROVIDER = "notification_provider"
    THEME_PROVIDER = "theme_provider"
    STREAM_PROVIDER = "stream_provider"
    AUTH_PROVIDER = "auth_provider"
    SCHEDULED_TASK = "scheduled_task"
    GENERAL = "general"


class PluginStatus(Enum):
    """Plugin status states."""
    INSTALLED = "installed"
    ACTIVE = "active"
    DISABLED = "disabled"
    ERROR = "error"
    UPDATING = "updating"


@dataclass
class PluginManifest:
    """
    Plugin manifest containing metadata.
    Each plugin must have a manifest.json file.
    """
    id: str                          # Unique plugin ID (UUID)
    name: str                        # Display name
    description: str                 # Short description
    version: str                     # Semantic version
    author: str                      # Author name
    plugin_type: PluginType          # Type of plugin
    entry_point: str                 # Main module/class name
    
    # Optional fields
    homepage: str = ""               # Project homepage
    repository: str = ""             # Source repository
    license: str = "MIT"             # License type
    min_watchnexus_version: str = "1.0.0"
    max_watchnexus_version: str = ""
    dependencies: List[str] = field(default_factory=list)
    settings_schema: Dict = field(default_factory=dict)
    icon: str = ""                   # Base64 or URL
    tags: List[str] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: dict) -> "PluginManifest":
        """Create manifest from dictionary."""
        plugin_type = data.get("plugin_type", "general")
        if isinstance(plugin_type, str):
            plugin_type = PluginType(plugin_type)
        
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            name=data["name"],
            description=data.get("description", ""),
            version=data.get("version", "1.0.0"),
            author=data.get("author", "Unknown"),
            plugin_type=plugin_type,
            entry_point=data.get("entry_point", "main.Plugin"),
            homepage=data.get("homepage", ""),
            repository=data.get("repository", ""),
            license=data.get("license", "MIT"),
            min_watchnexus_version=data.get("min_watchnexus_version", "1.0.0"),
            max_watchnexus_version=data.get("max_watchnexus_version", ""),
            dependencies=data.get("dependencies", []),
            settings_schema=data.get("settings_schema", {}),
            icon=data.get("icon", ""),
            tags=data.get("tags", []),
        )
    
    def to_dict(self) -> dict:
        """Convert manifest to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "author": self.author,
            "plugin_type": self.plugin_type.value,
            "entry_point": self.entry_point,
            "homepage": self.homepage,
            "repository": self.repository,
            "license": self.license,
            "min_watchnexus_version": self.min_watchnexus_version,
            "max_watchnexus_version": self.max_watchnexus_version,
            "dependencies": self.dependencies,
            "settings_schema": self.settings_schema,
            "icon": self.icon,
            "tags": self.tags,
        }


class GadgetPlugin(ABC):
    """
    Base class for all WatchNexus plugins.
    
    Every plugin must extend this class and implement required methods.
    
    Example:
    ```python
    from gadgets import GadgetPlugin, PluginType
    
    class MyPlugin(GadgetPlugin):
        @property
        def name(self) -> str:
            return "My Awesome Plugin"
        
        @property
        def plugin_id(self) -> str:
            return "my-awesome-plugin"
        
        @property
        def plugin_type(self) -> PluginType:
            return PluginType.GENERAL
        
        async def initialize(self) -> bool:
            # Setup code here
            return True
        
        async def shutdown(self):
            # Cleanup code here
            pass
    ```
    """
    
    def __init__(self, plugin_dir: Path, settings: Dict[str, Any] = None):
        self.plugin_dir = plugin_dir
        self._settings = settings or {}
        self._status = PluginStatus.INSTALLED
        self._error_message = ""
        self._initialized = False
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Plugin display name."""
        pass
    
    @property
    @abstractmethod
    def plugin_id(self) -> str:
        """Unique plugin identifier."""
        pass
    
    @property
    @abstractmethod
    def plugin_type(self) -> PluginType:
        """Type of plugin."""
        pass
    
    @property
    def version(self) -> str:
        """Plugin version."""
        return "1.0.0"
    
    @property
    def description(self) -> str:
        """Plugin description."""
        return ""
    
    @property
    def author(self) -> str:
        """Plugin author."""
        return "Unknown"
    
    @property
    def status(self) -> PluginStatus:
        """Current plugin status."""
        return self._status
    
    @property
    def settings(self) -> Dict[str, Any]:
        """Plugin settings."""
        return self._settings
    
    @settings.setter
    def settings(self, value: Dict[str, Any]):
        self._settings = value
    
    def get_settings_schema(self) -> Dict:
        """
        Return JSON Schema for plugin settings.
        Override to define custom settings.
        """
        return {}
    
    @abstractmethod
    async def initialize(self) -> bool:
        """
        Initialize the plugin.
        Called when plugin is loaded/activated.
        
        Returns:
            True if initialization successful, False otherwise.
        """
        pass
    
    @abstractmethod
    async def shutdown(self):
        """
        Shutdown the plugin.
        Called when plugin is disabled/unloaded.
        """
        pass
    
    async def on_settings_changed(self, old_settings: Dict, new_settings: Dict):
        """
        Called when plugin settings are updated.
        Override to handle settings changes.
        """
        self._settings = new_settings
    
    def get_api_routes(self) -> List[dict]:
        """
        Return list of API routes to register.
        Each route is a dict with: path, method, handler, description
        
        Example:
        ```python
        def get_api_routes(self):
            return [
                {
                    "path": "/my-plugin/status",
                    "method": "GET",
                    "handler": self.get_status,
                    "description": "Get plugin status"
                }
            ]
        ```
        """
        return []
    
    def to_dict(self) -> dict:
        """Convert plugin info to dictionary."""
        return {
            "id": self.plugin_id,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "plugin_type": self.plugin_type.value,
            "status": self._status.value,
            "error_message": self._error_message,
            "settings": self._settings,
        }


# ============================================================
# Provider Interfaces
# ============================================================

class MetadataProvider(GadgetPlugin):
    """Interface for metadata provider plugins."""
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.METADATA_PROVIDER
    
    @abstractmethod
    async def search(self, query: str, media_type: str = "movie") -> List[dict]:
        """Search for media by title."""
        pass
    
    @abstractmethod
    async def get_details(self, media_id: str) -> Optional[dict]:
        """Get detailed metadata for a specific item."""
        pass
    
    async def get_images(self, media_id: str) -> List[dict]:
        """Get images (posters, backdrops) for media."""
        return []


class IndexerProvider(GadgetPlugin):
    """Interface for indexer provider plugins."""
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.INDEXER_PROVIDER
    
    @abstractmethod
    async def search(self, query: str, category: str = "all") -> List[dict]:
        """Search for torrents/releases."""
        pass
    
    @abstractmethod
    async def get_download_link(self, result_id: str) -> Optional[str]:
        """Get magnet/torrent download link."""
        pass


class SubtitleProvider(GadgetPlugin):
    """Interface for subtitle provider plugins."""
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.SUBTITLE_PROVIDER
    
    @abstractmethod
    async def search_tv(
        self, show: str, season: int, episode: int, languages: List[str]
    ) -> List[dict]:
        """Search subtitles for TV show."""
        pass
    
    @abstractmethod
    async def search_movie(
        self, title: str, year: int = None, languages: List[str] = None
    ) -> List[dict]:
        """Search subtitles for movie."""
        pass
    
    @abstractmethod
    async def download(self, subtitle_id: str, save_path: str) -> Optional[str]:
        """Download subtitle file."""
        pass


class NotificationProvider(GadgetPlugin):
    """Interface for notification provider plugins."""
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.NOTIFICATION_PROVIDER
    
    @abstractmethod
    async def send(
        self,
        title: str,
        message: str,
        level: str = "info",
        **kwargs
    ) -> bool:
        """Send notification."""
        pass
    
    async def test(self) -> bool:
        """Test notification delivery."""
        return await self.send(
            title="WatchNexus Test",
            message="This is a test notification from WatchNexus.",
            level="info"
        )


class ThemeProvider(GadgetPlugin):
    """Interface for theme provider plugins (integrates with Milk)."""
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.THEME_PROVIDER
    
    @abstractmethod
    def get_theme_config(self) -> dict:
        """Return theme configuration (colors, fonts, etc.)."""
        pass
    
    @abstractmethod
    def get_css_overrides(self) -> str:
        """Return custom CSS to inject."""
        pass
    
    def get_assets(self) -> Dict[str, str]:
        """Return additional assets (fonts, images)."""
        return {}


class ScheduledTask(GadgetPlugin):
    """Interface for scheduled task plugins."""
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.SCHEDULED_TASK
    
    @property
    @abstractmethod
    def schedule(self) -> str:
        """
        Cron-style schedule string.
        Examples: "0 * * * *" (hourly), "0 0 * * *" (daily)
        """
        pass
    
    @abstractmethod
    async def run(self) -> dict:
        """
        Execute the scheduled task.
        Returns dict with results/status.
        """
        pass
    
    async def get_last_run(self) -> Optional[datetime]:
        """Get timestamp of last run."""
        return None


# ============================================================
# Plugin Manager
# ============================================================

class GadgetsManager:
    """
    Gadgets - Central plugin manager for WatchNexus.
    
    Handles:
    - Plugin discovery and loading
    - Plugin lifecycle (init, shutdown, enable, disable)
    - Settings management
    - API route registration
    - Plugin repository/marketplace
    """
    
    def __init__(self, plugins_dir: str = None):
        self.plugins_dir = Path(plugins_dir or os.environ.get(
            "WATCHNEXUS_PLUGINS_DIR",
            os.path.join(os.path.dirname(__file__), "plugins")
        ))
        self.plugins_dir.mkdir(parents=True, exist_ok=True)
        
        self._plugins: Dict[str, GadgetPlugin] = {}
        self._manifests: Dict[str, PluginManifest] = {}
        self._settings_file = self.plugins_dir / "settings.json"
        self._plugin_settings: Dict[str, Dict] = {}
        
        # Provider registries
        self._metadata_providers: List[MetadataProvider] = []
        self._indexer_providers: List[IndexerProvider] = []
        self._subtitle_providers: List[SubtitleProvider] = []
        self._notification_providers: List[NotificationProvider] = []
        self._theme_providers: List[ThemeProvider] = []
        self._scheduled_tasks: List[ScheduledTask] = []
        
        # Load saved settings
        self._load_settings()
    
    def _load_settings(self):
        """Load plugin settings from file."""
        if self._settings_file.exists():
            try:
                with open(self._settings_file, "r") as f:
                    self._plugin_settings = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load plugin settings: {e}")
                self._plugin_settings = {}
    
    def _save_settings(self):
        """Save plugin settings to file."""
        try:
            with open(self._settings_file, "w") as f:
                json.dump(self._plugin_settings, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save plugin settings: {e}")
    
    async def discover_plugins(self) -> List[PluginManifest]:
        """
        Discover installed plugins.
        Scans plugins directory for valid plugin packages.
        """
        discovered = []
        
        for item in self.plugins_dir.iterdir():
            if not item.is_dir():
                continue
            
            manifest_path = item / "manifest.json"
            if not manifest_path.exists():
                continue
            
            try:
                with open(manifest_path, "r") as f:
                    manifest_data = json.load(f)
                
                manifest = PluginManifest.from_dict(manifest_data)
                self._manifests[manifest.id] = manifest
                discovered.append(manifest)
                
                logger.info(f"Discovered plugin: {manifest.name} v{manifest.version}")
                
            except Exception as e:
                logger.error(f"Failed to load manifest from {item}: {e}")
        
        return discovered
    
    async def load_plugin(self, plugin_id: str) -> Optional[GadgetPlugin]:
        """
        Load and initialize a plugin.
        
        Args:
            plugin_id: Plugin identifier
        
        Returns:
            Plugin instance if successful, None otherwise
        """
        if plugin_id in self._plugins:
            return self._plugins[plugin_id]
        
        manifest = self._manifests.get(plugin_id)
        if not manifest:
            logger.error(f"Plugin manifest not found: {plugin_id}")
            return None
        
        plugin_dir = self.plugins_dir / plugin_id
        
        try:
            # Parse entry point (module.ClassName)
            module_name, class_name = manifest.entry_point.rsplit(".", 1)
            
            # Load module
            module_path = plugin_dir / f"{module_name.replace('.', '/')}.py"
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            
            # Get plugin class
            plugin_class = getattr(module, class_name)
            
            # Get saved settings
            settings = self._plugin_settings.get(plugin_id, {})
            
            # Create instance
            plugin = plugin_class(plugin_dir, settings)
            
            # Initialize
            if await plugin.initialize():
                plugin._status = PluginStatus.ACTIVE
                plugin._initialized = True
                
                # Register with appropriate provider list
                self._register_provider(plugin)
                
                self._plugins[plugin_id] = plugin
                logger.info(f"Loaded plugin: {manifest.name}")
                
                return plugin
            else:
                plugin._status = PluginStatus.ERROR
                plugin._error_message = "Initialization failed"
                logger.error(f"Plugin initialization failed: {manifest.name}")
                
        except Exception as e:
            logger.error(f"Failed to load plugin {plugin_id}: {e}")
            return None
        
        return None
    
    def _register_provider(self, plugin: GadgetPlugin):
        """Register plugin with appropriate provider list."""
        if isinstance(plugin, MetadataProvider):
            self._metadata_providers.append(plugin)
        elif isinstance(plugin, IndexerProvider):
            self._indexer_providers.append(plugin)
        elif isinstance(plugin, SubtitleProvider):
            self._subtitle_providers.append(plugin)
        elif isinstance(plugin, NotificationProvider):
            self._notification_providers.append(plugin)
        elif isinstance(plugin, ThemeProvider):
            self._theme_providers.append(plugin)
        elif isinstance(plugin, ScheduledTask):
            self._scheduled_tasks.append(plugin)
    
    async def unload_plugin(self, plugin_id: str) -> bool:
        """
        Unload and shutdown a plugin.
        
        Args:
            plugin_id: Plugin identifier
        
        Returns:
            True if successful
        """
        plugin = self._plugins.get(plugin_id)
        if not plugin:
            return False
        
        try:
            await plugin.shutdown()
            plugin._status = PluginStatus.DISABLED
            plugin._initialized = False
            
            # Remove from provider lists
            self._unregister_provider(plugin)
            
            del self._plugins[plugin_id]
            logger.info(f"Unloaded plugin: {plugin.name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to unload plugin {plugin_id}: {e}")
            return False
    
    def _unregister_provider(self, plugin: GadgetPlugin):
        """Remove plugin from provider lists."""
        if isinstance(plugin, MetadataProvider):
            self._metadata_providers = [p for p in self._metadata_providers if p.plugin_id != plugin.plugin_id]
        elif isinstance(plugin, IndexerProvider):
            self._indexer_providers = [p for p in self._indexer_providers if p.plugin_id != plugin.plugin_id]
        elif isinstance(plugin, SubtitleProvider):
            self._subtitle_providers = [p for p in self._subtitle_providers if p.plugin_id != plugin.plugin_id]
        elif isinstance(plugin, NotificationProvider):
            self._notification_providers = [p for p in self._notification_providers if p.plugin_id != plugin.plugin_id]
        elif isinstance(plugin, ThemeProvider):
            self._theme_providers = [p for p in self._theme_providers if p.plugin_id != plugin.plugin_id]
        elif isinstance(plugin, ScheduledTask):
            self._scheduled_tasks = [p for p in self._scheduled_tasks if p.plugin_id != plugin.plugin_id]
    
    async def load_all_plugins(self):
        """Discover and load all plugins."""
        await self.discover_plugins()
        
        for manifest in self._manifests.values():
            await self.load_plugin(manifest.id)
    
    async def shutdown_all(self):
        """Shutdown all loaded plugins."""
        for plugin_id in list(self._plugins.keys()):
            await self.unload_plugin(plugin_id)
    
    def get_plugin(self, plugin_id: str) -> Optional[GadgetPlugin]:
        """Get a loaded plugin by ID."""
        return self._plugins.get(plugin_id)
    
    def get_all_plugins(self) -> List[dict]:
        """Get info for all discovered plugins."""
        result = []
        
        for plugin_id, manifest in self._manifests.items():
            plugin = self._plugins.get(plugin_id)
            
            info = manifest.to_dict()
            info["loaded"] = plugin is not None
            info["status"] = plugin.status.value if plugin else PluginStatus.INSTALLED.value
            
            result.append(info)
        
        return result
    
    async def update_plugin_settings(self, plugin_id: str, settings: Dict) -> bool:
        """Update settings for a plugin."""
        plugin = self._plugins.get(plugin_id)
        
        if plugin:
            old_settings = plugin.settings.copy()
            await plugin.on_settings_changed(old_settings, settings)
        
        self._plugin_settings[plugin_id] = settings
        self._save_settings()
        
        return True
    
    # Provider access methods
    def get_metadata_providers(self) -> List[MetadataProvider]:
        return self._metadata_providers
    
    def get_indexer_providers(self) -> List[IndexerProvider]:
        return self._indexer_providers
    
    def get_subtitle_providers(self) -> List[SubtitleProvider]:
        return self._subtitle_providers
    
    def get_notification_providers(self) -> List[NotificationProvider]:
        return self._notification_providers
    
    def get_theme_providers(self) -> List[ThemeProvider]:
        return self._theme_providers
    
    def get_scheduled_tasks(self) -> List[ScheduledTask]:
        return self._scheduled_tasks


# Singleton instance
_gadgets_manager: Optional[GadgetsManager] = None


def get_gadgets_manager() -> GadgetsManager:
    """Get or create the Gadgets manager instance."""
    global _gadgets_manager
    if _gadgets_manager is None:
        _gadgets_manager = GadgetsManager()
    return _gadgets_manager


# ============================================================
# Example Plugin Template
# ============================================================

PLUGIN_TEMPLATE = '''
"""
{name} - WatchNexus Plugin
{description}
"""

from gadgets import GadgetPlugin, PluginType

class Plugin(GadgetPlugin):
    """
    {name} plugin for WatchNexus.
    """
    
    @property
    def name(self) -> str:
        return "{name}"
    
    @property
    def plugin_id(self) -> str:
        return "{plugin_id}"
    
    @property
    def plugin_type(self) -> PluginType:
        return PluginType.{plugin_type}
    
    @property
    def version(self) -> str:
        return "1.0.0"
    
    @property
    def description(self) -> str:
        return "{description}"
    
    @property
    def author(self) -> str:
        return "{author}"
    
    def get_settings_schema(self) -> dict:
        """Define plugin settings."""
        return {{
            "type": "object",
            "properties": {{
                "enabled": {{
                    "type": "boolean",
                    "title": "Enabled",
                    "default": True
                }}
            }}
        }}
    
    async def initialize(self) -> bool:
        """Initialize the plugin."""
        # Your initialization code here
        return True
    
    async def shutdown(self):
        """Cleanup when plugin is disabled."""
        pass
'''

MANIFEST_TEMPLATE = '''{{
    "id": "{plugin_id}",
    "name": "{name}",
    "description": "{description}",
    "version": "1.0.0",
    "author": "{author}",
    "plugin_type": "{plugin_type}",
    "entry_point": "main.Plugin",
    "min_watchnexus_version": "1.0.0",
    "dependencies": [],
    "settings_schema": {{}},
    "tags": []
}}'''

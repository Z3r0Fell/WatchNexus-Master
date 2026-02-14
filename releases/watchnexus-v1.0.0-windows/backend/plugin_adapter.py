"""
WatchNexus Plugin Adapter Framework
====================================
Unified adapter system for converting plugins from Kodi, Jellyfin/Emby, and Plex
to the native WatchNexus Gadgets format.

This framework provides:
1. Base adapter classes for each ecosystem
2. Manifest conversion utilities
3. API mapping layers
4. Dependency resolution
"""

import os
import json
import xml.etree.ElementTree as ET
import zipfile
import tempfile
import shutil
import logging
import re
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# =============================================================================
# WATCHNEXUS NATIVE PLUGIN FORMAT
# =============================================================================

class PluginType(Enum):
    """WatchNexus native plugin types."""
    METADATA_PROVIDER = "metadata_provider"
    INDEXER_PROVIDER = "indexer_provider"
    SUBTITLE_PROVIDER = "subtitle_provider"
    STREAM_PROVIDER = "stream_provider"
    NOTIFICATION_PROVIDER = "notification_provider"
    THEME_PROVIDER = "theme_provider"
    SCHEDULED_TASK = "scheduled_task"
    LIBRARY_SCANNER = "library_scanner"
    PLAYER_EXTENSION = "player_extension"
    UI_EXTENSION = "ui_extension"
    INTEGRATION = "integration"


@dataclass
class WatchNexusManifest:
    """Native WatchNexus plugin manifest."""
    id: str
    name: str
    version: str
    description: str
    author: str
    plugin_type: PluginType
    entry_point: str = "main.py"
    icon: str = "icon.png"
    tags: List[str] = field(default_factory=list)
    dependencies: List[Dict[str, str]] = field(default_factory=list)
    settings_schema: Dict[str, Any] = field(default_factory=dict)
    permissions: List[str] = field(default_factory=list)
    min_version: str = "1.0.0"
    homepage: str = ""
    repository: str = ""
    license: str = "MIT"
    
    # Adapter metadata (for converted plugins)
    source_ecosystem: Optional[str] = None
    source_id: Optional[str] = None
    source_version: Optional[str] = None
    adaptation_notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "plugin_type": self.plugin_type.value,
            "entry_point": self.entry_point,
            "icon": self.icon,
            "tags": self.tags,
            "dependencies": self.dependencies,
            "settings_schema": self.settings_schema,
            "permissions": self.permissions,
            "min_version": self.min_version,
            "homepage": self.homepage,
            "repository": self.repository,
            "license": self.license,
            "source_ecosystem": self.source_ecosystem,
            "source_id": self.source_id,
            "source_version": self.source_version,
            "adaptation_notes": self.adaptation_notes,
        }
    
    def save(self, path: str):
        """Save manifest to JSON file."""
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)


# =============================================================================
# BASE ADAPTER CLASS
# =============================================================================

class PluginAdapter(ABC):
    """
    Base class for all plugin adapters.
    Subclass this to create adapters for specific ecosystems.
    """
    
    ECOSYSTEM_NAME: str = "unknown"
    
    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or tempfile.mkdtemp(prefix="watchnexus_adapter_")
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    @abstractmethod
    def parse_manifest(self, source_path: str) -> Dict[str, Any]:
        """Parse the source plugin's manifest file."""
        pass
    
    @abstractmethod
    def map_plugin_type(self, source_type: str) -> PluginType:
        """Map source plugin type to WatchNexus PluginType."""
        pass
    
    @abstractmethod
    def convert_code(self, source_path: str, manifest: WatchNexusManifest) -> str:
        """Convert source code to WatchNexus format. Returns path to converted code."""
        pass
    
    @abstractmethod
    def map_api_calls(self, code: str) -> str:
        """Replace source ecosystem API calls with WatchNexus equivalents."""
        pass
    
    def convert(self, source_path: str) -> Tuple[Optional[WatchNexusManifest], str]:
        """
        Main conversion method. Converts a plugin from source ecosystem to WatchNexus format.
        
        Args:
            source_path: Path to source plugin (zip file or directory)
            
        Returns:
            Tuple of (manifest, output_path) or (None, error_message) on failure
        """
        try:
            # Extract if zip
            if source_path.endswith('.zip'):
                extract_dir = tempfile.mkdtemp()
                with zipfile.ZipFile(source_path, 'r') as z:
                    z.extractall(extract_dir)
                source_path = extract_dir
            
            # Parse source manifest
            source_manifest = self.parse_manifest(source_path)
            if not source_manifest:
                return None, "Failed to parse source manifest"
            
            # Create WatchNexus manifest
            manifest = self._create_manifest(source_manifest)
            
            # Convert code
            output_path = self.convert_code(source_path, manifest)
            
            # Save manifest
            manifest_path = os.path.join(output_path, "manifest.json")
            manifest.save(manifest_path)
            
            logger.info(f"Successfully converted {manifest.name} from {self.ECOSYSTEM_NAME}")
            return manifest, output_path
            
        except Exception as e:
            logger.error(f"Conversion failed: {e}")
            return None, str(e)
    
    def _create_manifest(self, source: Dict[str, Any]) -> WatchNexusManifest:
        """Create WatchNexus manifest from source manifest data."""
        return WatchNexusManifest(
            id=self._generate_id(source),
            name=source.get('name', 'Unknown Plugin'),
            version=source.get('version', '1.0.0'),
            description=source.get('description', ''),
            author=source.get('author', 'Unknown'),
            plugin_type=self.map_plugin_type(source.get('type', '')),
            tags=source.get('tags', []),
            dependencies=self._convert_dependencies(source.get('dependencies', [])),
            homepage=source.get('homepage', ''),
            repository=source.get('repository', ''),
            license=source.get('license', 'Unknown'),
            source_ecosystem=self.ECOSYSTEM_NAME,
            source_id=source.get('id', ''),
            source_version=source.get('version', ''),
        )
    
    def _generate_id(self, source: Dict[str, Any]) -> str:
        """Generate WatchNexus plugin ID from source."""
        source_id = source.get('id', source.get('name', 'unknown'))
        # Sanitize ID
        safe_id = re.sub(r'[^a-zA-Z0-9_-]', '_', source_id.lower())
        return f"wn.adapted.{self.ECOSYSTEM_NAME}.{safe_id}"
    
    def _convert_dependencies(self, deps: List[Any]) -> List[Dict[str, str]]:
        """Convert source dependencies to WatchNexus format."""
        converted = []
        for dep in deps:
            if isinstance(dep, str):
                converted.append({"id": dep, "version": "*"})
            elif isinstance(dep, dict):
                converted.append({
                    "id": dep.get('id', dep.get('addon', '')),
                    "version": dep.get('version', '*'),
                    "optional": dep.get('optional', False)
                })
        return converted


# =============================================================================
# KODI ADAPTER
# =============================================================================

class KodiAdapter(PluginAdapter):
    """
    Adapter for converting Kodi addons to WatchNexus plugins.
    
    Kodi addon structure:
    - addon.xml (manifest)
    - resources/
        - settings.xml (configuration schema)
        - language/ (translations)
    - lib/ or addon.py (Python code)
    - icon.png, fanart.jpg
    """
    
    ECOSYSTEM_NAME = "kodi"
    
    # Kodi extension points to WatchNexus types
    TYPE_MAP = {
        "xbmc.python.pluginsource": PluginType.STREAM_PROVIDER,
        "xbmc.python.script": PluginType.UI_EXTENSION,
        "xbmc.python.library": PluginType.INTEGRATION,
        "xbmc.python.module": PluginType.INTEGRATION,
        "xbmc.metadata.scraper.movies": PluginType.METADATA_PROVIDER,
        "xbmc.metadata.scraper.tvshows": PluginType.METADATA_PROVIDER,
        "xbmc.metadata.scraper.albums": PluginType.METADATA_PROVIDER,
        "xbmc.metadata.scraper.artists": PluginType.METADATA_PROVIDER,
        "xbmc.subtitle.module": PluginType.SUBTITLE_PROVIDER,
        "xbmc.service": PluginType.SCHEDULED_TASK,
        "xbmc.ui.screensaver": PluginType.UI_EXTENSION,
        "xbmc.player.musicviz": PluginType.PLAYER_EXTENSION,
        "xbmc.python.weather": PluginType.INTEGRATION,
        "xbmc.addon.repository": PluginType.INTEGRATION,
    }
    
    # Kodi Python API to WatchNexus API mappings
    API_MAPPINGS = {
        # xbmc module
        "xbmc.log": "watchnexus.log",
        "xbmc.Player": "watchnexus.player.Player",
        "xbmc.Keyboard": "watchnexus.ui.Keyboard",
        "xbmc.Monitor": "watchnexus.events.Monitor",
        "xbmc.executebuiltin": "watchnexus.system.execute",
        "xbmc.getInfoLabel": "watchnexus.system.get_info",
        "xbmc.sleep": "watchnexus.utils.sleep",
        "xbmc.translatePath": "watchnexus.paths.translate",
        "xbmc.getCondVisibility": "watchnexus.ui.get_visibility",
        
        # xbmcgui module
        "xbmcgui.Dialog": "watchnexus.ui.Dialog",
        "xbmcgui.DialogProgress": "watchnexus.ui.ProgressDialog",
        "xbmcgui.ListItem": "watchnexus.media.ListItem",
        "xbmcgui.Window": "watchnexus.ui.Window",
        "xbmcgui.WindowDialog": "watchnexus.ui.WindowDialog",
        
        # xbmcplugin module
        "xbmcplugin.addDirectoryItem": "watchnexus.plugin.add_item",
        "xbmcplugin.addDirectoryItems": "watchnexus.plugin.add_items",
        "xbmcplugin.endOfDirectory": "watchnexus.plugin.end_directory",
        "xbmcplugin.setResolvedUrl": "watchnexus.plugin.set_resolved_url",
        "xbmcplugin.setContent": "watchnexus.plugin.set_content",
        "xbmcplugin.addSortMethod": "watchnexus.plugin.add_sort_method",
        
        # xbmcaddon module
        "xbmcaddon.Addon": "watchnexus.plugin.Addon",
        
        # xbmcvfs module
        "xbmcvfs.exists": "watchnexus.fs.exists",
        "xbmcvfs.mkdir": "watchnexus.fs.mkdir",
        "xbmcvfs.mkdirs": "watchnexus.fs.makedirs",
        "xbmcvfs.delete": "watchnexus.fs.delete",
        "xbmcvfs.copy": "watchnexus.fs.copy",
        "xbmcvfs.rename": "watchnexus.fs.rename",
        "xbmcvfs.File": "watchnexus.fs.File",
        "xbmcvfs.Stat": "watchnexus.fs.stat",
        "xbmcvfs.listdir": "watchnexus.fs.listdir",
        "xbmcvfs.translatePath": "watchnexus.paths.translate",
    }
    
    def parse_manifest(self, source_path: str) -> Dict[str, Any]:
        """Parse Kodi addon.xml manifest."""
        addon_xml = os.path.join(source_path, "addon.xml")
        
        if not os.path.exists(addon_xml):
            # Try to find addon.xml in subdirectory
            for item in os.listdir(source_path):
                sub_path = os.path.join(source_path, item, "addon.xml")
                if os.path.exists(sub_path):
                    addon_xml = sub_path
                    source_path = os.path.join(source_path, item)
                    break
        
        if not os.path.exists(addon_xml):
            self.errors.append("addon.xml not found")
            return None
        
        try:
            tree = ET.parse(addon_xml)
            root = tree.getroot()
            
            manifest = {
                "id": root.get("id", ""),
                "name": root.get("name", ""),
                "version": root.get("version", "1.0.0"),
                "author": root.get("provider-name", ""),
                "type": "",
                "description": "",
                "tags": [],
                "dependencies": [],
                "homepage": "",
                "license": "",
                "source_path": source_path,
            }
            
            # Parse requires (dependencies)
            requires = root.find("requires")
            if requires is not None:
                for imp in requires.findall("import"):
                    manifest["dependencies"].append({
                        "addon": imp.get("addon", ""),
                        "version": imp.get("version", ""),
                        "optional": imp.get("optional", "false") == "true"
                    })
            
            # Parse extensions
            for ext in root.findall("extension"):
                point = ext.get("point", "")
                
                if point == "xbmc.addon.metadata":
                    # Extract metadata
                    summary = ext.find("summary")
                    if summary is not None and summary.text:
                        manifest["description"] = summary.text
                    
                    desc = ext.find("description")
                    if desc is not None and desc.text:
                        manifest["description"] = desc.text
                    
                    website = ext.find("website")
                    if website is not None and website.text:
                        manifest["homepage"] = website.text
                    
                    lic = ext.find("license")
                    if lic is not None and lic.text:
                        manifest["license"] = lic.text
                else:
                    # This is the main extension point
                    if not manifest["type"]:
                        manifest["type"] = point
                    
                    # Extract provides for tagging
                    provides = ext.find("provides")
                    if provides is not None and provides.text:
                        manifest["tags"].extend(provides.text.split())
            
            return manifest
            
        except ET.ParseError as e:
            self.errors.append(f"Failed to parse addon.xml: {e}")
            return None
    
    def map_plugin_type(self, source_type: str) -> PluginType:
        """Map Kodi extension point to WatchNexus plugin type."""
        return self.TYPE_MAP.get(source_type, PluginType.INTEGRATION)
    
    def convert_code(self, source_path: str, manifest: WatchNexusManifest) -> str:
        """Convert Kodi addon code to WatchNexus format."""
        output_path = os.path.join(self.output_dir, manifest.id)
        os.makedirs(output_path, exist_ok=True)
        
        # Copy assets
        for asset in ["icon.png", "fanart.jpg", "fanart.png"]:
            src = os.path.join(source_path, asset)
            if os.path.exists(src):
                shutil.copy(src, output_path)
        
        # Copy and convert Python files
        self._convert_python_files(source_path, output_path)
        
        # Convert settings.xml to settings_schema
        settings_xml = os.path.join(source_path, "resources", "settings.xml")
        if os.path.exists(settings_xml):
            manifest.settings_schema = self._convert_settings_xml(settings_xml)
        
        # Create compatibility shim
        self._create_kodi_shim(output_path)
        
        return output_path
    
    def _convert_python_files(self, source_path: str, output_path: str):
        """Convert all Python files with API mapping."""
        for root, dirs, files in os.walk(source_path):
            for file in files:
                if file.endswith('.py'):
                    src_file = os.path.join(root, file)
                    rel_path = os.path.relpath(src_file, source_path)
                    dst_file = os.path.join(output_path, rel_path)
                    
                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                    
                    with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
                        code = f.read()
                    
                    converted_code = self.map_api_calls(code)
                    
                    with open(dst_file, 'w', encoding='utf-8') as f:
                        f.write(converted_code)
    
    def map_api_calls(self, code: str) -> str:
        """Replace Kodi API calls with WatchNexus equivalents."""
        # Add shim import at the top
        if "import xbmc" in code or "from xbmc" in code:
            code = "from watchnexus.compat.kodi import *\n" + code
        
        # Replace API calls
        for kodi_api, wn_api in self.API_MAPPINGS.items():
            code = code.replace(kodi_api, wn_api)
        
        return code
    
    def _convert_settings_xml(self, settings_path: str) -> Dict[str, Any]:
        """Convert Kodi settings.xml to WatchNexus settings schema."""
        schema = {"type": "object", "properties": {}, "required": []}
        
        try:
            tree = ET.parse(settings_path)
            root = tree.getroot()
            
            for setting in root.findall(".//setting"):
                setting_id = setting.get("id")
                if not setting_id:
                    continue
                
                setting_type = setting.get("type", "text")
                label = setting.get("label", setting_id)
                default = setting.get("default", "")
                
                prop = {
                    "title": label,
                    "default": default,
                }
                
                # Map Kodi setting types to JSON schema types
                if setting_type in ("text", "file", "folder", "ipaddress"):
                    prop["type"] = "string"
                elif setting_type == "bool":
                    prop["type"] = "boolean"
                    prop["default"] = default.lower() == "true"
                elif setting_type in ("number", "slider"):
                    prop["type"] = "number"
                    prop["default"] = float(default) if default else 0
                elif setting_type == "enum":
                    prop["type"] = "string"
                    prop["enum"] = setting.get("values", "").split("|")
                elif setting_type == "labelenum":
                    prop["type"] = "string"
                    prop["enum"] = [v.strip() for v in setting.get("values", "").split("|")]
                else:
                    prop["type"] = "string"
                
                schema["properties"][setting_id] = prop
            
        except Exception as e:
            self.warnings.append(f"Failed to convert settings.xml: {e}")
        
        return schema
    
    def _create_kodi_shim(self, output_path: str):
        """Create Kodi compatibility shim module."""
        shim_dir = os.path.join(output_path, "watchnexus", "compat")
        os.makedirs(shim_dir, exist_ok=True)
        
        shim_code = '''"""
Kodi Compatibility Shim for WatchNexus
Auto-generated - provides Kodi API compatibility layer
"""

from watchnexus.core import get_plugin_context

# Kodi module shims
class xbmc:
    @staticmethod
    def log(msg, level=0):
        from watchnexus import log
        log(msg, level)
    
    @staticmethod
    def sleep(ms):
        import time
        time.sleep(ms / 1000)
    
    @staticmethod
    def translatePath(path):
        from watchnexus.paths import translate
        return translate(path)
    
    class Player:
        def __init__(self):
            from watchnexus.player import get_player
            self._player = get_player()
        
        def play(self, url, listitem=None):
            self._player.play(url)
        
        def stop(self):
            self._player.stop()
        
        def pause(self):
            self._player.pause()
    
    class Monitor:
        def waitForAbort(self, timeout=None):
            import time
            time.sleep(timeout or 1)
            return False
        
        def abortRequested(self):
            return False


class xbmcgui:
    class Dialog:
        def ok(self, heading, message):
            from watchnexus.ui import show_dialog
            show_dialog(heading, message)
        
        def yesno(self, heading, message):
            from watchnexus.ui import show_confirm
            return show_confirm(heading, message)
        
        def select(self, heading, options):
            from watchnexus.ui import show_select
            return show_select(heading, options)
        
        def input(self, heading, default="", type=0):
            from watchnexus.ui import show_input
            return show_input(heading, default)
    
    class ListItem:
        def __init__(self, label="", label2="", path=""):
            self.label = label
            self.label2 = label2
            self.path = path
            self._info = {}
            self._art = {}
            self._properties = {}
        
        def setLabel(self, label):
            self.label = label
        
        def setInfo(self, type, info):
            self._info[type] = info
        
        def setArt(self, art):
            self._art.update(art)
        
        def setProperty(self, key, value):
            self._properties[key] = value
        
        def getProperty(self, key):
            return self._properties.get(key, "")
        
        def to_watchnexus(self):
            from watchnexus.media import MediaItem
            return MediaItem(
                title=self.label,
                path=self.path,
                metadata=self._info,
                artwork=self._art
            )


class xbmcplugin:
    _items = []
    _content = ""
    _resolved_url = None
    
    @classmethod
    def addDirectoryItem(cls, handle, url, listitem, isFolder=False):
        cls._items.append({
            "url": url,
            "item": listitem,
            "is_folder": isFolder
        })
        return True
    
    @classmethod
    def addDirectoryItems(cls, handle, items):
        for url, listitem, isFolder in items:
            cls.addDirectoryItem(handle, url, listitem, isFolder)
        return True
    
    @classmethod
    def endOfDirectory(cls, handle, succeeded=True, updateListing=False, cacheToDisc=True):
        from watchnexus.plugin import set_directory_items
        set_directory_items(cls._items)
        cls._items = []
    
    @classmethod
    def setResolvedUrl(cls, handle, succeeded, listitem):
        cls._resolved_url = listitem
        from watchnexus.plugin import set_playable_url
        if hasattr(listitem, 'path'):
            set_playable_url(listitem.path)
    
    @classmethod
    def setContent(cls, handle, content):
        cls._content = content


class xbmcaddon:
    class Addon:
        def __init__(self, id=None):
            self._id = id
            self._ctx = get_plugin_context()
        
        def getAddonInfo(self, key):
            info = {
                "id": self._ctx.plugin_id,
                "name": self._ctx.plugin_name,
                "version": self._ctx.plugin_version,
                "path": self._ctx.plugin_path,
                "profile": self._ctx.data_path,
            }
            return info.get(key, "")
        
        def getSetting(self, key):
            return self._ctx.get_setting(key)
        
        def setSetting(self, key, value):
            self._ctx.set_setting(key, value)
        
        def getLocalizedString(self, id):
            return self._ctx.get_string(id)


class xbmcvfs:
    @staticmethod
    def exists(path):
        import os
        return os.path.exists(path)
    
    @staticmethod
    def mkdir(path):
        import os
        os.makedirs(path, exist_ok=True)
        return True
    
    @staticmethod
    def mkdirs(path):
        return xbmcvfs.mkdir(path)
    
    @staticmethod
    def delete(path):
        import os
        os.remove(path)
        return True
    
    @staticmethod
    def copy(src, dst):
        import shutil
        shutil.copy(src, dst)
        return True
    
    @staticmethod
    def rename(src, dst):
        import os
        os.rename(src, dst)
        return True
    
    @staticmethod
    def listdir(path):
        import os
        items = os.listdir(path)
        dirs = [i for i in items if os.path.isdir(os.path.join(path, i))]
        files = [i for i in items if os.path.isfile(os.path.join(path, i))]
        return dirs, files
    
    @staticmethod
    def translatePath(path):
        return xbmc.translatePath(path)
    
    class File:
        def __init__(self, path, mode='r'):
            self._file = open(path, mode)
        
        def read(self):
            return self._file.read()
        
        def write(self, data):
            self._file.write(data)
        
        def close(self):
            self._file.close()
        
        def __enter__(self):
            return self
        
        def __exit__(self, *args):
            self.close()
'''
        
        with open(os.path.join(shim_dir, "kodi.py"), 'w') as f:
            f.write(shim_code)
        
        # Create __init__.py files
        open(os.path.join(output_path, "watchnexus", "__init__.py"), 'w').close()
        open(os.path.join(shim_dir, "__init__.py"), 'w').close()


# =============================================================================
# JELLYFIN/EMBY ADAPTER
# =============================================================================

class JellyfinAdapter(PluginAdapter):
    """
    Adapter for converting Jellyfin/Emby plugins to WatchNexus.
    
    Jellyfin plugin structure:
    - meta.json or *.dll (C# plugins)
    - For JS plugins: config.html, plugin.js
    """
    
    ECOSYSTEM_NAME = "jellyfin"
    
    TYPE_MAP = {
        "Channel": PluginType.STREAM_PROVIDER,
        "MetadataProvider": PluginType.METADATA_PROVIDER,
        "MetadataFetcher": PluginType.METADATA_PROVIDER,
        "SubtitleProvider": PluginType.SUBTITLE_PROVIDER,
        "Notification": PluginType.NOTIFICATION_PROVIDER,
        "Authentication": PluginType.INTEGRATION,
        "LiveTv": PluginType.STREAM_PROVIDER,
        "Intro": PluginType.PLAYER_EXTENSION,
        "Theme": PluginType.THEME_PROVIDER,
    }
    
    # Jellyfin API to WatchNexus mappings
    API_MAPPINGS = {
        # C# to Python mappings (conceptual)
        "ILogger": "watchnexus.log",
        "IHttpClient": "watchnexus.http",
        "IJsonSerializer": "watchnexus.json",
        "IFileSystem": "watchnexus.fs",
        "IServerApplicationHost": "watchnexus.system",
        "ILibraryManager": "watchnexus.library",
        "IUserManager": "watchnexus.users",
        "IMediaEncoder": "watchnexus.transcoding",
        
        # JavaScript API mappings
        "ApiClient": "watchnexus.api",
        "Dashboard": "watchnexus.ui.dashboard",
        "Events": "watchnexus.events",
    }
    
    def parse_manifest(self, source_path: str) -> Dict[str, Any]:
        """Parse Jellyfin meta.json manifest."""
        meta_json = os.path.join(source_path, "meta.json")
        
        if os.path.exists(meta_json):
            with open(meta_json, 'r') as f:
                data = json.load(f)
            
            return {
                "id": data.get("guid", data.get("id", "")),
                "name": data.get("name", ""),
                "version": data.get("version", "1.0.0"),
                "author": data.get("owner", ""),
                "description": data.get("description", ""),
                "type": data.get("category", ""),
                "homepage": data.get("homepage", ""),
                "dependencies": [],
                "tags": data.get("tags", []),
                "source_path": source_path,
            }
        
        # Try to parse from DLL metadata or other sources
        self.warnings.append("meta.json not found, attempting alternative parsing")
        return self._parse_alternative(source_path)
    
    def _parse_alternative(self, source_path: str) -> Dict[str, Any]:
        """Parse plugin info from alternative sources."""
        # Look for any JSON files
        for file in os.listdir(source_path):
            if file.endswith('.json'):
                try:
                    with open(os.path.join(source_path, file), 'r') as f:
                        data = json.load(f)
                    if 'name' in data or 'guid' in data:
                        return {
                            "id": data.get("guid", data.get("id", os.path.basename(source_path))),
                            "name": data.get("name", os.path.basename(source_path)),
                            "version": data.get("version", "1.0.0"),
                            "author": data.get("owner", "Unknown"),
                            "description": data.get("description", ""),
                            "type": "",
                            "dependencies": [],
                            "source_path": source_path,
                        }
                except:
                    continue
        
        # Fallback to directory name
        return {
            "id": os.path.basename(source_path),
            "name": os.path.basename(source_path),
            "version": "1.0.0",
            "author": "Unknown",
            "description": "Converted from Jellyfin/Emby",
            "type": "",
            "dependencies": [],
            "source_path": source_path,
        }
    
    def map_plugin_type(self, source_type: str) -> PluginType:
        """Map Jellyfin plugin category to WatchNexus type."""
        return self.TYPE_MAP.get(source_type, PluginType.INTEGRATION)
    
    def convert_code(self, source_path: str, manifest: WatchNexusManifest) -> str:
        """Convert Jellyfin plugin to WatchNexus format."""
        output_path = os.path.join(self.output_dir, manifest.id)
        os.makedirs(output_path, exist_ok=True)
        
        # Check plugin type
        has_cs = any(f.endswith('.cs') or f.endswith('.dll') for f in os.listdir(source_path))
        has_js = any(f.endswith('.js') for f in os.listdir(source_path))
        
        if has_cs:
            # C# plugin - create Python wrapper
            self._convert_csharp_plugin(source_path, output_path, manifest)
        elif has_js:
            # JavaScript plugin - convert to Python
            self._convert_js_plugin(source_path, output_path, manifest)
        
        # Copy assets
        for asset in os.listdir(source_path):
            if asset.endswith(('.png', '.jpg', '.svg', '.html', '.css')):
                shutil.copy(os.path.join(source_path, asset), output_path)
        
        return output_path
    
    def _convert_csharp_plugin(self, source_path: str, output_path: str, manifest: WatchNexusManifest):
        """Create Python wrapper for C# plugin."""
        manifest.adaptation_notes.append("C# plugin - requires manual implementation")
        
        # Create stub implementation
        stub = f'''"""
WatchNexus Plugin: {manifest.name}
Adapted from Jellyfin/Emby C# plugin

NOTE: This is a stub. The original C# code needs manual conversion.
Original source: {source_path}
"""

from watchnexus.plugin import Plugin, PluginContext

class {self._class_name(manifest.name)}(Plugin):
    """
    Adapted from Jellyfin plugin.
    TODO: Implement the following methods based on original C# code.
    """
    
    def __init__(self, context: PluginContext):
        super().__init__(context)
        self.log.warning("This plugin requires manual implementation")
    
    def initialize(self):
        """Initialize plugin - implement based on original OnInitializing()"""
        pass
    
    def shutdown(self):
        """Cleanup - implement based on original Dispose()"""
        pass

# Export plugin class
plugin_class = {self._class_name(manifest.name)}
'''
        
        with open(os.path.join(output_path, "main.py"), 'w') as f:
            f.write(stub)
    
    def _convert_js_plugin(self, source_path: str, output_path: str, manifest: WatchNexusManifest):
        """Convert JavaScript plugin to Python."""
        manifest.adaptation_notes.append("JS plugin - API calls mapped to WatchNexus")
        
        # Find main JS file
        js_files = [f for f in os.listdir(source_path) if f.endswith('.js')]
        
        if js_files:
            # Copy and note for manual conversion
            for js_file in js_files:
                src = os.path.join(source_path, js_file)
                # Copy original for reference
                shutil.copy(src, os.path.join(output_path, f"original_{js_file}"))
            
            # Create Python stub
            stub = f'''"""
WatchNexus Plugin: {manifest.name}
Adapted from Jellyfin/Emby JavaScript plugin

Original JS files have been copied with 'original_' prefix for reference.
"""

from watchnexus.plugin import Plugin, PluginContext

class {self._class_name(manifest.name)}(Plugin):
    """
    Adapted from Jellyfin JS plugin.
    See original_*.js files for reference implementation.
    """
    
    def __init__(self, context: PluginContext):
        super().__init__(context)
    
    def initialize(self):
        # TODO: Convert from original JS
        pass
    
    def get_config_page(self):
        """Return HTML for config page if available."""
        config_html = self.context.get_resource("config.html")
        return config_html

plugin_class = {self._class_name(manifest.name)}
'''
            
            with open(os.path.join(output_path, "main.py"), 'w') as f:
                f.write(stub)
    
    def _class_name(self, name: str) -> str:
        """Convert plugin name to valid Python class name."""
        # Remove non-alphanumeric, capitalize words
        words = re.sub(r'[^a-zA-Z0-9]', ' ', name).split()
        return ''.join(w.capitalize() for w in words) + "Plugin"
    
    def map_api_calls(self, code: str) -> str:
        """Map Jellyfin API calls to WatchNexus."""
        for jf_api, wn_api in self.API_MAPPINGS.items():
            code = code.replace(jf_api, wn_api)
        return code


# =============================================================================
# PLEX ADAPTER
# =============================================================================

class PlexAdapter(PluginAdapter):
    """
    Adapter for converting Plex plugins (channels) to WatchNexus.
    
    Plex plugin structure:
    - Contents/
        - Info.plist (manifest)
        - Code/
            - __init__.py
        - Resources/
            - icon-default.png
        - DefaultPrefs.json or DefaultPrefs.xml
    """
    
    ECOSYSTEM_NAME = "plex"
    
    TYPE_MAP = {
        "Video": PluginType.STREAM_PROVIDER,
        "Music": PluginType.STREAM_PROVIDER,
        "Photos": PluginType.STREAM_PROVIDER,
        "Agent": PluginType.METADATA_PROVIDER,
        "Service": PluginType.INTEGRATION,
    }
    
    # Plex Framework API to WatchNexus mappings
    API_MAPPINGS = {
        # Core objects
        "Plugin": "watchnexus.plugin",
        "Prefs": "watchnexus.settings",
        "Dict": "watchnexus.storage",
        "Data": "watchnexus.storage",
        "Resource": "watchnexus.resources",
        "Log": "watchnexus.log",
        "Locale": "watchnexus.i18n",
        
        # HTTP/Network
        "HTTP.Request": "watchnexus.http.request",
        "HTTP.CacheTime": "watchnexus.http.cache_time",
        "HTTP.Headers": "watchnexus.http.headers",
        "HTTP.Cookies": "watchnexus.http.cookies",
        "JSON.ObjectFromURL": "watchnexus.http.get_json",
        "JSON.ObjectFromString": "watchnexus.json.loads",
        "XML.ElementFromURL": "watchnexus.http.get_xml",
        "XML.ElementFromString": "watchnexus.xml.parse",
        "HTML.ElementFromURL": "watchnexus.http.get_html",
        "HTML.ElementFromString": "watchnexus.html.parse",
        
        # Media objects
        "VideoClipObject": "watchnexus.media.VideoClip",
        "MovieObject": "watchnexus.media.Movie",
        "EpisodeObject": "watchnexus.media.Episode",
        "TrackObject": "watchnexus.media.Track",
        "AlbumObject": "watchnexus.media.Album",
        "ArtistObject": "watchnexus.media.Artist",
        "PhotoObject": "watchnexus.media.Photo",
        "PhotoAlbumObject": "watchnexus.media.PhotoAlbum",
        "DirectoryObject": "watchnexus.media.Directory",
        "InputDirectoryObject": "watchnexus.media.InputDirectory",
        "PrefsObject": "watchnexus.media.Prefs",
        "MediaObject": "watchnexus.media.Media",
        "PartObject": "watchnexus.media.Part",
        
        # Containers
        "ObjectContainer": "watchnexus.containers.ObjectContainer",
        "MessageContainer": "watchnexus.containers.MessageContainer",
        
        # Decorators
        "@handler": "@watchnexus.route",
        "@route": "@watchnexus.route",
        "@indirect": "@watchnexus.indirect",
    }
    
    def parse_manifest(self, source_path: str) -> Dict[str, Any]:
        """Parse Plex Info.plist manifest."""
        info_plist = os.path.join(source_path, "Contents", "Info.plist")
        
        if not os.path.exists(info_plist):
            # Try root level
            info_plist = os.path.join(source_path, "Info.plist")
        
        if not os.path.exists(info_plist):
            self.errors.append("Info.plist not found")
            return self._parse_from_code(source_path)
        
        try:
            # Parse plist (it's XML)
            tree = ET.parse(info_plist)
            root = tree.getroot()
            
            # Plist is dict with key-value pairs
            data = {}
            dict_elem = root.find("dict")
            if dict_elem is not None:
                keys = dict_elem.findall("key")
                values = list(dict_elem)
                
                for i, key in enumerate(keys):
                    key_name = key.text
                    # Value is the next element after the key
                    val_idx = list(dict_elem).index(key) + 1
                    if val_idx < len(list(dict_elem)):
                        val_elem = list(dict_elem)[val_idx]
                        if val_elem.tag == "string":
                            data[key_name] = val_elem.text or ""
                        elif val_elem.tag == "array":
                            data[key_name] = [e.text for e in val_elem.findall("string")]
            
            return {
                "id": data.get("CFBundleIdentifier", ""),
                "name": data.get("CFBundleName", data.get("PlexPluginName", "")),
                "version": data.get("CFBundleVersion", "1.0.0"),
                "author": data.get("PlexPluginAuthor", ""),
                "description": data.get("PlexPluginDescription", ""),
                "type": data.get("PlexPluginClass", ""),
                "tags": data.get("PlexPluginTags", []),
                "dependencies": [],
                "source_path": source_path,
            }
            
        except Exception as e:
            self.errors.append(f"Failed to parse Info.plist: {e}")
            return self._parse_from_code(source_path)
    
    def _parse_from_code(self, source_path: str) -> Dict[str, Any]:
        """Extract plugin info from code files."""
        code_path = os.path.join(source_path, "Contents", "Code")
        if not os.path.exists(code_path):
            code_path = source_path
        
        name = os.path.basename(source_path).replace('.bundle', '')
        
        return {
            "id": f"com.plexapp.plugins.{name.lower()}",
            "name": name,
            "version": "1.0.0",
            "author": "Unknown",
            "description": "Converted from Plex plugin",
            "type": "",
            "dependencies": [],
            "source_path": source_path,
        }
    
    def map_plugin_type(self, source_type: str) -> PluginType:
        """Map Plex plugin class to WatchNexus type."""
        return self.TYPE_MAP.get(source_type, PluginType.STREAM_PROVIDER)
    
    def convert_code(self, source_path: str, manifest: WatchNexusManifest) -> str:
        """Convert Plex plugin to WatchNexus format."""
        output_path = os.path.join(self.output_dir, manifest.id)
        os.makedirs(output_path, exist_ok=True)
        
        # Find code directory
        code_path = os.path.join(source_path, "Contents", "Code")
        if not os.path.exists(code_path):
            code_path = source_path
        
        # Convert Python files
        self._convert_python_files(code_path, output_path)
        
        # Copy resources
        resources_path = os.path.join(source_path, "Contents", "Resources")
        if os.path.exists(resources_path):
            for item in os.listdir(resources_path):
                src = os.path.join(resources_path, item)
                if os.path.isfile(src):
                    shutil.copy(src, output_path)
        
        # Convert preferences
        prefs = self._convert_preferences(source_path)
        if prefs:
            manifest.settings_schema = prefs
        
        # Create Plex shim
        self._create_plex_shim(output_path)
        
        return output_path
    
    def _convert_python_files(self, source_path: str, output_path: str):
        """Convert Plex Python files with API mapping."""
        for root, dirs, files in os.walk(source_path):
            for file in files:
                if file.endswith('.py'):
                    src_file = os.path.join(root, file)
                    rel_path = os.path.relpath(src_file, source_path)
                    dst_file = os.path.join(output_path, rel_path)
                    
                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                    
                    with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
                        code = f.read()
                    
                    converted = self.map_api_calls(code)
                    
                    with open(dst_file, 'w', encoding='utf-8') as f:
                        f.write(converted)
    
    def map_api_calls(self, code: str) -> str:
        """Map Plex Framework API to WatchNexus."""
        # Add compatibility import
        code = "from watchnexus.compat.plex import *\n" + code
        
        for plex_api, wn_api in self.API_MAPPINGS.items():
            code = code.replace(plex_api, wn_api)
        
        return code
    
    def _convert_preferences(self, source_path: str) -> Dict[str, Any]:
        """Convert Plex DefaultPrefs to settings schema."""
        # Try JSON first
        prefs_json = os.path.join(source_path, "Contents", "DefaultPrefs.json")
        if os.path.exists(prefs_json):
            with open(prefs_json, 'r') as f:
                prefs = json.load(f)
            return self._prefs_to_schema(prefs)
        
        # Try XML
        prefs_xml = os.path.join(source_path, "Contents", "DefaultPrefs.xml")
        if os.path.exists(prefs_xml):
            return self._parse_prefs_xml(prefs_xml)
        
        return {}
    
    def _prefs_to_schema(self, prefs: List[Dict]) -> Dict[str, Any]:
        """Convert Plex prefs list to JSON schema."""
        schema = {"type": "object", "properties": {}}
        
        for pref in prefs:
            pref_id = pref.get("id", "")
            if not pref_id:
                continue
            
            pref_type = pref.get("type", "text")
            
            prop = {
                "title": pref.get("label", pref_id),
                "default": pref.get("default", ""),
            }
            
            if pref_type == "bool":
                prop["type"] = "boolean"
                prop["default"] = pref.get("default", "false") == "true"
            elif pref_type == "enum":
                prop["type"] = "string"
                prop["enum"] = pref.get("values", "").split("|")
            else:
                prop["type"] = "string"
            
            schema["properties"][pref_id] = prop
        
        return schema
    
    def _parse_prefs_xml(self, path: str) -> Dict[str, Any]:
        """Parse DefaultPrefs.xml to schema."""
        schema = {"type": "object", "properties": {}}
        
        try:
            tree = ET.parse(path)
            for pref in tree.findall(".//pref"):
                pref_id = pref.get("id", "")
                if pref_id:
                    schema["properties"][pref_id] = {
                        "title": pref.get("label", pref_id),
                        "type": "string",
                        "default": pref.get("default", "")
                    }
        except:
            pass
        
        return schema
    
    def _create_plex_shim(self, output_path: str):
        """Create Plex Framework compatibility shim."""
        shim_dir = os.path.join(output_path, "watchnexus", "compat")
        os.makedirs(shim_dir, exist_ok=True)
        
        # Shim is large - create minimal version
        shim_code = '''"""
Plex Framework Compatibility Shim for WatchNexus
Provides Plex plugin API compatibility
"""

from watchnexus.core import get_plugin_context
import watchnexus.http as http
import watchnexus.log as Log
import json as _json

# Preferences
class Prefs:
    @staticmethod
    def __getitem__(key):
        ctx = get_plugin_context()
        return ctx.get_setting(key)

# Storage
class Dict(dict):
    def Save(self):
        ctx = get_plugin_context()
        ctx.save_data("dict", dict(self))

class Data:
    @staticmethod
    def Load(filename):
        ctx = get_plugin_context()
        return ctx.load_data(filename)
    
    @staticmethod
    def Save(data, filename):
        ctx = get_plugin_context()
        ctx.save_data(filename, data)

# HTTP helpers
class HTTP:
    @staticmethod
    def Request(url, headers=None, cacheTime=0):
        return http.get(url, headers=headers)
    
    CacheTime = 0
    Headers = {}

class JSON:
    @staticmethod
    def ObjectFromURL(url, headers=None):
        return http.get_json(url, headers=headers)
    
    @staticmethod
    def ObjectFromString(s):
        return _json.loads(s)

# Media objects
class MediaObject:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

class VideoClipObject(MediaObject): pass
class MovieObject(MediaObject): pass
class EpisodeObject(MediaObject): pass
class DirectoryObject(MediaObject): pass

class ObjectContainer(list):
    def __init__(self, title1="", title2="", **kwargs):
        super().__init__()
        self.title1 = title1
        self.title2 = title2

# Decorators
def handler(prefix, name, thumb=None, art=None):
    def decorator(func):
        func._handler = {"prefix": prefix, "name": name}
        return func
    return decorator

def route(path):
    def decorator(func):
        func._route = path
        return func
    return decorator

def indirect(func):
    func._indirect = True
    return func
'''
        
        with open(os.path.join(shim_dir, "plex.py"), 'w') as f:
            f.write(shim_code)
        
        open(os.path.join(output_path, "watchnexus", "__init__.py"), 'w').close()
        open(os.path.join(shim_dir, "__init__.py"), 'w').close()


# =============================================================================
# ADAPTER FACTORY
# =============================================================================

class AdapterFactory:
    """Factory for creating appropriate plugin adapters."""
    
    ADAPTERS = {
        "kodi": KodiAdapter,
        "jellyfin": JellyfinAdapter,
        "emby": JellyfinAdapter,  # Same format
        "plex": PlexAdapter,
    }
    
    @classmethod
    def get_adapter(cls, ecosystem: str, output_dir: str = None) -> Optional[PluginAdapter]:
        """Get adapter for specified ecosystem."""
        adapter_class = cls.ADAPTERS.get(ecosystem.lower())
        if adapter_class:
            return adapter_class(output_dir)
        return None
    
    @classmethod
    def detect_ecosystem(cls, source_path: str) -> Optional[str]:
        """Auto-detect plugin ecosystem from source files."""
        if os.path.isfile(source_path) and source_path.endswith('.zip'):
            # Extract temporarily to detect
            with zipfile.ZipFile(source_path, 'r') as z:
                names = z.namelist()
                if any('addon.xml' in n for n in names):
                    return "kodi"
                if any('Info.plist' in n for n in names):
                    return "plex"
                if any('meta.json' in n for n in names):
                    return "jellyfin"
        else:
            if os.path.exists(os.path.join(source_path, "addon.xml")):
                return "kodi"
            if os.path.exists(os.path.join(source_path, "Contents", "Info.plist")):
                return "plex"
            if os.path.exists(os.path.join(source_path, "Info.plist")):
                return "plex"
            if os.path.exists(os.path.join(source_path, "meta.json")):
                return "jellyfin"
            # Check for .bundle suffix (Plex)
            if source_path.endswith('.bundle'):
                return "plex"
        
        return None
    
    @classmethod
    def convert(cls, source_path: str, ecosystem: str = None, output_dir: str = None):
        """
        Convert a plugin from any supported ecosystem.
        
        Args:
            source_path: Path to plugin source
            ecosystem: Source ecosystem (auto-detected if not provided)
            output_dir: Output directory for converted plugin
            
        Returns:
            Tuple of (manifest, output_path) or (None, error_message)
        """
        if not ecosystem:
            ecosystem = cls.detect_ecosystem(source_path)
        
        if not ecosystem:
            return None, "Could not detect plugin ecosystem"
        
        adapter = cls.get_adapter(ecosystem, output_dir)
        if not adapter:
            return None, f"No adapter available for {ecosystem}"
        
        return adapter.convert(source_path)


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def convert_kodi_addon(source_path: str, output_dir: str = None):
    """Convert a Kodi addon to WatchNexus format."""
    adapter = KodiAdapter(output_dir)
    return adapter.convert(source_path)

def convert_jellyfin_plugin(source_path: str, output_dir: str = None):
    """Convert a Jellyfin/Emby plugin to WatchNexus format."""
    adapter = JellyfinAdapter(output_dir)
    return adapter.convert(source_path)

def convert_plex_plugin(source_path: str, output_dir: str = None):
    """Convert a Plex plugin to WatchNexus format."""
    adapter = PlexAdapter(output_dir)
    return adapter.convert(source_path)

def auto_convert(source_path: str, output_dir: str = None):
    """Auto-detect ecosystem and convert plugin."""
    return AdapterFactory.convert(source_path, output_dir=output_dir)

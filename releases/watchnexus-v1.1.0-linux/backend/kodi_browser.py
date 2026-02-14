"""
Kodi Repository Browser - WatchNexus Integration
Fetches and parses Kodi addon repositories for the Gadgets system.
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
import gzip
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timezone
import re

logger = logging.getLogger(__name__)

# Kodi repository URLs
KODI_MIRRORS = [
    "https://mirrors.kodi.tv/addons/omega",      # Kodi 21 (latest)
    "https://mirrors.kodi.tv/addons/nexus",      # Kodi 20
    "https://mirror.netzwerge.de/kodi/addons/omega",  # Mirror
]

class KodiAddonCategory(Enum):
    """Kodi addon categories."""
    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"
    PROGRAM = "program"
    SCRIPT = "script"
    SERVICE = "service"
    SKIN = "skin"
    RESOURCE = "resource"
    CONTEXT = "context"
    SUBTITLE = "subtitle"
    METADATA = "metadata"
    LYRICS = "lyrics"
    SCREENSAVER = "screensaver"
    VISUALIZATION = "visualization"
    WEATHER = "weather"
    REPOSITORY = "repository"
    GAME = "game"
    INPUTSTREAM = "inputstream"
    PERIPHERAL = "peripheral"
    WEBINTERFACE = "webinterface"
    OTHER = "other"


@dataclass
class KodiAddon:
    """Represents a Kodi addon."""
    id: str
    name: str
    version: str
    provider: str  # author
    summary: str = ""
    description: str = ""
    category: KodiAddonCategory = KodiAddonCategory.OTHER
    icon: str = ""
    fanart: str = ""
    changelog: str = ""
    news: str = ""
    platform: str = "all"
    license: str = ""
    forum: str = ""
    website: str = ""
    source: str = ""
    broken: Optional[str] = None  # If set, addon is broken
    dependencies: List[Dict] = field(default_factory=list)
    extension_point: str = ""
    provides: List[str] = field(default_factory=list)
    size: int = 0
    download_url: str = ""
    repo_url: str = ""
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "provider": self.provider,
            "summary": self.summary,
            "description": self.description,
            "category": self.category.value,
            "icon": self.icon,
            "fanart": self.fanart,
            "changelog": self.changelog,
            "platform": self.platform,
            "license": self.license,
            "website": self.website,
            "broken": self.broken,
            "dependencies": self.dependencies,
            "provides": self.provides,
            "download_url": self.download_url,
        }


class KodiRepoBrowser:
    """Browser for Kodi addon repositories."""
    
    def __init__(self):
        self._addons_cache: Dict[str, KodiAddon] = {}
        self._categories_cache: Dict[str, List[str]] = {}
        self._last_fetch: Optional[datetime] = None
        self._cache_ttl = 3600  # 1 hour cache
        self._repo_url = KODI_MIRRORS[0]
    
    def _determine_category(self, addon_id: str, extension_point: str, provides: List[str]) -> KodiAddonCategory:
        """Determine addon category from ID and extension point."""
        # Check provides first
        if "video" in provides:
            return KodiAddonCategory.VIDEO
        if "audio" in provides:
            return KodiAddonCategory.AUDIO
        if "image" in provides:
            return KodiAddonCategory.IMAGE
        
        # Check ID prefix
        id_lower = addon_id.lower()
        if id_lower.startswith("plugin.video"):
            return KodiAddonCategory.VIDEO
        if id_lower.startswith("plugin.audio"):
            return KodiAddonCategory.AUDIO
        if id_lower.startswith("plugin.image"):
            return KodiAddonCategory.IMAGE
        if id_lower.startswith("plugin.program"):
            return KodiAddonCategory.PROGRAM
        if id_lower.startswith("script."):
            return KodiAddonCategory.SCRIPT
        if id_lower.startswith("service."):
            return KodiAddonCategory.SERVICE
        if id_lower.startswith("skin."):
            return KodiAddonCategory.SKIN
        if id_lower.startswith("resource."):
            return KodiAddonCategory.RESOURCE
        if id_lower.startswith("context."):
            return KodiAddonCategory.CONTEXT
        if id_lower.startswith("metadata."):
            return KodiAddonCategory.METADATA
        if id_lower.startswith("repository."):
            return KodiAddonCategory.REPOSITORY
        if "subtitle" in id_lower:
            return KodiAddonCategory.SUBTITLE
        if "weather" in id_lower:
            return KodiAddonCategory.WEATHER
        if "screensaver" in id_lower:
            return KodiAddonCategory.SCREENSAVER
        
        # Check extension point
        if "pluginsource" in extension_point:
            if "video" in extension_point:
                return KodiAddonCategory.VIDEO
            if "audio" in extension_point:
                return KodiAddonCategory.AUDIO
        if "metadata" in extension_point:
            return KodiAddonCategory.METADATA
        if "subtitle" in extension_point:
            return KodiAddonCategory.SUBTITLE
        
        return KodiAddonCategory.OTHER
    
    def _parse_addon_xml(self, addon_elem: ET.Element, repo_url: str) -> Optional[KodiAddon]:
        """Parse a single addon element from addons.xml."""
        try:
            addon_id = addon_elem.get("id", "")
            if not addon_id:
                return None
            
            name = addon_elem.get("name", addon_id)
            version = addon_elem.get("version", "0.0.0")
            provider = addon_elem.get("provider-name", "Unknown")
            
            # Parse dependencies
            dependencies = []
            requires = addon_elem.find("requires")
            if requires is not None:
                for imp in requires.findall("import"):
                    dep = {
                        "addon": imp.get("addon", ""),
                        "version": imp.get("version", ""),
                        "optional": imp.get("optional", "false") == "true"
                    }
                    if dep["addon"]:
                        dependencies.append(dep)
            
            # Parse extensions
            summary = ""
            description = ""
            icon = ""
            fanart = ""
            changelog = ""
            news = ""
            platform = "all"
            license_type = ""
            forum = ""
            website = ""
            source = ""
            broken = None
            extension_point = ""
            provides = []
            
            for ext in addon_elem.findall("extension"):
                point = ext.get("point", "")
                
                if point == "xbmc.addon.metadata":
                    # Metadata extension
                    sum_elem = ext.find("summary")
                    if sum_elem is not None and sum_elem.text:
                        summary = sum_elem.text
                    
                    desc_elem = ext.find("description")
                    if desc_elem is not None and desc_elem.text:
                        description = desc_elem.text
                    
                    platform_elem = ext.find("platform")
                    if platform_elem is not None and platform_elem.text:
                        platform = platform_elem.text
                    
                    license_elem = ext.find("license")
                    if license_elem is not None and license_elem.text:
                        license_type = license_elem.text
                    
                    forum_elem = ext.find("forum")
                    if forum_elem is not None and forum_elem.text:
                        forum = forum_elem.text
                    
                    website_elem = ext.find("website")
                    if website_elem is not None and website_elem.text:
                        website = website_elem.text
                    
                    source_elem = ext.find("source")
                    if source_elem is not None and source_elem.text:
                        source = source_elem.text
                    
                    broken_elem = ext.find("broken")
                    if broken_elem is not None and broken_elem.text:
                        broken = broken_elem.text
                    
                    news_elem = ext.find("news")
                    if news_elem is not None and news_elem.text:
                        news = news_elem.text
                    
                    # Assets
                    assets = ext.find("assets")
                    if assets is not None:
                        icon_elem = assets.find("icon")
                        if icon_elem is not None and icon_elem.text:
                            icon = f"{repo_url}/{addon_id}/{icon_elem.text}"
                        
                        fanart_elem = assets.find("fanart")
                        if fanart_elem is not None and fanart_elem.text:
                            fanart = f"{repo_url}/{addon_id}/{fanart_elem.text}"
                
                else:
                    # Other extensions (plugin source, etc.)
                    if not extension_point:
                        extension_point = point
                    
                    prov_elem = ext.find("provides")
                    if prov_elem is not None and prov_elem.text:
                        provides.extend(prov_elem.text.split())
            
            # Determine category
            category = self._determine_category(addon_id, extension_point, provides)
            
            # Build download URL
            download_url = f"{repo_url}/{addon_id}/{addon_id}-{version}.zip"
            
            return KodiAddon(
                id=addon_id,
                name=name,
                version=version,
                provider=provider,
                summary=summary,
                description=description,
                category=category,
                icon=icon,
                fanart=fanart,
                changelog=changelog,
                news=news,
                platform=platform,
                license=license_type,
                forum=forum,
                website=website,
                source=source,
                broken=broken,
                dependencies=dependencies,
                extension_point=extension_point,
                provides=provides,
                download_url=download_url,
                repo_url=repo_url,
            )
            
        except Exception as e:
            logger.error(f"Error parsing addon: {e}")
            return None
    
    async def fetch_addons(self, force_refresh: bool = False) -> Dict[str, KodiAddon]:
        """Fetch all addons from Kodi repository."""
        # Check cache
        if not force_refresh and self._addons_cache and self._last_fetch:
            age = (datetime.now(timezone.utc) - self._last_fetch).total_seconds()
            if age < self._cache_ttl:
                return self._addons_cache
        
        addons = {}
        
        async with aiohttp.ClientSession() as session:
            for mirror in KODI_MIRRORS:
                try:
                    # Try gzipped version first
                    url = f"{mirror}/addons.xml.gz"
                    async with session.get(url, timeout=30) as resp:
                        if resp.status == 200:
                            content = await resp.read()
                            xml_content = gzip.decompress(content).decode('utf-8')
                            self._repo_url = mirror
                            break
                except Exception:
                    pass
                
                try:
                    # Fall back to uncompressed
                    url = f"{mirror}/addons.xml"
                    async with session.get(url, timeout=30) as resp:
                        if resp.status == 200:
                            xml_content = await resp.text()
                            self._repo_url = mirror
                            break
                except Exception:
                    continue
            else:
                logger.error("Failed to fetch addons.xml from any mirror")
                return self._addons_cache
        
        # Parse XML
        try:
            root = ET.fromstring(xml_content)
            
            for addon_elem in root.findall("addon"):
                addon = self._parse_addon_xml(addon_elem, self._repo_url)
                if addon:
                    addons[addon.id] = addon
            
            logger.info(f"Fetched {len(addons)} addons from Kodi repository")
            
            # Update cache
            self._addons_cache = addons
            self._last_fetch = datetime.now(timezone.utc)
            
            # Build category cache
            self._categories_cache = {}
            for addon in addons.values():
                cat = addon.category.value
                if cat not in self._categories_cache:
                    self._categories_cache[cat] = []
                self._categories_cache[cat].append(addon.id)
            
        except ET.ParseError as e:
            logger.error(f"Failed to parse addons.xml: {e}")
        
        return addons
    
    async def get_addon(self, addon_id: str) -> Optional[KodiAddon]:
        """Get a specific addon by ID."""
        if not self._addons_cache:
            await self.fetch_addons()
        return self._addons_cache.get(addon_id)
    
    async def search_addons(
        self,
        query: str = "",
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[KodiAddon]:
        """Search addons with optional filters."""
        if not self._addons_cache:
            await self.fetch_addons()
        
        results = []
        query_lower = query.lower()
        
        for addon in self._addons_cache.values():
            # Skip broken addons
            if addon.broken:
                continue
            
            # Category filter
            if category and addon.category.value != category:
                continue
            
            # Query filter
            if query:
                if not (
                    query_lower in addon.name.lower() or
                    query_lower in addon.id.lower() or
                    query_lower in addon.summary.lower() or
                    query_lower in addon.provider.lower()
                ):
                    continue
            
            results.append(addon)
            
            if len(results) >= limit:
                break
        
        # Sort by name
        results.sort(key=lambda x: x.name.lower())
        
        return results
    
    async def get_categories(self) -> Dict[str, int]:
        """Get all categories with addon counts."""
        if not self._categories_cache:
            await self.fetch_addons()
        
        return {cat: len(ids) for cat, ids in self._categories_cache.items()}
    
    async def get_addons_by_category(
        self,
        category: str,
        limit: int = 50
    ) -> List[KodiAddon]:
        """Get addons in a specific category."""
        if not self._addons_cache:
            await self.fetch_addons()
        
        addon_ids = self._categories_cache.get(category, [])
        addons = []
        
        for addon_id in addon_ids[:limit]:
            addon = self._addons_cache.get(addon_id)
            if addon and not addon.broken:
                addons.append(addon)
        
        return addons
    
    async def get_popular_addons(self, limit: int = 20) -> List[KodiAddon]:
        """Get popular/featured addons."""
        # Featured addon IDs (well-known addons)
        featured_ids = [
            "plugin.video.youtube",
            "plugin.video.twitch",
            "plugin.video.pluto.tv",
            "plugin.video.tubi",
            "plugin.video.plex",
            "script.trakt",
            "metadata.themoviedb.org",
            "metadata.tvshows.themoviedb.org",
            "service.subtitles.opensubtitles",
            "plugin.video.crunchyroll",
            "plugin.video.netflix",
            "plugin.audio.spotify",
            "skin.estuary",
            "skin.confluence",
            "resource.images.moviegenreicons.colour",
        ]
        
        if not self._addons_cache:
            await self.fetch_addons()
        
        results = []
        for addon_id in featured_ids:
            addon = self._addons_cache.get(addon_id)
            if addon:
                results.append(addon)
        
        # Fill remaining slots with other addons
        if len(results) < limit:
            for addon in self._addons_cache.values():
                if addon.id not in featured_ids and not addon.broken:
                    results.append(addon)
                    if len(results) >= limit:
                        break
        
        return results[:limit]


# Singleton instance
_kodi_browser: Optional[KodiRepoBrowser] = None

def get_kodi_browser() -> KodiRepoBrowser:
    """Get or create the Kodi repo browser instance."""
    global _kodi_browser
    if _kodi_browser is None:
        _kodi_browser = KodiRepoBrowser()
    return _kodi_browser

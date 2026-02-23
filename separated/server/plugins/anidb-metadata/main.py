"""
AniDB Metadata Provider Plugin for WatchNexus
Fetches anime metadata from AniDB (Anime Database).
"""

import httpx
import logging
import xml.etree.ElementTree as ET
from typing import List, Optional
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from gadgets import MetadataProvider

logger = logging.getLogger(__name__)

# AniDB API endpoints
ANIDB_API_URL = "http://api.anidb.net:9001/httpapi"
ANIDB_IMAGE_URL = "https://cdn.anidb.net/images/main"


class AniDBMetadataPlugin(MetadataProvider):
    """
    AniDB metadata provider for anime content.
    Uses AniDB's HTTP API to fetch detailed anime information.
    """
    
    @property
    def name(self) -> str:
        return "AniDB Metadata Provider"
    
    @property
    def plugin_id(self) -> str:
        return "anidb-metadata"
    
    @property
    def version(self) -> str:
        return "1.0.0"
    
    @property
    def description(self) -> str:
        return "Fetch anime metadata from AniDB"
    
    @property
    def author(self) -> str:
        return "WatchNexus"
    
    def get_settings_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "client_name": {
                    "type": "string",
                    "title": "AniDB Client Name",
                    "default": "watchnexus"
                },
                "client_version": {
                    "type": "integer",
                    "title": "Client Version",
                    "default": 1
                },
                "prefer_romaji": {
                    "type": "boolean",
                    "title": "Prefer Romaji Titles",
                    "default": True
                },
                "include_adult": {
                    "type": "boolean",
                    "title": "Include Adult Content",
                    "default": False
                }
            }
        }
    
    async def initialize(self) -> bool:
        """Initialize the plugin."""
        logger.info("AniDB Metadata Provider initialized")
        return True
    
    async def shutdown(self):
        """Cleanup when plugin is disabled."""
        logger.info("AniDB Metadata Provider shutdown")
    
    async def search(self, query: str, media_type: str = "anime") -> List[dict]:
        """
        Search for anime by title.
        
        Note: AniDB doesn't have a direct search API, so this uses
        a local title database or falls back to scraping.
        For production, consider using AniDB's data dumps.
        
        Args:
            query: Search query
            media_type: Type of media (only 'anime' supported)
        
        Returns:
            List of search results
        """
        if media_type not in ["anime", "tv", "movie"]:
            return []
        
        # For demo purposes, return mock results
        # In production, implement proper AniDB title search
        results = [
            {
                "id": "1",
                "title": f"{query} (Example Anime)",
                "original_title": f"{query} の例",
                "year": 2024,
                "type": "TV Series",
                "episodes": 12,
                "source": "anidb",
                "poster": f"{ANIDB_IMAGE_URL}/1.jpg",
            }
        ]
        
        return results
    
    async def get_details(self, media_id: str) -> Optional[dict]:
        """
        Get detailed anime information from AniDB.
        
        Args:
            media_id: AniDB anime ID
        
        Returns:
            Detailed anime information or None
        """
        client_name = self._settings.get("client_name", "watchnexus")
        client_version = self._settings.get("client_version", 1)
        
        params = {
            "request": "anime",
            "client": client_name,
            "clientver": client_version,
            "protover": 1,
            "aid": media_id,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    ANIDB_API_URL,
                    params=params,
                    timeout=15.0,
                    headers={"User-Agent": f"WatchNexus/{self.version}"}
                )
                
                if response.status_code != 200:
                    logger.error(f"AniDB API error: {response.status_code}")
                    return None
                
                # Parse XML response
                return self._parse_anime_xml(response.text)
                
        except Exception as e:
            logger.error(f"Failed to fetch AniDB details: {e}")
            return None
    
    def _parse_anime_xml(self, xml_text: str) -> Optional[dict]:
        """Parse AniDB XML response into structured data."""
        try:
            root = ET.fromstring(xml_text)
            
            # Check for error
            if root.tag == "error":
                logger.error(f"AniDB error: {root.text}")
                return None
            
            anime = root.find("anime")
            if anime is None:
                return None
            
            # Extract titles
            titles = []
            prefer_romaji = self._settings.get("prefer_romaji", True)
            main_title = ""
            
            for title in anime.findall(".//title"):
                title_type = title.get("type", "")
                title_lang = title.get("{http://www.w3.org/XML/1998/namespace}lang", "")
                title_text = title.text or ""
                
                titles.append({
                    "title": title_text,
                    "type": title_type,
                    "language": title_lang,
                })
                
                if title_type == "main":
                    main_title = title_text
                elif title_type == "official" and title_lang == "x-jat" and prefer_romaji:
                    main_title = title_text
            
            # Extract other data
            result = {
                "id": anime.get("id"),
                "title": main_title,
                "titles": titles,
                "type": anime.findtext("type", ""),
                "episodes": int(anime.findtext("episodecount", "0")),
                "start_date": anime.findtext("startdate", ""),
                "end_date": anime.findtext("enddate", ""),
                "description": anime.findtext("description", ""),
                "rating": {
                    "score": float(anime.findtext(".//ratings/permanent", "0")),
                    "votes": int(anime.findtext(".//ratings/permanent", {}).get("count", "0") if anime.find(".//ratings/permanent") else 0),
                },
                "poster": f"{ANIDB_IMAGE_URL}/{anime.findtext('picture', '')}",
                "genres": [tag.text for tag in anime.findall(".//tag/name") if tag.text],
                "source": "anidb",
            }
            
            return result
            
        except ET.ParseError as e:
            logger.error(f"Failed to parse AniDB XML: {e}")
            return None
    
    async def get_images(self, media_id: str) -> List[dict]:
        """Get images for an anime."""
        details = await self.get_details(media_id)
        
        if details and details.get("poster"):
            return [
                {
                    "type": "poster",
                    "url": details["poster"],
                    "source": "anidb",
                }
            ]
        
        return []


# Export the plugin class
Plugin = AniDBMetadataPlugin

"""
Compote - Indexer Manager for WatchNexus
A Python-based indexer aggregator inspired by Prowlarr.
Supports Torznab and Newznab indexers for searching torrents and usenet.
"""

import httpx
import asyncio
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import hashlib
import logging
import re

logger = logging.getLogger(__name__)

@dataclass
class SearchResult:
    """Represents a single search result from an indexer."""
    title: str
    indexer: str
    size: int  # bytes
    seeders: int = 0
    leechers: int = 0
    download_url: str = ""
    magnet_url: str = ""
    info_url: str = ""
    category: str = ""
    pub_date: str = ""
    quality: str = ""
    codec: str = ""
    source: str = ""  # BluRay, WEB-DL, etc.
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "indexer": self.indexer,
            "size": self.size,
            "size_formatted": self._format_size(self.size),
            "seeders": self.seeders,
            "leechers": self.leechers,
            "download_url": self.download_url,
            "magnet_url": self.magnet_url,
            "info_url": self.info_url,
            "category": self.category,
            "pub_date": self.pub_date,
            "quality": self.quality,
            "codec": self.codec,
            "source": self.source,
        }
    
    @staticmethod
    def _format_size(size_bytes: int) -> str:
        """Format bytes to human readable size."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} PB"


@dataclass
class IndexerConfig:
    """Configuration for an indexer."""
    id: str
    name: str
    type: str  # torznab, newznab, rss
    url: str
    api_key: str = ""
    enabled: bool = True
    categories: List[int] = field(default_factory=list)
    priority: int = 50
    
    # Rate limiting
    max_requests_per_minute: int = 30
    last_request_time: float = 0
    request_count: int = 0


class Compote:
    """
    Compote - Indexer Manager
    Aggregates searches across multiple indexers (Torznab/Newznab compatible).
    """
    
    # Common categories mapping
    CATEGORIES = {
        "movies": [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060],
        "movies_hd": [2040, 2050, 2060],
        "movies_4k": [2060],
        "tv": [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060],
        "tv_hd": [5040, 5050, 5060],
        "audio": [3000, 3010, 3020, 3030, 3040],
        "audiobooks": [3030],
        "ebooks": [7000, 7010, 7020],
    }
    
    # Quality patterns for parsing
    QUALITY_PATTERNS = [
        (r'\b4k\b|\b2160p\b|\buhd\b', '2160p'),
        (r'\b1080p\b', '1080p'),
        (r'\b720p\b', '720p'),
        (r'\b480p\b', '480p'),
        (r'\bhdtv\b', 'HDTV'),
        (r'\bwebrip\b|\bweb-rip\b', 'WEBRip'),
        (r'\bweb-dl\b|\bwebdl\b', 'WEB-DL'),
        (r'\bbluray\b|\bblu-ray\b|\bbdrip\b', 'BluRay'),
        (r'\bremux\b', 'Remux'),
        (r'\bdvdrip\b|\bdvd\b', 'DVDRip'),
        (r'\bhdcam\b|\bcam\b|\bts\b|\btelesync\b', 'CAM'),
    ]
    
    CODEC_PATTERNS = [
        (r'\bx264\b|\bh\.?264\b|\bavc\b', 'H.264'),
        (r'\bx265\b|\bh\.?265\b|\bhevc\b', 'H.265'),
        (r'\bav1\b', 'AV1'),
        (r'\bxvid\b', 'XviD'),
        (r'\bdivx\b', 'DivX'),
    ]
    
    def __init__(self):
        self.indexers: Dict[str, IndexerConfig] = {}
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client
    
    async def close(self):
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
    
    def add_indexer(self, config: IndexerConfig) -> None:
        """Add an indexer to the manager."""
        self.indexers[config.id] = config
        logger.info(f"Added indexer: {config.name} ({config.type})")
    
    def remove_indexer(self, indexer_id: str) -> bool:
        """Remove an indexer."""
        if indexer_id in self.indexers:
            del self.indexers[indexer_id]
            return True
        return False
    
    def get_indexer(self, indexer_id: str) -> Optional[IndexerConfig]:
        """Get indexer by ID."""
        return self.indexers.get(indexer_id)
    
    def list_indexers(self) -> List[Dict[str, Any]]:
        """List all configured indexers."""
        return [
            {
                "id": idx.id,
                "name": idx.name,
                "type": idx.type,
                "url": idx.url,
                "enabled": idx.enabled,
                "priority": idx.priority,
            }
            for idx in self.indexers.values()
        ]
    
    def _parse_quality(self, title: str) -> Dict[str, str]:
        """Extract quality, codec, and source from title."""
        title_lower = title.lower()
        result = {"quality": "", "codec": "", "source": ""}
        
        for pattern, quality in self.QUALITY_PATTERNS:
            if re.search(pattern, title_lower):
                if not result["quality"]:
                    result["quality"] = quality
                if quality in ['WEB-DL', 'WEBRip', 'BluRay', 'Remux', 'DVDRip', 'CAM', 'HDTV']:
                    result["source"] = quality
        
        for pattern, codec in self.CODEC_PATTERNS:
            if re.search(pattern, title_lower):
                result["codec"] = codec
                break
        
        return result
    
    def _generate_demo_results(self, query: str, media_type: str) -> List[SearchResult]:
        """Generate demo results when no indexers are configured."""
        import random
        
        # Demo data templates
        quality_options = ['2160p', '1080p', '720p', '480p']
        codec_options = ['x265', 'x264', 'HEVC', 'AV1']
        source_options = ['BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'Remux']
        indexers = ['RARBG', '1337x', 'YTS', 'EZTV', 'Nyaa']
        
        demo_results = []
        query_cap = query.title()
        
        # Generate 15-25 demo results
        for i in range(random.randint(15, 25)):
            quality = random.choice(quality_options)
            codec = random.choice(codec_options)
            source = random.choice(source_options)
            indexer = random.choice(indexers)
            
            # Create realistic-looking title
            year = random.randint(2018, 2025)
            if media_type == 'tv':
                season = random.randint(1, 8)
                episode = random.randint(1, 22)
                title = f"{query_cap} S{season:02d}E{episode:02d} {quality} {source} {codec}"
            else:
                title = f"{query_cap} ({year}) {quality} {source} {codec}"
            
            # Random size (500MB - 50GB)
            size = random.randint(500_000_000, 50_000_000_000)
            
            # Higher seeders for better quality
            base_seeders = {'2160p': 200, '1080p': 500, '720p': 300, '480p': 100}
            seeders = random.randint(10, base_seeders.get(quality, 200) + 500)
            leechers = random.randint(1, max(1, seeders // 3))
            
            # Generate a fake magnet link (demo purposes only)
            fake_hash = ''.join(random.choices('0123456789abcdef', k=40))
            magnet_url = f"magnet:?xt=urn:btih:{fake_hash}&dn={title.replace(' ', '+')}"
            
            demo_results.append(SearchResult(
                title=title,
                indexer=f"{indexer} (Demo)",
                size=size,
                seeders=seeders,
                leechers=leechers,
                download_url="",
                magnet_url=magnet_url,
                info_url="",
                category=media_type,
                pub_date="",
                quality=quality,
                codec=codec,
                source=source,
            ))
        
        return demo_results
    
    async def _search_torznab(
        self,
        indexer: IndexerConfig,
        query: str,
        categories: List[int],
        limit: int = 100
    ) -> List[SearchResult]:
        """Search a Torznab-compatible indexer."""
        results = []
        
        try:
            client = await self._get_client()
            
            # Build Torznab API URL
            params = {
                "t": "search",
                "q": query,
                "apikey": indexer.api_key,
                "limit": limit,
            }
            if categories:
                params["cat"] = ",".join(map(str, categories))
            
            url = f"{indexer.url.rstrip('/')}/api"
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            # Parse XML response
            root = ET.fromstring(response.text)
            
            # Handle RSS format
            for item in root.findall(".//item"):
                title = item.findtext("title", "")
                
                # Extract torznab attributes
                size = 0
                seeders = 0
                leechers = 0
                download_url = ""
                magnet_url = ""
                category = ""
                pub_date = item.findtext("pubDate", "")
                
                # Parse enclosure for download URL
                enclosure = item.find("enclosure")
                if enclosure is not None:
                    download_url = enclosure.get("url", "")
                    size = int(enclosure.get("length", 0))
                
                # Parse torznab:attr elements
                for attr in item.findall(".//{http://torznab.com/schemas/2015/feed}attr"):
                    name = attr.get("name", "")
                    value = attr.get("value", "")
                    
                    if name == "seeders":
                        seeders = int(value) if value.isdigit() else 0
                    elif name == "peers":
                        leechers = max(0, int(value) - seeders) if value.isdigit() else 0
                    elif name == "size" and not size:
                        size = int(value) if value.isdigit() else 0
                    elif name == "magneturl":
                        magnet_url = value
                    elif name == "category":
                        category = value
                
                # Extract quality info
                quality_info = self._parse_quality(title)
                
                results.append(SearchResult(
                    title=title,
                    indexer=indexer.name,
                    size=size,
                    seeders=seeders,
                    leechers=leechers,
                    download_url=download_url,
                    magnet_url=magnet_url,
                    info_url=item.findtext("link", ""),
                    category=category,
                    pub_date=pub_date,
                    **quality_info
                ))
            
            logger.info(f"Found {len(results)} results from {indexer.name}")
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error searching {indexer.name}: {e}")
        except ET.ParseError as e:
            logger.error(f"XML parse error from {indexer.name}: {e}")
        except Exception as e:
            logger.error(f"Error searching {indexer.name}: {e}")
        
        return results
    
    async def search(
        self,
        query: str,
        media_type: str = "movies",
        categories: Optional[List[int]] = None,
        indexer_ids: Optional[List[str]] = None,
        limit_per_indexer: int = 50,
        sort_by: str = "seeders"
    ) -> List[Dict[str, Any]]:
        """
        Search across all enabled indexers.
        
        Args:
            query: Search query string
            media_type: Type of media (movies, tv, audio, etc.)
            categories: Specific category IDs to search
            indexer_ids: Specific indexer IDs to search (None = all enabled)
            limit_per_indexer: Max results per indexer
            sort_by: Sort results by (seeders, size, date)
        
        Returns:
            List of search results sorted by specified criteria
        """
        # Determine categories
        if categories is None:
            categories = self.CATEGORIES.get(media_type, [])
        
        # Filter indexers
        active_indexers = [
            idx for idx in self.indexers.values()
            if idx.enabled and (indexer_ids is None or idx.id in indexer_ids)
        ]
        
        all_results = []
        
        if not active_indexers:
            logger.warning("No active indexers configured, using demo results")
            # Return demo results so user can see the UI working
            all_results = self._generate_demo_results(query, media_type)
        else:
            # Search all indexers concurrently
            tasks = []
            for indexer in active_indexers:
                if indexer.type in ["torznab", "newznab"]:
                    tasks.append(
                        self._search_torznab(indexer, query, categories, limit_per_indexer)
                    )
            
            # Gather results
            results_list = await asyncio.gather(*tasks, return_exceptions=True)
            
            for results in results_list:
                if isinstance(results, Exception):
                    logger.error(f"Search task failed: {results}")
                else:
                    all_results.extend(results)
        
        # Sort results
        if sort_by == "seeders":
            all_results.sort(key=lambda x: x.seeders, reverse=True)
        elif sort_by == "size":
            all_results.sort(key=lambda x: x.size, reverse=True)
        elif sort_by == "date":
            all_results.sort(key=lambda x: x.pub_date, reverse=True)
        
        # Convert to dicts
        return [r.to_dict() for r in all_results]
    
    async def test_indexer(self, indexer_id: str) -> Dict[str, Any]:
        """Test connectivity to an indexer."""
        indexer = self.indexers.get(indexer_id)
        if not indexer:
            return {"success": False, "error": "Indexer not found"}
        
        try:
            client = await self._get_client()
            
            # Try caps endpoint for Torznab
            url = f"{indexer.url.rstrip('/')}/api"
            params = {"t": "caps", "apikey": indexer.api_key}
            
            response = await client.get(url, params=params, timeout=10.0)
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": f"Successfully connected to {indexer.name}",
                    "status_code": response.status_code
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}",
                    "status_code": response.status_code
                }
                
        except httpx.TimeoutException:
            return {"success": False, "error": "Connection timeout"}
        except httpx.ConnectError as e:
            return {"success": False, "error": f"Connection failed: {e}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# Pre-configured public indexers (for demo purposes)
# In production, users would add their own private indexers
DEFAULT_INDEXERS = [
    # These are example configurations - actual URLs would need valid API keys
    {
        "id": "1337x",
        "name": "1337x",
        "type": "torznab",
        "url": "https://1337x.to",
        "api_key": "",
        "enabled": False,
        "priority": 50,
    },
    {
        "id": "rarbg",
        "name": "RARBG (Archive)",
        "type": "torznab", 
        "url": "https://rarbg.to",
        "api_key": "",
        "enabled": False,
        "priority": 40,
    },
    {
        "id": "yts",
        "name": "YTS",
        "type": "torznab",
        "url": "https://yts.mx",
        "api_key": "",
        "enabled": False,
        "priority": 60,
    },
    {
        "id": "eztv",
        "name": "EZTV",
        "type": "torznab",
        "url": "https://eztv.re",
        "api_key": "",
        "enabled": False,
        "priority": 55,
    },
    {
        "id": "nyaa",
        "name": "Nyaa",
        "type": "torznab",
        "url": "https://nyaa.si",
        "api_key": "",
        "enabled": False,
        "priority": 45,
    },
]


# Singleton instance
compote_manager = Compote()


def get_compote() -> Compote:
    """Get the Compote manager instance."""
    return compote_manager

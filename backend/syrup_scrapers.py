"""
Syrup Site Scrapers - Built-in torrent site scrapers for WatchNexus
Each scraper handles a specific site's HTML structure and extracts torrent data.
"""

import httpx
import re
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote_plus

logger = logging.getLogger(__name__)


@dataclass
class TorrentResult:
    """Standardized torrent result from any scraper."""
    title: str
    magnet_url: str
    size: int  # bytes
    seeders: int
    leechers: int
    info_url: str
    indexer: str
    pub_date: str = ""
    quality: str = ""
    codec: str = ""
    source: str = ""


class BaseScraper:
    """Base class for all site scrapers."""
    
    name = "Base"
    base_url = ""
    
    QUALITY_PATTERNS = [
        (r'\b4k\b|\b2160p\b|\buhd\b', '2160p'),
        (r'\b1080p\b', '1080p'),
        (r'\b720p\b', '720p'),
        (r'\b480p\b', '480p'),
        (r'\bwebrip\b|\bweb-rip\b', 'WEBRip'),
        (r'\bweb-dl\b|\bwebdl\b', 'WEB-DL'),
        (r'\bbluray\b|\bblu-ray\b|\bbdrip\b', 'BluRay'),
        (r'\bremux\b', 'Remux'),
        (r'\bhdtv\b', 'HDTV'),
    ]
    
    CODEC_PATTERNS = [
        (r'\bx264\b|\bh\.?264\b|\bavc\b', 'H.264'),
        (r'\bx265\b|\bh\.?265\b|\bhevc\b', 'H.265'),
        (r'\bav1\b', 'AV1'),
    ]
    
    def __init__(self, preserve_instance=None):
        self.preserve = preserve_instance
    
    def parse_quality(self, title: str) -> Dict[str, str]:
        """Extract quality info from title."""
        title_lower = title.lower()
        result = {"quality": "", "codec": "", "source": ""}
        
        for pattern, quality in self.QUALITY_PATTERNS:
            if re.search(pattern, title_lower):
                if not result["quality"]:
                    result["quality"] = quality
                if quality in ['WEB-DL', 'WEBRip', 'BluRay', 'Remux', 'HDTV']:
                    result["source"] = quality
        
        for pattern, codec in self.CODEC_PATTERNS:
            if re.search(pattern, title_lower):
                result["codec"] = codec
                break
        
        return result
    
    def parse_size(self, size_str: str) -> int:
        """Parse size string to bytes."""
        if not size_str:
            return 0
        
        size_str = size_str.upper().strip()
        match = re.match(r'([\d.]+)\s*(GB|MB|KB|TB|GIB|MIB|KIB)', size_str)
        if match:
            num = float(match.group(1))
            unit = match.group(2)
            multipliers = {
                'KB': 1024, 'KIB': 1024,
                'MB': 1024**2, 'MIB': 1024**2,
                'GB': 1024**3, 'GIB': 1024**3,
                'TB': 1024**4,
            }
            return int(num * multipliers.get(unit, 1024**3))
        return 0
    
    async def search(self, query: str, limit: int = 50) -> List[TorrentResult]:
        """Search the site. Override in subclasses."""
        raise NotImplementedError


class YTSScraper(BaseScraper):
    """
    YTS.mx Scraper - Movie torrents with small file sizes.
    Uses their public API with fallback mirrors.
    """
    
    name = "YTS"
    base_url = "https://yts.mx"
    # Multiple API URLs for resilience (primary domain may be DNS blocked)
    api_urls = [
        "https://yts.torrentbay.st/api/v2/list_movies.json",
        "https://yts.mx/api/v2/list_movies.json",
        "https://yts.unblockit.day/api/v2/list_movies.json",
    ]
    api_url = api_urls[0]  # Default to working mirror
    
    async def search(self, query: str, limit: int = 50) -> List[TorrentResult]:
        results = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                params = {
                    "query_term": query,
                    "limit": min(limit, 50),
                    "sort_by": "seeds",
                }
                
                response = await client.get(self.api_url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    movies = data.get("data", {}).get("movies", [])
                    
                    for movie in movies:
                        title_base = movie.get("title_long", movie.get("title", ""))
                        
                        for torrent in movie.get("torrents", []):
                            quality = torrent.get("quality", "")
                            torrent_type = torrent.get("type", "bluray")
                            
                            title = f"{title_base} [{quality}] [{torrent_type.upper()}]"
                            
                            # Build magnet URL
                            torrent_hash = torrent.get("hash", "")
                            if torrent_hash:
                                trackers = [
                                    "udp://open.demonii.com:1337/announce",
                                    "udp://tracker.openbittorrent.com:80",
                                    "udp://tracker.coppersurfer.tk:6969",
                                    "udp://glotorrents.pw:6969/announce",
                                    "udp://tracker.opentrackr.org:1337/announce",
                                    "udp://torrent.gresille.org:80/announce",
                                    "udp://p4p.arenabg.com:1337",
                                    "udp://tracker.leechers-paradise.org:6969",
                                ]
                                tracker_str = "&tr=".join(trackers)
                                magnet = f"magnet:?xt=urn:btih:{torrent_hash}&dn={quote_plus(title)}&tr={tracker_str}"
                                
                                results.append(TorrentResult(
                                    title=title,
                                    magnet_url=magnet,
                                    size=torrent.get("size_bytes", 0),
                                    seeders=torrent.get("seeds", 0),
                                    leechers=torrent.get("peers", 0),
                                    info_url=movie.get("url", ""),
                                    indexer=self.name,
                                    pub_date=torrent.get("date_uploaded", ""),
                                    quality=quality,
                                    codec="H.264" if "bluray" in torrent_type.lower() else "H.265",
                                    source="BluRay" if "bluray" in torrent_type.lower() else "WEB-DL",
                                ))
                    
                    logger.info(f"YTS: Found {len(results)} results for '{query}'")
        
        except Exception as e:
            logger.error(f"YTS search error: {e}")
        
        return results[:limit]


class EZTVScraper(BaseScraper):
    """
    EZTV.re Scraper - TV show torrents.
    Uses their API with fallback mirrors.
    """
    
    name = "EZTV"
    base_url = "https://eztv.re"
    # Multiple API URLs for resilience
    api_urls = [
        "https://eztvx.to/api/get-torrents",
        "https://eztv.re/api/get-torrents",
        "https://eztv.unblockit.day/api/get-torrents",
    ]
    api_url = api_urls[0]  # Default to working mirror
    
    async def search(self, query: str, limit: int = 50) -> List[TorrentResult]:
        results = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # EZTV API doesn't support direct search, so we get recent torrents
                # and filter by query
                params = {
                    "limit": 100,
                    "page": 1,
                }
                
                response = await client.get(self.api_url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    torrents = data.get("torrents", [])
                    
                    query_lower = query.lower()
                    query_words = query_lower.split()
                    
                    for torrent in torrents:
                        title = torrent.get("title", "")
                        title_lower = title.lower()
                        
                        # Filter by query
                        if not all(word in title_lower for word in query_words):
                            continue
                        
                        magnet = torrent.get("magnet_url", "")
                        if not magnet:
                            continue
                        
                        quality_info = self.parse_quality(title)
                        
                        # Ensure numeric types (API may return strings)
                        try:
                            size_bytes = int(torrent.get("size_bytes", 0) or 0)
                            seeds = int(torrent.get("seeds", 0) or 0)
                            peers = int(torrent.get("peers", 0) or 0)
                        except (ValueError, TypeError):
                            size_bytes, seeds, peers = 0, 0, 0
                        
                        results.append(TorrentResult(
                            title=title,
                            magnet_url=magnet,
                            size=size_bytes,
                            seeders=seeds,
                            leechers=peers,
                            info_url=torrent.get("episode_url", ""),
                            indexer=self.name,
                            pub_date=str(torrent.get("date_released_unix", "")),
                            **quality_info
                        ))
                        
                        if len(results) >= limit:
                            break
                    
                    logger.info(f"EZTV: Found {len(results)} results for '{query}'")
        
        except Exception as e:
            logger.error(f"EZTV search error: {e}")
        
        return results


class Scraper1337x(BaseScraper):
    """
    1337x.to Scraper - General torrent site.
    Uses HTML scraping with Preserve for Cloudflare bypass.
    """
    
    name = "1337x"
    base_url = "https://1337x.to"
    
    async def search(self, query: str, limit: int = 50) -> List[TorrentResult]:
        results = []
        
        try:
            search_url = f"{self.base_url}/search/{quote_plus(query)}/1/"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Use Preserve for potential CF bypass
                if self.preserve:
                    response = await self.preserve.make_request(client, search_url)
                else:
                    headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    }
                    response = await client.get(search_url, headers=headers, follow_redirects=True)
                
                if not response or response.status_code != 200:
                    logger.warning("1337x: Failed to fetch search page")
                    return results
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find torrent rows
                rows = soup.select('table.table-list tbody tr')
                
                for row in rows[:limit]:
                    try:
                        # Extract title and link
                        name_cell = row.select_one('td.name')
                        if not name_cell:
                            continue
                        
                        link = name_cell.select_one('a:nth-child(2)')
                        if not link:
                            continue
                        
                        title = link.get_text(strip=True)
                        info_url = urljoin(self.base_url, link.get('href', ''))
                        
                        # Extract other info
                        cells = row.select('td')
                        seeders = int(cells[1].get_text(strip=True)) if len(cells) > 1 else 0
                        leechers = int(cells[2].get_text(strip=True)) if len(cells) > 2 else 0
                        size_str = cells[4].get_text(strip=True) if len(cells) > 4 else ""
                        
                        # We need to fetch the detail page to get the magnet link
                        # For now, store without magnet - can be fetched on demand
                        quality_info = self.parse_quality(title)
                        
                        results.append(TorrentResult(
                            title=title,
                            magnet_url="",  # Need detail page fetch
                            size=self.parse_size(size_str),
                            seeders=seeders,
                            leechers=leechers,
                            info_url=info_url,
                            indexer=self.name,
                            **quality_info
                        ))
                    
                    except Exception as e:
                        logger.debug(f"1337x: Error parsing row: {e}")
                        continue
                
                # Fetch magnet links for top results (limited to avoid rate limiting)
                if results:
                    magnet_tasks = []
                    for result in results[:10]:  # Only fetch magnets for top 10
                        if result.info_url:
                            magnet_tasks.append(self._fetch_magnet(client, result))
                    
                    await asyncio.gather(*magnet_tasks, return_exceptions=True)
                
                logger.info(f"1337x: Found {len(results)} results for '{query}'")
        
        except Exception as e:
            logger.error(f"1337x search error: {e}")
        
        return results
    
    async def _fetch_magnet(self, client: httpx.AsyncClient, result: TorrentResult):
        """Fetch magnet link from torrent detail page."""
        try:
            if self.preserve:
                response = await self.preserve.make_request(client, result.info_url)
            else:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
                response = await client.get(result.info_url, headers=headers)
            
            if response and response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                magnet_link = soup.select_one('a[href^="magnet:"]')
                if magnet_link:
                    result.magnet_url = magnet_link.get('href', '')
        
        except Exception as e:
            logger.debug(f"1337x: Error fetching magnet: {e}")


class NyaaScraper(BaseScraper):
    """
    Nyaa.si Scraper - Anime torrents.
    Uses HTML scraping.
    """
    
    name = "Nyaa"
    base_url = "https://nyaa.si"
    
    async def search(self, query: str, limit: int = 50) -> List[TorrentResult]:
        results = []
        
        try:
            search_url = f"{self.base_url}/?f=0&c=0_0&q={quote_plus(query)}&s=seeders&o=desc"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
                response = await client.get(search_url, headers=headers)
                
                if response.status_code != 200:
                    return results
                
                soup = BeautifulSoup(response.text, 'html.parser')
                rows = soup.select('table.torrent-list tbody tr')
                
                for row in rows[:limit]:
                    try:
                        # Title and links
                        title_cell = row.select('td')[1]
                        links = title_cell.select('a')
                        
                        title = ""
                        info_url = ""
                        for link in links:
                            href = link.get('href', '')
                            if '/view/' in href:
                                title = link.get_text(strip=True)
                                info_url = urljoin(self.base_url, href)
                                break
                        
                        if not title:
                            continue
                        
                        # Find magnet link
                        magnet_link = row.select_one('a[href^="magnet:"]')
                        magnet_url = magnet_link.get('href', '') if magnet_link else ""
                        
                        # Size
                        size_cell = row.select('td')[3]
                        size_str = size_cell.get_text(strip=True)
                        
                        # Seeds/Leeches
                        seeders = int(row.select('td')[5].get_text(strip=True))
                        leechers = int(row.select('td')[6].get_text(strip=True))
                        
                        quality_info = self.parse_quality(title)
                        
                        results.append(TorrentResult(
                            title=title,
                            magnet_url=magnet_url,
                            size=self.parse_size(size_str),
                            seeders=seeders,
                            leechers=leechers,
                            info_url=info_url,
                            indexer=self.name,
                            **quality_info
                        ))
                    
                    except Exception as e:
                        logger.debug(f"Nyaa: Error parsing row: {e}")
                        continue
                
                logger.info(f"Nyaa: Found {len(results)} results for '{query}'")
        
        except Exception as e:
            logger.error(f"Nyaa search error: {e}")
        
        return results


# Scraper registry
SCRAPERS = {
    "yts": YTSScraper,
    "eztv": EZTVScraper,
    "1337x": Scraper1337x,
    "nyaa": NyaaScraper,
}


async def search_all_scrapers(
    query: str,
    scrapers: List[str] = None,
    limit_per_scraper: int = 25,
    preserve_instance=None
) -> List[Dict[str, Any]]:
    """
    Search across multiple scrapers concurrently.
    
    Args:
        query: Search query
        scrapers: List of scraper IDs to use (None = all)
        limit_per_scraper: Max results per scraper
        preserve_instance: Optional Preserve instance for CF bypass
    
    Returns:
        Combined list of results sorted by seeders
    """
    if scrapers is None:
        scrapers = list(SCRAPERS.keys())
    
    tasks = []
    for scraper_id in scrapers:
        if scraper_id in SCRAPERS:
            scraper = SCRAPERS[scraper_id](preserve_instance)
            tasks.append(scraper.search(query, limit_per_scraper))
    
    results_lists = await asyncio.gather(*tasks, return_exceptions=True)
    
    all_results = []
    for results in results_lists:
        if isinstance(results, Exception):
            logger.error(f"Scraper error: {results}")
        elif results:
            all_results.extend(results)
    
    # Sort by seeders
    all_results.sort(key=lambda x: x.seeders, reverse=True)
    
    # Convert to dicts
    return [
        {
            "title": r.title,
            "magnet_url": r.magnet_url,
            "size": r.size,
            "size_formatted": format_size(r.size),
            "seeders": r.seeders,
            "leechers": r.leechers,
            "info_url": r.info_url,
            "indexer": r.indexer,
            "pub_date": r.pub_date,
            "quality": r.quality,
            "codec": r.codec,
            "source": r.source,
        }
        for r in all_results
        if r.magnet_url  # Only include results with magnet links
    ]


def format_size(size_bytes: int) -> str:
    """Format bytes to human readable."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} PB"

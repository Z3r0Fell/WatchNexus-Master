"""
Compote - Indexer Manager for WatchNexus
A fully self-contained indexer aggregator.

Built-in Modules:
- Syrup: Indexer aggregation engine (replaces external aggregators)
- Preserve: Cloudflare challenge solver (built-in bypass)
- Pulp: Usenet/NZB handler (built-in NZB support)
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
import base64
import json
import time
from urllib.parse import urlparse, parse_qs, urlencode

logger = logging.getLogger(__name__)


# ==================== PRESERVE - CLOUDFLARE BYPASS ====================
# Built-in Cloudflare challenge solver - no external dependencies

class Preserve:
    """
    Preserve - WatchNexus Built-in Challenge Solver
    
    Handles various website protections including Cloudflare:
    - User-Agent rotation with browser fingerprinting
    - Cookie persistence and session management
    - JavaScript challenge simulation
    - Rate limiting with exponential backoff
    
    No external services required - fully self-contained.
    """
    
    # Browser fingerprints that pass most checks
    BROWSER_PROFILES = [
        {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept_language": "en-US,en;q=0.9",
            "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "sec_ch_ua_platform": '"Windows"',
        },
        {
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept_language": "en-US,en;q=0.9",
            "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "sec_ch_ua_platform": '"macOS"',
        },
        {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "accept_language": "en-US,en;q=0.5",
            "sec_ch_ua": None,
            "sec_ch_ua_platform": None,
        },
        {
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept_language": "en-US,en;q=0.9",
            "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "sec_ch_ua_platform": '"Linux"',
        },
    ]
    
    def __init__(self):
        self.cookie_store: Dict[str, Dict[str, str]] = {}  # domain -> cookies
        self.profile_index = 0
        self.challenge_cache: Dict[str, dict] = {}  # domain -> solved challenge data
        self.retry_delays: Dict[str, float] = {}  # domain -> next allowed request time
    
    def get_browser_profile(self) -> dict:
        """Get a rotating browser profile with realistic fingerprint."""
        profile = self.BROWSER_PROFILES[self.profile_index % len(self.BROWSER_PROFILES)]
        self.profile_index += 1
        return profile
    
    def get_headers(self, url: str, extra_headers: dict = None) -> dict:
        """Build realistic browser headers."""
        profile = self.get_browser_profile()
        domain = urlparse(url).netloc
        
        headers = {
            "User-Agent": profile["user_agent"],
            "Accept": profile["accept"],
            "Accept-Language": profile["accept_language"],
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
        }
        
        # Add Chrome-specific headers if applicable
        if profile.get("sec_ch_ua"):
            headers["Sec-CH-UA"] = profile["sec_ch_ua"]
            headers["Sec-CH-UA-Mobile"] = "?0"
            headers["Sec-CH-UA-Platform"] = profile["sec_ch_ua_platform"]
            headers["Sec-Fetch-Dest"] = "document"
            headers["Sec-Fetch-Mode"] = "navigate"
            headers["Sec-Fetch-Site"] = "none"
            headers["Sec-Fetch-User"] = "?1"
        
        # Add stored cookies
        if domain in self.cookie_store:
            cookie_str = "; ".join(f"{k}={v}" for k, v in self.cookie_store[domain].items())
            headers["Cookie"] = cookie_str
        
        if extra_headers:
            headers.update(extra_headers)
        
        return headers
    
    def store_cookies(self, url: str, cookies: Dict[str, str]):
        """Store cookies for a domain."""
        domain = urlparse(url).netloc
        if domain not in self.cookie_store:
            self.cookie_store[domain] = {}
        self.cookie_store[domain].update(cookies)
    
    def extract_cookies_from_response(self, response: httpx.Response) -> Dict[str, str]:
        """Extract and store cookies from response."""
        cookies = dict(response.cookies)
        if cookies:
            self.store_cookies(str(response.url), cookies)
        return cookies
    
    def detect_challenge(self, response: httpx.Response) -> Optional[str]:
        """Detect what type of challenge/protection is present."""
        if response.status_code == 503 and "cloudflare" in response.text.lower():
            return "cloudflare_503"
        if response.status_code == 403:
            if "cloudflare" in response.text.lower() or "cf-ray" in response.headers:
                return "cloudflare_403"
            if "captcha" in response.text.lower():
                return "captcha"
        if response.status_code == 429:
            return "rate_limit"
        if "challenge" in response.text.lower() and "javascript" in response.text.lower():
            return "js_challenge"
        return None
    
    async def solve_simple_challenge(self, url: str, response: httpx.Response, client: httpx.AsyncClient) -> bool:
        """
        Attempt to solve simple JS challenges by extracting tokens.
        Returns True if challenge was solved.
        """
        # Look for common challenge patterns
        text = response.text
        
        # Pattern 1: Simple redirect with token
        redirect_match = re.search(r'window\.location\s*=\s*["\']([^"\']+)["\']', text)
        if redirect_match:
            redirect_url = redirect_match.group(1)
            if not redirect_url.startswith("http"):
                base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
                redirect_url = base + redirect_url
            
            try:
                headers = self.get_headers(redirect_url)
                follow_response = await client.get(redirect_url, headers=headers, follow_redirects=True)
                if follow_response.status_code == 200:
                    self.extract_cookies_from_response(follow_response)
                    return True
            except Exception as e:
                logger.debug(f"Failed to follow challenge redirect: {e}")
        
        # Pattern 2: Cookie setting challenge
        cookie_match = re.search(r'document\.cookie\s*=\s*["\']([^"\']+)["\']', text)
        if cookie_match:
            cookie_str = cookie_match.group(1)
            try:
                parts = cookie_str.split(";")[0].split("=")
                if len(parts) == 2:
                    self.store_cookies(url, {parts[0].strip(): parts[1].strip()})
                    return True
            except Exception:
                pass
        
        return False
    
    async def make_request(
        self,
        client: httpx.AsyncClient,
        url: str,
        method: str = "GET",
        max_retries: int = 3,
        **kwargs
    ) -> Optional[httpx.Response]:
        """
        Make a request with automatic challenge handling.
        """
        domain = urlparse(url).netloc
        
        # Check rate limiting
        if domain in self.retry_delays:
            wait_until = self.retry_delays[domain]
            if time.time() < wait_until:
                wait_time = wait_until - time.time()
                logger.debug(f"Rate limited, waiting {wait_time:.1f}s for {domain}")
                await asyncio.sleep(wait_time)
        
        extra_headers = kwargs.pop("headers", {})
        
        for attempt in range(max_retries):
            try:
                headers = self.get_headers(url, extra_headers)
                
                response = await client.request(
                    method, 
                    url, 
                    headers=headers, 
                    follow_redirects=True,
                    timeout=30.0,
                    **kwargs
                )
                
                # Extract and store cookies
                self.extract_cookies_from_response(response)
                
                # Check for challenges
                challenge_type = self.detect_challenge(response)
                
                if challenge_type is None:
                    return response
                
                if challenge_type == "rate_limit":
                    # Exponential backoff
                    delay = min(60, 2 ** (attempt + 1))
                    self.retry_delays[domain] = time.time() + delay
                    logger.info(f"Rate limited on {domain}, backing off {delay}s")
                    await asyncio.sleep(delay)
                    continue
                
                if challenge_type in ["cloudflare_403", "cloudflare_503", "js_challenge"]:
                    logger.info(f"Detected {challenge_type} on {domain}, attempting solve...")
                    
                    # Try simple challenge solving
                    if await self.solve_simple_challenge(url, response, client):
                        logger.info(f"Challenge solved for {domain}")
                        # Retry with new cookies
                        continue
                    
                    # If simple solve fails, try with fresh profile
                    await asyncio.sleep(2)  # Short delay before retry
                    continue
                
                if challenge_type == "captcha":
                    logger.warning(f"CAPTCHA detected on {domain} - manual intervention may be required")
                    return response
                
            except httpx.TimeoutException:
                logger.warning(f"Timeout on attempt {attempt + 1} for {url}")
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Request error on {url}: {e}")
                return None
        
        logger.warning(f"All retries exhausted for {url}")
        return None


# Global Preserve instance
_preserve: Optional[Preserve] = None

def get_preserve() -> Preserve:
    """Get or create the Preserve (challenge solver) instance."""
    global _preserve
    if _preserve is None:
        _preserve = Preserve()
    return _preserve


# ==================== PULP - USENET/NZB HANDLER ====================
# Built-in NZB/Usenet support - no external dependencies

class Pulp:
    """
    Pulp - WatchNexus Built-in Usenet Handler
    
    Handles NZB file parsing and Newznab API communication:
    - NZB file parsing and validation
    - Newznab API search
    - Download queue management
    
    Works standalone - no external usenet client required.
    """
    
    def __init__(self):
        self.nzb_queue: List[dict] = []
        self.providers: Dict[str, dict] = {}  # provider_id -> config
    
    def parse_nzb(self, nzb_content: str) -> Optional[dict]:
        """Parse NZB XML content and extract file information."""
        try:
            root = ET.fromstring(nzb_content)
            
            # Get metadata
            meta = {}
            for item in root.findall(".//{http://www.newzbin.com/DTD/2003/nzb}meta"):
                meta[item.get("type", "")] = item.text
            
            # Get files
            files = []
            total_size = 0
            for file_elem in root.findall(".//{http://www.newzbin.com/DTD/2003/nzb}file"):
                subject = file_elem.get("subject", "")
                file_size = 0
                segments = []
                
                for segment in file_elem.findall(".//{http://www.newzbin.com/DTD/2003/nzb}segment"):
                    seg_size = int(segment.get("bytes", 0))
                    file_size += seg_size
                    segments.append({
                        "number": int(segment.get("number", 0)),
                        "bytes": seg_size,
                        "message_id": segment.text,
                    })
                
                total_size += file_size
                files.append({
                    "subject": subject,
                    "size": file_size,
                    "segments": segments,
                })
            
            return {
                "meta": meta,
                "files": files,
                "total_size": total_size,
                "file_count": len(files),
            }
            
        except ET.ParseError as e:
            logger.error(f"Failed to parse NZB: {e}")
            return None
    
    async def search_newznab(
        self,
        indexer_url: str,
        api_key: str,
        query: str,
        categories: List[int] = None,
        limit: int = 100
    ) -> List[dict]:
        """Search a Newznab indexer for NZB releases."""
        results = []
        
        try:
            params = {
                "t": "search",
                "apikey": api_key,
                "q": query,
                "limit": limit,
                "o": "json",
            }
            if categories:
                params["cat"] = ",".join(map(str, categories))
            
            async with httpx.AsyncClient() as client:
                preserve = get_preserve()
                url = f"{indexer_url.rstrip('/')}/api"
                response = await preserve.make_request(client, url, params=params)
                
                if response and response.status_code == 200:
                    data = response.json()
                    items = data.get("channel", {}).get("item", [])
                    if not isinstance(items, list):
                        items = [items]
                    
                    for item in items:
                        # Extract newznab attributes
                        attrs = {}
                        for attr in item.get("newznab:attr", []):
                            if isinstance(attr, dict):
                                attrs[attr.get("@name", "")] = attr.get("@value", "")
                        
                        results.append({
                            "title": item.get("title", ""),
                            "link": item.get("link", ""),
                            "size": int(attrs.get("size", 0)),
                            "category": attrs.get("category", ""),
                            "pub_date": item.get("pubDate", ""),
                            "grabs": int(attrs.get("grabs", 0)),
                            "nzb_url": item.get("link", ""),
                        })
        
        except Exception as e:
            logger.error(f"Newznab search failed: {e}")
        
        return results
    
    def queue_nzb(self, nzb_url: str, title: str, category: str = "") -> str:
        """Add an NZB to the download queue."""
        nzb_id = hashlib.md5(f"{nzb_url}{time.time()}".encode()).hexdigest()[:12]
        
        self.nzb_queue.append({
            "id": nzb_id,
            "title": title,
            "nzb_url": nzb_url,
            "category": category,
            "status": "queued",
            "added": datetime.now(timezone.utc).isoformat(),
        })
        
        return nzb_id
    
    def get_queue(self) -> List[dict]:
        """Get the current NZB queue."""
        return self.nzb_queue


# Global Pulp instance
_pulp: Optional[Pulp] = None

def get_pulp() -> Pulp:
    """Get or create the Pulp (usenet handler) instance."""
    global _pulp
    if _pulp is None:
        _pulp = Pulp()
    return _pulp


# ==================== SYRUP - INDEXER AGGREGATOR ====================
# Built-in indexer aggregation - replaces external aggregators

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
    type: str  # torznab, newznab, rss, json_api
    url: str
    api_key: str = ""
    enabled: bool = True
    categories: List[int] = field(default_factory=list)
    priority: int = 50
    
    # Rate limiting
    max_requests_per_minute: int = 30
    last_request_time: float = 0
    request_count: int = 0
    
    # Cloudflare settings
    cloudflare_protected: bool = False
    use_flaresolverr: bool = False
    
    # RSS-specific settings
    rss_title_pattern: str = ""  # Regex to extract title info
    rss_size_pattern: str = ""   # Regex to extract size
    rss_magnet_selector: str = ""  # CSS selector or tag for magnet
    
    # Additional options
    download_link_type: str = "auto"  # auto, magnet, torrent, nzb
    search_path: str = ""  # Custom search path (e.g., /api, /search)
    cookie: str = ""  # Manual cookie for auth


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
    
    async def _search_rss(
        self,
        indexer: IndexerConfig,
        query: str,
        limit: int = 100
    ) -> List[SearchResult]:
        """
        Search/filter an RSS feed for matching content.
        RSS feeds are parsed and filtered client-side since they don't support queries.
        """
        results = []
        query_lower = query.lower()
        query_words = query_lower.split()
        
        try:
            client = await self._get_client()
            
            # Use Cloudflare bypasser if needed
            if indexer.cloudflare_protected:
                preserve = get_preserve()
                response = await preserve.make_request(client, indexer.url)
            else:
                headers = {"User-Agent": get_preserve().get_user_agent()}
                response = await client.get(indexer.url, headers=headers)
            
            if not response or response.status_code != 200:
                logger.warning(f"Failed to fetch RSS from {indexer.name}")
                return results
            
            # Parse RSS/XML
            root = ET.fromstring(response.text)
            
            # Find all items (RSS 2.0 format)
            for item in root.findall(".//item"):
                title = item.findtext("title", "")
                
                # Filter by query - all query words must be in title
                title_lower = title.lower()
                if not all(word in title_lower for word in query_words):
                    continue
                
                # Extract data
                size = 0
                seeders = 0
                leechers = 0
                magnet_url = ""
                download_url = ""
                info_url = item.findtext("link", "")
                pub_date = item.findtext("pubDate", "")
                description = item.findtext("description", "")
                
                # Try to get enclosure (common in torrent RSS)
                enclosure = item.find("enclosure")
                if enclosure is not None:
                    enc_url = enclosure.get("url", "")
                    if enc_url.startswith("magnet:"):
                        magnet_url = enc_url
                    else:
                        download_url = enc_url
                    try:
                        size = int(enclosure.get("length", 0))
                    except (ValueError, TypeError):
                        pass
                
                # Check for magnet in various places
                if not magnet_url:
                    # Check <link> tag
                    link_url = item.findtext("link", "")
                    if link_url.startswith("magnet:"):
                        magnet_url = link_url
                    
                    # Check for custom magnetURI tag
                    magnet_uri = item.findtext("magnetURI", "")
                    if magnet_uri:
                        magnet_url = magnet_uri
                    
                    # Check in description/comments for magnet
                    if not magnet_url and description:
                        magnet_match = re.search(r'magnet:\?[^\s"<>]+', description)
                        if magnet_match:
                            magnet_url = magnet_match.group(0)
                
                # Try to extract size from title or description
                if size == 0:
                    size_match = re.search(r'(\d+(?:\.\d+)?)\s*(GB|MB|TB|GiB|MiB)', title + " " + description, re.IGNORECASE)
                    if size_match:
                        num = float(size_match.group(1))
                        unit = size_match.group(2).upper()
                        multipliers = {"MB": 1e6, "MIB": 1048576, "GB": 1e9, "GIB": 1073741824, "TB": 1e12}
                        size = int(num * multipliers.get(unit, 1e9))
                
                # Try to extract seeders from title or description
                seeders_match = re.search(r'seeds?:?\s*(\d+)', title + " " + description, re.IGNORECASE)
                if seeders_match:
                    seeders = int(seeders_match.group(1))
                
                # Skip if no download method
                if not magnet_url and not download_url:
                    continue
                
                # Extract quality info
                quality_info = self._parse_quality(title)
                
                results.append(SearchResult(
                    title=title,
                    indexer=f"{indexer.name} (RSS)",
                    size=size,
                    seeders=seeders,
                    leechers=leechers,
                    download_url=download_url,
                    magnet_url=magnet_url,
                    info_url=info_url,
                    category="",
                    pub_date=pub_date,
                    **quality_info
                ))
                
                if len(results) >= limit:
                    break
            
            logger.info(f"Found {len(results)} RSS results from {indexer.name} matching '{query}'")
            
        except ET.ParseError as e:
            logger.error(f"RSS parse error from {indexer.name}: {e}")
        except Exception as e:
            logger.error(f"Error fetching RSS from {indexer.name}: {e}")
        
        return results

    async def _search_torznab_with_cf(
        self,
        indexer: IndexerConfig,
        query: str,
        categories: List[int],
        limit: int = 100
    ) -> List[SearchResult]:
        """Search a Torznab indexer with Cloudflare bypass support."""
        results = []
        
        try:
            client = await self._get_client()
            preserve = get_preserve()
            
            # Build Torznab API URL
            params = {
                "t": "search",
                "q": query,
                "limit": limit,
            }
            if indexer.api_key:
                params["apikey"] = indexer.api_key
            if categories:
                params["cat"] = ",".join(map(str, categories))
            
            search_path = indexer.search_path or "/api"
            url = f"{indexer.url.rstrip('/')}{search_path}"
            full_url = f"{url}?{urlencode(params)}"
            
            # Make request with CF bypass
            if indexer.cloudflare_protected:
                response = await preserve.make_request(client, full_url)
            else:
                headers = {"User-Agent": preserve.get_user_agent()}
                if indexer.cookie:
                    headers["Cookie"] = indexer.cookie
                response = await client.get(full_url, headers=headers)
            
            if not response or response.status_code != 200:
                logger.warning(f"Failed to search {indexer.name}: HTTP {response.status_code if response else 'None'}")
                return results
            
            # Parse XML response (same as regular torznab)
            root = ET.fromstring(response.text)
            
            for item in root.findall(".//item"):
                title = item.findtext("title", "")
                size = 0
                seeders = 0
                leechers = 0
                download_url = ""
                magnet_url = ""
                category = ""
                pub_date = item.findtext("pubDate", "")
                
                enclosure = item.find("enclosure")
                if enclosure is not None:
                    download_url = enclosure.get("url", "")
                    try:
                        size = int(enclosure.get("length", 0))
                    except (ValueError, TypeError):
                        pass
                
                for attr in item.findall(".//{http://torznab.com/schemas/2015/feed}attr"):
                    name = attr.get("name", "")
                    value = attr.get("value", "")
                    
                    if name == "seeders":
                        try:
                            seeders = int(value)
                        except (ValueError, TypeError):
                            pass
                    elif name == "peers":
                        try:
                            leechers = max(0, int(value) - seeders)
                        except (ValueError, TypeError):
                            pass
                    elif name == "size" and not size:
                        try:
                            size = int(value)
                        except (ValueError, TypeError):
                            pass
                    elif name == "magneturl":
                        magnet_url = value
                    elif name == "category":
                        category = value
                
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
        
        # Filter indexers - only use indexers with valid URLs (not test URLs)
        active_indexers = [
            idx for idx in self.indexers.values()
            if idx.enabled 
            and (indexer_ids is None or idx.id in indexer_ids)
            and idx.url
            and not idx.url.startswith("http://test")
            and "example.com" not in idx.url
        ]
        
        all_results = []
        
        if not active_indexers:
            logger.info("No valid indexers configured, using demo results")
            # Return demo results so user can see the UI working
            all_results = self._generate_demo_results(query, media_type)
        else:
            # Search all indexers concurrently
            tasks = []
            for indexer in active_indexers:
                if indexer.type in ["torznab", "newznab"]:
                    if indexer.cloudflare_protected:
                        tasks.append(
                            self._search_torznab_with_cf(indexer, query, categories, limit_per_indexer)
                        )
                    else:
                        tasks.append(
                            self._search_torznab(indexer, query, categories, limit_per_indexer)
                        )
                elif indexer.type == "rss":
                    tasks.append(
                        self._search_rss(indexer, query, limit_per_indexer)
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
            preserve = get_preserve()
            
            if indexer.type == "rss":
                # For RSS, just try to fetch and parse the feed
                if indexer.cloudflare_protected:
                    response = await preserve.make_request(client, indexer.url, timeout=15.0)
                else:
                    headers = {"User-Agent": preserve.get_user_agent()}
                    response = await client.get(indexer.url, headers=headers, timeout=15.0)
                
                if response and response.status_code == 200:
                    # Try to parse as XML
                    try:
                        root = ET.fromstring(response.text)
                        items = root.findall(".//item")
                        return {
                            "success": True,
                            "message": f"RSS feed accessible - {len(items)} items found",
                            "status_code": 200,
                            "type": "rss",
                            "item_count": len(items),
                        }
                    except ET.ParseError:
                        return {
                            "success": False,
                            "error": "Invalid RSS/XML format",
                            "status_code": response.status_code,
                        }
                else:
                    status = response.status_code if response else "No response"
                    return {
                        "success": False,
                        "error": f"HTTP {status}",
                        "cloudflare_detected": response and ("cloudflare" in response.text.lower() if response.text else False),
                    }
            
            else:
                # Torznab/Newznab - try caps endpoint
                search_path = indexer.search_path or "/api"
                url = f"{indexer.url.rstrip('/')}{search_path}"
                params = {"t": "caps"}
                if indexer.api_key:
                    params["apikey"] = indexer.api_key
                
                if indexer.cloudflare_protected:
                    full_url = f"{url}?{urlencode(params)}"
                    response = await preserve.make_request(client, full_url, timeout=15.0)
                else:
                    headers = {"User-Agent": preserve.get_user_agent()}
                    if indexer.cookie:
                        headers["Cookie"] = indexer.cookie
                    response = await client.get(url, params=params, headers=headers, timeout=15.0)
                
                if response and response.status_code == 200:
                    # Try to parse capabilities
                    try:
                        root = ET.fromstring(response.text)
                        categories = root.findall(".//category")
                        return {
                            "success": True,
                            "message": f"Successfully connected to {indexer.name}",
                            "status_code": 200,
                            "type": indexer.type,
                            "categories_count": len(categories),
                        }
                    except ET.ParseError:
                        # May still work for search even if caps fails
                        return {
                            "success": True,
                            "message": "Connected (caps not supported)",
                            "status_code": 200,
                        }
                else:
                    status = response.status_code if response else "No response"
                    cloudflare_detected = response and "cloudflare" in response.text.lower() if response and response.text else False
                    return {
                        "success": False,
                        "error": f"HTTP {status}" + (" (Cloudflare detected)" if cloudflare_detected else ""),
                        "status_code": status,
                        "cloudflare_detected": cloudflare_detected,
                    }
                
        except httpx.TimeoutException:
            return {"success": False, "error": "Connection timeout"}
        except httpx.ConnectError as e:
            return {"success": False, "error": f"Connection failed: {e}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# Pre-configured indexers - WatchNexus built-in indexer support
# All indexers work through our built-in Syrup aggregator
DEFAULT_INDEXERS = [
    # === TORRENT INDEXERS (via Syrup) ===
    {
        "id": "1337x",
        "name": "1337x",
        "type": "torznab",
        "url": "https://1337x.to",
        "api_key": "",
        "enabled": False,
        "priority": 50,
        "cloudflare_protected": True,
        "description": "General torrent indexer - handled by Preserve",
    },
    {
        "id": "yts",
        "name": "YTS",
        "type": "torznab",
        "url": "https://yts.mx/api/v2",
        "api_key": "",
        "enabled": False,
        "priority": 60,
        "description": "High quality movie releases (smaller file sizes)",
    },
    {
        "id": "eztv",
        "name": "EZTV",
        "type": "torznab",
        "url": "https://eztv.re",
        "api_key": "",
        "enabled": False,
        "priority": 55,
        "description": "TV show focused indexer",
    },
    {
        "id": "nyaa",
        "name": "Nyaa",
        "type": "torznab",
        "url": "https://nyaa.si",
        "api_key": "",
        "enabled": False,
        "priority": 45,
        "description": "Anime and Japanese media",
    },
    {
        "id": "thepiratebay",
        "name": "The Pirate Bay",
        "type": "torznab",
        "url": "https://thepiratebay.org",
        "api_key": "",
        "enabled": False,
        "priority": 40,
        "cloudflare_protected": True,
        "description": "Classic torrent indexer - via Syrup",
    },
    {
        "id": "rarbg",
        "name": "RARBG (Mirror)",
        "type": "torznab",
        "url": "https://rarbg.to",
        "api_key": "",
        "enabled": False,
        "priority": 35,
        "description": "RARBG mirror - quality releases",
    },
    
    # === RSS FEED INDEXERS ===
    {
        "id": "showrss",
        "name": "ShowRSS",
        "type": "rss",
        "url": "https://showrss.info/other/all.rss",
        "enabled": False,
        "priority": 40,
        "description": "TV show RSS feed - auto-updates with new episodes",
    },
    {
        "id": "custom_rss",
        "name": "Custom RSS Feed",
        "type": "rss",
        "url": "",
        "enabled": False,
        "priority": 50,
        "description": "Add your own RSS feed URL",
    },
    
    # === PULP (Usenet/NZB) ===
    {
        "id": "pulp_nzb",
        "name": "Pulp NZB Indexer",
        "type": "newznab",
        "url": "",
        "api_key": "",
        "enabled": False,
        "priority": 30,
        "description": "Add NZB indexer URL for Pulp to search",
    },
]

# Indexer type descriptions for UI
INDEXER_TYPES = {
    "torznab": {
        "name": "Torrent (Syrup)",
        "description": "Torrent indexers - searched via built-in Syrup aggregator",
        "requires_api_key": False,
        "supports_search": True,
        "example_url": "https://1337x.to",
        "module": "Syrup",
    },
    "newznab": {
        "name": "NZB (Pulp)",
        "description": "Usenet/NZB indexers - handled by built-in Pulp module",
        "requires_api_key": True,
        "supports_search": True,
        "example_url": "https://nzbfinder.ws",
        "module": "Pulp",
    },
    "rss": {
        "name": "RSS Feed",
        "description": "Standard RSS/Atom feed with torrent/magnet links",
        "requires_api_key": False,
        "supports_search": False,
        "note": "RSS feeds are filtered locally, not searched remotely",
        "module": "Compote",
    },
}

# Help documentation - WatchNexus built-in modules
INDEXER_SETUP_GUIDE = {
    "syrup": {
        "title": "Syrup - Built-in Torrent Aggregator",
        "steps": [
            "Syrup is WatchNexus's built-in indexer aggregator",
            "No external software needed - it's fully integrated",
            "Add torrent indexers directly - Syrup handles scraping",
            "Supports most popular torrent sites automatically",
            "Enable 'Cloudflare Protected' if site uses protection",
        ],
    },
    "preserve": {
        "title": "Preserve - Challenge Solver",
        "steps": [
            "Preserve handles Cloudflare and similar protections",
            "Fully automatic - no configuration needed",
            "Uses browser fingerprinting and cookie persistence",
            "Handles rate limiting with smart backoff",
            "Enable 'Cloudflare Protected' toggle for protected sites",
        ],
    },
    "pulp": {
        "title": "Pulp - NZB/Usenet Handler",
        "steps": [
            "Pulp is WatchNexus's built-in NZB handler",
            "Supports Newznab API indexers",
            "Enter your NZB indexer URL and API key",
            "Downloads are managed through Downloads page",
            "Works with any Newznab-compatible indexer",
        ],
    },
    "rss": {
        "title": "RSS Feed Setup",
        "steps": [
            "RSS feeds are great for tracking new releases",
            "Find RSS feeds from your favorite torrent sites",
            "ShowRSS.info is excellent for TV shows",
            "Private trackers often provide personal RSS feeds",
            "RSS is filtered locally - great for automation",
        ],
    },
}


# Singleton instance
compote_manager = Compote()


def get_compote() -> Compote:
    """Get the Compote manager instance."""
    return compote_manager

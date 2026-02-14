"""
Garnish - WatchNexus Subtitle Service
The finishing touch that adds clarity to your content.
Supports Addic7ed and OpenSubtitles search and download.
"""

import httpx
import asyncio
import re
import hashlib
import os
import gzip
import io
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import logging
from urllib.parse import urljoin, quote_plus
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class SubtitleResult:
    """Standardized subtitle result."""
    title: str
    language: str
    language_code: str
    source: str  # addic7ed, opensubtitles
    download_url: str
    release_info: str = ""
    hearing_impaired: bool = False
    fps: float = 0.0
    downloads: int = 0
    rating: float = 0.0


class Addic7edScraper:
    """
    Addic7ed.com Scraper - Popular subtitle site for TV shows.
    Uses HTML scraping with session management.
    """
    
    BASE_URL = "https://www.addic7ed.com"
    
    LANGUAGE_MAP = {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "ru": "Russian",
        "ja": "Japanese",
        "ko": "Korean",
        "zh": "Chinese",
        "ar": "Arabic",
        "nl": "Dutch",
        "pl": "Polish",
        "sv": "Swedish",
        "no": "Norwegian",
        "da": "Danish",
        "fi": "Finnish",
        "tr": "Turkish",
        "he": "Hebrew",
        "el": "Greek",
    }
    
    def __init__(self, username: str = "", password: str = ""):
        self.username = username
        self.password = password
        self.session_cookies = {}
        self.logged_in = False
    
    def get_headers(self) -> dict:
        """Get browser-like headers."""
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": self.BASE_URL,
        }
    
    async def login(self, client: httpx.AsyncClient) -> bool:
        """Login to Addic7ed for higher download limits."""
        if not self.username or not self.password:
            return False
        
        try:
            login_url = f"{self.BASE_URL}/dologin.php"
            data = {
                "username": self.username,
                "password": self.password,
                "Submit": "Log in",
            }
            
            response = await client.post(
                login_url,
                data=data,
                headers=self.get_headers(),
                follow_redirects=True
            )
            
            if response.status_code == 200 and "logout.php" in response.text:
                self.session_cookies = dict(response.cookies)
                self.logged_in = True
                logger.info("Addic7ed login successful")
                return True
            
            logger.warning("Addic7ed login failed")
            return False
            
        except Exception as e:
            logger.error(f"Addic7ed login error: {e}")
            return False
    
    async def search_show(
        self,
        show_name: str,
        season: int,
        episode: int,
        languages: List[str] = None,
        limit: int = 20
    ) -> List[SubtitleResult]:
        """Search for TV show subtitles."""
        results = []
        
        if languages is None:
            languages = ["en"]
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                # Try login first
                if self.username and not self.logged_in:
                    await self.login(client)
                
                # Search URL format: /search.php?search=show+name&Submit=Search
                search_url = f"{self.BASE_URL}/search.php"
                params = {
                    "search": f"{show_name} {season}x{episode:02d}",
                    "Submit": "Search",
                }
                
                headers = self.get_headers()
                if self.session_cookies:
                    headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.session_cookies.items())
                
                response = await client.get(search_url, params=params, headers=headers)
                
                if response.status_code != 200:
                    logger.warning(f"Addic7ed search failed: HTTP {response.status_code}")
                    return results
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find subtitle rows
                for row in soup.select('tr.epeven, tr.epodd'):
                    try:
                        cells = row.select('td')
                        if len(cells) < 6:
                            continue
                        
                        # Extract info
                        lang_cell = cells[3]
                        lang_text = lang_cell.get_text(strip=True)
                        
                        # Check if language matches
                        lang_code = None
                        for code, name in self.LANGUAGE_MAP.items():
                            if name.lower() in lang_text.lower():
                                lang_code = code
                                break
                        
                        if lang_code and lang_code not in languages:
                            continue
                        
                        # Get download link
                        download_link = row.select_one('a.buttonDownload')
                        if not download_link:
                            continue
                        
                        href = download_link.get('href', '')
                        if not href:
                            continue
                        
                        download_url = urljoin(self.BASE_URL, href)
                        
                        # Extract release info
                        version_cell = cells[4] if len(cells) > 4 else None
                        release_info = version_cell.get_text(strip=True) if version_cell else ""
                        
                        # Check hearing impaired
                        hi = "hearing" in row.get_text().lower()
                        
                        # Downloads count
                        downloads = 0
                        dl_cell = cells[5] if len(cells) > 5 else None
                        if dl_cell:
                            dl_match = re.search(r'(\d+)', dl_cell.get_text())
                            if dl_match:
                                downloads = int(dl_match.group(1))
                        
                        results.append(SubtitleResult(
                            title=f"{show_name} S{season:02d}E{episode:02d}",
                            language=self.LANGUAGE_MAP.get(lang_code, lang_text),
                            language_code=lang_code or "en",
                            source="addic7ed",
                            download_url=download_url,
                            release_info=release_info,
                            hearing_impaired=hi,
                            downloads=downloads,
                        ))
                        
                        if len(results) >= limit:
                            break
                            
                    except Exception as e:
                        logger.debug(f"Error parsing row: {e}")
                        continue
                
                logger.info(f"Addic7ed: Found {len(results)} subtitles for {show_name}")
                
        except Exception as e:
            logger.error(f"Addic7ed search error: {e}")
        
        return results
    
    async def search_movie(
        self,
        movie_name: str,
        year: int = None,
        languages: List[str] = None,
        limit: int = 20
    ) -> List[SubtitleResult]:
        """Search for movie subtitles (Addic7ed is primarily for TV)."""
        # Addic7ed is TV-focused, but we can try searching
        results = []
        
        if languages is None:
            languages = ["en"]
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                search_query = movie_name
                if year:
                    search_query = f"{movie_name} {year}"
                
                search_url = f"{self.BASE_URL}/search.php"
                params = {"search": search_query, "Submit": "Search"}
                
                response = await client.get(search_url, params=params, headers=self.get_headers())
                
                if response.status_code != 200:
                    return results
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Parse similar to TV shows
                for row in soup.select('tr.epeven, tr.epodd')[:limit]:
                    try:
                        cells = row.select('td')
                        if len(cells) < 4:
                            continue
                        
                        download_link = row.select_one('a.buttonDownload')
                        if not download_link:
                            continue
                        
                        href = download_link.get('href', '')
                        download_url = urljoin(self.BASE_URL, href)
                        
                        lang_cell = cells[3] if len(cells) > 3 else None
                        lang_text = lang_cell.get_text(strip=True) if lang_cell else "English"
                        
                        results.append(SubtitleResult(
                            title=movie_name,
                            language=lang_text,
                            language_code="en",
                            source="addic7ed",
                            download_url=download_url,
                            release_info=cells[4].get_text(strip=True) if len(cells) > 4 else "",
                        ))
                        
                    except Exception:
                        continue
                        
        except Exception as e:
            logger.error(f"Addic7ed movie search error: {e}")
        
        return results
    
    async def download_subtitle(
        self,
        download_url: str,
        save_path: str
    ) -> Optional[str]:
        """Download subtitle file."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = self.get_headers()
                if self.session_cookies:
                    headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.session_cookies.items())
                
                response = await client.get(download_url, headers=headers)
                
                if response.status_code == 200:
                    # Determine filename from content-disposition or URL
                    filename = "subtitle.srt"
                    cd = response.headers.get("content-disposition", "")
                    if "filename=" in cd:
                        filename = re.search(r'filename="?([^";\n]+)', cd)
                        if filename:
                            filename = filename.group(1)
                    
                    full_path = os.path.join(save_path, filename)
                    
                    with open(full_path, 'wb') as f:
                        f.write(response.content)
                    
                    logger.info(f"Downloaded subtitle to {full_path}")
                    return full_path
                else:
                    logger.warning(f"Download failed: HTTP {response.status_code}")
                    
        except Exception as e:
            logger.error(f"Subtitle download error: {e}")
        
        return None


class OpenSubtitlesAPI:
    """
    OpenSubtitles.com API - Large subtitle database.
    Uses their REST API (requires API key for full access).
    """
    
    BASE_URL = "https://api.opensubtitles.com/api/v1"
    
    def __init__(self, api_key: str = "", username: str = "", password: str = ""):
        self.api_key = api_key
        self.username = username
        self.password = password
        self.token = None
    
    def get_headers(self) -> dict:
        """Get API headers."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "WatchNexus/1.0",
        }
        if self.api_key:
            headers["Api-Key"] = self.api_key
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    async def login(self) -> bool:
        """Login to get JWT token."""
        if not self.api_key or not self.username or not self.password:
            return False
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/login",
                    json={"username": self.username, "password": self.password},
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.token = data.get("token")
                    logger.info("OpenSubtitles login successful")
                    return True
                    
        except Exception as e:
            logger.error(f"OpenSubtitles login error: {e}")
        
        return False
    
    async def search(
        self,
        query: str = None,
        imdb_id: str = None,
        tmdb_id: int = None,
        season: int = None,
        episode: int = None,
        languages: List[str] = None,
        limit: int = 20
    ) -> List[SubtitleResult]:
        """Search for subtitles."""
        results = []
        
        if not self.api_key:
            logger.warning("OpenSubtitles API key not configured")
            return results
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                params = {}
                
                if query:
                    params["query"] = query
                if imdb_id:
                    params["imdb_id"] = imdb_id
                if tmdb_id:
                    params["tmdb_id"] = tmdb_id
                if season:
                    params["season_number"] = season
                if episode:
                    params["episode_number"] = episode
                if languages:
                    params["languages"] = ",".join(languages)
                
                response = await client.get(
                    f"{self.BASE_URL}/subtitles",
                    params=params,
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    for item in data.get("data", [])[:limit]:
                        attrs = item.get("attributes", {})
                        
                        # Get download link
                        files = attrs.get("files", [])
                        if not files:
                            continue
                        
                        file_id = files[0].get("file_id")
                        
                        results.append(SubtitleResult(
                            title=attrs.get("release", query or ""),
                            language=attrs.get("language", "English"),
                            language_code=attrs.get("language", "en")[:2].lower(),
                            source="opensubtitles",
                            download_url=str(file_id),  # Store file_id, need separate download call
                            release_info=attrs.get("release", ""),
                            hearing_impaired=attrs.get("hearing_impaired", False),
                            fps=attrs.get("fps", 0.0),
                            downloads=attrs.get("download_count", 0),
                            rating=attrs.get("ratings", 0.0),
                        ))
                else:
                    logger.warning(f"OpenSubtitles search failed: {response.status_code}")
                    
        except Exception as e:
            logger.error(f"OpenSubtitles search error: {e}")
        
        return results


# Main subtitle service
class GarnishService:
    """
    Garnish - Unified Subtitle Service for WatchNexus.
    The finishing touch that adds clarity to your content.
    Combines multiple providers: Addic7ed, OpenSubtitles.
    """
    
    def __init__(self):
        self.addic7ed = Addic7edScraper()
        self.opensubtitles = OpenSubtitlesAPI()
        self.settings = {
            "addic7ed_enabled": True,
            "addic7ed_username": "",
            "addic7ed_password": "",
            "opensubtitles_enabled": False,
            "opensubtitles_api_key": "",
            "opensubtitles_username": "",
            "opensubtitles_password": "",
            "preferred_languages": ["en"],
            "auto_download": True,
            "hearing_impaired": False,
        }
    
    def configure(self, settings: dict):
        """Update settings."""
        self.settings.update(settings)
        
        # Update provider configs
        self.addic7ed.username = settings.get("addic7ed_username", "")
        self.addic7ed.password = settings.get("addic7ed_password", "")
        
        self.opensubtitles.api_key = settings.get("opensubtitles_api_key", "")
        self.opensubtitles.username = settings.get("opensubtitles_username", "")
        self.opensubtitles.password = settings.get("opensubtitles_password", "")
    
    async def search_tv(
        self,
        show_name: str,
        season: int,
        episode: int,
        languages: List[str] = None,
        providers: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Search for TV show subtitles across providers."""
        if languages is None:
            languages = self.settings.get("preferred_languages", ["en"])
        
        if providers is None:
            providers = []
            if self.settings.get("addic7ed_enabled"):
                providers.append("addic7ed")
            if self.settings.get("opensubtitles_enabled"):
                providers.append("opensubtitles")
        
        all_results = []
        tasks = []
        
        if "addic7ed" in providers:
            tasks.append(
                self.addic7ed.search_show(show_name, season, episode, languages)
            )
        
        if "opensubtitles" in providers:
            tasks.append(
                self.opensubtitles.search(
                    query=f"{show_name} S{season:02d}E{episode:02d}",
                    season=season,
                    episode=episode,
                    languages=languages
                )
            )
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Provider error: {result}")
            elif result:
                all_results.extend(result)
        
        # Sort by downloads
        all_results.sort(key=lambda x: x.downloads, reverse=True)
        
        return [
            {
                "title": r.title,
                "language": r.language,
                "language_code": r.language_code,
                "source": r.source,
                "download_url": r.download_url,
                "release_info": r.release_info,
                "hearing_impaired": r.hearing_impaired,
                "downloads": r.downloads,
            }
            for r in all_results
        ]
    
    async def search_movie(
        self,
        movie_name: str,
        year: int = None,
        imdb_id: str = None,
        languages: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Search for movie subtitles."""
        if languages is None:
            languages = self.settings.get("preferred_languages", ["en"])
        
        all_results = []
        tasks = []
        
        if self.settings.get("addic7ed_enabled"):
            tasks.append(self.addic7ed.search_movie(movie_name, year, languages))
        
        if self.settings.get("opensubtitles_enabled") and self.opensubtitles.api_key:
            tasks.append(
                self.opensubtitles.search(
                    query=movie_name,
                    imdb_id=imdb_id,
                    languages=languages
                )
            )
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Provider error: {result}")
            elif result:
                all_results.extend(result)
        
        all_results.sort(key=lambda x: x.downloads, reverse=True)
        
        return [
            {
                "title": r.title,
                "language": r.language,
                "language_code": r.language_code,
                "source": r.source,
                "download_url": r.download_url,
                "release_info": r.release_info,
                "hearing_impaired": r.hearing_impaired,
                "downloads": r.downloads,
            }
            for r in all_results
        ]
    
    async def download(
        self,
        download_url: str,
        source: str,
        save_path: str
    ) -> Optional[str]:
        """Download subtitle from URL."""
        os.makedirs(save_path, exist_ok=True)
        
        if source == "addic7ed":
            return await self.addic7ed.download_subtitle(download_url, save_path)
        
        # For OpenSubtitles, would need to use their download endpoint
        # with the file_id
        
        return None


# Singleton instance
_garnish_service: Optional[GarnishService] = None

def get_garnish_service() -> GarnishService:
    """Get or create Garnish (subtitle) service instance."""
    global _garnish_service
    if _garnish_service is None:
        _garnish_service = GarnishService()
    return _garnish_service

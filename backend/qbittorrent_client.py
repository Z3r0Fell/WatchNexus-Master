"""
qBittorrent Client Integration for WatchNexus
Handles communication with qBittorrent Web API for torrent management.
"""

import httpx
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class TorrentState(Enum):
    """qBittorrent torrent states."""
    ERROR = "error"
    MISSING_FILES = "missingFiles"
    UPLOADING = "uploading"
    PAUSED_UP = "pausedUP"
    QUEUED_UP = "queuedUP"
    STALLED_UP = "stalledUP"
    CHECKING_UP = "checkingUP"
    FORCED_UP = "forcedUP"
    ALLOCATING = "allocating"
    DOWNLOADING = "downloading"
    META_DL = "metaDL"
    PAUSED_DL = "pausedDL"
    QUEUED_DL = "queuedDL"
    STALLED_DL = "stalledDL"
    CHECKING_DL = "checkingDL"
    FORCED_DL = "forcedDL"
    CHECKING_RESUME_DATA = "checkingResumeData"
    MOVING = "moving"
    UNKNOWN = "unknown"


@dataclass
class TorrentInfo:
    """Information about a torrent."""
    hash: str
    name: str
    size: int
    progress: float
    dlspeed: int
    upspeed: int
    priority: int
    num_seeds: int
    num_leechs: int
    ratio: float
    eta: int
    state: str
    category: str
    tags: str
    save_path: str
    content_path: str
    added_on: int
    completion_on: int
    
    @property
    def is_downloading(self) -> bool:
        return self.state in ["downloading", "metaDL", "stalledDL", "checkingDL", "forcedDL", "allocating"]
    
    @property
    def is_complete(self) -> bool:
        return self.progress >= 1.0
    
    @property
    def size_formatted(self) -> str:
        size = self.size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} PB"
    
    @property
    def speed_formatted(self) -> str:
        speed = self.dlspeed
        for unit in ['B/s', 'KB/s', 'MB/s', 'GB/s']:
            if speed < 1024:
                return f"{speed:.1f} {unit}"
            speed /= 1024
        return f"{speed:.1f} TB/s"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hash": self.hash,
            "name": self.name,
            "size": self.size,
            "size_formatted": self.size_formatted,
            "progress": round(self.progress * 100, 1),
            "dlspeed": self.dlspeed,
            "speed_formatted": self.speed_formatted,
            "upspeed": self.upspeed,
            "seeds": self.num_seeds,
            "leeches": self.num_leechs,
            "ratio": round(self.ratio, 2),
            "eta": self.eta,
            "state": self.state,
            "category": self.category,
            "save_path": self.save_path,
            "is_downloading": self.is_downloading,
            "is_complete": self.is_complete,
        }


class QBittorrentClient:
    """
    qBittorrent Web API Client.
    Supports qBittorrent v4.1+ (Web API v2.x)
    """
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 8080,
        username: str = "admin",
        password: str = "adminadmin",
        use_https: bool = False
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.base_url = f"{'https' if use_https else 'http'}://{host}:{port}/api/v2"
        self._cookies: Dict[str, str] = {}
        self._http_client: Optional[httpx.AsyncClient] = None
        self._authenticated = False
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                cookies=self._cookies
            )
        return self._http_client
    
    async def close(self):
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
    
    async def login(self) -> bool:
        """Authenticate with qBittorrent."""
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/auth/login",
                data={"username": self.username, "password": self.password}
            )
            
            if response.status_code == 200 and response.text == "Ok.":
                # Store session cookie
                self._cookies = dict(response.cookies)
                self._authenticated = True
                logger.info("Successfully authenticated with qBittorrent")
                return True
            else:
                logger.error(f"qBittorrent auth failed: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"qBittorrent login error: {e}")
            return False
    
    async def logout(self) -> bool:
        """Logout from qBittorrent."""
        try:
            client = await self._get_client()
            await client.post(f"{self.base_url}/auth/logout")
            self._authenticated = False
            self._cookies = {}
            return True
        except Exception as e:
            logger.error(f"qBittorrent logout error: {e}")
            return False
    
    async def _ensure_auth(self):
        """Ensure we're authenticated."""
        if not self._authenticated:
            await self.login()
    
    async def get_version(self) -> Optional[str]:
        """Get qBittorrent version."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/app/version")
            return response.text if response.status_code == 200 else None
        except Exception as e:
            logger.error(f"Error getting version: {e}")
            return None
    
    async def get_api_version(self) -> Optional[str]:
        """Get Web API version."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/app/webapiVersion")
            return response.text if response.status_code == 200 else None
        except Exception as e:
            logger.error(f"Error getting API version: {e}")
            return None
    
    async def get_torrents(
        self,
        filter: str = "all",
        category: str = "",
        sort: str = "added_on",
        reverse: bool = True,
        limit: int = 0,
        offset: int = 0
    ) -> List[TorrentInfo]:
        """Get list of torrents."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            params = {
                "filter": filter,
                "sort": sort,
                "reverse": str(reverse).lower(),
            }
            if category:
                params["category"] = category
            if limit > 0:
                params["limit"] = limit
            if offset > 0:
                params["offset"] = offset
            
            response = await client.get(
                f"{self.base_url}/torrents/info",
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                return [
                    TorrentInfo(
                        hash=t.get("hash", ""),
                        name=t.get("name", ""),
                        size=t.get("size", 0),
                        progress=t.get("progress", 0),
                        dlspeed=t.get("dlspeed", 0),
                        upspeed=t.get("upspeed", 0),
                        priority=t.get("priority", 0),
                        num_seeds=t.get("num_seeds", 0),
                        num_leechs=t.get("num_leechs", 0),
                        ratio=t.get("ratio", 0),
                        eta=t.get("eta", 0),
                        state=t.get("state", "unknown"),
                        category=t.get("category", ""),
                        tags=t.get("tags", ""),
                        save_path=t.get("save_path", ""),
                        content_path=t.get("content_path", ""),
                        added_on=t.get("added_on", 0),
                        completion_on=t.get("completion_on", 0),
                    )
                    for t in data
                ]
            return []
            
        except Exception as e:
            logger.error(f"Error getting torrents: {e}")
            return []
    
    async def add_torrent(
        self,
        urls: Optional[List[str]] = None,
        torrents: Optional[List[bytes]] = None,
        save_path: str = "",
        category: str = "",
        tags: str = "",
        paused: bool = False,
        skip_checking: bool = False,
        root_folder: bool = True,
        rename: str = "",
        sequential_download: bool = False,
        first_last_piece_prio: bool = False
    ) -> bool:
        """
        Add torrent(s) to qBittorrent.
        
        Args:
            urls: List of URLs/magnet links
            torrents: List of .torrent file contents
            save_path: Download destination folder
            category: Category for the torrent
            tags: Comma-separated tags
            paused: Start torrent paused
            skip_checking: Skip hash checking
            root_folder: Create root folder
            rename: Rename torrent
            sequential_download: Enable sequential download
            first_last_piece_prio: Prioritize first and last pieces
        
        Returns:
            True if successful
        """
        await self._ensure_auth()
        try:
            client = await self._get_client()
            
            data = {}
            files = {}
            
            if urls:
                data["urls"] = "\n".join(urls)
            
            if torrents:
                for i, torrent in enumerate(torrents):
                    files[f"torrents_{i}"] = ("torrent.torrent", torrent, "application/x-bittorrent")
            
            if save_path:
                data["savepath"] = save_path
            if category:
                data["category"] = category
            if tags:
                data["tags"] = tags
            if paused:
                data["paused"] = "true"
            if skip_checking:
                data["skip_checking"] = "true"
            if not root_folder:
                data["root_folder"] = "false"
            if rename:
                data["rename"] = rename
            if sequential_download:
                data["sequentialDownload"] = "true"
            if first_last_piece_prio:
                data["firstLastPiecePrio"] = "true"
            
            response = await client.post(
                f"{self.base_url}/torrents/add",
                data=data,
                files=files if files else None
            )
            
            if response.status_code == 200:
                logger.info("Added torrent(s) successfully")
                return True
            else:
                logger.error(f"Failed to add torrent: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error adding torrent: {e}")
            return False
    
    async def add_magnet(self, magnet_url: str, **kwargs) -> bool:
        """Add a magnet link."""
        return await self.add_torrent(urls=[magnet_url], **kwargs)
    
    async def delete_torrent(self, torrent_hash: str, delete_files: bool = False) -> bool:
        """Delete a torrent."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/torrents/delete",
                data={
                    "hashes": torrent_hash,
                    "deleteFiles": str(delete_files).lower()
                }
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error deleting torrent: {e}")
            return False
    
    async def pause_torrent(self, torrent_hash: str) -> bool:
        """Pause a torrent."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/torrents/pause",
                data={"hashes": torrent_hash}
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error pausing torrent: {e}")
            return False
    
    async def resume_torrent(self, torrent_hash: str) -> bool:
        """Resume a torrent."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/torrents/resume",
                data={"hashes": torrent_hash}
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error resuming torrent: {e}")
            return False
    
    async def get_torrent_files(self, torrent_hash: str) -> List[Dict[str, Any]]:
        """Get files in a torrent."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.get(
                f"{self.base_url}/torrents/files",
                params={"hash": torrent_hash}
            )
            return response.json() if response.status_code == 200 else []
        except Exception as e:
            logger.error(f"Error getting torrent files: {e}")
            return []
    
    async def get_transfer_info(self) -> Dict[str, Any]:
        """Get global transfer info."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/transfer/info")
            return response.json() if response.status_code == 200 else {}
        except Exception as e:
            logger.error(f"Error getting transfer info: {e}")
            return {}
    
    async def get_categories(self) -> Dict[str, Dict[str, str]]:
        """Get all categories."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/torrents/categories")
            return response.json() if response.status_code == 200 else {}
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return {}
    
    async def create_category(self, name: str, save_path: str = "") -> bool:
        """Create a category."""
        await self._ensure_auth()
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/torrents/createCategory",
                data={"category": name, "savePath": save_path}
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error creating category: {e}")
            return False
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to qBittorrent."""
        try:
            success = await self.login()
            if success:
                version = await self.get_version()
                api_version = await self.get_api_version()
                return {
                    "success": True,
                    "message": "Connected to qBittorrent",
                    "version": version,
                    "api_version": api_version
                }
            else:
                return {
                    "success": False,
                    "error": "Authentication failed"
                }
        except httpx.ConnectError:
            return {
                "success": False,
                "error": f"Cannot connect to {self.host}:{self.port}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
_qbit_client: Optional[QBittorrentClient] = None


def get_qbittorrent_client(
    host: str = None,
    port: int = None,
    username: str = None,
    password: str = None
) -> QBittorrentClient:
    """Get or create qBittorrent client instance."""
    global _qbit_client
    
    import os
    
    # Use environment variables or provided values
    host = host or os.environ.get("QBITTORRENT_HOST", "localhost")
    port = port or int(os.environ.get("QBITTORRENT_PORT", "8080"))
    username = username or os.environ.get("QBITTORRENT_USERNAME", "admin")
    password = password or os.environ.get("QBITTORRENT_PASSWORD", "adminadmin")
    
    if _qbit_client is None:
        _qbit_client = QBittorrentClient(
            host=host,
            port=port,
            username=username,
            password=password
        )
    
    return _qbit_client

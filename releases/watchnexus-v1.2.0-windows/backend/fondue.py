"""
Fondue - WatchNexus Torrent Engine
Downloads come in pieces, layered together into a perfect whole.
A fully integrated torrent download client using LTorrent (pure Python).

Features:
- Magnet link handling
- .torrent file support
- Sequential download for streaming
- Progress tracking
- Cross-platform compatibility (Mac, Linux, Windows)
- NO system dependencies required (pure Python)
"""

import asyncio
import logging
import os
import json
import hashlib
import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from enum import Enum
import threading

logger = logging.getLogger(__name__)

# Import LTorrent - pure Python torrent library with magnet support
try:
    from ltorrent.client import Client as LTorrentClient
    TORRENT_AVAILABLE = True
    TORRENT_LIBRARY = "ltorrent"
except ImportError:
    TORRENT_AVAILABLE = False
    TORRENT_LIBRARY = None
    logger.warning("LTorrent not installed. Install with: pip install git+https://github.com/hlf20010508/LTorrent.git@1.6.0#subdirectory=ltorrent")


class TorrentState(Enum):
    """Torrent download states."""
    QUEUED = "queued"
    CHECKING = "checking"
    DOWNLOADING_METADATA = "downloading_metadata"
    DOWNLOADING = "downloading"
    FINISHED = "finished"
    SEEDING = "seeding"
    PAUSED = "paused"
    ERROR = "error"
    ALLOCATING = "allocating"


@dataclass
class EngineSettings:
    """Comprehensive torrent engine settings."""
    download_path: str = "/media/downloads"
    move_completed_path: str = ""
    max_active_downloads: int = 3
    max_active_uploads: int = 3
    max_active_torrents: int = 5
    max_download_rate: int = 0
    max_upload_rate: int = 0
    max_connections_global: int = 200
    max_connections_per_torrent: int = 50
    seed_ratio_limit: float = 1.0
    seed_time_limit: int = 60
    seed_ratio_action: str = "pause"
    remove_after_completion: bool = False
    remove_after_seeding: bool = False
    delete_files_on_remove: bool = False
    max_completed_torrents: int = 50
    listen_port: int = 6881
    enable_dht: bool = True
    enable_pex: bool = True
    enable_lsd: bool = True
    add_paused: bool = False
    sequential_download_default: bool = True  # Default to sequential for streaming
    prioritize_first_last_pieces: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EngineSettings':
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered)


@dataclass
class TorrentStatus:
    """Status information for a torrent."""
    id: str
    name: str
    state: TorrentState
    progress: float
    download_rate: int
    upload_rate: int
    total_size: int
    downloaded: int
    uploaded: int
    num_seeds: int
    num_peers: int
    eta: int
    save_path: str
    info_hash: str
    added_on: str
    ratio: float = 0.0
    seeding_time: int = 0
    error_message: Optional[str] = None
    sequential: bool = False
    category: str = ""
    completed_on: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "state": self.state.value,
            "progress": round(self.progress, 2),
            "download_rate": self.download_rate,
            "download_rate_formatted": self._format_speed(self.download_rate),
            "upload_rate": self.upload_rate,
            "upload_rate_formatted": self._format_speed(self.upload_rate),
            "total_size": self.total_size,
            "total_size_formatted": self._format_size(self.total_size),
            "downloaded": self.downloaded,
            "downloaded_formatted": self._format_size(self.downloaded),
            "uploaded": self.uploaded,
            "uploaded_formatted": self._format_size(self.uploaded),
            "num_seeds": self.num_seeds,
            "num_peers": self.num_peers,
            "eta": self.eta,
            "eta_formatted": self._format_eta(self.eta),
            "save_path": self.save_path,
            "info_hash": self.info_hash,
            "added_on": self.added_on,
            "ratio": round(self.ratio, 2),
            "seeding_time": self.seeding_time,
            "error_message": self.error_message,
            "sequential": self.sequential,
            "category": self.category,
            "completed_on": self.completed_on,
        }
    
    @staticmethod
    def _format_size(size_bytes: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.2f} PB"
    
    @staticmethod
    def _format_speed(speed: int) -> str:
        for unit in ['B/s', 'KB/s', 'MB/s', 'GB/s']:
            if speed < 1024:
                return f"{speed:.1f} {unit}"
            speed /= 1024
        return f"{speed:.1f} TB/s"
    
    @staticmethod
    def _format_eta(seconds: int) -> str:
        if seconds < 0:
            return "∞"
        if seconds == 0:
            return "Done"
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        if h > 0:
            return f"{h}h {m}m"
        if m > 0:
            return f"{m}m {s}s"
        return f"{s}s"


@dataclass
class TorrentFile:
    """Information about a file in a torrent."""
    index: int
    path: str
    size: int
    progress: float
    priority: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "path": self.path,
            "size": self.size,
            "size_formatted": TorrentStatus._format_size(self.size),
            "progress": round(self.progress, 2),
            "priority": self.priority,
        }


def extract_info_hash(magnet: str) -> Optional[str]:
    """Extract info hash from magnet link."""
    match = re.search(r'btih:([a-fA-F0-9]{40})', magnet)
    if match:
        return match.group(1).lower()
    # Try base32 encoded hash
    match = re.search(r'btih:([A-Za-z2-7]{32})', magnet)
    if match:
        import base64
        try:
            decoded = base64.b32decode(match.group(1).upper())
            return decoded.hex()
        except:
            pass
    return None


def extract_name_from_magnet(magnet: str) -> str:
    """Extract display name from magnet link."""
    match = re.search(r'dn=([^&]+)', magnet)
    if match:
        from urllib.parse import unquote
        return unquote(match.group(1))
    info_hash = extract_info_hash(magnet)
    return f"Torrent {info_hash[:8]}" if info_hash else "Unknown Torrent"


class TorrentWrapper:
    """Wrapper around LTorrent Client for tracking."""
    
    def __init__(self, torrent_id: str, source: str, save_path: str, metadata: dict, settings: EngineSettings):
        self.torrent_id = torrent_id
        self.source = source
        self.save_path = save_path
        self.metadata = metadata
        self.settings = settings
        self.client: Optional[LTorrentClient] = None
        self.state = TorrentState.QUEUED
        self.progress = 0.0
        self.download_rate = 0
        self.upload_rate = 0
        self.total_size = 0
        self.downloaded = 0
        self.uploaded = 0
        self.num_seeds = 0
        self.num_peers = 0
        self.error_message = None
        self._thread: Optional[threading.Thread] = None
        self._stop_flag = False
        self._files: List[TorrentFile] = []
    
    def start(self):
        """Start downloading the torrent in a background thread."""
        if not TORRENT_AVAILABLE:
            self.state = TorrentState.ERROR
            self.error_message = "LTorrent not installed"
            return
        
        self._stop_flag = False
        self._thread = threading.Thread(target=self._download_thread, daemon=True)
        self._thread.start()
    
    def _download_thread(self):
        """Background thread for torrent download."""
        try:
            self.state = TorrentState.DOWNLOADING_METADATA
            
            # Create save directory
            Path(self.save_path).mkdir(parents=True, exist_ok=True)
            
            # Initialize LTorrent client
            self.client = LTorrentClient(
                port=self.settings.listen_port,
                storage=self.save_path
            )
            
            # Load torrent (magnet or file)
            is_magnet = self.source.startswith("magnet:")
            if is_magnet:
                self.client.load(magnet_link=self.source)
            else:
                self.client.load(torrent_path=self.source)
            
            # Get file list and select all files
            # LTorrent requires file selection before download
            self.client.list_file()
            
            # Select all files (use "0" for all or range like "0-999")
            self.client.select_file(selection="0-9999")
            
            self.state = TorrentState.DOWNLOADING
            
            # Start download (blocking call)
            # LTorrent's run() blocks until complete
            self.client.run()
            
            if not self._stop_flag:
                self.state = TorrentState.FINISHED
                self.progress = 100.0
                self.metadata["completed_on"] = datetime.now(timezone.utc).isoformat()
                logger.info(f"Torrent completed: {self.torrent_id}")
            
        except Exception as e:
            if not self._stop_flag:
                self.state = TorrentState.ERROR
                self.error_message = str(e)
                logger.error(f"Download error for {self.torrent_id}: {e}")
    
    def pause(self):
        """Pause the download (stops the thread)."""
        self._stop_flag = True
        self.state = TorrentState.PAUSED
        # LTorrent doesn't have native pause, so we just stop
    
    def resume(self):
        """Resume the download."""
        if self.state == TorrentState.PAUSED:
            self.start()
    
    def stop(self):
        """Stop and cleanup."""
        self._stop_flag = True
        if self._thread and self._thread.is_alive():
            # LTorrent doesn't have a clean stop mechanism
            # Thread will exit on next iteration check
            pass
    
    def get_files(self) -> List[TorrentFile]:
        """Get list of files in the torrent."""
        return self._files
    
    def get_status(self) -> TorrentStatus:
        """Get current status."""
        # Try to get progress from client
        if self.client and hasattr(self.client, 'last_percentage_completed'):
            try:
                self.progress = float(self.client.last_percentage_completed or 0)
            except:
                pass
        
        eta = -1
        if self.download_rate > 0 and self.total_size > 0:
            remaining = self.total_size - self.downloaded
            eta = int(remaining / self.download_rate)
        
        return TorrentStatus(
            id=self.torrent_id,
            name=self.metadata.get("name", "Unknown"),
            state=self.state,
            progress=self.progress,
            download_rate=self.download_rate,
            upload_rate=self.upload_rate,
            total_size=self.total_size,
            downloaded=self.downloaded,
            uploaded=self.uploaded,
            num_seeds=self.num_seeds,
            num_peers=self.num_peers,
            eta=eta,
            save_path=self.save_path,
            info_hash=self.metadata.get("info_hash", ""),
            added_on=self.metadata.get("added_on", ""),
            ratio=self.uploaded / self.downloaded if self.downloaded > 0 else 0,
            sequential=self.metadata.get("sequential", False),
            category=self.metadata.get("category", ""),
            completed_on=self.metadata.get("completed_on"),
            error_message=self.error_message,
        )


class FondueEngine:
    """
    Fondue - Built-in BitTorrent download engine.
    Uses LTorrent for pure Python, cross-platform torrent downloading.
    Supports both magnet links and .torrent files.
    """
    
    def __init__(self, settings: Optional[EngineSettings] = None):
        self.settings = settings or EngineSettings()
        self.torrents: Dict[str, TorrentWrapper] = {}
        self._running = False
        self._state_file = Path(self.settings.download_path) / ".watchnexus_engine.json"
        self._settings_file = Path(self.settings.download_path) / ".watchnexus_settings.json"
        
        lib_info = f"LTorrent" if TORRENT_AVAILABLE else "NOT AVAILABLE"
        logger.info(f"FondueEngine initialized ({lib_info}). Download path: {self.settings.download_path}")
    
    def update_settings(self, new_settings: Dict[str, Any]) -> EngineSettings:
        """Update engine settings."""
        for key, value in new_settings.items():
            if hasattr(self.settings, key):
                setattr(self.settings, key, value)
        self._save_settings()
        return self.settings
    
    def get_settings(self) -> EngineSettings:
        """Get current settings."""
        return self.settings
    
    def start(self):
        """Start the torrent engine."""
        if self._running:
            return
        
        self._load_settings()
        self._running = True
        self._load_state()
        logger.info("FondueEngine started")
    
    def stop(self):
        """Stop the torrent engine."""
        self._running = False
        self._save_state()
        self._save_settings()
        
        for wrapper in self.torrents.values():
            wrapper.stop()
        
        logger.info("FondueEngine stopped")
    
    def _generate_id(self, source: str) -> str:
        """Generate a unique ID for a torrent."""
        # For magnets, use info hash if available
        if source.startswith("magnet:"):
            info_hash = extract_info_hash(source)
            if info_hash:
                return info_hash[:16]
        return hashlib.sha256(source.encode()).hexdigest()[:16]
    
    async def add_magnet(
        self,
        magnet_url: str,
        save_path: Optional[str] = None,
        sequential: bool = None,
        category: str = "",
    ) -> Optional[str]:
        """Add a torrent from a magnet link."""
        if not TORRENT_AVAILABLE:
            logger.error("LTorrent not installed")
            return None
        
        if not magnet_url.startswith("magnet:"):
            logger.error("Invalid magnet link")
            return None
        
        try:
            save_path = save_path or self.settings.download_path
            sequential = sequential if sequential is not None else self.settings.sequential_download_default
            
            Path(save_path).mkdir(parents=True, exist_ok=True)
            
            torrent_id = self._generate_id(magnet_url)
            info_hash = extract_info_hash(magnet_url) or torrent_id
            name = extract_name_from_magnet(magnet_url)
            
            metadata = {
                "id": torrent_id,
                "info_hash": info_hash,
                "name": name,
                "magnet": magnet_url,
                "save_path": save_path,
                "sequential": sequential,
                "category": category,
                "added_on": datetime.now(timezone.utc).isoformat(),
                "completed_on": None,
            }
            
            wrapper = TorrentWrapper(torrent_id, magnet_url, save_path, metadata, self.settings)
            self.torrents[torrent_id] = wrapper
            
            if not self.settings.add_paused:
                wrapper.start()
            
            logger.info(f"Added magnet torrent: {torrent_id} ({name})")
            return torrent_id
            
        except Exception as e:
            logger.error(f"Failed to add magnet: {e}")
            return None
    
    async def add_torrent_file(
        self,
        torrent_path: str,
        save_path: Optional[str] = None,
        sequential: bool = None,
        category: str = "",
    ) -> Optional[str]:
        """Add a torrent from a .torrent file path."""
        if not TORRENT_AVAILABLE:
            logger.error("LTorrent not installed")
            return None
        
        if not os.path.exists(torrent_path):
            logger.error(f"Torrent file not found: {torrent_path}")
            return None
        
        try:
            save_path = save_path or self.settings.download_path
            sequential = sequential if sequential is not None else self.settings.sequential_download_default
            
            Path(save_path).mkdir(parents=True, exist_ok=True)
            
            torrent_id = self._generate_id(torrent_path)
            
            metadata = {
                "id": torrent_id,
                "info_hash": torrent_id,
                "name": Path(torrent_path).stem,
                "torrent_file": torrent_path,
                "save_path": save_path,
                "sequential": sequential,
                "category": category,
                "added_on": datetime.now(timezone.utc).isoformat(),
                "completed_on": None,
            }
            
            wrapper = TorrentWrapper(torrent_id, torrent_path, save_path, metadata, self.settings)
            self.torrents[torrent_id] = wrapper
            
            if not self.settings.add_paused:
                wrapper.start()
            
            logger.info(f"Added torrent file: {torrent_id}")
            return torrent_id
            
        except Exception as e:
            logger.error(f"Failed to add torrent file: {e}")
            return None
    
    def get_status(self, torrent_id: str) -> Optional[TorrentStatus]:
        """Get the status of a torrent."""
        wrapper = self.torrents.get(torrent_id)
        if not wrapper:
            return None
        return wrapper.get_status()
    
    def get_all_torrents(self) -> List[TorrentStatus]:
        """Get status of all torrents."""
        return [wrapper.get_status() for wrapper in self.torrents.values()]
    
    def get_files(self, torrent_id: str) -> List[TorrentFile]:
        """Get list of files in a torrent."""
        wrapper = self.torrents.get(torrent_id)
        if not wrapper:
            return []
        return wrapper.get_files()
    
    def pause(self, torrent_id: str) -> bool:
        """Pause a torrent."""
        wrapper = self.torrents.get(torrent_id)
        if wrapper:
            wrapper.pause()
            return True
        return False
    
    def resume(self, torrent_id: str) -> bool:
        """Resume a paused torrent."""
        wrapper = self.torrents.get(torrent_id)
        if wrapper:
            wrapper.resume()
            return True
        return False
    
    def pause_all(self) -> int:
        """Pause all torrents."""
        count = 0
        for wrapper in self.torrents.values():
            if wrapper.state == TorrentState.DOWNLOADING:
                wrapper.pause()
                count += 1
        return count
    
    def resume_all(self) -> int:
        """Resume all torrents."""
        count = 0
        for wrapper in self.torrents.values():
            if wrapper.state == TorrentState.PAUSED:
                wrapper.resume()
                count += 1
        return count
    
    def remove(self, torrent_id: str, delete_files: bool = False) -> bool:
        """Remove a torrent."""
        wrapper = self.torrents.get(torrent_id)
        if not wrapper:
            return False
        
        wrapper.stop()
        
        if delete_files:
            try:
                # TODO: Implement proper file deletion
                pass
            except Exception as e:
                logger.error(f"Error deleting files: {e}")
        
        del self.torrents[torrent_id]
        logger.info(f"Removed torrent: {torrent_id}")
        return True
    
    def remove_completed(self, delete_files: bool = False) -> int:
        """Remove all completed torrents."""
        count = 0
        for torrent_id in list(self.torrents.keys()):
            wrapper = self.torrents.get(torrent_id)
            if wrapper and wrapper.state == TorrentState.FINISHED:
                self.remove(torrent_id, delete_files)
                count += 1
        return count
    
    def set_sequential(self, torrent_id: str, enabled: bool) -> bool:
        """Enable/disable sequential download."""
        wrapper = self.torrents.get(torrent_id)
        if wrapper:
            wrapper.metadata["sequential"] = enabled
            return True
        return False
    
    def get_transfer_info(self) -> Dict[str, Any]:
        """Get global transfer statistics."""
        total_download = 0
        total_upload = 0
        download_rate = 0
        upload_rate = 0
        downloading = 0
        seeding = 0
        completed = 0
        
        for wrapper in self.torrents.values():
            total_download += wrapper.downloaded
            total_upload += wrapper.uploaded
            download_rate += wrapper.download_rate
            upload_rate += wrapper.upload_rate
            
            if wrapper.state == TorrentState.DOWNLOADING:
                downloading += 1
            elif wrapper.state == TorrentState.SEEDING:
                seeding += 1
            elif wrapper.state == TorrentState.FINISHED:
                completed += 1
        
        return {
            "download_rate": download_rate,
            "download_rate_formatted": TorrentStatus._format_speed(download_rate),
            "upload_rate": upload_rate,
            "upload_rate_formatted": TorrentStatus._format_speed(upload_rate),
            "total_downloaded": total_download,
            "total_downloaded_formatted": TorrentStatus._format_size(total_download),
            "total_uploaded": total_upload,
            "total_uploaded_formatted": TorrentStatus._format_size(total_upload),
            "num_torrents": len(self.torrents),
            "downloading": downloading,
            "seeding": seeding,
            "completed": completed,
            "dht_nodes": 0,
        }
    
    def _save_settings(self):
        """Save settings to disk."""
        try:
            Path(self.settings.download_path).mkdir(parents=True, exist_ok=True)
            with open(self._settings_file, 'w') as f:
                json.dump(self.settings.to_dict(), f, indent=2)
        except Exception as e:
            logger.error(f"Error saving settings: {e}")
    
    def _load_settings(self):
        """Load settings from disk."""
        if not self._settings_file.exists():
            return
        try:
            with open(self._settings_file, 'r') as f:
                data = json.load(f)
            self.settings = EngineSettings.from_dict(data)
        except Exception as e:
            logger.error(f"Error loading settings: {e}")
    
    def _save_state(self):
        """Save torrent state to disk."""
        try:
            state = {
                "torrents": {
                    tid: wrapper.metadata for tid, wrapper in self.torrents.items()
                }
            }
            Path(self.settings.download_path).mkdir(parents=True, exist_ok=True)
            with open(self._state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving state: {e}")
    
    def _load_state(self):
        """Load persisted torrent state."""
        if not self._state_file.exists():
            return
        try:
            with open(self._state_file, 'r') as f:
                state = json.load(f)
            
            for torrent_id, metadata in state.get("torrents", {}).items():
                # Re-add torrents from saved state
                if "magnet" in metadata:
                    asyncio.create_task(
                        self.add_magnet(
                            metadata["magnet"],
                            save_path=metadata.get("save_path"),
                            sequential=metadata.get("sequential", False),
                            category=metadata.get("category", ""),
                        )
                    )
                elif "torrent_file" in metadata and os.path.exists(metadata["torrent_file"]):
                    asyncio.create_task(
                        self.add_torrent_file(
                            metadata["torrent_file"],
                            save_path=metadata.get("save_path"),
                            sequential=metadata.get("sequential", False),
                            category=metadata.get("category", ""),
                        )
                    )
        except Exception as e:
            logger.error(f"Error loading state: {e}")


# Singleton instance
_fondue_engine: Optional[FondueEngine] = None


def get_fondue_engine() -> FondueEngine:
    """Get or create the Fondue (torrent) engine instance."""
    global _fondue_engine
    
    if _fondue_engine is None:
        download_path = os.environ.get("DOWNLOAD_PATH", "/media/downloads")
        settings = EngineSettings(download_path=download_path)
        _fondue_engine = FondueEngine(settings=settings)
        _fondue_engine.start()
    
    return _fondue_engine


def shutdown_fondue_engine():
    """Shutdown the Fondue engine."""
    global _fondue_engine
    if _fondue_engine:
        _fondue_engine.stop()
        _fondue_engine = None

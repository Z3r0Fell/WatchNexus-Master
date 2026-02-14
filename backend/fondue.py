"""
Fondue - WatchNexus Torrent Engine
Downloads come in pieces, layered together into a perfect whole.
A fully integrated torrent download client using aiotorrent (pure Python).

Features:
- .torrent file support
- Sequential download for streaming
- Progress tracking
- Cross-platform compatibility (Mac, Linux, Windows)
- NO system dependencies required (pure Python)

Note: aiotorrent currently supports .torrent files only.
Magnet link support is planned for future versions.
"""

import asyncio
import logging
import os
import json
import hashlib
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)

# Import aiotorrent - pure Python torrent library
try:
    from aiotorrent import Torrent, DownloadStrategy
    TORRENT_AVAILABLE = True
except ImportError:
    TORRENT_AVAILABLE = False
    logger.warning("aiotorrent not installed. Install with: pip install aiotorrent")


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
    sequential_download_default: bool = False
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


class TorrentWrapper:
    """Wrapper around aiotorrent Torrent for tracking."""
    
    def __init__(self, torrent_id: str, source: str, save_path: str, metadata: dict):
        self.torrent_id = torrent_id
        self.source = source
        self.save_path = save_path
        self.metadata = metadata
        self.torrent: Optional[Torrent] = None
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
        self._task: Optional[asyncio.Task] = None
        self._paused = False
        self._cancelled = False
        self._current_file = None
    
    async def start(self):
        """Start downloading the torrent."""
        if not TORRENT_AVAILABLE:
            self.state = TorrentState.ERROR
            self.error_message = "aiotorrent not installed"
            return
        
        try:
            self.state = TorrentState.DOWNLOADING_METADATA
            
            # Initialize the torrent from .torrent file
            self.torrent = Torrent(self.source)
            await self.torrent.init(dht_enabled=self.metadata.get("enable_dht", False))
            
            # Update metadata with torrent info
            if self.torrent.files:
                self.total_size = sum(f.size for f in self.torrent.files)
                self.metadata["name"] = self.torrent.files[0].path.split("/")[0] if "/" in self.torrent.files[0].path else Path(self.source).stem
            
            # Start download in background
            self._task = asyncio.create_task(self._download_loop())
            
        except Exception as e:
            self.state = TorrentState.ERROR
            self.error_message = str(e)
            logger.error(f"Error starting torrent {self.torrent_id}: {e}")
    
    async def _download_loop(self):
        """Main download loop with progress tracking."""
        try:
            self.state = TorrentState.DOWNLOADING
            
            if not self.torrent or not self.torrent.files:
                self.state = TorrentState.ERROR
                self.error_message = "No files in torrent"
                return
            
            # Choose download strategy
            strategy = DownloadStrategy.SEQUENTIAL if self.metadata.get("sequential", False) else DownloadStrategy.DEFAULT
            
            # Download all files in the torrent
            for idx, file in enumerate(self.torrent.files):
                if self._cancelled:
                    self.state = TorrentState.PAUSED
                    return
                
                self._current_file = file
                logger.info(f"Downloading file {idx + 1}/{len(self.torrent.files)}: {file.path}")
                
                # Create progress tracking task
                progress_task = asyncio.create_task(self._track_progress(file))
                
                try:
                    await self.torrent.download(file, strategy=strategy)
                finally:
                    progress_task.cancel()
                    try:
                        await progress_task
                    except asyncio.CancelledError:
                        pass
            
            self.state = TorrentState.FINISHED
            self.progress = 100.0
            self.metadata["completed_on"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Torrent completed: {self.torrent_id}")
            
        except asyncio.CancelledError:
            self.state = TorrentState.PAUSED
        except Exception as e:
            self.state = TorrentState.ERROR
            self.error_message = str(e)
            logger.error(f"Download error for {self.torrent_id}: {e}")
    
    async def _track_progress(self, file):
        """Track download progress for a file."""
        try:
            while True:
                if hasattr(file, 'get_download_progress'):
                    self.progress = file.get_download_progress()
                if hasattr(file, 'get_bytes_written'):
                    self.downloaded = file.get_bytes_written()
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
    
    async def pause(self):
        """Pause the download."""
        self._cancelled = True
        if self._task and not self._task.done():
            self._task.cancel()
            self._paused = True
            self.state = TorrentState.PAUSED
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    async def resume(self):
        """Resume the download."""
        if self._paused:
            self._paused = False
            self._cancelled = False
            await self.start()
    
    async def stop(self):
        """Stop and cleanup."""
        self._cancelled = True
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    def get_files(self) -> List[TorrentFile]:
        """Get list of files in the torrent."""
        if not self.torrent or not self.torrent.files:
            return []
        
        result = []
        for idx, file in enumerate(self.torrent.files):
            progress = 0.0
            if hasattr(file, 'get_download_progress'):
                progress = file.get_download_progress()
            
            result.append(TorrentFile(
                index=idx,
                path=file.path,
                size=file.size,
                progress=progress,
                priority=1
            ))
        return result
    
    def get_status(self) -> TorrentStatus:
        """Get current status."""
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
    Uses aiotorrent for pure Python, cross-platform torrent downloading.
    """
    
    def __init__(self, settings: Optional[EngineSettings] = None):
        self.settings = settings or EngineSettings()
        self.torrents: Dict[str, TorrentWrapper] = {}
        self._running = False
        self._state_file = Path(self.settings.download_path) / ".watchnexus_engine.json"
        self._settings_file = Path(self.settings.download_path) / ".watchnexus_settings.json"
        
        logger.info(f"FondueEngine initialized (aiotorrent). Download path: {self.settings.download_path}")
    
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
            asyncio.create_task(wrapper.stop())
        
        logger.info("FondueEngine stopped")
    
    def _generate_id(self, source: str) -> str:
        """Generate a unique ID for a torrent."""
        return hashlib.sha256(source.encode()).hexdigest()[:16]
    
    async def add_magnet(
        self,
        magnet_url: str,
        save_path: Optional[str] = None,
        sequential: bool = None,
        category: str = "",
    ) -> Optional[str]:
        """
        Add a torrent from a magnet link.
        Note: aiotorrent does not yet support magnet links.
        This returns an error message explaining the limitation.
        """
        logger.warning("Magnet links are not yet supported by aiotorrent. Please use .torrent files.")
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
            logger.error("aiotorrent not installed. Run: pip install aiotorrent")
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
                "enable_dht": self.settings.enable_dht,
            }
            
            wrapper = TorrentWrapper(torrent_id, torrent_path, save_path, metadata)
            self.torrents[torrent_id] = wrapper
            
            if not self.settings.add_paused:
                await wrapper.start()
            
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
            asyncio.create_task(wrapper.pause())
            return True
        return False
    
    def resume(self, torrent_id: str) -> bool:
        """Resume a paused torrent."""
        wrapper = self.torrents.get(torrent_id)
        if wrapper:
            asyncio.create_task(wrapper.resume())
            return True
        return False
    
    def pause_all(self) -> int:
        """Pause all torrents."""
        count = 0
        for wrapper in self.torrents.values():
            if wrapper.state == TorrentState.DOWNLOADING:
                asyncio.create_task(wrapper.pause())
                count += 1
        return count
    
    def resume_all(self) -> int:
        """Resume all torrents."""
        count = 0
        for wrapper in self.torrents.values():
            if wrapper.state == TorrentState.PAUSED:
                asyncio.create_task(wrapper.resume())
                count += 1
        return count
    
    def remove(self, torrent_id: str, delete_files: bool = False) -> bool:
        """Remove a torrent."""
        wrapper = self.torrents.get(torrent_id)
        if not wrapper:
            return False
        
        asyncio.create_task(wrapper.stop())
        
        if delete_files:
            try:
                save_path = Path(wrapper.save_path)
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
                if "torrent_file" in metadata and os.path.exists(metadata["torrent_file"]):
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

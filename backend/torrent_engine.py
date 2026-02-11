"""
WatchNexus Built-in Torrent Engine
A fully integrated torrent download client using libtorrent.
Eliminates the need for external applications like qBittorrent.

Features:
- BitTorrent protocol support (DHT, PEX, LSD)
- Magnet link handling
- .torrent file support
- Sequential download for streaming
- Bandwidth management
- Download queue management
- Progress tracking
- Cross-platform compatibility (Mac, Linux, Windows)
"""

import libtorrent as lt
import asyncio
import logging
import os
import json
import hashlib
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from enum import Enum
import threading
import time

logger = logging.getLogger(__name__)


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
class TorrentStatus:
    """Status information for a torrent."""
    id: str
    name: str
    state: TorrentState
    progress: float  # 0-100
    download_rate: int  # bytes/sec
    upload_rate: int  # bytes/sec
    total_size: int  # bytes
    downloaded: int  # bytes
    uploaded: int  # bytes
    num_seeds: int
    num_peers: int
    eta: int  # seconds, -1 if unknown
    save_path: str
    info_hash: str
    added_on: str
    error_message: Optional[str] = None
    sequential: bool = False
    
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
            "num_seeds": self.num_seeds,
            "num_peers": self.num_peers,
            "eta": self.eta,
            "eta_formatted": self._format_eta(self.eta),
            "save_path": self.save_path,
            "info_hash": self.info_hash,
            "added_on": self.added_on,
            "error_message": self.error_message,
            "sequential": self.sequential,
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
    priority: int  # 0=skip, 1=normal, 7=high
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "path": self.path,
            "size": self.size,
            "size_formatted": TorrentStatus._format_size(self.size),
            "progress": round(self.progress, 2),
            "priority": self.priority,
        }


class TorrentEngine:
    """
    Built-in BitTorrent download engine.
    Uses libtorrent for efficient, cross-platform torrent downloading.
    """
    
    def __init__(
        self,
        download_path: str = "/media/downloads",
        listen_port: int = 6881,
        max_download_rate: int = 0,  # 0 = unlimited
        max_upload_rate: int = 0,
        max_connections: int = 200,
        max_active_downloads: int = 5,
        enable_dht: bool = True,
        enable_lsd: bool = True,
        enable_upnp: bool = True,
        enable_natpmp: bool = True,
    ):
        self.download_path = download_path
        self.listen_port = listen_port
        self.max_download_rate = max_download_rate
        self.max_upload_rate = max_upload_rate
        self.max_connections = max_connections
        self.max_active_downloads = max_active_downloads
        
        # Create session with settings
        settings = {
            'listen_interfaces': f'0.0.0.0:{listen_port},[::0]:{listen_port}',
            'download_rate_limit': max_download_rate,
            'upload_rate_limit': max_upload_rate,
            'connections_limit': max_connections,
            'active_downloads': max_active_downloads,
            'enable_dht': enable_dht,
            'enable_lsd': enable_lsd,
            'enable_upnp': enable_upnp,
            'enable_natpmp': enable_natpmp,
            'announce_to_all_trackers': True,
            'announce_to_all_tiers': True,
            'user_agent': 'WatchNexus/1.0 libtorrent/2.0',
        }
        
        self.session = lt.session(settings)
        self.torrents: Dict[str, lt.torrent_handle] = {}
        self.torrent_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Callbacks
        self._on_complete_callbacks: Dict[str, List[Callable]] = {}
        self._on_progress_callbacks: Dict[str, List[Callable]] = {}
        
        # Background worker
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None
        
        # State persistence file
        self._state_file = Path(download_path) / ".watchnexus_torrents.json"
        
        logger.info(f"TorrentEngine initialized. Download path: {download_path}")
    
    def start(self):
        """Start the torrent engine background worker."""
        if self._running:
            return
        
        self._running = True
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()
        
        # Load persisted state
        self._load_state()
        
        logger.info("TorrentEngine started")
    
    def stop(self):
        """Stop the torrent engine."""
        self._running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=5.0)
        
        # Save state before stopping
        self._save_state()
        
        # Pause all torrents
        for handle in self.torrents.values():
            if handle.is_valid():
                handle.pause()
        
        logger.info("TorrentEngine stopped")
    
    def _worker_loop(self):
        """Background worker loop for processing alerts and updates."""
        while self._running:
            try:
                # Process alerts
                alerts = self.session.pop_alerts()
                for alert in alerts:
                    self._handle_alert(alert)
                
                # Sleep briefly
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                time.sleep(1)
    
    def _handle_alert(self, alert):
        """Handle libtorrent alerts."""
        if isinstance(alert, lt.torrent_finished_alert):
            info_hash = str(alert.handle.info_hash())
            logger.info(f"Torrent finished: {info_hash}")
            
            # Trigger callbacks
            if info_hash in self._on_complete_callbacks:
                for callback in self._on_complete_callbacks[info_hash]:
                    try:
                        callback(info_hash)
                    except Exception as e:
                        logger.error(f"Callback error: {e}")
        
        elif isinstance(alert, lt.torrent_error_alert):
            info_hash = str(alert.handle.info_hash())
            logger.error(f"Torrent error: {info_hash} - {alert.error.message()}")
        
        elif isinstance(alert, lt.metadata_received_alert):
            info_hash = str(alert.handle.info_hash())
            logger.info(f"Metadata received for: {info_hash}")
    
    def _generate_id(self, info_hash: str) -> str:
        """Generate a unique ID for a torrent."""
        return hashlib.sha256(info_hash.encode()).hexdigest()[:16]
    
    def _get_state(self, handle: lt.torrent_handle) -> TorrentState:
        """Convert libtorrent state to TorrentState enum."""
        if not handle.is_valid():
            return TorrentState.ERROR
        
        status = handle.status()
        
        if status.paused:
            return TorrentState.PAUSED
        
        state_map = {
            lt.torrent_status.checking_files: TorrentState.CHECKING,
            lt.torrent_status.downloading_metadata: TorrentState.DOWNLOADING_METADATA,
            lt.torrent_status.downloading: TorrentState.DOWNLOADING,
            lt.torrent_status.finished: TorrentState.FINISHED,
            lt.torrent_status.seeding: TorrentState.SEEDING,
            lt.torrent_status.allocating: TorrentState.ALLOCATING,
            lt.torrent_status.checking_resume_data: TorrentState.CHECKING,
        }
        
        return state_map.get(status.state, TorrentState.QUEUED)
    
    async def add_magnet(
        self,
        magnet_url: str,
        save_path: Optional[str] = None,
        sequential: bool = False,
        category: str = "",
    ) -> Optional[str]:
        """
        Add a torrent from a magnet link.
        
        Args:
            magnet_url: Magnet URI
            save_path: Custom save path (defaults to engine download_path)
            sequential: Enable sequential download for streaming
            category: Category/tag for the torrent
        
        Returns:
            Torrent ID if successful, None otherwise
        """
        try:
            save_path = save_path or self.download_path
            
            # Ensure save path exists
            Path(save_path).mkdir(parents=True, exist_ok=True)
            
            # Parse magnet and add torrent
            params = lt.parse_magnet_uri(magnet_url)
            params.save_path = save_path
            
            handle = self.session.add_torrent(params)
            
            if sequential:
                handle.set_sequential_download(True)
            
            info_hash = str(handle.info_hash())
            torrent_id = self._generate_id(info_hash)
            
            # Store handle and metadata
            self.torrents[torrent_id] = handle
            self.torrent_metadata[torrent_id] = {
                "id": torrent_id,
                "info_hash": info_hash,
                "magnet": magnet_url,
                "save_path": save_path,
                "sequential": sequential,
                "category": category,
                "added_on": datetime.now(timezone.utc).isoformat(),
            }
            
            logger.info(f"Added magnet torrent: {torrent_id} ({info_hash[:16]}...)")
            return torrent_id
            
        except Exception as e:
            logger.error(f"Failed to add magnet: {e}")
            return None
    
    async def add_torrent_file(
        self,
        torrent_data: bytes,
        save_path: Optional[str] = None,
        sequential: bool = False,
        category: str = "",
    ) -> Optional[str]:
        """
        Add a torrent from .torrent file data.
        
        Args:
            torrent_data: Raw .torrent file contents
            save_path: Custom save path
            sequential: Enable sequential download
            category: Category/tag
        
        Returns:
            Torrent ID if successful
        """
        try:
            save_path = save_path or self.download_path
            Path(save_path).mkdir(parents=True, exist_ok=True)
            
            # Create torrent info from data
            info = lt.torrent_info(lt.bdecode(torrent_data))
            
            params = lt.add_torrent_params()
            params.ti = info
            params.save_path = save_path
            
            handle = self.session.add_torrent(params)
            
            if sequential:
                handle.set_sequential_download(True)
            
            info_hash = str(handle.info_hash())
            torrent_id = self._generate_id(info_hash)
            
            self.torrents[torrent_id] = handle
            self.torrent_metadata[torrent_id] = {
                "id": torrent_id,
                "info_hash": info_hash,
                "name": info.name(),
                "save_path": save_path,
                "sequential": sequential,
                "category": category,
                "added_on": datetime.now(timezone.utc).isoformat(),
            }
            
            logger.info(f"Added torrent file: {torrent_id} - {info.name()}")
            return torrent_id
            
        except Exception as e:
            logger.error(f"Failed to add torrent file: {e}")
            return None
    
    def get_status(self, torrent_id: str) -> Optional[TorrentStatus]:
        """Get the status of a torrent."""
        handle = self.torrents.get(torrent_id)
        if not handle or not handle.is_valid():
            return None
        
        try:
            status = handle.status()
            metadata = self.torrent_metadata.get(torrent_id, {})
            
            # Get name from torrent info or metadata
            name = "Unknown"
            if handle.torrent_file():
                name = handle.torrent_file().name()
            elif status.name:
                name = status.name
            elif "name" in metadata:
                name = metadata["name"]
            
            # Calculate ETA
            eta = -1
            if status.download_rate > 0 and status.total_wanted > 0:
                remaining = status.total_wanted - status.total_wanted_done
                eta = int(remaining / status.download_rate)
            
            return TorrentStatus(
                id=torrent_id,
                name=name,
                state=self._get_state(handle),
                progress=(status.progress * 100),
                download_rate=status.download_rate,
                upload_rate=status.upload_rate,
                total_size=status.total_wanted,
                downloaded=status.total_wanted_done,
                uploaded=status.total_upload,
                num_seeds=status.num_seeds,
                num_peers=status.num_peers,
                eta=eta,
                save_path=metadata.get("save_path", self.download_path),
                info_hash=str(handle.info_hash()),
                added_on=metadata.get("added_on", ""),
                sequential=metadata.get("sequential", False),
                error_message=status.error if status.error else None,
            )
            
        except Exception as e:
            logger.error(f"Error getting status for {torrent_id}: {e}")
            return None
    
    def get_all_torrents(self) -> List[TorrentStatus]:
        """Get status of all torrents."""
        statuses = []
        for torrent_id in list(self.torrents.keys()):
            status = self.get_status(torrent_id)
            if status:
                statuses.append(status)
        return statuses
    
    def get_files(self, torrent_id: str) -> List[TorrentFile]:
        """Get list of files in a torrent."""
        handle = self.torrents.get(torrent_id)
        if not handle or not handle.is_valid():
            return []
        
        try:
            torrent_info = handle.torrent_file()
            if not torrent_info:
                return []
            
            files = []
            file_progress = handle.file_progress()
            priorities = handle.get_file_priorities()
            
            for i in range(torrent_info.num_files()):
                file_entry = torrent_info.files().file_path(i)
                file_size = torrent_info.files().file_size(i)
                
                progress = 0
                if file_size > 0:
                    progress = (file_progress[i] / file_size) * 100
                
                files.append(TorrentFile(
                    index=i,
                    path=file_entry,
                    size=file_size,
                    progress=progress,
                    priority=priorities[i],
                ))
            
            return files
            
        except Exception as e:
            logger.error(f"Error getting files for {torrent_id}: {e}")
            return []
    
    def pause(self, torrent_id: str) -> bool:
        """Pause a torrent."""
        handle = self.torrents.get(torrent_id)
        if handle and handle.is_valid():
            handle.pause()
            logger.info(f"Paused torrent: {torrent_id}")
            return True
        return False
    
    def resume(self, torrent_id: str) -> bool:
        """Resume a paused torrent."""
        handle = self.torrents.get(torrent_id)
        if handle and handle.is_valid():
            handle.resume()
            logger.info(f"Resumed torrent: {torrent_id}")
            return True
        return False
    
    def remove(self, torrent_id: str, delete_files: bool = False) -> bool:
        """Remove a torrent."""
        handle = self.torrents.get(torrent_id)
        if not handle:
            return False
        
        try:
            options = lt.session.delete_files if delete_files else lt.session_handle.options_t()
            self.session.remove_torrent(handle, options)
            
            del self.torrents[torrent_id]
            if torrent_id in self.torrent_metadata:
                del self.torrent_metadata[torrent_id]
            
            logger.info(f"Removed torrent: {torrent_id} (delete_files={delete_files})")
            return True
            
        except Exception as e:
            logger.error(f"Error removing torrent {torrent_id}: {e}")
            return False
    
    def set_sequential(self, torrent_id: str, enabled: bool) -> bool:
        """Enable/disable sequential download for streaming."""
        handle = self.torrents.get(torrent_id)
        if handle and handle.is_valid():
            handle.set_sequential_download(enabled)
            if torrent_id in self.torrent_metadata:
                self.torrent_metadata[torrent_id]["sequential"] = enabled
            logger.info(f"Sequential download {'enabled' if enabled else 'disabled'} for: {torrent_id}")
            return True
        return False
    
    def set_file_priority(self, torrent_id: str, file_index: int, priority: int) -> bool:
        """
        Set priority for a specific file.
        0 = don't download, 1 = normal, 7 = highest
        """
        handle = self.torrents.get(torrent_id)
        if handle and handle.is_valid():
            handle.file_priority(file_index, priority)
            return True
        return False
    
    def get_transfer_info(self) -> Dict[str, Any]:
        """Get global transfer statistics."""
        try:
            # Get session stats
            stats = self.session.status()
            
            return {
                "download_rate": stats.download_rate,
                "download_rate_formatted": TorrentStatus._format_speed(stats.download_rate),
                "upload_rate": stats.upload_rate,
                "upload_rate_formatted": TorrentStatus._format_speed(stats.upload_rate),
                "total_downloaded": stats.total_download,
                "total_uploaded": stats.total_upload,
                "num_torrents": len(self.torrents),
                "dht_nodes": stats.dht_nodes,
            }
        except Exception as e:
            logger.error(f"Error getting transfer info: {e}")
            return {}
    
    def set_download_rate_limit(self, rate: int):
        """Set global download rate limit (bytes/sec, 0 = unlimited)."""
        settings = self.session.settings()
        settings['download_rate_limit'] = rate
        self.session.apply_settings(settings)
        self.max_download_rate = rate
    
    def set_upload_rate_limit(self, rate: int):
        """Set global upload rate limit (bytes/sec, 0 = unlimited)."""
        settings = self.session.settings()
        settings['upload_rate_limit'] = rate
        self.session.apply_settings(settings)
        self.max_upload_rate = rate
    
    def on_complete(self, torrent_id: str, callback: Callable):
        """Register a callback for when a torrent completes."""
        if torrent_id not in self._on_complete_callbacks:
            self._on_complete_callbacks[torrent_id] = []
        self._on_complete_callbacks[torrent_id].append(callback)
    
    def _save_state(self):
        """Save torrent state to disk for persistence."""
        try:
            state = {
                "metadata": self.torrent_metadata,
                "settings": {
                    "download_path": self.download_path,
                    "max_download_rate": self.max_download_rate,
                    "max_upload_rate": self.max_upload_rate,
                }
            }
            
            with open(self._state_file, 'w') as f:
                json.dump(state, f, indent=2)
            
            # Also save individual torrent resume data
            for torrent_id, handle in self.torrents.items():
                if handle.is_valid():
                    try:
                        handle.save_resume_data()
                    except:
                        pass
            
            logger.info(f"Saved state: {len(self.torrent_metadata)} torrents")
            
        except Exception as e:
            logger.error(f"Error saving state: {e}")
    
    def _load_state(self):
        """Load persisted torrent state."""
        if not self._state_file.exists():
            return
        
        try:
            with open(self._state_file, 'r') as f:
                state = json.load(f)
            
            # Restore settings
            settings = state.get("settings", {})
            if "max_download_rate" in settings:
                self.set_download_rate_limit(settings["max_download_rate"])
            if "max_upload_rate" in settings:
                self.set_upload_rate_limit(settings["max_upload_rate"])
            
            # Restore torrents from metadata
            for torrent_id, metadata in state.get("metadata", {}).items():
                if "magnet" in metadata:
                    # Re-add magnet torrents
                    asyncio.create_task(
                        self.add_magnet(
                            metadata["magnet"],
                            save_path=metadata.get("save_path"),
                            sequential=metadata.get("sequential", False),
                            category=metadata.get("category", ""),
                        )
                    )
            
            logger.info(f"Loaded state: {len(state.get('metadata', {}))} torrents")
            
        except Exception as e:
            logger.error(f"Error loading state: {e}")


# Singleton instance
_torrent_engine: Optional[TorrentEngine] = None


def get_torrent_engine(
    download_path: str = None,
    **kwargs
) -> TorrentEngine:
    """Get or create the torrent engine instance."""
    global _torrent_engine
    
    if _torrent_engine is None:
        download_path = download_path or os.environ.get("DOWNLOAD_PATH", "/media/downloads")
        _torrent_engine = TorrentEngine(download_path=download_path, **kwargs)
        _torrent_engine.start()
    
    return _torrent_engine


def shutdown_torrent_engine():
    """Shutdown the torrent engine."""
    global _torrent_engine
    if _torrent_engine:
        _torrent_engine.stop()
        _torrent_engine = None

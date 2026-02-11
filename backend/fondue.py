"""
Fondue - WatchNexus Torrent Engine
Downloads come in pieces, layered together into a perfect whole.
A fully integrated torrent download client using libtorrent.

Features:
- BitTorrent protocol support (DHT, PEX, LSD)
- Magnet link handling
- .torrent file support
- Sequential download for streaming
- Bandwidth management
- Download queue management
- Seeding limits (ratio & time)
- Auto-cleanup completed torrents
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
from dataclasses import dataclass, field, asdict
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
class EngineSettings:
    """Comprehensive torrent engine settings."""
    # Download paths
    download_path: str = "/media/downloads"
    move_completed_path: str = ""  # Empty = don't move
    
    # Queue Management
    max_active_downloads: int = 3
    max_active_uploads: int = 3
    max_active_torrents: int = 5
    
    # Speed Limits (0 = unlimited, in KB/s)
    max_download_rate: int = 0
    max_upload_rate: int = 0
    alt_download_rate: int = 0  # Alternative/scheduled speed
    alt_upload_rate: int = 0
    
    # Connection Limits
    max_connections_global: int = 200
    max_connections_per_torrent: int = 50
    max_uploads_global: int = 8
    max_uploads_per_torrent: int = 4
    
    # Seeding Limits
    seed_ratio_limit: float = 1.0  # Stop seeding at this ratio (0 = disabled)
    seed_time_limit: int = 60  # Minutes to seed (0 = disabled)
    seed_ratio_action: str = "pause"  # "pause", "remove", "remove_with_data"
    
    # Auto-cleanup
    remove_after_completion: bool = False
    remove_after_seeding: bool = False
    delete_files_on_remove: bool = False
    max_completed_torrents: int = 50  # Auto-remove oldest when exceeded (0 = disabled)
    
    # Slow Torrent Handling
    slow_torrent_threshold: int = 10  # KB/s - below this is "slow"
    dont_count_slow_torrents: bool = True
    
    # Network
    listen_port: int = 6881
    enable_dht: bool = True
    enable_pex: bool = True  # Peer Exchange
    enable_lsd: bool = True  # Local Service Discovery
    enable_upnp: bool = True
    enable_natpmp: bool = True
    
    # Behavior
    preallocate_storage: bool = False
    add_paused: bool = False
    sequential_download_default: bool = False
    prioritize_first_last_pieces: bool = True  # For video preview
    
    # Tracker
    announce_to_all_trackers: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EngineSettings':
        # Filter only valid fields
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered)


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
    ratio: float = 0.0
    seeding_time: int = 0  # seconds
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
            "seeding_time_formatted": self._format_duration(self.seeding_time),
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
    
    @staticmethod
    def _format_duration(seconds: int) -> str:
        if seconds < 60:
            return f"{seconds}s"
        if seconds < 3600:
            return f"{seconds // 60}m"
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        return f"{hours}h {mins}m"


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


class FondueEngine:
    """
    Fondue - Built-in BitTorrent download engine.
    Downloads come in pieces, layered together into a perfect whole.
    Uses libtorrent for efficient, cross-platform torrent downloading.
    """
    
    def __init__(self, settings: Optional[EngineSettings] = None):
        self.settings = settings or EngineSettings()
        self._apply_settings_to_session()
        
        self.torrents: Dict[str, lt.torrent_handle] = {}
        self.torrent_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Callbacks
        self._on_complete_callbacks: Dict[str, List[Callable]] = {}
        
        # Background worker
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None
        self._cleanup_counter = 0
        
        # State persistence
        self._state_file = Path(self.settings.download_path) / ".watchnexus_engine.json"
        self._settings_file = Path(self.settings.download_path) / ".watchnexus_settings.json"
        
        logger.info(f"FondueEngine initialized. Download path: {self.settings.download_path}")
    
    def _apply_settings_to_session(self):
        """Apply settings to libtorrent session."""
        s = self.settings
        
        settings_pack = {
            'listen_interfaces': f'0.0.0.0:{s.listen_port},[::0]:{s.listen_port}',
            'download_rate_limit': s.max_download_rate * 1024 if s.max_download_rate > 0 else 0,
            'upload_rate_limit': s.max_upload_rate * 1024 if s.max_upload_rate > 0 else 0,
            'connections_limit': s.max_connections_global,
            'active_downloads': s.max_active_downloads,
            'active_seeds': s.max_active_uploads,
            'active_limit': s.max_active_torrents,
            'enable_dht': s.enable_dht,
            'enable_lsd': s.enable_lsd,
            'enable_upnp': s.enable_upnp,
            'enable_natpmp': s.enable_natpmp,
            'announce_to_all_trackers': s.announce_to_all_trackers,
            'announce_to_all_tiers': True,
            'user_agent': 'WatchNexus/1.0 libtorrent/2.0',
            'auto_manage_prefer_seeds': False,
        }
        
        if hasattr(self, 'session'):
            self.session.apply_settings(settings_pack)
        else:
            self.session = lt.session(settings_pack)
    
    def update_settings(self, new_settings: Dict[str, Any]) -> EngineSettings:
        """Update engine settings."""
        # Update settings object
        for key, value in new_settings.items():
            if hasattr(self.settings, key):
                setattr(self.settings, key, value)
        
        # Apply to session
        self._apply_settings_to_session()
        
        # Save settings
        self._save_settings()
        
        logger.info(f"Settings updated: {list(new_settings.keys())}")
        return self.settings
    
    def get_settings(self) -> EngineSettings:
        """Get current settings."""
        return self.settings
    
    def start(self):
        """Start the torrent engine background worker."""
        if self._running:
            return
        
        # Load settings first
        self._load_settings()
        self._apply_settings_to_session()
        
        self._running = True
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()
        
        # Load persisted torrents
        self._load_state()
        
        logger.info("FondueEngine started")
    
    def stop(self):
        """Stop the torrent engine."""
        self._running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=5.0)
        
        # Save state
        self._save_state()
        self._save_settings()
        
        # Pause all torrents
        for handle in self.torrents.values():
            if handle.is_valid():
                handle.pause()
        
        logger.info("FondueEngine stopped")
    
    def _worker_loop(self):
        """Background worker loop for processing alerts and auto-management."""
        while self._running:
            try:
                # Process alerts
                alerts = self.session.pop_alerts()
                for alert in alerts:
                    self._handle_alert(alert)
                
                # Periodic tasks (every 5 seconds)
                self._cleanup_counter += 1
                if self._cleanup_counter >= 10:
                    self._cleanup_counter = 0
                    self._check_seeding_limits()
                    self._check_completed_cleanup()
                
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                time.sleep(1)
    
    def _handle_alert(self, alert):
        """Handle libtorrent alerts."""
        if isinstance(alert, lt.torrent_finished_alert):
            info_hash = str(alert.handle.info_hash())
            torrent_id = self._find_torrent_id_by_hash(info_hash)
            
            if torrent_id:
                logger.info(f"Torrent finished: {torrent_id}")
                
                # Update metadata
                if torrent_id in self.torrent_metadata:
                    self.torrent_metadata[torrent_id]["completed_on"] = datetime.now(timezone.utc).isoformat()
                
                # Move completed file if configured
                if self.settings.move_completed_path:
                    self._move_completed(torrent_id)
                
                # Remove immediately if configured
                if self.settings.remove_after_completion:
                    self.remove(torrent_id, self.settings.delete_files_on_remove)
                
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
    
    def _find_torrent_id_by_hash(self, info_hash: str) -> Optional[str]:
        """Find torrent ID by info hash."""
        for tid, meta in self.torrent_metadata.items():
            if meta.get("info_hash") == info_hash:
                return tid
        return None
    
    def _check_seeding_limits(self):
        """Check and enforce seeding limits."""
        if self.settings.seed_ratio_limit <= 0 and self.settings.seed_time_limit <= 0:
            return
        
        for torrent_id, handle in list(self.torrents.items()):
            if not handle.is_valid():
                continue
            
            status = handle.status()
            
            # Only check seeding torrents
            if status.state != lt.torrent_status.seeding:
                continue
            
            should_stop = False
            reason = ""
            
            # Check ratio limit
            if self.settings.seed_ratio_limit > 0:
                ratio = status.ratio if hasattr(status, 'ratio') else (
                    status.total_upload / status.total_download if status.total_download > 0 else 0
                )
                if ratio >= self.settings.seed_ratio_limit:
                    should_stop = True
                    reason = f"ratio {ratio:.2f} >= {self.settings.seed_ratio_limit}"
            
            # Check time limit
            if self.settings.seed_time_limit > 0 and not should_stop:
                seeding_time = status.seeding_time if hasattr(status, 'seeding_time') else 0
                limit_seconds = self.settings.seed_time_limit * 60
                if seeding_time >= limit_seconds:
                    should_stop = True
                    reason = f"seeding time {seeding_time // 60}m >= {self.settings.seed_time_limit}m"
            
            if should_stop:
                logger.info(f"Stopping torrent {torrent_id}: {reason}")
                
                action = self.settings.seed_ratio_action
                if action == "pause":
                    handle.pause()
                elif action == "remove":
                    self.remove(torrent_id, delete_files=False)
                elif action == "remove_with_data":
                    self.remove(torrent_id, delete_files=True)
    
    def _check_completed_cleanup(self):
        """Auto-remove old completed torrents if limit exceeded."""
        if self.settings.max_completed_torrents <= 0:
            return
        
        # Get completed torrents sorted by completion time
        completed = []
        for tid, meta in self.torrent_metadata.items():
            if meta.get("completed_on"):
                completed.append((tid, meta.get("completed_on")))
        
        completed.sort(key=lambda x: x[1])
        
        # Remove oldest if over limit
        while len(completed) > self.settings.max_completed_torrents:
            oldest_id = completed.pop(0)[0]
            logger.info(f"Auto-removing old completed torrent: {oldest_id}")
            self.remove(oldest_id, delete_files=self.settings.delete_files_on_remove)
    
    def _move_completed(self, torrent_id: str):
        """Move completed torrent to the completed path."""
        if not self.settings.move_completed_path:
            return
        
        handle = self.torrents.get(torrent_id)
        if not handle or not handle.is_valid():
            return
        
        try:
            Path(self.settings.move_completed_path).mkdir(parents=True, exist_ok=True)
            handle.move_storage(self.settings.move_completed_path)
            logger.info(f"Moved torrent {torrent_id} to {self.settings.move_completed_path}")
        except Exception as e:
            logger.error(f"Failed to move torrent {torrent_id}: {e}")
    
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
        sequential: bool = None,
        category: str = "",
    ) -> Optional[str]:
        """Add a torrent from a magnet link."""
        try:
            save_path = save_path or self.settings.download_path
            sequential = sequential if sequential is not None else self.settings.sequential_download_default
            
            Path(save_path).mkdir(parents=True, exist_ok=True)
            
            params = lt.parse_magnet_uri(magnet_url)
            params.save_path = save_path
            
            handle = self.session.add_torrent(params)
            
            if sequential:
                handle.set_sequential_download(True)
            
            if self.settings.prioritize_first_last_pieces:
                handle.set_flags(lt.torrent_flags.sequential_download)
            
            if self.settings.add_paused:
                handle.pause()
            
            info_hash = str(handle.info_hash())
            torrent_id = self._generate_id(info_hash)
            
            self.torrents[torrent_id] = handle
            self.torrent_metadata[torrent_id] = {
                "id": torrent_id,
                "info_hash": info_hash,
                "magnet": magnet_url,
                "save_path": save_path,
                "sequential": sequential,
                "category": category,
                "added_on": datetime.now(timezone.utc).isoformat(),
                "completed_on": None,
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
        sequential: bool = None,
        category: str = "",
    ) -> Optional[str]:
        """Add a torrent from .torrent file data."""
        try:
            save_path = save_path or self.settings.download_path
            sequential = sequential if sequential is not None else self.settings.sequential_download_default
            
            Path(save_path).mkdir(parents=True, exist_ok=True)
            
            info = lt.torrent_info(lt.bdecode(torrent_data))
            
            params = lt.add_torrent_params()
            params.ti = info
            params.save_path = save_path
            
            handle = self.session.add_torrent(params)
            
            if sequential:
                handle.set_sequential_download(True)
            
            if self.settings.add_paused:
                handle.pause()
            
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
                "completed_on": None,
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
            
            name = "Unknown"
            if handle.torrent_file():
                name = handle.torrent_file().name()
            elif status.name:
                name = status.name
            elif "name" in metadata:
                name = metadata["name"]
            
            eta = -1
            if status.download_rate > 0 and status.total_wanted > 0:
                remaining = status.total_wanted - status.total_wanted_done
                eta = int(remaining / status.download_rate)
            
            ratio = status.total_upload / status.total_download if status.total_download > 0 else 0
            
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
                save_path=metadata.get("save_path", self.settings.download_path),
                info_hash=str(handle.info_hash()),
                added_on=metadata.get("added_on", ""),
                ratio=ratio,
                seeding_time=status.seeding_time if hasattr(status, 'seeding_time') else 0,
                sequential=metadata.get("sequential", False),
                category=metadata.get("category", ""),
                completed_on=metadata.get("completed_on"),
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
    
    def pause_all(self) -> int:
        """Pause all torrents. Returns count."""
        count = 0
        for handle in self.torrents.values():
            if handle.is_valid() and not handle.status().paused:
                handle.pause()
                count += 1
        logger.info(f"Paused {count} torrents")
        return count
    
    def resume_all(self) -> int:
        """Resume all torrents. Returns count."""
        count = 0
        for handle in self.torrents.values():
            if handle.is_valid() and handle.status().paused:
                handle.resume()
                count += 1
        logger.info(f"Resumed {count} torrents")
        return count
    
    def remove(self, torrent_id: str, delete_files: bool = False) -> bool:
        """Remove a torrent."""
        handle = self.torrents.get(torrent_id)
        if not handle:
            return False
        
        try:
            if delete_files:
                self.session.remove_torrent(handle, lt.session.delete_files)
            else:
                self.session.remove_torrent(handle)
            
            del self.torrents[torrent_id]
            if torrent_id in self.torrent_metadata:
                del self.torrent_metadata[torrent_id]
            
            logger.info(f"Removed torrent: {torrent_id} (delete_files={delete_files})")
            return True
            
        except Exception as e:
            logger.error(f"Error removing torrent {torrent_id}: {e}")
            return False
    
    def remove_completed(self, delete_files: bool = False) -> int:
        """Remove all completed torrents. Returns count."""
        count = 0
        for torrent_id in list(self.torrents.keys()):
            handle = self.torrents.get(torrent_id)
            if handle and handle.is_valid():
                status = handle.status()
                if status.state == lt.torrent_status.seeding or status.progress >= 1.0:
                    self.remove(torrent_id, delete_files)
                    count += 1
        logger.info(f"Removed {count} completed torrents")
        return count
    
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
        """Set priority for a specific file (0=skip, 1=normal, 7=highest)."""
        handle = self.torrents.get(torrent_id)
        if handle and handle.is_valid():
            handle.file_priority(file_index, priority)
            return True
        return False
    
    def get_transfer_info(self) -> Dict[str, Any]:
        """Get global transfer statistics."""
        try:
            stats = self.session.status()
            
            # Count active torrents
            downloading = 0
            seeding = 0
            completed = 0
            
            for handle in self.torrents.values():
                if handle.is_valid():
                    state = handle.status().state
                    if state == lt.torrent_status.downloading:
                        downloading += 1
                    elif state == lt.torrent_status.seeding:
                        seeding += 1
                    if handle.status().progress >= 1.0:
                        completed += 1
            
            return {
                "download_rate": stats.download_rate,
                "download_rate_formatted": TorrentStatus._format_speed(stats.download_rate),
                "upload_rate": stats.upload_rate,
                "upload_rate_formatted": TorrentStatus._format_speed(stats.upload_rate),
                "total_downloaded": stats.total_download,
                "total_downloaded_formatted": TorrentStatus._format_size(stats.total_download),
                "total_uploaded": stats.total_upload,
                "total_uploaded_formatted": TorrentStatus._format_size(stats.total_upload),
                "num_torrents": len(self.torrents),
                "downloading": downloading,
                "seeding": seeding,
                "completed": completed,
                "dht_nodes": stats.dht_nodes,
            }
        except Exception as e:
            logger.error(f"Error getting transfer info: {e}")
            return {}
    
    def on_complete(self, torrent_id: str, callback: Callable):
        """Register a callback for when a torrent completes."""
        handle = self.torrents.get(torrent_id)
        if handle:
            info_hash = str(handle.info_hash())
            if info_hash not in self._on_complete_callbacks:
                self._on_complete_callbacks[info_hash] = []
            self._on_complete_callbacks[info_hash].append(callback)
    
    def _save_settings(self):
        """Save settings to disk."""
        try:
            Path(self.settings.download_path).mkdir(parents=True, exist_ok=True)
            with open(self._settings_file, 'w') as f:
                json.dump(self.settings.to_dict(), f, indent=2)
            logger.info("Settings saved")
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
            logger.info("Settings loaded")
        except Exception as e:
            logger.error(f"Error loading settings: {e}")
    
    def _save_state(self):
        """Save torrent state to disk."""
        try:
            state = {
                "metadata": self.torrent_metadata,
            }
            
            Path(self.settings.download_path).mkdir(parents=True, exist_ok=True)
            with open(self._state_file, 'w') as f:
                json.dump(state, f, indent=2)
            
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
            
            # Restore torrents from metadata
            for torrent_id, metadata in state.get("metadata", {}).items():
                if "magnet" in metadata:
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

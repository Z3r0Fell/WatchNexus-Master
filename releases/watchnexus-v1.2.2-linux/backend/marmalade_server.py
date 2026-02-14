"""
Marmalade - WatchNexus Media Server
A Python-based media server that replaces Jellyfin functionality.

Features:
- Library scanning and metadata management
- Video streaming with transcoding support
- Integration with TMDB for metadata
- Subtitle management
- Watch history tracking
- Multi-library support
"""

import os
import json
import hashlib
import asyncio
import logging
import mimetypes
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
import re
import subprocess

logger = logging.getLogger(__name__)


class MediaType(Enum):
    MOVIE = "movie"
    EPISODE = "episode"
    MUSIC = "music"
    AUDIOBOOK = "audiobook"
    UNKNOWN = "unknown"


@dataclass
class MediaFile:
    """Represents a media file in the library."""
    id: str
    path: str
    filename: str
    media_type: MediaType
    title: str
    size: int
    duration: float = 0  # seconds
    width: int = 0
    height: int = 0
    codec_video: str = ""
    codec_audio: str = ""
    container: str = ""
    bitrate: int = 0
    added_date: str = ""
    modified_date: str = ""
    # Metadata from TMDB/manual
    tmdb_id: Optional[int] = None
    imdb_id: Optional[str] = None
    overview: str = ""
    poster_url: str = ""
    backdrop_url: str = ""
    year: Optional[int] = None
    rating: float = 0.0
    genres: List[str] = field(default_factory=list)
    # TV specific
    series_name: str = ""
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    # Watch status
    watched: bool = False
    watch_progress: float = 0  # seconds
    last_watched: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["media_type"] = self.media_type.value
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MediaFile':
        data["media_type"] = MediaType(data.get("media_type", "unknown"))
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Library:
    """Represents a media library."""
    id: str
    name: str
    path: str
    media_type: str  # movies, tv, music, audiobooks
    enabled: bool = True
    scan_interval: int = 3600  # seconds
    last_scan: Optional[str] = None
    item_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MarmaladeServer:
    """
    Python-based media server for WatchNexus.
    Handles library management, streaming, and metadata.
    """
    
    # Video file extensions
    VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.ts'}
    AUDIO_EXTENSIONS = {'.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.wma'}
    
    # Regex patterns for parsing filenames
    MOVIE_PATTERNS = [
        # Movie.Name.2020.1080p.BluRay.x264
        re.compile(r'^(.+?)[\.\s](\d{4})[\.\s]', re.IGNORECASE),
        # Movie Name (2020)
        re.compile(r'^(.+?)\s*\((\d{4})\)', re.IGNORECASE),
    ]
    
    TV_PATTERNS = [
        # Show.Name.S01E01 or Show Name - S01E01
        re.compile(r'^(.+?)[\.\s\-]+S(\d{1,2})E(\d{1,2})', re.IGNORECASE),
        # Show Name - 1x01
        re.compile(r'^(.+?)[\.\s\-]+(\d{1,2})x(\d{2})', re.IGNORECASE),
    ]
    
    def __init__(
        self,
        data_dir: str = "/var/lib/marmalade",
        ffprobe_path: str = "ffprobe",
        ffmpeg_path: str = "ffmpeg",
    ):
        self.data_dir = Path(data_dir)
        self.ffprobe_path = ffprobe_path
        self.ffmpeg_path = ffmpeg_path
        
        # Create data directories
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "cache").mkdir(exist_ok=True)
        (self.data_dir / "transcodes").mkdir(exist_ok=True)
        
        # Storage
        self.libraries: Dict[str, Library] = {}
        self.media_files: Dict[str, MediaFile] = {}
        
        # Persistence files
        self._libraries_file = self.data_dir / "libraries.json"
        self._media_file = self.data_dir / "media.json"
        
        # Load existing data
        self._load_data()
        
        logger.info(f"MarmaladeServer initialized. Data dir: {data_dir}")
    
    def _load_data(self):
        """Load persisted data from disk."""
        try:
            if self._libraries_file.exists():
                with open(self._libraries_file, 'r') as f:
                    data = json.load(f)
                    self.libraries = {lib['id']: Library(**lib) for lib in data}
                    logger.info(f"Loaded {len(self.libraries)} libraries")
            
            if self._media_file.exists():
                with open(self._media_file, 'r') as f:
                    data = json.load(f)
                    self.media_files = {m['id']: MediaFile.from_dict(m) for m in data}
                    logger.info(f"Loaded {len(self.media_files)} media files")
        except Exception as e:
            logger.error(f"Error loading data: {e}")
    
    def _save_data(self):
        """Save data to disk."""
        try:
            with open(self._libraries_file, 'w') as f:
                json.dump([lib.to_dict() for lib in self.libraries.values()], f, indent=2)
            
            with open(self._media_file, 'w') as f:
                json.dump([m.to_dict() for m in self.media_files.values()], f, indent=2)
        except Exception as e:
            logger.error(f"Error saving data: {e}")
    
    def _generate_id(self, path: str) -> str:
        """Generate a unique ID from a path."""
        return hashlib.md5(path.encode()).hexdigest()[:16]
    
    # ==================== Library Management ====================
    
    def add_library(
        self,
        name: str,
        path: str,
        media_type: str = "movies",
        enabled: bool = True,
        scan_interval: int = 3600,
    ) -> Library:
        """Add a new library."""
        lib_id = self._generate_id(path)
        
        library = Library(
            id=lib_id,
            name=name,
            path=path,
            media_type=media_type,
            enabled=enabled,
            scan_interval=scan_interval,
        )
        
        self.libraries[lib_id] = library
        self._save_data()
        
        logger.info(f"Added library: {name} ({path})")
        return library
    
    def remove_library(self, library_id: str) -> bool:
        """Remove a library and its media entries."""
        if library_id not in self.libraries:
            return False
        
        library = self.libraries[library_id]
        
        # Remove all media from this library
        to_remove = [
            mid for mid, media in self.media_files.items()
            if media.path.startswith(library.path)
        ]
        for mid in to_remove:
            del self.media_files[mid]
        
        del self.libraries[library_id]
        self._save_data()
        
        logger.info(f"Removed library: {library.name}")
        return True
    
    def get_libraries(self) -> List[Library]:
        """Get all libraries."""
        return list(self.libraries.values())
    
    def get_library(self, library_id: str) -> Optional[Library]:
        """Get a specific library."""
        return self.libraries.get(library_id)
    
    # ==================== Library Scanning ====================
    
    async def scan_library(self, library_id: str) -> Dict[str, Any]:
        """Scan a library for new media files."""
        library = self.libraries.get(library_id)
        if not library:
            return {"error": "Library not found"}
        
        if not Path(library.path).exists():
            return {"error": f"Library path does not exist: {library.path}"}
        
        logger.info(f"Scanning library: {library.name}")
        
        new_files = 0
        updated_files = 0
        removed_files = 0
        
        # Get existing files in this library
        existing_paths = {
            m.path for m in self.media_files.values()
            if m.path.startswith(library.path)
        }
        
        found_paths = set()
        
        # Scan for media files
        extensions = self.VIDEO_EXTENSIONS if library.media_type in ['movies', 'tv'] else self.AUDIO_EXTENSIONS
        
        for root, dirs, files in os.walk(library.path):
            # Skip hidden directories
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            for filename in files:
                ext = Path(filename).suffix.lower()
                if ext not in extensions:
                    continue
                
                file_path = os.path.join(root, filename)
                found_paths.add(file_path)
                
                if file_path in existing_paths:
                    # Check if file was modified
                    media_id = self._generate_id(file_path)
                    if media_id in self.media_files:
                        stat = os.stat(file_path)
                        current_mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                        if self.media_files[media_id].modified_date != current_mtime:
                            # File was modified, update it
                            await self._process_file(file_path, library)
                            updated_files += 1
                else:
                    # New file
                    await self._process_file(file_path, library)
                    new_files += 1
        
        # Remove files that no longer exist
        for path in existing_paths - found_paths:
            media_id = self._generate_id(path)
            if media_id in self.media_files:
                del self.media_files[media_id]
                removed_files += 1
        
        # Update library stats
        library.last_scan = datetime.now(timezone.utc).isoformat()
        library.item_count = len([
            m for m in self.media_files.values()
            if m.path.startswith(library.path)
        ])
        
        self._save_data()
        
        result = {
            "library": library.name,
            "new": new_files,
            "updated": updated_files,
            "removed": removed_files,
            "total": library.item_count,
        }
        
        logger.info(f"Scan complete: {result}")
        return result
    
    async def _process_file(self, file_path: str, library: Library) -> Optional[MediaFile]:
        """Process a media file and add to database."""
        try:
            stat = os.stat(file_path)
            filename = os.path.basename(file_path)
            
            # Generate ID
            media_id = self._generate_id(file_path)
            
            # Parse filename for metadata
            parsed = self._parse_filename(filename, library.media_type)
            
            # Get media info using ffprobe
            media_info = await self._get_media_info(file_path)
            
            # Determine media type
            if library.media_type == 'tv':
                media_type = MediaType.EPISODE
            elif library.media_type == 'movies':
                media_type = MediaType.MOVIE
            elif library.media_type == 'music':
                media_type = MediaType.MUSIC
            else:
                media_type = MediaType.UNKNOWN
            
            media_file = MediaFile(
                id=media_id,
                path=file_path,
                filename=filename,
                media_type=media_type,
                title=parsed.get('title', filename),
                size=stat.st_size,
                duration=media_info.get('duration', 0),
                width=media_info.get('width', 0),
                height=media_info.get('height', 0),
                codec_video=media_info.get('codec_video', ''),
                codec_audio=media_info.get('codec_audio', ''),
                container=media_info.get('container', ''),
                bitrate=media_info.get('bitrate', 0),
                added_date=datetime.now(timezone.utc).isoformat(),
                modified_date=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                year=parsed.get('year'),
                series_name=parsed.get('series_name', ''),
                season_number=parsed.get('season'),
                episode_number=parsed.get('episode'),
            )
            
            self.media_files[media_id] = media_file
            return media_file
            
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
            return None
    
    def _parse_filename(self, filename: str, media_type: str) -> Dict[str, Any]:
        """Parse a filename to extract metadata."""
        result = {'title': Path(filename).stem}
        
        if media_type == 'tv':
            for pattern in self.TV_PATTERNS:
                match = pattern.match(filename)
                if match:
                    groups = match.groups()
                    result['series_name'] = groups[0].replace('.', ' ').strip()
                    result['season'] = int(groups[1])
                    result['episode'] = int(groups[2])
                    result['title'] = f"{result['series_name']} S{result['season']:02d}E{result['episode']:02d}"
                    break
        else:
            for pattern in self.MOVIE_PATTERNS:
                match = pattern.match(filename)
                if match:
                    groups = match.groups()
                    result['title'] = groups[0].replace('.', ' ').strip()
                    result['year'] = int(groups[1])
                    break
        
        return result
    
    async def _get_media_info(self, file_path: str) -> Dict[str, Any]:
        """Get media information using ffprobe."""
        try:
            cmd = [
                self.ffprobe_path,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                file_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                return {}
            
            data = json.loads(result.stdout)
            
            info = {
                'container': Path(file_path).suffix.lower().lstrip('.'),
            }
            
            # Get format info
            fmt = data.get('format', {})
            info['duration'] = float(fmt.get('duration', 0))
            info['bitrate'] = int(fmt.get('bit_rate', 0))
            
            # Get stream info
            for stream in data.get('streams', []):
                if stream.get('codec_type') == 'video' and not info.get('codec_video'):
                    info['codec_video'] = stream.get('codec_name', '')
                    info['width'] = stream.get('width', 0)
                    info['height'] = stream.get('height', 0)
                elif stream.get('codec_type') == 'audio' and not info.get('codec_audio'):
                    info['codec_audio'] = stream.get('codec_name', '')
            
            return info
            
        except Exception as e:
            logger.error(f"ffprobe error: {e}")
            return {}
    
    # ==================== Media Retrieval ====================
    
    def get_media(self, media_id: str) -> Optional[MediaFile]:
        """Get a specific media file."""
        return self.media_files.get(media_id)
    
    def get_all_media(
        self,
        library_id: Optional[str] = None,
        media_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[MediaFile]:
        """Get media files with optional filtering."""
        media = list(self.media_files.values())
        
        if library_id:
            library = self.libraries.get(library_id)
            if library:
                media = [m for m in media if m.path.startswith(library.path)]
        
        if media_type:
            type_enum = MediaType(media_type)
            media = [m for m in media if m.media_type == type_enum]
        
        # Sort by title
        media.sort(key=lambda m: m.title.lower())
        
        return media[offset:offset + limit]
    
    def search_media(self, query: str, limit: int = 50) -> List[MediaFile]:
        """Search for media by title."""
        query_lower = query.lower()
        results = [
            m for m in self.media_files.values()
            if query_lower in m.title.lower() or query_lower in m.series_name.lower()
        ]
        results.sort(key=lambda m: m.title.lower())
        return results[:limit]
    
    def get_recent_media(self, limit: int = 20) -> List[MediaFile]:
        """Get recently added media."""
        media = list(self.media_files.values())
        media.sort(key=lambda m: m.added_date, reverse=True)
        return media[:limit]
    
    def get_continue_watching(self, limit: int = 10) -> List[MediaFile]:
        """Get media that was partially watched."""
        media = [
            m for m in self.media_files.values()
            if m.watch_progress > 0 and not m.watched
        ]
        media.sort(key=lambda m: m.last_watched or '', reverse=True)
        return media[:limit]
    
    # ==================== Watch Progress ====================
    
    def update_watch_progress(
        self,
        media_id: str,
        progress: float,
        mark_watched: bool = False,
    ) -> bool:
        """Update watch progress for a media file."""
        media = self.media_files.get(media_id)
        if not media:
            return False
        
        media.watch_progress = progress
        media.last_watched = datetime.now(timezone.utc).isoformat()
        
        # Auto-mark as watched if > 90% complete
        if mark_watched or (media.duration > 0 and progress / media.duration > 0.9):
            media.watched = True
        
        self._save_data()
        return True
    
    def mark_watched(self, media_id: str, watched: bool = True) -> bool:
        """Mark a media file as watched/unwatched."""
        media = self.media_files.get(media_id)
        if not media:
            return False
        
        media.watched = watched
        if watched:
            media.watch_progress = media.duration
        
        self._save_data()
        return True
    
    # ==================== Streaming ====================
    
    def get_stream_url(self, media_id: str, quality: str = "original") -> Optional[Dict[str, Any]]:
        """Get streaming URL for a media file."""
        media = self.media_files.get(media_id)
        if not media or not Path(media.path).exists():
            return None
        
        # For original quality, return direct path
        # For transcoded, would generate HLS playlist
        
        return {
            "id": media_id,
            "path": media.path,
            "mime_type": self._get_mime_type(media.path),
            "quality": quality,
            "duration": media.duration,
        }
    
    def _get_mime_type(self, path: str) -> str:
        """Get MIME type for a file."""
        mime, _ = mimetypes.guess_type(path)
        return mime or 'application/octet-stream'


# Singleton instance
_marmalade_server: Optional[MarmaladeServer] = None


def get_marmalade_server() -> MarmaladeServer:
    """Get or create the Marmalade server instance."""
    global _marmalade_server
    
    if _marmalade_server is None:
        data_dir = os.environ.get("MARMALADE_DATA_DIR", "/var/lib/marmalade")
        _marmalade_server = MarmaladeServer(data_dir=data_dir)
    
    return _marmalade_server

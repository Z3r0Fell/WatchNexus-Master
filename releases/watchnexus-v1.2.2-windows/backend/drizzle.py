"""
Drizzle - WatchNexus Playlist & Queue Engine

Drizzle handles continuous playback across movies, TV episodes, and collections.
Like a continuous drizzle of content - never stops flowing.

Features:
- Playlist management (create, edit, delete playlists)
- Queue system for auto-play next
- Smart episode progression (auto-next episode/season)
- Skip intro/outro/credits detection markers
- "Play All" for collections
- "Play Season" for TV shows
- Post-credits scene handling (MCU-style)
"""

import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
import uuid
import json

logger = logging.getLogger("drizzle")


class PlaylistType(str, Enum):
    """Types of playlists."""
    CUSTOM = "custom"           # User-created playlist
    COLLECTION = "collection"   # Movie collection (e.g., MCU)
    SEASON = "season"           # TV season
    SERIES = "series"           # Entire TV series
    SHUFFLE = "shuffle"         # Shuffled playlist
    MARATHON = "marathon"       # Marathon mode (all episodes)


class SkipMarkerType(str, Enum):
    """Types of skip markers."""
    INTRO = "intro"             # Opening credits/intro
    OUTRO = "outro"             # Ending credits
    RECAP = "recap"             # "Previously on..." recap
    CREDITS = "credits"         # Full credits
    POST_CREDITS = "post_credits"  # After-credits scene


@dataclass
class SkipMarker:
    """A skip marker in a media file."""
    type: SkipMarkerType
    start_time: int             # Start time in seconds
    end_time: int               # End time in seconds
    auto_skip: bool = True      # Auto-skip or prompt user
    label: str = ""             # Optional label (e.g., "Post-credits scene")


@dataclass
class PlaylistItem:
    """An item in a playlist."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    media_type: str = "movie"   # movie, episode, video
    tmdb_id: Optional[int] = None
    title: str = ""
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    duration: int = 0           # Duration in seconds
    local_path: Optional[str] = None
    
    # TV-specific
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    show_title: Optional[str] = None
    show_tmdb_id: Optional[int] = None
    
    # Skip markers for this item
    skip_markers: List[Dict] = field(default_factory=list)
    
    # Playback state
    watched: bool = False
    current_time: int = 0       # Last position in seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PlaylistItem':
        """Create from dictionary."""
        # Handle skip_markers conversion
        if 'skip_markers' in data and isinstance(data['skip_markers'], str):
            data['skip_markers'] = json.loads(data['skip_markers'])
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Playlist:
    """A playlist of media items."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    name: str = "My Playlist"
    description: str = ""
    playlist_type: PlaylistType = PlaylistType.CUSTOM
    items: List[PlaylistItem] = field(default_factory=list)
    
    # Display
    cover_image: Optional[str] = None  # Custom or first item's poster
    
    # Playback settings
    shuffle: bool = False
    repeat: bool = False
    auto_skip_intros: bool = True
    auto_skip_outros: bool = False
    auto_play_next: bool = True
    
    # Auto-continue settings
    credits_threshold: int = 90  # Show "next" when X% through credits
    
    # Metadata
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    total_duration: int = 0     # Total duration in seconds
    item_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        data = asdict(self)
        data['items'] = json.dumps([item if isinstance(item, dict) else asdict(item) for item in self.items])
        data['playlist_type'] = self.playlist_type.value if isinstance(self.playlist_type, PlaylistType) else self.playlist_type
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Playlist':
        """Create from dictionary."""
        # Parse items from JSON string
        if 'items' in data and isinstance(data['items'], str):
            items_data = json.loads(data['items'])
            data['items'] = [PlaylistItem.from_dict(item) for item in items_data]
        elif 'items' in data and isinstance(data['items'], list):
            data['items'] = [
                PlaylistItem.from_dict(item) if isinstance(item, dict) else item 
                for item in data['items']
            ]
        
        # Parse playlist_type
        if 'playlist_type' in data and isinstance(data['playlist_type'], str):
            data['playlist_type'] = PlaylistType(data['playlist_type'])
        
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
    
    def calculate_totals(self):
        """Calculate total duration and item count."""
        self.item_count = len(self.items)
        self.total_duration = sum(item.duration for item in self.items)
        
    def add_item(self, item: PlaylistItem, position: Optional[int] = None):
        """Add an item to the playlist."""
        if position is not None and 0 <= position <= len(self.items):
            self.items.insert(position, item)
        else:
            self.items.append(item)
        self.calculate_totals()
        self.updated_at = datetime.now(timezone.utc).isoformat()
        
    def remove_item(self, item_id: str) -> bool:
        """Remove an item from the playlist."""
        for i, item in enumerate(self.items):
            if item.id == item_id:
                self.items.pop(i)
                self.calculate_totals()
                self.updated_at = datetime.now(timezone.utc).isoformat()
                return True
        return False
    
    def reorder_item(self, item_id: str, new_position: int) -> bool:
        """Move an item to a new position."""
        for i, item in enumerate(self.items):
            if item.id == item_id:
                self.items.pop(i)
                self.items.insert(new_position, item)
                self.updated_at = datetime.now(timezone.utc).isoformat()
                return True
        return False
    
    def get_next_item(self, current_item_id: str) -> Optional[PlaylistItem]:
        """Get the next item after the current one."""
        for i, item in enumerate(self.items):
            if item.id == current_item_id:
                if i + 1 < len(self.items):
                    return self.items[i + 1]
                elif self.repeat:
                    return self.items[0]
        return None
    
    def get_previous_item(self, current_item_id: str) -> Optional[PlaylistItem]:
        """Get the previous item before the current one."""
        for i, item in enumerate(self.items):
            if item.id == current_item_id:
                if i > 0:
                    return self.items[i - 1]
                elif self.repeat:
                    return self.items[-1]
        return None


class DrizzleEngine:
    """
    Drizzle - Playlist & Queue Engine.
    
    Manages playlists, queues, and continuous playback.
    """
    
    def __init__(self, db=None):
        self.db = db
        self._active_queues: Dict[str, Playlist] = {}  # user_id -> active queue
        logger.info("DrizzleEngine initialized")
    
    def set_db(self, db):
        """Set the database connection (called after DB init)."""
        self.db = db
    
    # ==================== Playlist CRUD ====================
    
    async def create_playlist(
        self, 
        user_id: str, 
        name: str, 
        description: str = "",
        playlist_type: PlaylistType = PlaylistType.CUSTOM,
        items: List[Dict] = None
    ) -> Playlist:
        """Create a new playlist."""
        playlist = Playlist(
            user_id=user_id,
            name=name,
            description=description,
            playlist_type=playlist_type,
            items=[PlaylistItem.from_dict(item) for item in (items or [])]
        )
        playlist.calculate_totals()
        
        if self.db:
            await self.db.playlists.insert_one(playlist.to_dict())
        
        logger.info(f"Created playlist '{name}' for user {user_id}")
        return playlist
    
    async def get_playlist(self, playlist_id: str, user_id: str = None) -> Optional[Playlist]:
        """Get a playlist by ID."""
        if not self.db:
            return None
            
        query = {"id": playlist_id}
        if user_id:
            query["user_id"] = user_id
            
        data = await self.db.playlists.find_one(query, {"_id": 0})
        if data:
            return Playlist.from_dict(data)
        return None
    
    async def get_user_playlists(self, user_id: str) -> List[Playlist]:
        """Get all playlists for a user."""
        if not self.db:
            return []
            
        playlists_data = await self.db.playlists.find(
            {"user_id": user_id}, 
            {"_id": 0}
        ).sort("updated_at", -1).to_list(100)
        
        return [Playlist.from_dict(data) for data in playlists_data]
    
    async def update_playlist(self, playlist: Playlist) -> bool:
        """Update a playlist."""
        if not self.db:
            return False
            
        playlist.updated_at = datetime.now(timezone.utc).isoformat()
        playlist.calculate_totals()
        
        result = await self.db.playlists.update_one(
            {"id": playlist.id, "user_id": playlist.user_id},
            {"$set": playlist.to_dict()}
        )
        return result.modified_count > 0
    
    async def delete_playlist(self, playlist_id: str, user_id: str) -> bool:
        """Delete a playlist."""
        if not self.db:
            return False
            
        result = await self.db.playlists.delete_one({
            "id": playlist_id, 
            "user_id": user_id
        })
        
        # Also remove from active queue if it was active
        if user_id in self._active_queues and self._active_queues[user_id].id == playlist_id:
            del self._active_queues[user_id]
            
        return result.deleted_count > 0
    
    # ==================== Playlist Item Management ====================
    
    async def add_to_playlist(
        self, 
        playlist_id: str, 
        user_id: str,
        item_data: Dict[str, Any],
        position: Optional[int] = None
    ) -> Optional[PlaylistItem]:
        """Add an item to a playlist."""
        playlist = await self.get_playlist(playlist_id, user_id)
        if not playlist:
            return None
            
        item = PlaylistItem.from_dict(item_data)
        playlist.add_item(item, position)
        
        await self.update_playlist(playlist)
        return item
    
    async def remove_from_playlist(
        self, 
        playlist_id: str, 
        user_id: str,
        item_id: str
    ) -> bool:
        """Remove an item from a playlist."""
        playlist = await self.get_playlist(playlist_id, user_id)
        if not playlist:
            return False
            
        success = playlist.remove_item(item_id)
        if success:
            await self.update_playlist(playlist)
        return success
    
    async def reorder_playlist_item(
        self,
        playlist_id: str,
        user_id: str,
        item_id: str,
        new_position: int
    ) -> bool:
        """Reorder an item in a playlist."""
        playlist = await self.get_playlist(playlist_id, user_id)
        if not playlist:
            return False
            
        success = playlist.reorder_item(item_id, new_position)
        if success:
            await self.update_playlist(playlist)
        return success
    
    # ==================== Queue Management ====================
    
    async def set_active_queue(self, user_id: str, playlist_id: str) -> Optional[Playlist]:
        """Set a playlist as the active queue for a user."""
        playlist = await self.get_playlist(playlist_id, user_id)
        if playlist:
            self._active_queues[user_id] = playlist
            logger.info(f"Set active queue for user {user_id}: {playlist.name}")
        return playlist
    
    def get_active_queue(self, user_id: str) -> Optional[Playlist]:
        """Get the active queue for a user."""
        return self._active_queues.get(user_id)
    
    def clear_active_queue(self, user_id: str):
        """Clear the active queue for a user."""
        if user_id in self._active_queues:
            del self._active_queues[user_id]
    
    async def get_next_in_queue(self, user_id: str, current_item_id: str) -> Optional[PlaylistItem]:
        """Get the next item in the active queue."""
        queue = self.get_active_queue(user_id)
        if queue:
            return queue.get_next_item(current_item_id)
        return None
    
    async def update_queue_progress(
        self, 
        user_id: str, 
        item_id: str, 
        current_time: int,
        watched: bool = False
    ):
        """Update the playback progress of an item in the queue."""
        queue = self.get_active_queue(user_id)
        if not queue:
            return
            
        for item in queue.items:
            if item.id == item_id:
                item.current_time = current_time
                item.watched = watched
                break
    
    # ==================== Smart Playlist Generation ====================
    
    async def create_season_playlist(
        self, 
        user_id: str,
        show_tmdb_id: int,
        show_title: str,
        season_number: int,
        episodes: List[Dict[str, Any]]
    ) -> Playlist:
        """Create a playlist for a TV season (Play Season feature)."""
        items = []
        for ep in episodes:
            item = PlaylistItem(
                media_type="episode",
                tmdb_id=ep.get("id"),
                title=ep.get("name", f"Episode {ep.get('episode_number', '?')}"),
                poster_path=ep.get("still_path"),
                duration=ep.get("runtime", 0) * 60 if ep.get("runtime") else 2700,  # Default 45min
                season_number=season_number,
                episode_number=ep.get("episode_number"),
                show_title=show_title,
                show_tmdb_id=show_tmdb_id
            )
            items.append(item)
        
        playlist = Playlist(
            user_id=user_id,
            name=f"{show_title} - Season {season_number}",
            description=f"All episodes from Season {season_number}",
            playlist_type=PlaylistType.SEASON,
            items=items,
            auto_play_next=True,
            auto_skip_intros=True
        )
        playlist.calculate_totals()
        
        if self.db:
            await self.db.playlists.insert_one(playlist.to_dict())
        
        return playlist
    
    async def create_series_playlist(
        self,
        user_id: str,
        show_tmdb_id: int,
        show_title: str,
        all_episodes: List[Dict[str, Any]]  # Flat list of all episodes
    ) -> Playlist:
        """Create a playlist for an entire TV series (Marathon mode)."""
        items = []
        for ep in all_episodes:
            item = PlaylistItem(
                media_type="episode",
                tmdb_id=ep.get("id"),
                title=ep.get("name", f"S{ep.get('season_number', '?')}E{ep.get('episode_number', '?')}"),
                poster_path=ep.get("still_path"),
                duration=ep.get("runtime", 0) * 60 if ep.get("runtime") else 2700,
                season_number=ep.get("season_number"),
                episode_number=ep.get("episode_number"),
                show_title=show_title,
                show_tmdb_id=show_tmdb_id
            )
            items.append(item)
        
        playlist = Playlist(
            user_id=user_id,
            name=f"{show_title} - Complete Series",
            description=f"Marathon: All {len(items)} episodes",
            playlist_type=PlaylistType.MARATHON,
            items=items,
            auto_play_next=True,
            auto_skip_intros=True
        )
        playlist.calculate_totals()
        
        if self.db:
            await self.db.playlists.insert_one(playlist.to_dict())
        
        return playlist
    
    async def create_collection_playlist(
        self,
        user_id: str,
        collection_name: str,
        movies: List[Dict[str, Any]]
    ) -> Playlist:
        """Create a playlist for a movie collection (Play All feature)."""
        items = []
        for movie in movies:
            item = PlaylistItem(
                media_type="movie",
                tmdb_id=movie.get("id"),
                title=movie.get("title", "Unknown"),
                poster_path=movie.get("poster_path"),
                backdrop_path=movie.get("backdrop_path"),
                duration=movie.get("runtime", 0) * 60 if movie.get("runtime") else 7200  # Default 2h
            )
            items.append(item)
        
        playlist = Playlist(
            user_id=user_id,
            name=collection_name,
            description=f"Movie collection: {len(items)} films",
            playlist_type=PlaylistType.COLLECTION,
            items=items,
            auto_play_next=True,
            cover_image=movies[0].get("poster_path") if movies else None
        )
        playlist.calculate_totals()
        
        if self.db:
            await self.db.playlists.insert_one(playlist.to_dict())
        
        return playlist
    
    # ==================== Skip Marker Management ====================
    
    async def set_skip_marker(
        self,
        media_type: str,
        tmdb_id: int,
        marker_type: SkipMarkerType,
        start_time: int,
        end_time: int,
        auto_skip: bool = True,
        label: str = ""
    ) -> Dict:
        """Set a skip marker for a media item (stored globally for reuse)."""
        marker = SkipMarker(
            type=marker_type,
            start_time=start_time,
            end_time=end_time,
            auto_skip=auto_skip,
            label=label
        )
        
        marker_doc = {
            "media_type": media_type,
            "tmdb_id": tmdb_id,
            "marker_type": marker_type.value,
            "start_time": start_time,
            "end_time": end_time,
            "auto_skip": auto_skip,
            "label": label,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        if self.db:
            await self.db.skip_markers.update_one(
                {"tmdb_id": tmdb_id, "media_type": media_type, "marker_type": marker_type.value},
                {"$set": marker_doc},
                upsert=True
            )
        
        return marker_doc
    
    async def get_skip_markers(self, media_type: str, tmdb_id: int) -> List[Dict]:
        """Get all skip markers for a media item."""
        if not self.db:
            return []
            
        markers = await self.db.skip_markers.find(
            {"media_type": media_type, "tmdb_id": tmdb_id},
            {"_id": 0}
        ).to_list(10)
        
        return markers
    
    # ==================== Playback State ====================
    
    async def get_queue_state(self, user_id: str) -> Optional[Dict]:
        """Get the current queue state for a user (for resuming playback)."""
        queue = self.get_active_queue(user_id)
        if not queue:
            return None
        
        # Find current item (first unwatched or partially watched)
        current_item = None
        current_index = 0
        for i, item in enumerate(queue.items):
            if not item.watched:
                current_item = item
                current_index = i
                break
        
        return {
            "playlist_id": queue.id,
            "playlist_name": queue.name,
            "total_items": len(queue.items),
            "current_index": current_index,
            "current_item": current_item.to_dict() if current_item else None,
            "items_remaining": len(queue.items) - current_index,
            "auto_play_next": queue.auto_play_next,
            "auto_skip_intros": queue.auto_skip_intros
        }


# Global Drizzle engine instance
_drizzle_engine: Optional[DrizzleEngine] = None


def get_drizzle_engine() -> DrizzleEngine:
    """Get or create the Drizzle engine instance."""
    global _drizzle_engine
    if _drizzle_engine is None:
        _drizzle_engine = DrizzleEngine()
    return _drizzle_engine


def init_drizzle(db):
    """Initialize Drizzle with database connection."""
    global _drizzle_engine
    if _drizzle_engine is None:
        _drizzle_engine = DrizzleEngine(db)
    else:
        _drizzle_engine.set_db(db)
    return _drizzle_engine

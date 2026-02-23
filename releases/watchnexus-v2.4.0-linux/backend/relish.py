"""
Relish - IPTV Module for WatchNexus 📺
Handles M3U playlists, EPG data, and live TV channels.

Features:
- M3U/M3U8 playlist parsing
- XMLTV EPG data support
- Channel grouping and favorites
- Stream URL validation
- Recording schedules (future)
"""

import httpx
import asyncio
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
import hashlib
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)


@dataclass
class IPTVChannel:
    """Represents an IPTV channel."""
    id: str
    name: str
    stream_url: str
    logo: str = ""
    group: str = "Uncategorized"
    tvg_id: str = ""  # EPG channel ID
    tvg_name: str = ""
    language: str = ""
    country: str = ""
    is_favorite: bool = False
    is_hidden: bool = False
    last_checked: Optional[str] = None
    is_online: Optional[bool] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "stream_url": self.stream_url,
            "logo": self.logo,
            "group": self.group,
            "tvg_id": self.tvg_id,
            "tvg_name": self.tvg_name,
            "language": self.language,
            "country": self.country,
            "is_favorite": self.is_favorite,
            "is_hidden": self.is_hidden,
            "last_checked": self.last_checked,
            "is_online": self.is_online,
        }


@dataclass
class EPGProgram:
    """Represents a TV program in the EPG."""
    channel_id: str
    title: str
    start: datetime
    end: datetime
    description: str = ""
    category: str = ""
    episode_title: str = ""
    season: Optional[int] = None
    episode: Optional[int] = None
    icon: str = ""
    rating: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "channel_id": self.channel_id,
            "title": self.title,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "description": self.description,
            "category": self.category,
            "episode_title": self.episode_title,
            "season": self.season,
            "episode": self.episode,
            "icon": self.icon,
            "rating": self.rating,
            "duration_minutes": int((self.end - self.start).total_seconds() / 60),
        }


@dataclass
class IPTVSource:
    """Represents an IPTV source (M3U playlist)."""
    id: str
    name: str
    url: str
    epg_url: str = ""
    enabled: bool = True
    auto_refresh: bool = True
    refresh_interval: int = 24  # hours
    last_refresh: Optional[str] = None
    channel_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "epg_url": self.epg_url,
            "enabled": self.enabled,
            "auto_refresh": self.auto_refresh,
            "refresh_interval": self.refresh_interval,
            "last_refresh": self.last_refresh,
            "channel_count": self.channel_count,
        }


class RelishIPTV:
    """
    Relish - WatchNexus IPTV Manager
    
    Manages IPTV sources, channels, and EPG data.
    """
    
    def __init__(self):
        self.sources: Dict[str, IPTVSource] = {}
        self.channels: Dict[str, IPTVChannel] = {}  # channel_id -> channel
        self.epg_data: Dict[str, List[EPGProgram]] = {}  # channel_id -> programs
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            )
        return self._http_client
    
    async def close(self):
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
    
    # ==================== M3U PARSING ====================
    
    def _generate_channel_id(self, name: str, url: str) -> str:
        """Generate a unique channel ID."""
        return hashlib.md5(f"{name}:{url}".encode()).hexdigest()[:12]
    
    def _parse_m3u_extinf(self, line: str) -> Dict[str, str]:
        """Parse #EXTINF line attributes."""
        attrs = {}
        
        # Extract duration and name
        duration_match = re.match(r'#EXTINF:(-?\d+)', line)
        if duration_match:
            attrs['duration'] = duration_match.group(1)
        
        # Extract attributes like tvg-id="...", tvg-logo="...", etc.
        attr_pattern = r'(\w+(?:-\w+)*)="([^"]*)"'
        for match in re.finditer(attr_pattern, line):
            key = match.group(1).lower().replace('-', '_')
            attrs[key] = match.group(2)
        
        # Extract channel name (after the last comma)
        name_match = re.search(r',(.+)$', line)
        if name_match:
            attrs['name'] = name_match.group(1).strip()
        
        return attrs
    
    async def parse_m3u(self, content: str, source_id: str = "") -> List[IPTVChannel]:
        """Parse M3U/M3U8 playlist content."""
        channels = []
        lines = content.strip().split('\n')
        
        current_attrs = {}
        
        for line in lines:
            line = line.strip()
            
            if not line or line.startswith('#EXTM3U'):
                continue
            
            if line.startswith('#EXTINF:'):
                current_attrs = self._parse_m3u_extinf(line)
            
            elif line.startswith('#EXTGRP:'):
                current_attrs['group_title'] = line.split(':', 1)[1].strip()
            
            elif not line.startswith('#'):
                # This is a stream URL
                if current_attrs.get('name'):
                    channel_id = self._generate_channel_id(
                        current_attrs.get('name', ''),
                        line
                    )
                    
                    channel = IPTVChannel(
                        id=channel_id,
                        name=current_attrs.get('name', 'Unknown'),
                        stream_url=line,
                        logo=current_attrs.get('tvg_logo', '') or current_attrs.get('logo', ''),
                        group=current_attrs.get('group_title', '') or current_attrs.get('group', 'Uncategorized'),
                        tvg_id=current_attrs.get('tvg_id', ''),
                        tvg_name=current_attrs.get('tvg_name', ''),
                        language=current_attrs.get('tvg_language', ''),
                        country=current_attrs.get('tvg_country', ''),
                    )
                    channels.append(channel)
                
                current_attrs = {}
        
        logger.info(f"Parsed {len(channels)} channels from M3U")
        return channels
    
    async def load_m3u_from_url(self, url: str, source_id: str = "") -> List[IPTVChannel]:
        """Download and parse M3U playlist from URL."""
        try:
            client = await self._get_client()
            response = await client.get(url)
            response.raise_for_status()
            
            content = response.text
            return await self.parse_m3u(content, source_id)
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to load M3U from {url}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing M3U from {url}: {e}")
            return []
    
    async def load_m3u_from_file(self, file_path: str, source_id: str = "") -> List[IPTVChannel]:
        """Load and parse M3U playlist from local file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return await self.parse_m3u(content, source_id)
        except Exception as e:
            logger.error(f"Failed to load M3U from {file_path}: {e}")
            return []
    
    # ==================== EPG PARSING ====================
    
    def _parse_xmltv_time(self, time_str: str) -> Optional[datetime]:
        """Parse XMLTV time format: 20250211153000 +0000"""
        if not time_str:
            return None
        
        try:
            # Remove spaces and handle timezone
            time_str = time_str.strip()
            
            # Common formats
            formats = [
                '%Y%m%d%H%M%S %z',
                '%Y%m%d%H%M%S',
                '%Y-%m-%d %H:%M:%S',
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(time_str, fmt)
                except ValueError:
                    continue
            
            # Try parsing just the timestamp part
            match = re.match(r'(\d{14})', time_str)
            if match:
                return datetime.strptime(match.group(1), '%Y%m%d%H%M%S')
            
            return None
        except Exception:
            return None
    
    async def parse_epg(self, content: str) -> Dict[str, List[EPGProgram]]:
        """Parse XMLTV EPG content."""
        programs: Dict[str, List[EPGProgram]] = {}
        
        try:
            root = ET.fromstring(content)
            
            for programme in root.findall('.//programme'):
                channel_id = programme.get('channel', '')
                start_str = programme.get('start', '')
                end_str = programme.get('stop', '')
                
                start = self._parse_xmltv_time(start_str)
                end = self._parse_xmltv_time(end_str)
                
                if not start or not end or not channel_id:
                    continue
                
                # Extract program details
                title = programme.findtext('title', '')
                desc = programme.findtext('desc', '')
                category = programme.findtext('category', '')
                episode_title = programme.findtext('sub-title', '')
                
                # Extract episode info
                episode_num = programme.find('episode-num')
                season = None
                episode = None
                if episode_num is not None and episode_num.get('system') == 'xmltv_ns':
                    # Format: season.episode.part (0-indexed)
                    parts = episode_num.text.split('.')
                    if len(parts) >= 2:
                        try:
                            season = int(parts[0]) + 1
                            episode = int(parts[1]) + 1
                        except ValueError:
                            pass
                
                # Extract icon
                icon_elem = programme.find('icon')
                icon = icon_elem.get('src', '') if icon_elem is not None else ''
                
                # Extract rating
                rating_elem = programme.find('.//rating/value')
                rating = rating_elem.text if rating_elem is not None else ''
                
                program = EPGProgram(
                    channel_id=channel_id,
                    title=title,
                    start=start,
                    end=end,
                    description=desc,
                    category=category,
                    episode_title=episode_title,
                    season=season,
                    episode=episode,
                    icon=icon,
                    rating=rating,
                )
                
                if channel_id not in programs:
                    programs[channel_id] = []
                programs[channel_id].append(program)
            
            # Sort programs by start time
            for channel_id in programs:
                programs[channel_id].sort(key=lambda p: p.start)
            
            total = sum(len(p) for p in programs.values())
            logger.info(f"Parsed {total} programs for {len(programs)} channels")
            
        except ET.ParseError as e:
            logger.error(f"Failed to parse XMLTV EPG: {e}")
        except Exception as e:
            logger.error(f"Error parsing EPG: {e}")
        
        return programs
    
    async def load_epg_from_url(self, url: str) -> Dict[str, List[EPGProgram]]:
        """Download and parse EPG from URL."""
        try:
            client = await self._get_client()
            response = await client.get(url)
            response.raise_for_status()
            
            content = response.text
            return await self.parse_epg(content)
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to load EPG from {url}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error loading EPG from {url}: {e}")
            return {}
    
    # ==================== SOURCE MANAGEMENT ====================
    
    async def add_source(
        self,
        name: str,
        url: str,
        epg_url: str = "",
        auto_refresh: bool = True,
        refresh_interval: int = 24
    ) -> IPTVSource:
        """Add a new IPTV source."""
        source_id = hashlib.md5(f"{name}:{url}".encode()).hexdigest()[:12]
        
        source = IPTVSource(
            id=source_id,
            name=name,
            url=url,
            epg_url=epg_url,
            auto_refresh=auto_refresh,
            refresh_interval=refresh_interval,
        )
        
        self.sources[source_id] = source
        
        # Load channels from source
        await self.refresh_source(source_id)
        
        return source
    
    async def refresh_source(self, source_id: str) -> bool:
        """Refresh channels from a source."""
        source = self.sources.get(source_id)
        if not source:
            return False
        
        try:
            # Load channels
            channels = await self.load_m3u_from_url(source.url, source_id)
            
            # Update channels dict
            for channel in channels:
                self.channels[channel.id] = channel
            
            # Update source info
            source.channel_count = len(channels)
            source.last_refresh = datetime.now(timezone.utc).isoformat()
            
            # Load EPG if available
            if source.epg_url:
                epg_data = await self.load_epg_from_url(source.epg_url)
                self.epg_data.update(epg_data)
            
            logger.info(f"Refreshed source '{source.name}': {len(channels)} channels")
            return True
            
        except Exception as e:
            logger.error(f"Failed to refresh source '{source.name}': {e}")
            return False
    
    def remove_source(self, source_id: str) -> bool:
        """Remove an IPTV source."""
        if source_id in self.sources:
            del self.sources[source_id]
            # Note: channels from this source remain until full reload
            return True
        return False
    
    def list_sources(self) -> List[Dict[str, Any]]:
        """List all IPTV sources."""
        return [s.to_dict() for s in self.sources.values()]
    
    # ==================== CHANNEL MANAGEMENT ====================
    
    def list_channels(
        self,
        group: Optional[str] = None,
        favorites_only: bool = False,
        include_hidden: bool = False,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List channels with optional filters."""
        channels = list(self.channels.values())
        
        # Filter hidden
        if not include_hidden:
            channels = [c for c in channels if not c.is_hidden]
        
        # Filter by group
        if group:
            channels = [c for c in channels if c.group == group]
        
        # Filter favorites
        if favorites_only:
            channels = [c for c in channels if c.is_favorite]
        
        # Search
        if search:
            search_lower = search.lower()
            channels = [c for c in channels if search_lower in c.name.lower()]
        
        # Sort by group, then name
        channels.sort(key=lambda c: (c.group, c.name))
        
        return [c.to_dict() for c in channels]
    
    def get_channel(self, channel_id: str) -> Optional[Dict[str, Any]]:
        """Get channel by ID."""
        channel = self.channels.get(channel_id)
        return channel.to_dict() if channel else None
    
    def get_groups(self) -> List[str]:
        """Get list of unique channel groups."""
        groups = set(c.group for c in self.channels.values())
        return sorted(groups)
    
    def toggle_favorite(self, channel_id: str) -> bool:
        """Toggle favorite status for a channel."""
        channel = self.channels.get(channel_id)
        if channel:
            channel.is_favorite = not channel.is_favorite
            return True
        return False
    
    def toggle_hidden(self, channel_id: str) -> bool:
        """Toggle hidden status for a channel."""
        channel = self.channels.get(channel_id)
        if channel:
            channel.is_hidden = not channel.is_hidden
            return True
        return False
    
    # ==================== EPG QUERIES ====================
    
    def get_current_program(self, channel_id: str) -> Optional[Dict[str, Any]]:
        """Get currently playing program for a channel."""
        programs = self.epg_data.get(channel_id, [])
        now = datetime.now(timezone.utc)
        
        for program in programs:
            if program.start <= now <= program.end:
                return program.to_dict()
        
        return None
    
    def get_programs(
        self,
        channel_id: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get programs for a channel within time range."""
        programs = self.epg_data.get(channel_id, [])
        
        if start:
            programs = [p for p in programs if p.end > start]
        if end:
            programs = [p for p in programs if p.start < end]
        
        return [p.to_dict() for p in programs[:limit]]
    
    def get_epg_for_time(
        self,
        time: Optional[datetime] = None,
        channel_ids: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Get current program for multiple channels at a specific time."""
        if time is None:
            time = datetime.now(timezone.utc)
        
        result = {}
        
        channels_to_check = channel_ids or list(self.epg_data.keys())
        
        for channel_id in channels_to_check:
            programs = self.epg_data.get(channel_id, [])
            for program in programs:
                if program.start <= time <= program.end:
                    result[channel_id] = program.to_dict()
                    break
        
        return result
    
    # ==================== STREAM VALIDATION ====================
    
    async def check_stream(self, channel_id: str) -> Dict[str, Any]:
        """Check if a stream is accessible."""
        channel = self.channels.get(channel_id)
        if not channel:
            return {"success": False, "error": "Channel not found"}
        
        try:
            client = await self._get_client()
            
            # Try HEAD request first
            response = await client.head(channel.stream_url, timeout=10.0)
            
            if response.status_code == 200:
                channel.is_online = True
                channel.last_checked = datetime.now(timezone.utc).isoformat()
                return {
                    "success": True,
                    "status_code": 200,
                    "content_type": response.headers.get("content-type", ""),
                }
            elif response.status_code == 405:
                # Method not allowed, try GET with range
                response = await client.get(
                    channel.stream_url,
                    headers={"Range": "bytes=0-1"},
                    timeout=10.0
                )
                if response.status_code in [200, 206]:
                    channel.is_online = True
                    channel.last_checked = datetime.now(timezone.utc).isoformat()
                    return {"success": True, "status_code": response.status_code}
            
            channel.is_online = False
            channel.last_checked = datetime.now(timezone.utc).isoformat()
            return {"success": False, "status_code": response.status_code}
            
        except httpx.TimeoutException:
            channel.is_online = False
            channel.last_checked = datetime.now(timezone.utc).isoformat()
            return {"success": False, "error": "Timeout"}
        except Exception as e:
            channel.is_online = False
            channel.last_checked = datetime.now(timezone.utc).isoformat()
            return {"success": False, "error": str(e)}
    
    async def check_all_streams(self, batch_size: int = 10) -> Dict[str, Dict[str, Any]]:
        """Check all streams in batches."""
        results = {}
        channel_ids = list(self.channels.keys())
        
        for i in range(0, len(channel_ids), batch_size):
            batch = channel_ids[i:i + batch_size]
            tasks = [self.check_stream(cid) for cid in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for cid, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    results[cid] = {"success": False, "error": str(result)}
                else:
                    results[cid] = result
            
            # Small delay between batches
            await asyncio.sleep(0.5)
        
        return results
    
    # ==================== EXPORT ====================
    
    def export_m3u(
        self,
        channel_ids: Optional[List[str]] = None,
        include_hidden: bool = False
    ) -> str:
        """Export channels as M3U playlist."""
        lines = ["#EXTM3U"]
        
        channels = [
            self.channels[cid] for cid in (channel_ids or self.channels.keys())
            if cid in self.channels
        ]
        
        if not include_hidden:
            channels = [c for c in channels if not c.is_hidden]
        
        for channel in channels:
            # Build EXTINF line
            attrs = []
            if channel.tvg_id:
                attrs.append(f'tvg-id="{channel.tvg_id}"')
            if channel.tvg_name:
                attrs.append(f'tvg-name="{channel.tvg_name}"')
            if channel.logo:
                attrs.append(f'tvg-logo="{channel.logo}"')
            if channel.group:
                attrs.append(f'group-title="{channel.group}"')
            if channel.language:
                attrs.append(f'tvg-language="{channel.language}"')
            if channel.country:
                attrs.append(f'tvg-country="{channel.country}"')
            
            attr_str = " ".join(attrs)
            lines.append(f'#EXTINF:-1 {attr_str},{channel.name}')
            lines.append(channel.stream_url)
        
        return "\n".join(lines)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get IPTV statistics."""
        online_count = sum(1 for c in self.channels.values() if c.is_online is True)
        offline_count = sum(1 for c in self.channels.values() if c.is_online is False)
        unchecked_count = sum(1 for c in self.channels.values() if c.is_online is None)
        
        return {
            "total_sources": len(self.sources),
            "total_channels": len(self.channels),
            "total_groups": len(self.get_groups()),
            "favorites_count": sum(1 for c in self.channels.values() if c.is_favorite),
            "hidden_count": sum(1 for c in self.channels.values() if c.is_hidden),
            "online_count": online_count,
            "offline_count": offline_count,
            "unchecked_count": unchecked_count,
            "epg_channels": len(self.epg_data),
            "total_programs": sum(len(p) for p in self.epg_data.values()),
        }


# Global instance
_relish: Optional[RelishIPTV] = None


def get_relish() -> RelishIPTV:
    """Get or create the Relish IPTV manager."""
    global _relish
    if _relish is None:
        _relish = RelishIPTV()
    return _relish

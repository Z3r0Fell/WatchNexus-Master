"""
Potluck - WatchNexus Watch Party Service
Real-time synchronized playback with chat for group watching.
Everyone brings something to share - the ultimate viewing experience together.
"""

import asyncio
import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field, asdict
from fastapi import WebSocket, WebSocketDisconnect
import logging

logger = logging.getLogger(__name__)


@dataclass
class PartyMember:
    """Represents a member in a watch party."""
    user_id: str
    username: str
    websocket: WebSocket = field(repr=False)
    is_host: bool = False
    joined_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_ready: bool = False
    current_time: float = 0.0


@dataclass
class ChatMessage:
    """Chat message in a watch party."""
    id: str
    user_id: str
    username: str
    message: str
    timestamp: str
    message_type: str = "chat"  # chat, system, reaction


@dataclass
class Potluck:
    """Represents a potluck (watch party) session."""
    party_id: str
    host_id: str
    media_id: str
    media_title: str
    media_type: str  # movie, episode
    created_at: str
    
    # State
    is_playing: bool = False
    current_time: float = 0.0
    playback_rate: float = 1.0
    
    # Members (user_id -> PartyMember)
    members: Dict[str, PartyMember] = field(default_factory=dict)
    
    # Chat history (limited)
    chat_history: List[ChatMessage] = field(default_factory=list)
    max_chat_history: int = 100
    
    # Settings
    require_ready: bool = True
    sync_threshold: float = 2.0  # seconds
    
    def add_member(self, member: PartyMember):
        """Add a member to the party."""
        self.members[member.user_id] = member
    
    def remove_member(self, user_id: str) -> Optional[PartyMember]:
        """Remove a member from the party."""
        return self.members.pop(user_id, None)
    
    def get_member_count(self) -> int:
        """Get number of members."""
        return len(self.members)
    
    def add_chat_message(self, message: ChatMessage):
        """Add chat message with history limit."""
        self.chat_history.append(message)
        if len(self.chat_history) > self.max_chat_history:
            self.chat_history = self.chat_history[-self.max_chat_history:]
    
    def to_dict(self) -> dict:
        """Convert to dict for JSON serialization."""
        return {
            "party_id": self.party_id,
            "host_id": self.host_id,
            "media_id": self.media_id,
            "media_title": self.media_title,
            "media_type": self.media_type,
            "created_at": self.created_at,
            "is_playing": self.is_playing,
            "current_time": self.current_time,
            "playback_rate": self.playback_rate,
            "member_count": self.get_member_count(),
            "members": [
                {
                    "user_id": m.user_id,
                    "username": m.username,
                    "is_host": m.is_host,
                    "is_ready": m.is_ready,
                }
                for m in self.members.values()
            ],
            "require_ready": self.require_ready,
        }


class PotluckManager:
    """
    Manages all potluck (watch party) sessions.
    Handles WebSocket connections and synchronization.
    """
    
    def __init__(self):
        self.parties: Dict[str, Potluck] = {}
        self.user_party_map: Dict[str, str] = {}  # user_id -> party_id
    
    def generate_party_code(self) -> str:
        """Generate a short, readable party code."""
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No confusing chars
        code = "".join(chars[b % len(chars)] for b in uuid.uuid4().bytes[:6])
        return code
    
    async def create_party(
        self,
        host_id: str,
        host_username: str,
        media_id: str,
        media_title: str,
        media_type: str,
        websocket: WebSocket,
    ) -> Potluck:
        """Create a new watch party."""
        # Check if user is already in a party
        if host_id in self.user_party_map:
            old_party_id = self.user_party_map[host_id]
            await self.leave_party(host_id)
        
        party_id = self.generate_party_code()
        
        # Ensure unique code
        while party_id in self.parties:
            party_id = self.generate_party_code()
        
        party = Potluck(
            party_id=party_id,
            host_id=host_id,
            media_id=media_id,
            media_title=media_title,
            media_type=media_type,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        
        # Add host as first member
        host_member = PartyMember(
            user_id=host_id,
            username=host_username,
            websocket=websocket,
            is_host=True,
            is_ready=True,
        )
        party.add_member(host_member)
        
        self.parties[party_id] = party
        self.user_party_map[host_id] = party_id
        
        # Send system message
        await self._send_system_message(party, f"{host_username} created the watch party")
        
        logger.info(f"Watch party created: {party_id} by {host_username}")
        
        return party
    
    async def join_party(
        self,
        party_id: str,
        user_id: str,
        username: str,
        websocket: WebSocket,
    ) -> Optional[Potluck]:
        """Join an existing watch party."""
        party_id = party_id.upper()
        
        if party_id not in self.parties:
            return None
        
        # Leave any existing party
        if user_id in self.user_party_map:
            await self.leave_party(user_id)
        
        party = self.parties[party_id]
        
        member = PartyMember(
            user_id=user_id,
            username=username,
            websocket=websocket,
            is_host=False,
        )
        party.add_member(member)
        self.user_party_map[user_id] = party_id
        
        # Notify all members
        await self._broadcast_party_update(party)
        await self._send_system_message(party, f"{username} joined the party")
        
        # Send current state to new member
        await self._send_to_member(member, {
            "type": "sync",
            "is_playing": party.is_playing,
            "current_time": party.current_time,
            "playback_rate": party.playback_rate,
        })
        
        # Send chat history
        for msg in party.chat_history[-20:]:  # Last 20 messages
            await self._send_to_member(member, {
                "type": "chat",
                "message": asdict(msg),
            })
        
        logger.info(f"User {username} joined party {party_id}")
        
        return party
    
    async def leave_party(self, user_id: str) -> bool:
        """Leave current party."""
        if user_id not in self.user_party_map:
            return False
        
        party_id = self.user_party_map[user_id]
        party = self.parties.get(party_id)
        
        if not party:
            del self.user_party_map[user_id]
            return False
        
        member = party.remove_member(user_id)
        del self.user_party_map[user_id]
        
        if member:
            await self._send_system_message(party, f"{member.username} left the party")
        
        # If host left, transfer or close party
        if party.host_id == user_id:
            if party.members:
                # Transfer to next member
                new_host = next(iter(party.members.values()))
                new_host.is_host = True
                party.host_id = new_host.user_id
                await self._send_system_message(party, f"{new_host.username} is now the host")
            else:
                # Close empty party
                del self.parties[party_id]
                logger.info(f"Party {party_id} closed (empty)")
                return True
        
        await self._broadcast_party_update(party)
        
        return True
    
    async def handle_message(self, user_id: str, message: dict):
        """Handle incoming WebSocket message from user."""
        if user_id not in self.user_party_map:
            return
        
        party_id = self.user_party_map[user_id]
        party = self.parties.get(party_id)
        
        if not party:
            return
        
        member = party.members.get(user_id)
        if not member:
            return
        
        msg_type = message.get("type")
        
        if msg_type == "chat":
            # Chat message
            chat_msg = ChatMessage(
                id=str(uuid.uuid4()),
                user_id=user_id,
                username=member.username,
                message=message.get("message", "")[:500],  # Limit length
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            party.add_chat_message(chat_msg)
            
            await self._broadcast(party, {
                "type": "chat",
                "message": asdict(chat_msg),
            })
        
        elif msg_type == "reaction":
            # Emoji reaction
            await self._broadcast(party, {
                "type": "reaction",
                "user_id": user_id,
                "username": member.username,
                "emoji": message.get("emoji", "👍"),
            })
        
        elif msg_type == "ready":
            # Toggle ready state
            member.is_ready = message.get("ready", True)
            await self._broadcast_party_update(party)
        
        elif msg_type == "seek" and member.is_host:
            # Host seeking
            party.current_time = message.get("time", 0)
            await self._broadcast(party, {
                "type": "sync",
                "is_playing": party.is_playing,
                "current_time": party.current_time,
                "playback_rate": party.playback_rate,
            }, exclude=user_id)
        
        elif msg_type == "play" and member.is_host:
            # Host play/pause
            party.is_playing = True
            party.current_time = message.get("time", party.current_time)
            await self._broadcast(party, {
                "type": "sync",
                "is_playing": True,
                "current_time": party.current_time,
                "playback_rate": party.playback_rate,
            })
        
        elif msg_type == "pause" and member.is_host:
            # Host pause
            party.is_playing = False
            party.current_time = message.get("time", party.current_time)
            await self._broadcast(party, {
                "type": "sync",
                "is_playing": False,
                "current_time": party.current_time,
                "playback_rate": party.playback_rate,
            })
        
        elif msg_type == "time_update":
            # Member time update for sync checking
            member.current_time = message.get("time", 0)
            
            # Check if member is out of sync with host
            if party.is_playing and abs(member.current_time - party.current_time) > party.sync_threshold:
                # Send resync to this member
                await self._send_to_member(member, {
                    "type": "sync",
                    "is_playing": party.is_playing,
                    "current_time": party.current_time,
                    "playback_rate": party.playback_rate,
                    "resync": True,
                })
    
    async def _broadcast(self, party: Potluck, message: dict, exclude: str = None):
        """Broadcast message to all party members."""
        for member in party.members.values():
            if exclude and member.user_id == exclude:
                continue
            await self._send_to_member(member, message)
    
    async def _send_to_member(self, member: PartyMember, message: dict):
        """Send message to a specific member."""
        try:
            await member.websocket.send_json(message)
        except Exception as e:
            logger.debug(f"Failed to send to {member.username}: {e}")
    
    async def _broadcast_party_update(self, party: Potluck):
        """Broadcast party state update to all members."""
        await self._broadcast(party, {
            "type": "party_update",
            "party": party.to_dict(),
        })
    
    async def _send_system_message(self, party: Potluck, text: str):
        """Send system message to party."""
        msg = ChatMessage(
            id=str(uuid.uuid4()),
            user_id="system",
            username="System",
            message=text,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message_type="system",
        )
        party.add_chat_message(msg)
        
        await self._broadcast(party, {
            "type": "chat",
            "message": asdict(msg),
        })
    
    def get_party(self, party_id: str) -> Optional[Potluck]:
        """Get party by ID."""
        return self.parties.get(party_id.upper())
    
    def get_user_party(self, user_id: str) -> Optional[Potluck]:
        """Get party that user is in."""
        party_id = self.user_party_map.get(user_id)
        if party_id:
            return self.parties.get(party_id)
        return None
    
    def list_public_parties(self, limit: int = 20) -> List[dict]:
        """List public watch parties."""
        parties = []
        for party in self.parties.values():
            parties.append({
                "party_id": party.party_id,
                "media_title": party.media_title,
                "media_type": party.media_type,
                "member_count": party.get_member_count(),
                "is_playing": party.is_playing,
                "host": party.members.get(party.host_id, {}).username if party.host_id in party.members else "Unknown",
            })
        
        return sorted(parties, key=lambda x: x["member_count"], reverse=True)[:limit]


# Singleton instance
_potluck_manager: Optional[PotluckManager] = None

def get_potluck_manager() -> PotluckManager:
    """Get or create potluck manager instance."""
    global _potluck_manager
    if _potluck_manager is None:
        _potluck_manager = PotluckManager()
    return _potluck_manager

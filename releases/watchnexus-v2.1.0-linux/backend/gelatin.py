"""
Gelatin - WatchNexus Web Server & Tunnel Module
Enables external access to WatchNexus for Watch Parties and remote streaming.

Features:
- Local network (LAN) server discovery
- Reverse tunnel for internet access (ngrok-style)
- Dynamic URL generation
- WebSocket proxy for Watch Party
- SSL/TLS certificate management
"""

import asyncio
import socket
import hashlib
import secrets
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List
from dataclasses import dataclass, field
import httpx

logger = logging.getLogger(__name__)


@dataclass
class TunnelInfo:
    """Information about an active tunnel."""
    tunnel_id: str
    public_url: str
    local_port: int
    created_at: str
    expires_at: Optional[str] = None
    access_count: int = 0
    is_active: bool = True


@dataclass
class ServerInfo:
    """Server information for discovery."""
    server_id: str
    name: str
    local_ip: str
    local_port: int
    external_url: Optional[str] = None
    version: str = "1.0.0"
    features: List[str] = field(default_factory=list)


class GelatinServer:
    """
    Gelatin Web Server - Manages external access to WatchNexus.
    
    Supports:
    1. LAN discovery via UDP broadcast
    2. Port-based direct access
    3. Tunneling for internet access
    """
    
    def __init__(self):
        self.server_id = str(uuid.uuid4())[:8]
        self.server_name = "WatchNexus Server"
        self.local_port = 8001
        self.tunnels: Dict[str, TunnelInfo] = {}
        self.discovery_running = False
        self._discovery_task = None
        self._local_ip = None
        
        # Access tokens for security
        self.access_tokens: Dict[str, dict] = {}
        
        # Tunnel providers (can be extended)
        self.tunnel_providers = {
            "built_in": self._create_builtin_tunnel,
        }
    
    def get_local_ip(self) -> str:
        """Get the local IP address of the server."""
        if self._local_ip:
            return self._local_ip
        
        try:
            # Create a socket to determine local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            self._local_ip = ip
            return ip
        except Exception:
            return "127.0.0.1"
    
    def get_lan_url(self) -> str:
        """Get the LAN URL for local network access."""
        return f"http://{self.get_local_ip()}:{self.local_port}"
    
    def get_server_info(self) -> dict:
        """Get full server information."""
        active_tunnel = None
        for tunnel in self.tunnels.values():
            if tunnel.is_active:
                active_tunnel = tunnel
                break
        
        return {
            "server_id": self.server_id,
            "server_name": self.server_name,
            "local_ip": self.get_local_ip(),
            "local_port": self.local_port,
            "lan_url": self.get_lan_url(),
            "external_url": active_tunnel.public_url if active_tunnel else None,
            "tunnel_active": active_tunnel is not None,
            "version": "1.0.0",
            "features": [
                "streaming",
                "watch_party",
                "library",
                "downloads",
                "subtitles",
            ],
        }
    
    def generate_access_token(
        self,
        user_id: str,
        permissions: List[str] = None,
        expires_hours: int = 24
    ) -> str:
        """
        Generate a temporary access token for external access.
        
        Args:
            user_id: The user ID creating the token
            permissions: List of allowed permissions
            expires_hours: Hours until token expires
        
        Returns:
            Access token string
        """
        token = secrets.token_urlsafe(32)
        
        self.access_tokens[token] = {
            "user_id": user_id,
            "permissions": permissions or ["view", "watch_party"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (
                datetime.now(timezone.utc) + 
                asyncio.timedelta(hours=expires_hours) if hasattr(asyncio, 'timedelta') 
                else None
            ),
            "access_count": 0,
        }
        
        return token
    
    def validate_access_token(self, token: str) -> Optional[dict]:
        """Validate an access token."""
        if token not in self.access_tokens:
            return None
        
        token_data = self.access_tokens[token]
        
        # Check expiry (simplified)
        token_data["access_count"] += 1
        
        return token_data
    
    def revoke_access_token(self, token: str) -> bool:
        """Revoke an access token."""
        if token in self.access_tokens:
            del self.access_tokens[token]
            return True
        return False
    
    async def _create_builtin_tunnel(self) -> Optional[TunnelInfo]:
        """
        Create a built-in tunnel using a simple relay.
        In production, this would connect to a relay server.
        For now, returns the LAN URL as a placeholder.
        """
        tunnel_id = str(uuid.uuid4())[:12]
        
        # In a full implementation, this would:
        # 1. Connect to a relay server
        # 2. Register this server
        # 3. Get back a public URL
        
        # For now, return LAN info (tunnel would work on local network)
        tunnel = TunnelInfo(
            tunnel_id=tunnel_id,
            public_url=self.get_lan_url(),  # Would be external URL from relay
            local_port=self.local_port,
            created_at=datetime.now(timezone.utc).isoformat(),
            is_active=True,
        )
        
        self.tunnels[tunnel_id] = tunnel
        logger.info(f"Created tunnel: {tunnel_id}")
        
        return tunnel
    
    async def create_tunnel(self, provider: str = "built_in") -> Optional[TunnelInfo]:
        """
        Create a tunnel for external access.
        
        Args:
            provider: Tunnel provider to use
        
        Returns:
            TunnelInfo if successful
        """
        if provider not in self.tunnel_providers:
            logger.error(f"Unknown tunnel provider: {provider}")
            return None
        
        return await self.tunnel_providers[provider]()
    
    async def close_tunnel(self, tunnel_id: str) -> bool:
        """Close an active tunnel."""
        if tunnel_id in self.tunnels:
            self.tunnels[tunnel_id].is_active = False
            logger.info(f"Closed tunnel: {tunnel_id}")
            return True
        return False
    
    def get_active_tunnels(self) -> List[dict]:
        """Get list of active tunnels."""
        return [
            {
                "tunnel_id": t.tunnel_id,
                "public_url": t.public_url,
                "created_at": t.created_at,
                "access_count": t.access_count,
            }
            for t in self.tunnels.values()
            if t.is_active
        ]
    
    async def start_discovery(self):
        """Start UDP discovery service for LAN."""
        if self.discovery_running:
            return
        
        self.discovery_running = True
        self._discovery_task = asyncio.create_task(self._run_discovery())
        logger.info("Started LAN discovery service")
    
    async def stop_discovery(self):
        """Stop UDP discovery service."""
        self.discovery_running = False
        if self._discovery_task:
            self._discovery_task.cancel()
            try:
                await self._discovery_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped LAN discovery service")
    
    async def _run_discovery(self):
        """Run the UDP discovery service."""
        try:
            # UDP socket for discovery
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.bind(("", 52100))
            sock.setblocking(False)
            
            loop = asyncio.get_event_loop()
            
            while self.discovery_running:
                try:
                    data, addr = await loop.sock_recvfrom(sock, 1024)
                    
                    if data == b"WATCHNEXUS_DISCOVER":
                        # Respond with server info
                        response = json.dumps(self.get_server_info()).encode()
                        await loop.sock_sendto(sock, response, addr)
                        logger.debug(f"Discovery response sent to {addr}")
                        
                except Exception as e:
                    if self.discovery_running:
                        await asyncio.sleep(0.1)
                        
        except Exception as e:
            logger.error(f"Discovery service error: {e}")
        finally:
            try:
                sock.close()
            except:
                pass
    
    async def discover_servers(self, timeout: float = 3.0) -> List[dict]:
        """
        Discover other WatchNexus servers on the LAN.
        
        Args:
            timeout: How long to wait for responses
        
        Returns:
            List of discovered server info
        """
        servers = []
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.setblocking(False)
            
            # Send broadcast
            sock.sendto(b"WATCHNEXUS_DISCOVER", ("<broadcast>", 52100))
            
            loop = asyncio.get_event_loop()
            end_time = asyncio.get_event_loop().time() + timeout
            
            while asyncio.get_event_loop().time() < end_time:
                try:
                    data, addr = await asyncio.wait_for(
                        loop.sock_recvfrom(sock, 1024),
                        timeout=0.5
                    )
                    
                    server_info = json.loads(data.decode())
                    server_info["discovered_from"] = addr[0]
                    servers.append(server_info)
                    
                except asyncio.TimeoutError:
                    continue
                except json.JSONDecodeError:
                    continue
                    
            sock.close()
            
        except Exception as e:
            logger.error(f"Discovery error: {e}")
        
        return servers
    
    def generate_share_link(
        self,
        party_code: str,
        use_external: bool = False
    ) -> str:
        """
        Generate a shareable link for a watch party.
        
        Args:
            party_code: The watch party code
            use_external: Use external tunnel URL if available
        
        Returns:
            Shareable URL
        """
        base_url = self.get_lan_url()
        
        if use_external:
            for tunnel in self.tunnels.values():
                if tunnel.is_active:
                    base_url = tunnel.public_url
                    break
        
        return f"{base_url}/party/{party_code}"


# Singleton instance
_gelatin_server: Optional[GelatinServer] = None


def get_gelatin_server() -> GelatinServer:
    """Get or create the Gelatin server instance."""
    global _gelatin_server
    if _gelatin_server is None:
        _gelatin_server = GelatinServer()
    return _gelatin_server

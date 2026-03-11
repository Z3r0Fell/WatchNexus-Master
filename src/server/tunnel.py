"""
WatchNexus VPN Module (Tunnel)
Manages WireGuard VPN server and peer configurations.
"""
import uuid
import secrets
import base64
import json
from datetime import datetime, timezone
from typing import List, Dict, Optional
import logging
import subprocess
import io

logger = logging.getLogger("tunnel")


def _generate_wg_keypair():
    """Generate a mock WireGuard key pair."""
    private = base64.b64encode(secrets.token_bytes(32)).decode()
    public = base64.b64encode(secrets.token_bytes(32)).decode()
    return private, public


class VpnServer:
    def __init__(self):
        self.interface = "wg0"
        self.listen_port = 51820
        self.address = "10.0.0.1/24"
        self.dns = "1.1.1.1, 1.0.0.1"
        self.private_key, self.public_key = _generate_wg_keypair()
        self.endpoint = ""
        self.is_active = False
        self.is_configured = False
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.mtu = 1420
        self.post_up = ""
        self.post_down = ""

    def to_dict(self):
        return {
            "interface": self.interface,
            "listen_port": self.listen_port,
            "address": self.address,
            "dns": self.dns,
            "public_key": self.public_key,
            "endpoint": self.endpoint,
            "is_active": self.is_active,
            "is_configured": self.is_configured,
            "created_at": self.created_at,
            "mtu": self.mtu,
        }


class VpnPeer:
    def __init__(self, name: str, allowed_ips: str = "10.0.0.0/24"):
        self.id = str(uuid.uuid4())
        self.name = name
        self.private_key, self.public_key = _generate_wg_keypair()
        self.preshared_key = base64.b64encode(secrets.token_bytes(32)).decode()
        self.allowed_ips = allowed_ips
        self.address = ""
        self.is_active = True
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.last_handshake = None
        self.transfer_rx = 0
        self.transfer_tx = 0

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "public_key": self.public_key,
            "allowed_ips": self.allowed_ips,
            "address": self.address,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "last_handshake": self.last_handshake,
            "transfer_rx": self.transfer_rx,
            "transfer_tx": self.transfer_tx,
        }

    def get_client_config(self, server: VpnServer):
        return f"""[Interface]
PrivateKey = {self.private_key}
Address = {self.address}
DNS = {server.dns}
MTU = {server.mtu}

[Peer]
PublicKey = {server.public_key}
PresharedKey = {self.preshared_key}
AllowedIPs = 0.0.0.0/0
Endpoint = {server.endpoint}:{server.listen_port}
PersistentKeepalive = 25
"""


class VpnModule:
    """Tunnel VPN module for WireGuard management."""

    def __init__(self):
        self.server = VpnServer()
        self.peers: List[VpnPeer] = []
        self.connection_logs: List[dict] = []
        self._next_ip = 2  # 10.0.0.2, 10.0.0.3, etc.

    def setup_server(self, listen_port: int = 51820, address: str = "10.0.0.1/24",
                     dns: str = "1.1.1.1", endpoint: str = "", mtu: int = 1420):
        self.server.listen_port = listen_port
        self.server.address = address
        self.server.dns = dns
        self.server.endpoint = endpoint
        self.server.mtu = mtu
        self.server.is_configured = True
        logger.info(f"VPN server configured: {address}:{listen_port}")
        return self.server

    def activate(self):
        self.server.is_active = True
        self._log_connection("server_activated", "VPN server activated")
        return self.server

    def deactivate(self):
        self.server.is_active = False
        self._log_connection("server_deactivated", "VPN server deactivated")
        return self.server

    def add_peer(self, name: str, allowed_ips: str = "10.0.0.0/24"):
        peer = VpnPeer(name, allowed_ips)
        peer.address = f"10.0.0.{self._next_ip}/32"
        self._next_ip += 1
        self.peers.append(peer)
        self._log_connection("peer_added", f"Peer '{name}' added")
        return peer

    def remove_peer(self, peer_id: str):
        self.peers = [p for p in self.peers if p.id != peer_id]
        self._log_connection("peer_removed", f"Peer {peer_id} removed")

    def toggle_peer(self, peer_id: str):
        for peer in self.peers:
            if peer.id == peer_id:
                peer.is_active = not peer.is_active
                return peer
        return None

    def get_peer_qr_data(self, peer_id: str):
        """Generate QR code data for a peer's config."""
        peer = next((p for p in self.peers if p.id == peer_id), None)
        if not peer:
            return None
        config = peer.get_client_config(self.server)
        try:
            import qrcode
            qr = qrcode.QRCode(box_size=10, border=4)
            qr.add_data(config)
            qr.make(fit=True)
            buf = io.BytesIO()
            qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
            return base64.b64encode(buf.getvalue()).decode()
        except ImportError:
            return base64.b64encode(config.encode()).decode()

    def wg_status(self):
        """Get WireGuard status (mock)."""
        return {
            "interface": self.server.interface,
            "is_running": self.server.is_active,
            "listen_port": self.server.listen_port,
            "public_key": self.server.public_key,
            "peers_connected": sum(1 for p in self.peers if p.is_active),
            "total_peers": len(self.peers),
        }

    def get_stats(self):
        return {
            "server_active": self.server.is_active,
            "server_configured": self.server.is_configured,
            "total_peers": len(self.peers),
            "active_peers": sum(1 for p in self.peers if p.is_active),
            "total_rx": sum(p.transfer_rx for p in self.peers),
            "total_tx": sum(p.transfer_tx for p in self.peers),
        }

    def get_connection_logs(self, page: int = 1, page_size: int = 50):
        total = len(self.connection_logs)
        start = (page - 1) * page_size
        return {
            "logs": self.connection_logs[start:start + page_size],
            "total": total,
            "page": page,
        }

    def _log_connection(self, event: str, details: str):
        self.connection_logs.insert(0, {
            "id": str(uuid.uuid4()),
            "event": event,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        if len(self.connection_logs) > 5000:
            self.connection_logs = self.connection_logs[:5000]


# Singleton
_vpn_module = None

def get_vpn_module() -> VpnModule:
    global _vpn_module
    if _vpn_module is None:
        _vpn_module = VpnModule()
    return _vpn_module

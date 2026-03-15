# Tunnel - VPN Portal

WireGuard VPN management module for WatchNexus.

## Features
- VPN server configuration
- Peer creation and management
- Client config generation with QR codes
- WireGuard interface control
- Connection statistics

## API Routes
- `GET|POST /api/vpn/server` - Server configuration
- `POST /api/vpn/server/activate|deactivate` - Server control
- `GET|POST|PUT|DELETE /api/vpn/peers` - Peer management
- `GET /api/vpn/peers/{id}/qr-data` - QR code for client config
- `POST /api/vpn/server/wg-up|wg-down` - WireGuard interface
- `GET /api/vpn/stats` - VPN statistics

## Note
WireGuard must be installed on the host system for full functionality.
In development, operations are mocked.

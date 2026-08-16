# Lobster Mesh

Tailscale-based mesh networking module for WatchNexus.

## Architecture

- **Sidecar** (`lobster-sidecar/`) — Go binary embedding `tsnet` (Tailscale's userspace networking library). Handles WireGuard encryption, NAT traversal, DERP relay fallback, and coordination with Headscale.
- **.NET Module** (`src/watchnexus/modules/lobster/`) — Background service that supervises the Go sidecar process and exposes a local control API to the rest of the WatchNexus backend.
- **Coordination Server** (`lobster-coordination/`) — Self-hosted Headscale instance (open-source control plane replacement for Tailscale's hosted coordination server).
- **Relay** (`lobster-relay/`) — Self-hosted DERP relay for fallback when direct P2P hole-punching fails.

## Build Phases

1. **Spike** — Register two nodes against a local Headscale instance; confirm direct P2P tunnel forms and survives NAT.
2. **IPC Bridge** — Loopback control channel between `LobsterService.cs` and the sidecar (start/stop, status, peer list).
3. **Coordination Server** — Headscale on the VPS behind existing Nginx/TLS; pre-auth-key issuance tied to license/tier.
4. **Relay** — derper on the same VPS.
5. **Pairing UX** — QR-code / deep-link flow in the React frontend and mobile client.
6. **Data-plane wiring** — Route WatchNexus media API and stream traffic through the tsnet listener.
7. **Tier gating + telemetry** — Hook into Standard/Pro/Ultra; add connection-quality telemetry.

## Tier Gating

- `pro` — required for mesh networking features

## License

BSD-3-Clause (Tailscale client code) + MIT (wireguard-go). Redistribution and modification permitted with copyright notice retained.

# Lobster Mesh

Tailscale-based mesh networking module for WatchNexus.

## Architecture

- **Sidecar** (`lobster-sidecar/`) — Go binary embedding `tsnet` (Tailscale's userspace networking library). Handles WireGuard encryption, NAT traversal, DERP relay fallback, and coordination with Headscale.
- **.NET Module** (`src/watchnexus/modules/lobster/`) — Background service that supervises the Go sidecar process and exposes a local control API to the rest of the WatchNexus backend.
- **Coordination Server** (`lobster-coordination/`) — Self-hosted Headscale instance (open-source control plane replacement for Tailscale's hosted coordination server).
- **Relay** (`lobster-relay/`) — Self-hosted DERP relay for fallback when direct P2P hole-punching fails.

## Configuration

| Env | Meaning |
|---|---|
| `LOBSTER_CONTROL_URL` | Headscale coordination URL (required; unset = status `not_configured`) |
| `LOBSTER_AUTH_KEY` | Headscale pre-auth key for the first join (optional; otherwise the page shows a login URL) |
| `LOBSTER_HOSTNAME` | Tailnet hostname (default `watchnexus-<hostname>`) |
| `LOBSTER_SIDECAR_PORT` | Loopback control API port (default 19091) |
| `LOBSTER_UPSTREAM_HOST` | Override the address the sidecar uses to reach the app |

The sidecar keeps its state, and a per-install control key (`control.key`,
0600), in `$WATCHNEXUS_DATA_DIR/lobster`. `LobsterService` restarts it with
exponential backoff (1s up to 5 min) if it exits.

`GET /api/lobster/status` returns the sidecar status (`running`, `starting`,
`needs_login`, `needs_machine_auth`, `stopped`) or, when the sidecar is not
available, `not_configured` / `not_installed` / `sidecar_starting` with a
`message`.

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

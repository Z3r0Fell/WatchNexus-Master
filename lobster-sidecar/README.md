# Lobster Sidecar

Go binary embedding Tailscale's `tsnet` library. It joins a self-hosted
Headscale tailnet and exposes the local WatchNexus server (API, streams and
web UI on one port) to devices on that tailnet. It is spawned and supervised by
`LobsterService` in the WatchNexus backend; it is not meant to be run by hand
in production.

## Build

```bash
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o watchnexus-lobster .
go vet ./... && go test ./...
```

The Docker image builds it in a `golang` stage and installs it at
`/app/lobster-sidecar/watchnexus-lobster`.

## Configuration

| Flag | Env | Default |
|---|---|---|
| `-control-url` | `LOBSTER_CONTROL_URL` | none (node reports `not_configured`) |
| `-auth-key` | `LOBSTER_AUTH_KEY` (preferred) | none (node needs interactive login) |
| `-state-dir` | `LOBSTER_STATE_DIR` | `$WATCHNEXUS_DATA_DIR/lobster` |
| `-app-port` | `WATCHNEXUS_PORT` | `8001` |
| `-control-port` | `LOBSTER_SIDECAR_PORT` | `19091` (loopback only) |
| `-hostname` | `LOBSTER_HOSTNAME` | `watchnexus-<hostname>` |
| `-upstream-host` | `LOBSTER_UPSTREAM_HOST` | first non-loopback local address |
| `-control-key-file` | `LOBSTER_CONTROL_KEY` | required, no default |
| `-tailnet-port` | | `80` |

The pre-auth key is only used for the first registration; afterwards the node
identity lives in the state dir. Node log upload to log.tailscale.com is
disabled.

Tailnet connections are forwarded to WatchNexus on a non-loopback local
address, so remote peers are never seen by the app as on-box (loopback)
callers. Set `LOBSTER_UPSTREAM_HOST=127.0.0.1` only if the app listens on
localhost alone and you accept that trade-off.

## Control API

Listens on `127.0.0.1:<control-port>`. Every endpoint except `/healthz`
requires `X-Control-Key` (compared in constant time).

- `GET /api/status` - node status from tsnet's LocalClient: `status`
  (`running`, `starting`, `needs_login`, `needs_machine_auth`, `stopped`,
  `not_configured`), `online`, `hostname`, `dns_name`, `tailnet_ip`,
  `tailnet_ips`, `connect_url`, `auth_url`, `health`, `peers`
- `GET /api/peers` - peers (`name`, `dns_name`, `tailnet_ip`, `os`, `online`, `last_seen`)
- `POST /api/start` - bring the node up (remembered across restarts)
- `POST /api/stop` - take the node down (identity is kept)
- `POST /api/pair` - what is needed to connect: the login URL while the node
  needs authorization, or the `connect_url` other tailnet devices use
- `GET /healthz` - unauthenticated liveness probe

Errors: `409` with `{error, message}` when not configured / not running,
`401` for a missing or wrong key, `405` for a wrong method.

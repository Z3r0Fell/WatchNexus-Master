# Lobster Sidecar

Go binary embedding Tailscale's `tsnet` library. Spawned and supervised by the WatchNexus .NET backend.

## Build

```bash
go build -o watchnexus-lobster .
```

## Usage

```bash
./watchnexus-lobster \
  -instance-id my-server \
  -auth-key <headscale-pre-auth-key> \
  -control-url https://coord.watchnexus.local \
  -control-port 19091 \
  -media-ports 8002:api,8003:stream
```

## Control API

The sidecar exposes a local HTTP control API on `127.0.0.1:<control-port>`:

- `GET /api/status` — Node status, tailnet IP, peers
- `POST /api/start` — Start the tsnet node
- `POST /api/stop` — Stop the tsnet node
- `GET /api/peers` — List connected peers
- `POST /api/pair` — Generate a pairing code

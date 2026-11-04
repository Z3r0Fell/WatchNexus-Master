# Lobster coordination server (Headscale)

Lobster gives a WatchNexus server remote access over a private tailnet. The
WatchNexus image ships the node (the `lobster-sidecar`); this directory is the
control plane it registers with: [Headscale](https://headscale.net) 0.29.7.
The optional DERP relay lives in `../lobster-relay/`.

## Deploy

Prerequisites: a VPS with Docker, a DNS name (e.g. `mesh.example.com`), and a
TLS reverse proxy on the host (Caddy, nginx, Traefik) forwarding to
`127.0.0.1:8080`. The proxy must pass WebSocket/`Upgrade` requests (Tailscale
clients use them on `/ts2021`).

1. Edit `config/config.yaml`: `dns.base_domain` (must differ from the server
   domain), and optionally `trusted_proxies` and `policy`.
2. Start it (Postgres):

   ```bash
   export HEADSCALE_SERVER_URL=https://mesh.example.com
   export HEADSCALE_DB_PASSWORD="$(openssl rand -hex 24)"   # keep it
   docker compose up -d
   ```

   or SQLite: `HEADSCALE_SERVER_URL=... docker compose -f docker-compose.sqlite.yml up -d`.
3. Check: `curl https://mesh.example.com/health` returns `{"status":"pass"}`.

Minimal Caddy site:

```
mesh.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

## Pre-auth keys (one Headscale user per customer)

```bash
docker exec lobster-headscale headscale users create customer-123
docker exec lobster-headscale headscale users list            # note the ID
docker exec lobster-headscale headscale preauthkeys create --user <ID> --expiration 24h
#   add --reusable to join several devices with the same key
```

Give the customer's WatchNexus server:

```
LOBSTER_CONTROL_URL=https://mesh.example.com
LOBSTER_AUTH_KEY=hskey-auth-...
```

The key is used only for the first registration; the node identity is then
kept in `$WATCHNEXUS_DATA_DIR/lobster`. Without a key, the node shows a login
URL in the Lobster page; approve it with
`headscale nodes register --user <user name> --key <key from the URL>`.

Other devices (phones, laptops) join the same user with the Tailscale app
pointed at the custom coordination server and a pre-auth key, then open the
server's tailnet address shown under "Pair a Device".

Useful commands: `headscale nodes list`, `headscale nodes expire -i <id>`,
`headscale nodes delete -i <id>`, `headscale preauthkeys list`.

## Security notes

- Never publish port 8080 directly; only the TLS proxy should reach it.
- With the default empty `policy.path`, all nodes can reach each other. For a
  shared multi-customer server, add an ACL policy that restricts each user to
  their own nodes.
- Back up the `headscale-data` (and Postgres) volumes: the noise private key
  identifies the server to every node.

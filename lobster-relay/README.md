# Lobster DERP relay

Fallback relay for Lobster peers that cannot connect directly. Tailscale does
not publish a derper image, so `Dockerfile` builds `tailscale.com/cmd/derper`
at the same version as the sidecar.

```bash
export DERP_HOSTNAME=relay.example.com              # public DNS name, ports 80/443/3478udp open
export HEADSCALE_VERIFY_URL=https://mesh.example.com/verify
docker compose up -d --build
```

- TLS: Let's Encrypt (HTTP-01 on port 80), certs kept in the `derper-certs` volume.
- Only nodes registered on your Headscale can relay: derper asks Headscale's
  `/verify` endpoint and fails closed if it is unreachable.
- Then enable it in Headscale: copy `../lobster-coordination/config/derp.yaml.example`
  to `derp.yaml`, set the hostname, add `/etc/headscale/derp.yaml` to
  `derp.paths`, and restart Headscale.

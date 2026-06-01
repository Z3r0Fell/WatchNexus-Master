# WatchNexus Quick-Start

## Prerequisites

- Linux (systemd) or Docker
- .NET 10 runtime (for manual install)
- Media files in a readable directory

## Install (systemd)

```bash
# Extract release tarball
tar xzf watchnexus-v1.0.0-linux-x64.tar.gz -C /opt/watchnexus

# Install systemd service
sudo cp build/packaging/fpm/service/watchnexus.service /etc/systemd/system/

# (Optional) restrict the service to a specific user for sandboxing
# Edit /etc/systemd/system/watchnexus.service and add:
#   User=your-username
#   Group=your-group
# Then uncomment any hardening directives as needed.

sudo systemctl daemon-reload

# Set required env vars
export JWT_SECRET="your-32-char-secret"
export TMDB_API_KEY="your-tmdb-key"

# Start service
sudo systemctl start watchnexus
```

**Note:** By default the service runs as root with full filesystem access, so any directory visible to the OS is visible to WatchNexus. If you want to sandbox it, set `User=` in the service unit.

## Install (Docker)

```bash
docker run -d \
  -p 8001:8001 \
  -e JWT_SECRET="your-32-char-secret" \
  -e TMDB_API_KEY="your-tmdb-key" \
  -v /path/to/media:/media \
  ghcr.io/z3r0fell/watchnexus:latest
```

## Required Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | 32+ char random string for JWT signing |
| `TMDB_API_KEY` | Yes | — | TMDB API key (themoviedb.org) |
| `LICENSE_SERVER_URL` | No | `https://licenses.watchnexus.ca` | License server URL |
| `LICENSE_SERVER_API_KEY` | No | — | License server API auth |
| `ALLOWED_ORIGINS` | No | `http://localhost:8001` | CORS origins (comma-separated) |

## First-Time Setup

1. Open http://localhost:8001 in your browser
2. Register the admin account at `/setup`
3. Add a media library at `/library-manager`
4. (Optional) Configure gadgets at `/settings`

## Default Credentials

**No default credentials.** The first user to register via the setup wizard becomes the admin.

## Media Directory

The service runs as the `watchnexus` system user. Media directories must be readable by this user:

```bash
sudo mkdir -p /var/lib/watchnexus/media
sudo chown -R watchnexus:watchnexus /var/lib/watchnexus/media
```

Place your media in `/var/lib/watchnexus/media/` or another directory the service can access.

## Verifying the Install

```bash
curl http://localhost:8001/api/health
# {"status":"healthy","version":"1.0.0"}
```

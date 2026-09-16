<!--
  WatchNexus — Production README
  Ships in the repository and inside the Docker image.
-->

<p align="center">
  <img src="build/installbuilder/resources/watchnexus-logo.png" alt="WatchNexus" width="220">
</p>

<h1 align="center">WatchNexus</h1>

<p align="center">
  <strong>Release To Public — RTP v1.0.4</strong><br>
  A unified, self-hosted media server with tier-locked module licensing.
</p>

<p align="center">
  <a href="https://watchnexus.ca">Website</a> ·
  <a href="https://docs.watchnexus.ca">Documentation</a> ·
  <a href="https://licenses.watchnexus.ca">License Portal</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="docs/API.md">API Reference</a>
</p>

---

## What is WatchNexus?

WatchNexus is a C#/.NET 10 + React 19 media server that consolidates the
*arr stack, Jellyfin-style playback, Jellyseerr-style discovery, retro
gaming, ebook/audiobook management, live-TV DVR, hardware transcoding,
and cloud sync into **one cohesive product**. It is licensed in three
tiers — **Standard**, **Pro**, **Ultra** — delivered as tier-specific
Docker images so a Standard install never ships Pro/Ultra binaries.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WatchNexus Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │   React 19   │◄──►│  ASP.NET 10  │◄──►│    SQLite (WAL)      │   │
│  │   Frontend   │    │   Backend    │    │   + EF Core 9        │   │
│  │  (SPA + PWA) │    │  (REST + WS) │    │  Encryption-at-rest  │   │
│  └──────────────┘    └──────┬───────┘    └──────────────────────┘   │
│                             │                                        │
│                    ┌────────┴────────┐                               │
│                    │  Module System  │                               │
│                    │  (73 modules)   │                               │
│                    └────────┬────────┘                               │
│                             │                                        │
│         ┌───────────────────┼───────────────────┐                    │
│         ▼                   ▼                   ▼                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Standard  │    │     Pro     │    │    Ultra    │              │
│  │   (31 mod)  │    │  (+18 = 49) │    │  (+24 = 73) │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │              Fortress Protocol (Integrity)                   │     │
│  │  SHA-256 manifest • Runtime verification • Signed updates   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │              License Server (licenses.watchnexus.ca)         │     │
│  │  Tier validation • Seat management • Update manifests       │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tier Comparison

| Feature | Standard (Free) | Pro | Ultra |
|---------|-----------------|-----|-------|
| **Core Media Library** | ✅ | ✅ | ✅ |
| **Movies / TV / Anime / Music / Audiobooks** | ✅ | ✅ | ✅ |
| **Playlists & Collections** | ✅ | ✅ | ✅ |
| **Search & Discovery (TMDB)** | ✅ | ✅ | ✅ |
| **Weather / Podcasts / Radio / Photos / Web Video** | ✅ | ✅ | ✅ |
| **Scrobbling (Trakt/Last.fm)** | ✅ | ✅ | ✅ |
| **Theme Forge & Marketplace** | ✅ | ✅ | ✅ |
| **Help & Documentation** | ✅ | ✅ | ✅ |
| **Basic Settings** | ✅ | ✅ | ✅ |
| **Download Clients (qBittorrent/SABnzbd/NZBGet)** | ❌ | ✅ | ✅ |
| **Indexer Automation (Sonarr/Radarr/Prowlarr)** | ❌ | ✅ | ✅ |
| **Subtitle Management** | ❌ | ✅ | ✅ |
| **Live TV / DVR (IPTV)** | ❌ | ✅ | ✅ |
| **Watch Analytics (Year Wrapped)** | ❌ | ✅ | ✅ |
| **User Requests (Meringue/Parfait/Menu)** | ❌ | ✅ | ✅ |
| **RSS Feeds (Sprout)** | ❌ | ✅ | ✅ |
| **Backups (Sourdough)** | ❌ | ✅ | ✅ |
| **Hardware Transcoding (NVENC/QSV/VAAPI/AMF/VideoToolbox)** | ❌ | ❌ | ✅ |
| **Disc Ripping (Strudel - MakeMKV/HandBrake)** | ❌ | ❌ | ✅ |
| **Security Suite (Bastion 2FA, IP Rules, Audit)** | ❌ | ❌ | ✅ |
| **VPN Manager (Tunnel - WireGuard)** | ❌ | ❌ | ✅ |
| **Parental Controls (Rind)** | ❌ | ❌ | ✅ |
| **Notification Hub (Pepper - Discord/Telegram/Slack/Pushover)** | ❌ | ❌ | ✅ |
| **Media Processing (Crucible - FFmpeg Pipeline)** | ❌ | ❌ | ✅ |
| **Retro Gaming (Pretzel)** | ❌ | ❌ | ✅ |
| **Ebooks/Audiobooks/Comics (Biscotti/Treacle)** | ❌ | ❌ | ✅ |
| **AI Metadata (Sage)** | ❌ | ❌ | ✅ |
| **Jellyfin/Emby Bridge (Custard)** | ❌ | ❌ | ✅ |
| **Matrix/Synapse Integration** | ❌ | ❌ | ✅ |
| **Usenet (Brine/Ladle)** | ❌ | ❌ | ✅ |
| **Offline Sync (Popsicle)** | ❌ | ❌ | ✅ |
| **S3/Cloud Backup (Preserves)** | ❌ | ❌ | ✅ |
| **Cloud Sync (Marshmallow)** | ❌ | ❌ | ✅ |
| **Media Sync (Chowder)** | ❌ | ❌ | ✅ |
| **Watch Party** | ❌ | ❌ | ✅ |
| **Lobster Mesh (Tailscale P2P)** | ❌ | ❌ | ✅ |
| **Background Automation (Yeast Bot)** | ❌ | ❌ | ✅ |

**Total Modules:** 31 | 49 | 73

Complete module matrix: [`docs/TIER-MANIFESTS.md`](docs/TIER-MANIFESTS.md)

---

## Quick Start

### Docker (Recommended)

```bash
# Standard (Free)
docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v watchnexus-data:/app/data \
  -v /path/to/media:/data/media \
  -e WATCHNEXUS_TIER=standard \
  -e TZ=America/Toronto \
  watchnexus/watchnexus:1.0.4-standard

# Pro
docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v watchnexus-data:/app/data \
  -v /path/to/media:/data/media \
  -v /path/to/rips:/data/rips \
  -e WATCHNEXUS_TIER=pro \
  -e TZ=America/Toronto \
  -e LICENSE_SERVER_API_KEY=your_api_key \
  watchnexus/watchnexus:1.0.4-pro

# Ultra (with GPU)
docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v watchnexus-data:/app/data \
  -v /path/to/media:/data/media \
  -v /path/to/rips:/data/rips \
  -v /path/to/transcoded:/data/transcoded \
  -v /path/to/offline:/data/offline \
  -e WATCHNEXUS_TIER=ultra \
  -e TZ=America/Toronto \
  -e LICENSE_SERVER_API_KEY=your_api_key \
  --gpus all \
  watchnexus/watchnexus:1.0.4-ultra
```

**Docker Compose (Multi-Tier):**
```bash
# Standard
docker compose --profile standard up -d

# Pro
docker compose --profile pro up -d

# Ultra
docker compose --profile ultra up -d
```

### Docker-Only Distribution

> Native `.deb` / `.rpm` / `.pkg.tar.zst` / Windows `.exe` installers
> and AppImages are **discontinued**. Docker is the only installation and
> release channel (business decision, 2026-09-16). Updates are delivered
> by re-pulling the image tag: `docker pull watchnexus/watchnexus:<version>-<tier>`.

### macOS / Windows (via Docker)

```bash
docker run -d --name watchnexus \
  -p 8001:8001 \
  -v watchnexus-data:/app/data \
  -v /path/to/media:/data/media \
  -e WATCHNEXUS_TIER=standard \
  watchnexus/watchnexus:1.0.4-standard
```

### Unraid / TrueNAS / CasaOS / HexOS / Portainer / Synology

Community-store templates are generated at release time via
`build/build-installers.fish` (all Docker/compose based). Unraid users:
Community Apps → Search "WatchNexus" → Install.

---

## First-Launch Checklist

1. Open `http://<host>:8001` in your browser.
2. Complete the setup wizard: create your admin account.
3. **Activate your license key** (Standard / Pro / Ultra) from [licenses.watchnexus.ca](https://licenses.watchnexus.ca).
4. **Settings → Libraries** → Add at least one media root (e.g., `/data/media/Movies`).
5. **Settings → Integrations** → Paste your **TMDB v3 API key** (required for metadata).
6. **Settings → System** → Confirm Fortress integrity status is **Green**.
7. *(Pro/Ultra only)* **Settings → Download Clients** → Connect Churro to qBittorrent / SABnzbd / NZBGet.
8. *(Ultra only)* **Settings → Security** → Enable Bastion 2FA.

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WATCHNEXUS_TIER` | Yes | `standard` | Tier: `standard`, `pro`, `ultra` |
| `WATCHNEXUS_PORT` | No | `8001` | HTTP port to bind |
| `WATCHNEXUS_DATA_DIR` | No | Platform-specific | Data directory (DB, logs, keys) |
| `ASPNETCORE_ENVIRONMENT` | No | `Production` | `Development`/`Production` |
| `TZ` | No | `UTC` | Timezone (e.g., `America/Toronto`) |
| `LICENSE_SERVER_URL` | No | `https://licenses.watchnexus.ca` | License server endpoint |
| `LICENSE_SERVER_API_KEY` | Pro/Ultra | Built-in | API key for license validation |
| `TMDB_API_KEY` | Recommended | — | TMDB v3 API key for metadata |
| `JWT_SECRET` | No | Auto-generated | 32+ char signing secret (set for consistency) |
| `ALLOWED_ORIGINS` | No | `localhost` | CORS origins (comma-separated) |
| `TRUSTED_PROXY_IPS` | Behind proxy | — | CIDR ranges for X-Forwarded-* headers |
| `FORCE_HTTPS` | Behind TLS proxy | `false` | Enable HSTS header |
| `MEDIA_ROOTS` | No | `/data/media` | Allowed media root paths (comma-separated) |
| `WATCHNEXUS_SEED_ADMIN_EMAIL` | Headless | — | Pre-seed admin email (CI) |
| `WATCHNEXUS_SEED_ADMIN_PASSWORD` | Headless | — | Pre-seed admin password (CI) |

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `appsettings.json` | App root / `/app` | Base configuration (committed, no secrets) |
| `appsettings.Production.json` | App root (gitignored) | Production overrides (secrets) |
| `docker-compose.yml` | Repo root | Multi-tier container orchestration |
| `Dockerfile` | Repo root | Multi-stage build (standard/pro/ultra) |

### Data Directory Layout

| Path | Purpose |
|------|---------|
| `/var/lib/watchnexus/` | Database, thumbnails, transcode cache (Linux/Docker) |
| `/var/lib/watchnexus/data` | Persistent user data |
| `%PROGRAMDATA%\WatchNexus` | Same, on Windows |
| `/opt/watchnexus/` | Installed binaries (Linux) |
| `C:\Program Files\WatchNexus\` | Installed binaries (Windows) |

**Backup:** Back up `/var/lib/watchnexus/data` regularly — it captures all user state.

---

## Module System

WatchNexus uses a **tier-locked module architecture**:

- **Built-in modules** compiled into every tier binary
- **FortressFilter** enforces tier at API level (codename → tier mapping)
- **Module manifests** (`module.json`) declare tier, routes, version
- **External modules** (SDK) can be dropped into `/modules` directory

### Module SDK (Third-Party Development)

```bash
# Create module template
dotnet new watchnexus-module -n MyModule

# Module structure
MyModule/
├── module.json          # Manifest (tier, routes, version)
├── MyModule.csproj
├── MyModule.cs          # IModule implementation
├── Controllers/         # API controllers
└── Services/            # Background services
```

See [`docs/PLUGIN-DEVELOPMENT-GUIDE.md`](docs/PLUGIN-DEVELOPMENT-GUIDE.md) and [`src/watchnexus/module-sdk/`](src/watchnexus/module-sdk/).

---

## License Activation

WatchNexus validates tier via the license server at `https://licenses.watchnexus.ca`.

### Activation Flow

```
┌─────────────┐     POST /api/integrate/activate     ┌──────────────────┐
│  WatchNexus │ ──────────────────────────────────► │  License Server  │
│   Instance  │ ◄────────────────────────────────── │  (WN-License)    │
└─────────────┘     { plan: "pro", tier: "pro" }    └──────────────────┘
```

### License Key Format

```
WNX-PRO-XXXX-XXXX-XXXX   # Pro tier (22 chars)
WNX-ULT-XXXX-XXXX-XXXX   # Ultra tier
WNX-STD-XXXX-XXXX-XXXX   # Standard tier
```

### Offline / Air-Gapped Activation

If the license server is unreachable, WatchNexus falls back to **format-based validation** (prefix `WNX-PRO-`/`WNX-ULT-`/`WNX-STD-`). Full server validation runs on next connectivity.

### Seat Management

- **Standard:** Unlimited seats
- **Pro:** 3 concurrent seats
- **Ultra:** 10 concurrent seats

Exceeding seats returns `403 Seat limit exceeded` — revoke unused seats in the license portal.

---

## API Documentation

Full OpenAPI specification: [`docs/API.md`](docs/API.md)

### Authentication

- **Primary:** `wn_token` httpOnly cookie (set on login)
- **Alternative:** `Authorization: Bearer <jwt>` header
- **CSRF:** Double-submit cookie (`csrf_token` + `X-CSRF-Token` header)

### Tier Enforcement

Every mutating endpoint is guarded by `FortressFilter` which validates the license tier against the endpoint's required module codename.

```csharp
// Example: Pro-only endpoint
[HttpPost("automation")]
[ModuleGate("fondue")]  // Requires Pro tier
public IActionResult CreateAutomation(...)
```

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| Auth (`/api/auth/*`) | 10 req/min/IP |
| License activation | 5 req/5 min/IP |
| All mutations (POST/PUT/DELETE) | 120 req/min/IP |
| Media streaming (GET) | Unlimited |

### Error Response Format

```json
{
  "detail": "Human-readable error message",
  "code": "ERROR_CODE",
  "status": 400,
  "traceId": "optional-correlation-id"
}
```

---

## Deployment Configurations

### Reverse Proxy (Caddy - Recommended)

```caddy
# Caddyfile
watchnexus.yourdomain.com {
    encode zstd gzip
    reverse_proxy localhost:8001 {
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Host {host}
    }
    
    # WebSocket for WatchParty
    @websockets {
        path /api/watch-party/*/ws
    }
    reverse_proxy @websockets localhost:8001 {
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection "upgrade"
    }
}
```

### Reverse Proxy (nginx)

```nginx
# /etc/nginx/sites-available/watchnexus
server {
    listen 443 ssl http2;
    server_name watchnexus.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    client_max_body_size 50G;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache off;
    }

    # Health check endpoint (no auth)
    location /api/health {
        proxy_pass http://localhost:8001;
        access_log off;
    }
}
```

**Enable in nginx:**
```bash
sudo ln -s /etc/nginx/sites-available/watchnexus /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Systemd Service (Native Linux)

```ini
# /etc/systemd/system/watchnexus.service
[Unit]
Description=WatchNexus Media Server
After=network.target
Wants=network-online.target

[Service]
Type=notify
User=watchnexus
Group=watchnexus
WorkingDirectory=/opt/watchnexus
ExecStart=/opt/watchnexus/WatchNexus.Core --tray
Restart=on-failure
RestartSec=5
TimeoutStartSec=60
TimeoutStopSec=30

# Environment
Environment=WATCHNEXUS_TIER=standard
Environment=WATCHNEXUS_PORT=8001
Environment=WATCHNEXUS_DATA_DIR=/var/lib/watchnexus
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_GCServer=1
Environment=DOTNET_GCConcurrent=1

# Security
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/watchnexus /data/media /data/rips /data/transcoded /data/offline
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=watchnexus

[Install]
WantedBy=multi-user.target
```

**Enable:**
```bash
sudo useradd -r -s /bin/false -d /var/lib/watchnexus watchnexus
sudo mkdir -p /var/lib/watchnexus /data/media /data/rips
sudo chown -R watchnexus:watchnexus /var/lib/watchnexus /data/media /data/rips
sudo systemctl daemon-reload
sudo systemctl enable --now watchnexus
```

### Kubernetes Manifests

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: watchnexus
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: watchnexus-config
  namespace: watchnexus
data:
  WATCHNEXUS_TIER: "ultra"
  WATCHNEXUS_PORT: "8001"
  ASPNETCORE_ENVIRONMENT: "Production"
  TZ: "America/Toronto"
  LICENSE_SERVER_URL: "https://licenses.watchnexus.ca"
---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: watchnexus-secrets
  namespace: watchnexus
type: Opaque
stringData:
  LICENSE_SERVER_API_KEY: "your-api-key"
  TMDB_API_KEY: "your-tmdb-key"
  JWT_SECRET: "your-96-char-hex-secret"
---
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: watchnexus-data
  namespace: watchnexus
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: watchnexus
  namespace: watchnexus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: watchnexus
  template:
    metadata:
      labels:
        app: watchnexus
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        runAsNonRoot: true
      containers:
        - name: watchnexus
          image: watchnexus/watchnexus:1.0.4-ultra
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8001
              name: http
          envFrom:
            - configMapRef:
                name: watchnexus-config
            - secretRef:
                name: watchnexus-secrets
          volumeMounts:
            - name: data
              mountPath: /app/data
            - name: media
              mountPath: /data/media
            - name: rips
              mountPath: /data/rips
            - name: transcoded
              mountPath: /data/transcoded
            - name: offline
              mountPath: /data/offline
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "4000m"
              memory: "4Gi"
              nvidia.com/gpu: 1  # Ultra tier GPU
          livenessProbe:
            httpGet:
              path: /api/health
              port: 8001
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health
              port: 8001
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: watchnexus-data
        - name: media
          hostPath:
            path: /mnt/media
            type: Directory
        - name: rips
          hostPath:
            path: /mnt/rips
            type: Directory
        - name: transcoded
          hostPath:
            path: /mnt/transcoded
            type: Directory
        - name: offline
          hostPath:
            path: /mnt/offline
            type: Directory
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: watchnexus
  namespace: watchnexus
spec:
  type: ClusterIP
  ports:
    - port: 8001
      targetPort: 8001
      protocol: TCP
      name: http
  selector:
    app: watchnexus
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: watchnexus
  namespace: watchnexus
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/proxy-body-size: "50G"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/websocket-services: "watchnexus"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - watchnexus.yourdomain.com
      secretName: watchnexus-tls
  rules:
    - host: watchnexus.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: watchnexus
                port:
                  number: 8001
```

**Deploy:**
```bash
kubectl apply -f k8s/
```

---

## Upgrading

Updates flow from the license server:

- **In-app:** Settings → Updates → Check Now
- **Docker:** `docker compose pull && docker compose up -d` (or `docker pull watchnexus/watchnexus:<version>-<tier>`)
- **Offline:** load a released tarball with `docker load -i watchnexus-<tier>-<version>-docker.tar`

The Fortress integrity manifest is re-validated after every upgrade.

---

## Building from Source

Requirements:
- .NET 10 SDK
- Node.js 22 + Yarn
- Docker (for container builds)

```bash
# Frontend
cd src/web && yarn install && yarn build

# Backend (all tiers)
dotnet publish src/watchnexus/core/WatchNexus.Core.csproj -c Release -o ./publish /p:SkipFrontendBuild=true

# Docker (multi-arch)
./build/docker-build.sh --push --multiarch

# Release support artifacts (community-hub templates, optional tarballs)
# See docs/BUILD-INSTALLERS.md
```

---

## Security

- **No default credentials** — first-launch wizard creates admin
- **Per-install JWT secrets** — generated on first boot, stored in data dir
- **Encryption-at-rest** — ASP.NET Core Data Protection for credential columns
- **Fortress Protocol** — SHA-256 binary manifest, runtime integrity checks
- **Signed updates** — RSA-signed update manifests verified on install
- **Non-root containers** — `watchnexus:watchnexus` user, read-only rootfs, dropped capabilities
- **CSP, HSTS, X-Frame-Options** — OWASP secure headers

Report security issues: `security@watchnexus.ca` (PGP key on website)

---

## Contributing

WatchNexus is **source-available proprietary software**. The source is provided for:
- Transparency and auditability
- Self-hosters who want to verify what runs on their hardware
- Community contributions (bug fixes, translations, documentation)

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

---

## Support

| Channel | URL |
|---------|-----|
| Documentation | <https://docs.watchnexus.ca> |
| Issue Tracker | <https://github.com/Z3r0Fell/WatchNexus-Master/issues> |
| Email Support | <support@watchnexus.ca> |
| License Sales | <https://watchnexus.ca/pricing> |
| Security Issues | <security@watchnexus.ca> |

---

## License

WatchNexus is proprietary software licensed per-tier. See
[`LICENSE.txt`](LICENSE.txt) or [`LICENSE.html`](LICENSE.html) for the
full End User License Agreement.

Third-party component notices: <https://watchnexus.ca/legal/notices>.

---

<p align="center"><sub>WatchNexus · RTP v1.0.4 · Built with care for self-hosters.</sub></p>
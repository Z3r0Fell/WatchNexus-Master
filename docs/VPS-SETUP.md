# WatchNexus VPS Operations Runbook

> **Audience**: you, Auz, setting up the Ubuntu VPS that hosts release
> downloads, license activations, and auto-updates for WatchNexus.
> **Goal**: ship the v1.0.0 RTP cleanly and never have to reboot/reinstall
> the box again unless you choose to.
> **Difficulty**: each section starts with the **EASIEST** path and notes
> when a more robust setup is worth the extra effort.

---

## What the VPS does

It runs three logical services. On v1.0 they can all share one Ubuntu
box:

| Subdomain | Purpose | What it serves |
|---|---|---|
| `releases.watchnexus.ca` | Static-file CDN | The `.exe / .deb / .rpm / .pkg.tar.zst / .tar` installer artifacts you `rsync` up from the Arch laptop |
| `licenses.watchnexus.ca` | License API | `POST /api/cellar/activate` (validates a backer's key), `POST /api/releases/hashes` (build pipeline pushes SHA-256 manifests here), `GET /api/updates/check` (clients poll for new versions) |
| `watchnexus.ca` | Marketing site | The static homepage at `/app/website/` (optional — you may already host this elsewhere) |

For the cost of **~$12/mo on Hetzner** (CX22, 2 vCPU / 4 GB RAM /
40 GB SSD), all three fit comfortably on one box with room to grow.
A second box gets added at $40K stretch goal (mobile apps) or when
license-API load exceeds ~50 req/s sustained.

---

## §0 — Prerequisites you need *before* touching the VPS

Tick these off on your own machine first. None of them require the VPS.

- [ ] **A registered domain**: `watchnexus.ca` (confirmed — you own it).
- [ ] **DNS access to that domain** (Cloudflare, Namecheap, Porkbun, Hover, etc.).
- [ ] **An SSH public key** on your Arch laptop (`~/.ssh/id_ed25519.pub`).
      Generate with `ssh-keygen -t ed25519 -C "auz@watchnexus.ca"` if missing.
- [ ] **A Hetzner / DigitalOcean / Vultr / Linode account** with billing set up.
      (Hetzner is cheapest for EU/NA; pick whichever you already use.)
- [ ] **A backup email** that's *not* on your `watchnexus.ca` domain
      (in case email DNS goes sideways mid-setup). Gmail is fine.

---

## §1 — Provision the VPS (15 min)

### 1.1 Spin up the box

1. Log in to your VPS provider's web console.
2. Create a new server with these specs:
   - **Image**: Ubuntu 24.04 LTS (the "Noble" release)
   - **Type**: 2 vCPU / 4 GB RAM minimum (Hetzner CX22, DO Basic 4 GB,
     Vultr Cloud Compute 2 GB+, Linode Nanode 4 GB)
   - **Storage**: 40 GB SSD minimum (releases will eat ~5 GB per version
     × 5 versions = 25 GB headroom)
   - **Datacentre**: pick the one closest to your audience (Toronto /
     New York / Falkenstein / Helsinki are all fine)
   - **SSH key**: paste your `~/.ssh/id_ed25519.pub` *during creation*.
     This is the only way to log in by default — Ubuntu's default user
     `root` will use this key.
3. Click create. Wait ~60 seconds.

### 1.2 Point DNS at the box

In your DNS provider's dashboard:

| Type | Name | Value | TTL |
|---|---|---|---|
| `A` | `@` | *(VPS IPv4 address)* | 300 |
| `A` | `releases` | *(VPS IPv4 address)* | 300 |
| `A` | `licenses` | *(VPS IPv4 address)* | 300 |
| `A` | `www` | *(VPS IPv4 address)* | 300 |
| `AAAA` | `@` | *(VPS IPv6 address, if provided)* | 300 |
| `AAAA` | `releases` | *(VPS IPv6 address)* | 300 |
| `AAAA` | `licenses` | *(VPS IPv6 address)* | 300 |
| `CAA` | `@` | `0 issue "letsencrypt.org"` | 300 |
| `MX` | `@` | *(your email host — Fastmail, Google Workspace, etc.)* | 300 |
| `TXT` | `@` | `v=spf1 include:_spf.your-email-host.com ~all` | 300 |

Wait 5–10 minutes for DNS to propagate. Verify with:

```bash
dig +short releases.watchnexus.ca
dig +short licenses.watchnexus.ca
# Both should print your VPS's IP
```

### 1.3 First SSH

From your Arch laptop:

```fish
ssh root@releases.watchnexus.ca
```

You should land in a root shell. Run `hostnamectl set-hostname watchnexus-prod`
to rename the box, then `exit`.

---

## §2 — Harden the box (20 min, one-time)

### 2.1 Create a non-root user

```bash
adduser watchnexus
usermod -aG sudo watchnexus
mkdir -p /home/watchnexus/.ssh
chmod 700 /home/watchnexus/.ssh
cp ~/.ssh/authorized_keys /home/watchnexus/.ssh/
chown -R watchnexus:watchnexus /home/watchnexus/.ssh
chmod 600 /home/watchnexus/.ssh/authorized_keys
```

Test from your laptop in a **new terminal** (keep the root session open
until you've confirmed the new user works):

```fish
ssh watchnexus@releases.watchnexus.ca
sudo whoami    # should print 'root'
```

If both work, return to the root session and disable root SSH:

```bash
# /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### 2.2 Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp     # HTTP (for Let's Encrypt + redirect)
ufw allow 443/tcp    # HTTPS
ufw enable
ufw status verbose
```

### 2.3 Unattended security updates

```bash
apt update
apt install -y unattended-upgrades apt-listchanges
dpkg-reconfigure -plow unattended-upgrades
# Answer "Yes" to enable automatic upgrades.
```

### 2.4 Fail2ban (light brute-force protection)

```bash
apt install -y fail2ban
systemctl enable --now fail2ban
```

Default config bans IPs after 5 failed SSH attempts. No tuning needed
for v1.0.

### 2.5 Time sync

```bash
timedatectl set-timezone America/Toronto
timedatectl set-ntp true
timedatectl   # confirms 'NTP service: active'
```

---

## §3 — Install the web tier (10 min)

We're using **Caddy** instead of nginx because:
- One-line HTTPS via Let's Encrypt (no certbot wrangling)
- Config file is human-readable (one block per subdomain)
- Free, MIT-licensed, single binary

### 3.1 Install Caddy

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
systemctl enable caddy
```

Caddy is now installed at `/usr/bin/caddy` and the systemd unit
`caddy.service` runs as the `caddy` user.

### 3.2 Directory layout

```bash
sudo -u watchnexus mkdir -p /srv/watchnexus/{releases,site}
sudo mkdir -p /srv/watchnexus/license-server
sudo chown -R watchnexus:watchnexus /srv/watchnexus
```

The tree:

```
/srv/watchnexus/
├── releases/         ← rsync target for installer artifacts
├── site/             ← static marketing website
└── license-server/   ← FastAPI license API (covered in §4)
```

### 3.3 Caddyfile

`/etc/caddy/Caddyfile`:

```caddy
# ── Marketing site
watchnexus.ca, www.watchnexus.ca {
    encode zstd gzip
    root * /srv/watchnexus/site
    file_server
    try_files {path} /index.html
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}

# ── Release downloads (CDN)
releases.watchnexus.ca {
    encode zstd gzip
    root * /srv/watchnexus/releases
    file_server browse

    # Cache aggressively — releases never change once published
    header /v*/* Cache-Control "public, max-age=31536000, immutable"
    # Don't cache the 'latest' manifest — it changes per release
    header /latest.json Cache-Control "public, max-age=300"
    header /version.txt  Cache-Control "public, max-age=300"

    log {
        output file /var/log/caddy/releases.log {
            roll_size 10MiB
            roll_keep 5
        }
    }
}

# ── License API (proxied to FastAPI on :8002)
licenses.watchnexus.ca {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8002

    # Rate-limit activation endpoint to 60 req/min per IP
    rate_limit {
        zone activate {
            key {client_ip}
            events 60
            window 1m
        }
        match path /api/cellar/activate
    }

    log {
        output file /var/log/caddy/licenses.log {
            roll_size 10MiB
            roll_keep 5
        }
    }
}
```

Validate and reload:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl restart caddy
```

Caddy will automatically request Let's Encrypt certificates for all
three subdomains within 60 seconds. Verify with:

```bash
curl -I https://releases.watchnexus.ca/
# Should return 200 OK with a valid TLS cert.
```

---

## §4 — Install the license API (45 min)

### 4.1 The simplest license server

For v1.0 we ship a small Python FastAPI app backed by SQLite. It does
exactly four things:

| Endpoint | Who calls it | What it does |
|---|---|---|
| `POST /api/cellar/issue` | BackerKit / Stripe / GitHub Sponsors / Patreon / BMC webhooks | Generates a new license key for a backer's email and tier, returns the key in the webhook reply, emails the backer a copy |
| `POST /api/cellar/activate` | WatchNexus client at first-launch | Validates a key, returns `{tier, status, expires_at}`, increments activation counter |
| `POST /api/releases/hashes` | The Arch laptop after `fortress-build.sh sign` | Receives the SHA-256 manifest for a release and stores it for later runtime verification |
| `GET /api/updates/check` | WatchNexus client (weekly poll) | Returns `{latest_version, download_url, signature}` for the caller's tier |

You don't need to design this from scratch — the source code lives in
the WatchNexus repo at `/license-server/`. (We'll wire it up in §4.3.)

### 4.2 Install Python + dependencies

```bash
apt install -y python3 python3-venv python3-pip sqlite3
sudo -u watchnexus bash -c '
  cd /srv/watchnexus/license-server
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip
  pip install fastapi "uvicorn[standard]" "pydantic[email]" python-dotenv \
              sqlalchemy email-validator httpx
'
```

### 4.3 Drop in the license server code

Pull the license-server code from the WatchNexus repo (a forthcoming
sub-folder — not yet committed; you'll have me write it in the next
session). For now, scaffold the layout:

```bash
sudo -u watchnexus mkdir -p /srv/watchnexus/license-server/app
sudo -u watchnexus tee /srv/watchnexus/license-server/.env <<'EOF'
# License server configuration (admin tokens, never commit this file)
WN_ADMIN_TOKEN=__GENERATE_WITH_OPENSSL_RAND_BASE64_32__
WN_DB_URL=sqlite:////srv/watchnexus/license-server/licenses.db
WN_SMTP_HOST=smtp.postmarkapp.com
WN_SMTP_PORT=587
WN_SMTP_USER=__POSTMARK_SERVER_TOKEN__
WN_SMTP_PASS=__POSTMARK_SERVER_TOKEN__
WN_SMTP_FROM=noreply@watchnexus.ca
WN_REPLY_TO=support@watchnexus.ca
WN_RELEASES_BASE=https://releases.watchnexus.ca
WN_HMAC_SECRET=__GENERATE_WITH_OPENSSL_RAND_BASE64_64__
EOF
chmod 600 /srv/watchnexus/license-server/.env

# Generate strong secrets
openssl rand -base64 32   # paste as WN_ADMIN_TOKEN
openssl rand -base64 64   # paste as WN_HMAC_SECRET
```

### 4.4 systemd unit for the license API

`/etc/systemd/system/watchnexus-licenses.service`:

```ini
[Unit]
Description=WatchNexus License API
After=network.target

[Service]
Type=simple
User=watchnexus
Group=watchnexus
WorkingDirectory=/srv/watchnexus/license-server
EnvironmentFile=/srv/watchnexus/license-server/.env
ExecStart=/srv/watchnexus/license-server/.venv/bin/uvicorn \
    app.main:app --host 127.0.0.1 --port 8002 \
    --workers 2 --proxy-headers --forwarded-allow-ips '127.0.0.1'
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/srv/watchnexus/license-server

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now watchnexus-licenses
systemctl status watchnexus-licenses
```

You should see `active (running)` once the code is in place. Until then
Caddy will return `502 Bad Gateway` for `licenses.watchnexus.ca` — that's
expected.

---

## §5 — Release-storage directory layout (the contract)

This is the **single most important section**. The directory structure
on `releases.watchnexus.ca` is the contract between the build pipeline
on your Arch laptop and the auto-update logic in the WatchNexus client.

### 5.1 The layout

```
/srv/watchnexus/releases/
├── v1.0.0/                              ← per-version folder
│   ├── standard/
│   │   ├── watchnexus-standard_1.0.0_amd64.deb
│   │   ├── watchnexus-standard-1.0.0-1.x86_64.rpm
│   │   ├── watchnexus-standard-1.0.0-1-x86_64.pkg.tar.zst
│   │   ├── watchnexus-standard-1.0.0-windows-x64.exe
│   │   ├── watchnexus-standard-1.0.0-docker.tar
│   │   └── SHA256SUMS.txt
│   ├── pro/                             (same five files)
│   ├── ultra/                           (same five files)
│   ├── community-hubs/                  (Unraid XML, CasaOS, etc.)
│   └── CHANGELOG.md                     (release notes for this version)
├── v1.0.1/                              ← next release
│   └── ...
├── latest                               ← SYMLINK to the latest version dir
└── latest.json                          ← machine-readable update manifest
```

### 5.2 The `latest.json` manifest

Generated by the build pipeline (we'll add this to
`build-installers.fish` in the next session — your action item to remind
me). Format:

```json
{
  "version": "1.0.0",
  "released_at": "2026-02-15T12:00:00Z",
  "channel": "stable",
  "tiers": {
    "standard": {
      "windows-x64": {
        "url": "https://releases.watchnexus.ca/v1.0.0/standard/watchnexus-standard-1.0.0-windows-x64.exe",
        "sha256": "abc123...",
        "size_bytes": 95000000
      },
      "linux-deb": {
        "url": "https://releases.watchnexus.ca/v1.0.0/standard/watchnexus-standard_1.0.0_amd64.deb",
        "sha256": "def456...",
        "size_bytes": 85000000
      },
      "linux-rpm": { "url": "...", "sha256": "...", "size_bytes": ... },
      "linux-arch": { "url": "...", "sha256": "...", "size_bytes": ... },
      "docker": { "image": "watchnexus/watchnexus:1.0.0-standard" }
    },
    "pro":   { ...same layout... },
    "ultra": { ...same layout... }
  },
  "min_supported_version": "1.0.0",
  "signature": "base64-hmac-sha256-of-this-document"
}
```

The `signature` is computed by the license server using the
`WN_HMAC_SECRET` so clients can verify the manifest hasn't been tampered
with in transit. The WatchNexus client only auto-updates if the
signature validates against the public HMAC key shipped in the binary.

### 5.3 The `latest` symlink

```bash
sudo -u watchnexus ln -sfn v1.0.0 /srv/watchnexus/releases/latest
```

This lets users use stable URLs like:

```
https://releases.watchnexus.ca/latest/standard/watchnexus-standard.deb
```

…even when v1.0.0 becomes v1.0.1 next month. Update the symlink once
per release and every CDN-cached URL is invalidated by the
`Cache-Control` header on `/latest/*` (which Caddy returns with `max-age=300`).

---

## §6 — The upload pipeline (from Arch laptop to VPS)

### 6.1 One-time setup on the VPS

Create a separate "release publisher" SSH key so the upload pipeline
doesn't share Auz's personal SSH credentials:

```bash
# On the VPS, as root:
sudo -u watchnexus ssh-keygen -t ed25519 -N "" \
    -f /home/watchnexus/.ssh/release-pipeline \
    -C "watchnexus-release-pipeline"
cat /home/watchnexus/.ssh/release-pipeline.pub
# Copy this PUBLIC key.
```

On the VPS, append the public key to `authorized_keys` with an upload
restriction (so this key can ONLY rsync to /srv/watchnexus/releases):

```bash
# Append to /home/watchnexus/.ssh/authorized_keys:
echo 'command="rrsync /srv/watchnexus/releases",restrict ssh-ed25519 AAAA...' \
    >> /home/watchnexus/.ssh/authorized_keys
apt install -y rsync   # rrsync ships with rsync
```

Move the **private** key portion to your Arch laptop:

```fish
# On the VPS:
cat /home/watchnexus/.ssh/release-pipeline
# Copy the private key, paste into your Arch laptop at:
#   ~/.ssh/watchnexus-release-pipeline
# Then:
#   chmod 600 ~/.ssh/watchnexus-release-pipeline
```

Then delete the private key from the VPS — keep only the public side
in `authorized_keys`:

```bash
shred -u /home/watchnexus/.ssh/release-pipeline
```

### 6.2 Upload command (run on Arch laptop after build)

```fish
# After: ./build/build-installers.fish all --sign

rsync -avh --progress \
    -e "ssh -i ~/.ssh/watchnexus-release-pipeline" \
    release/ \
    watchnexus@releases.watchnexus.ca:v1.0.0/

# Flip the 'latest' symlink on the VPS:
ssh -i ~/.ssh/watchnexus-release-pipeline \
    watchnexus@releases.watchnexus.ca \
    "ln -sfn v1.0.0 latest"
```

The `rrsync` wrapper on the VPS *only* allows writes inside
`/srv/watchnexus/releases/`, so even if this key is stolen, the
attacker can't touch the license server or anything outside the release
tree.

### 6.3 Optional: pre-upload integrity gate

Before flipping the `latest` symlink, verify the upload completed
correctly:

```fish
# On Arch laptop:
ssh -i ~/.ssh/watchnexus-release-pipeline \
    watchnexus@releases.watchnexus.ca \
    "cd v1.0.0/ultra && sha256sum -c SHA256SUMS.txt"
# Expected output: "watchnexus-ultra-1.0.0-windows-x64.exe: OK", etc.
```

If any line says `FAILED`, **do not flip the symlink**. Re-upload that
artifact.

---

## §7 — Activation flow (what happens when a backer installs WatchNexus)

This is illustrative — clients are already implemented. Documented so
you understand what the VPS is doing.

```
┌──────────────┐   1. POST /api/cellar/activate         ┌──────────────────┐
│              │       { license_key, machine_id }      │                  │
│  WatchNexus  ├───────────────────────────────────────►│   License API    │
│   Client     │                                        │   (FastAPI)      │
│              │   2. Response                          │                  │
│              │◄───────────────────────────────────────┤                  │
└──────────────┘   { tier, status, expires_at,          └──────────────────┘
                     activation_signature }                      │
                                                                 │ 3. Write
┌──────────────┐                                                 ▼
│              │                                        ┌──────────────────┐
│  Re-validate │                                        │  SQLite DB       │
│  every 7d    │                                        │  /srv/watchnexus │
│              │                                        │  /license-server │
└──────────────┘                                        │  /licenses.db    │
                                                        └──────────────────┘
```

Key properties:

- A license key is bound to **one machine_id at a time**. If a backer
  installs on a new machine, the license server invalidates the old
  activation and binds to the new one. No "5-device limit" nonsense.
- The license server returns an **HMAC-SHA-256 activation signature**
  that the client caches locally. If the network drops for up to 7
  days, the client uses the cached signature; after 7 days offline, it
  requires re-activation.
- A license key is **never** sent to the client unencrypted in
  transit — Caddy's TLS handles that.

---

## §8 — Auto-update flow (what happens once a week)

```
┌──────────────┐   1. GET /api/updates/check            ┌──────────────────┐
│              │      ?tier=ultra&version=1.0.0         │                  │
│  WatchNexus  ├───────────────────────────────────────►│   License API    │
│   Client     │                                        │                  │
│              │   2. Response                          │                  │
│              │◄───────────────────────────────────────┤                  │
└──────────────┘   { update_available: true,            └──────────────────┘
       │             latest_version: "1.0.1",                    │
       │             url: ".../v1.0.1/ultra/...",                │ 3. Reads
       │             sha256: "abc...",                           ▼
       │             signature: "hmac..." }              ┌──────────────────┐
       │                                                 │  latest.json     │
       │ 4. Client downloads from                        │  (on disk)       │
       │    releases.watchnexus.ca                       └──────────────────┘
       ▼
┌──────────────┐
│  releases    │
│  Caddy CDN   │
└──────────────┘
```

Update behaviour on the client:

- **Notify mode (default)**: client shows a "Settings → Updates → New
  version available" badge. User clicks "Install update" to proceed.
- **Auto mode**: opt-in (off by default). Update downloads in
  background; user confirms restart.
- **Held mode**: power user opt-in. Updates only installable from CLI.

The client verifies SHA-256 *and* the HMAC signature on the manifest
before launching the new installer. The Fortress Protocol then verifies
the new binary's integrity on first launch.

---

## §9 — Operational tooling (set once, forget)

### 9.1 Daily backups

`/etc/systemd/system/watchnexus-backup.service`:

```ini
[Unit]
Description=Backup WatchNexus license DB and configs
After=network.target

[Service]
Type=oneshot
User=watchnexus
Group=watchnexus
ExecStart=/srv/watchnexus/bin/backup.sh
```

`/etc/systemd/system/watchnexus-backup.timer`:

```ini
[Unit]
Description=Run WatchNexus backup nightly

[Timer]
OnCalendar=daily
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
```

`/srv/watchnexus/bin/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_DIR=/srv/watchnexus/backups
mkdir -p "$BACKUP_DIR"

# SQLite backup (uses .backup for crash-consistent snapshot)
sqlite3 /srv/watchnexus/license-server/licenses.db \
    ".backup '$BACKUP_DIR/licenses-$STAMP.db'"

# Configs
tar -czf "$BACKUP_DIR/configs-$STAMP.tar.gz" \
    /etc/caddy/Caddyfile \
    /etc/systemd/system/watchnexus-*.service \
    /etc/systemd/system/watchnexus-*.timer \
    /srv/watchnexus/license-server/.env

# Retention: keep last 30 days
find "$BACKUP_DIR" -name "licenses-*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "configs-*.tar.gz" -mtime +30 -delete
```

```bash
chmod +x /srv/watchnexus/bin/backup.sh
systemctl daemon-reload
systemctl enable --now watchnexus-backup.timer
```

### 9.2 Off-VPS backup mirror (Backblaze B2, ~$1/mo)

Sign up for B2, create a bucket called `watchnexus-backups`. Get an
application key with read/write access. Then on the VPS:

```bash
apt install -y restic
restic init --repo b2:watchnexus-backups:/license-server
# Save the password in /srv/watchnexus/.restic-pass (chmod 600)
```

Add to `/srv/watchnexus/bin/backup.sh` after the local backup step:

```bash
export RESTIC_PASSWORD_FILE=/srv/watchnexus/.restic-pass
export B2_ACCOUNT_ID="..."
export B2_ACCOUNT_KEY="..."
restic --repo b2:watchnexus-backups:/license-server backup "$BACKUP_DIR/licenses-$STAMP.db"
restic --repo b2:watchnexus-backups:/license-server forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
```

Restic does encrypted deduplicating backups; you can lose the entire
VPS and restore from B2 in 15 minutes.

### 9.3 Monitoring

Use **Uptime Kuma** (self-hosted, free) on a separate cheap box, OR
use **BetterUptime / OnlineOrNot** (~$10/mo, hosted). Configure three
checks:

| Check | URL | Expected |
|---|---|---|
| Releases CDN | `GET https://releases.watchnexus.ca/latest.json` | 200, JSON parses |
| License API health | `GET https://licenses.watchnexus.ca/api/health` | 200, `{"status": "ok"}` |
| TLS expiry | `tcps://releases.watchnexus.ca:443` | cert valid for > 14 days |

Notification channels: email (your personal one) + Discord webhook
(your WatchNexus support channel). Don't route alerts to your
WatchNexus support email; you want them somewhere you actually see at
3 a.m.

### 9.4 Log rotation

Caddy already rotates with `roll_size 10MiB roll_keep 5`. The license
API uses systemd-journald which rotates by default.

To inspect:

```bash
journalctl -u watchnexus-licenses -f          # license API logs (live)
journalctl -u watchnexus-licenses --since "1 hour ago"
tail -f /var/log/caddy/releases.log           # release download logs
tail -f /var/log/caddy/licenses.log           # license API access logs
```

---

## §10 — The first release (Day 0)

Concrete sequence, in order, the day v1.0.0 ships:

1. **On Arch laptop**: build + sign all installers.
   ```fish
   ./build/build-installers.fish all --sign --docker
   ```
2. **On Arch laptop**: hash and upload to license server.
   ```fish
   set -x WN_LICENSE_TOKEN "your-publishing-token"
   ./build/fortress-build.sh sign /home/auz/Downloads/git/WatchNexus/release
   WN_UPLOAD_HASHES=1 ./build/fortress-build.sh sign release
   ```
3. **On Arch laptop**: rsync to VPS.
   ```fish
   rsync -avh --progress \
       -e "ssh -i ~/.ssh/watchnexus-release-pipeline" \
       release/ \
       watchnexus@releases.watchnexus.ca:v1.0.0/
   ```
4. **On VPS** (SSH in): verify integrity.
   ```bash
   cd /srv/watchnexus/releases/v1.0.0/ultra
   sha256sum -c SHA256SUMS.txt
   # Repeat for /standard and /pro
   ```
5. **On VPS**: flip the latest symlink.
   ```bash
   cd /srv/watchnexus/releases
   ln -sfn v1.0.0 latest
   ```
6. **On VPS**: push Docker images to Docker Hub (if you built them).
   ```bash
   docker login
   for tier in standard pro ultra; do
       docker tag watchnexus/watchnexus:1.0.0-$tier watchnexus/watchnexus:latest-$tier
       docker push watchnexus/watchnexus:1.0.0-$tier
       docker push watchnexus/watchnexus:latest-$tier
   done
   ```
7. **On VPS**: smoke test the activation flow with one of your own test keys.
   ```bash
   curl -X POST https://licenses.watchnexus.ca/api/cellar/activate \
       -H "Content-Type: application/json" \
       -d '{"license_key":"WN-TEST-XXXXXX","machine_id":"smoke-test"}'
   # Expect {"tier":"...", "status":"active", ...}
   ```
8. **On VPS**: verify the latest.json signature.
   ```bash
   curl https://releases.watchnexus.ca/latest.json | jq .
   # Confirm version=1.0.0
   ```
9. **Announce.** Post to all the channels (see crowdfunding launch
   checklist).

---

## §11 — Shipping v1.0.1 (subsequent releases)

The same pattern, abbreviated:

1. `git tag v1.0.1 && git push --tags`
2. `./build/build-installers.fish all --sign --docker` (Arch laptop)
3. `rsync ... v1.0.1/` (Arch laptop → VPS)
4. `sha256sum -c` (VPS, verify)
5. `ln -sfn v1.0.1 latest` (VPS, flip symlink)
6. `docker push :1.0.1-{standard,pro,ultra}` + retag `:latest-*`
7. WatchNexus clients running v1.0.0 will see "Update available" in
   their Settings → Updates panel within ~7 days. No further action
   needed from you.

Optional: post a "v1.0.1 is out" update to backers on Kickstarter +
Open Collective + Patreon.

---

## §12 — Disaster recovery

### 12.1 VPS is gone (provider outage, accidental deletion, etc.)

Recovery time: **~30 minutes**.

1. Spin up a new VPS (§1.1) on the same or different provider.
2. Re-point DNS A records at the new IP (§1.2).
3. Run §2 (harden) and §3.1 (install Caddy).
4. Restore from off-VPS B2 backup:
   ```bash
   restic --repo b2:watchnexus-backups:/license-server restore latest \
       --target /srv/watchnexus/license-server-restored
   ```
5. Re-install license API per §4 with restored DB.
6. Re-sync releases from the **Arch laptop** (you have all the
   originals locally):
   ```fish
   rsync -avh release/ watchnexus@new-vps:/srv/watchnexus/releases/v1.0.0/
   ```
7. Set the `latest` symlink. Done.

DNS TTL of 300s means clients see the new IP within 5 minutes of step 2.

### 12.2 License DB corrupted

Restore from the most recent local `/srv/watchnexus/backups/licenses-*.db`:

```bash
systemctl stop watchnexus-licenses
cp /srv/watchnexus/backups/licenses-20260215-030000.db \
   /srv/watchnexus/license-server/licenses.db
systemctl start watchnexus-licenses
```

If local backups are also gone, restore from B2 (§9.2).

### 12.3 Caddy can't get certs (Let's Encrypt outage)

Caddy auto-retries. If LE is down for >12 hours, fall back to
ZeroSSL by adding to Caddyfile globally:

```caddy
{
    acme_ca https://acme.zerossl.com/v2/DV90
    acme_eab {
        key_id "..."
        mac_key "..."
    }
}
```

(Get the EAB credentials from zerossl.com — they're free for 90-day
certs.)

---

## §13 — Cost summary (annualised)

| Item | Annual |
|---|---|
| Hetzner CX22 (2 vCPU / 4 GB / 40 GB) | $84 |
| Backblaze B2 backups (~5 GB) | $12 |
| Cloudflare (DNS only, free tier) | $0 |
| Let's Encrypt | $0 |
| BetterUptime monitoring (5-min polling) | $108 |
| Postmark transactional email (10k emails/mo) | $180 |
| Domain renewals (`watchnexus.ca` + `.com` + `.app`) | $90 |
| **Total annual operating cost** | **$474** |

This is well within the $1,200 hosting line item in
`crowdfunding/_shared/budget.md` and leaves $726 for the second year.

---

## §14 — Things I need from you to write the actual license-server code

When you ask me to write `app/main.py` in the next session, I'll need
these decisions confirmed:

1. **Email provider** for transactional license-key delivery:
   - a. Postmark ($15/mo, easiest, recommended)
   - b. SendGrid ($20/mo)
   - c. AWS SES ($1 per 1000 emails, cheapest but more setup)
   - **Default**: Postmark.

2. **License key format**:
   - a. `WN-XXXX-XXXX-XXXX-XXXX` (16 chars + 3 dashes, 20 total)
   - b. UUID v4 (`f47ac10b-58cc-4372-a567-0e02b2c3d479`)
   - c. Stripe-style short ID (`wn_live_a4b5c6...`)
   - **Default**: option a (most user-friendly).

3. **Backer-survey integration** (after Kickstarter close):
   - a. BackerKit webhook
   - b. Manual CSV upload via admin endpoint
   - c. Both
   - **Default**: option c.

4. **Stripe direct-purchase support** (for users who buy *after* the campaign):
   - a. Yes, integrate Stripe Checkout from day 1
   - b. Skip for v1.0; manual key issuance only
   - **Default**: option a (Stripe Checkout is one webhook handler).

5. **GDPR / data-deletion endpoint**:
   - a. Self-service `DELETE /api/cellar/forget` (verified via email)
   - b. Manual request via support@watchnexus.ca
   - **Default**: option a (legal-compliance friendly + saves you time).

---

## §15 — Checklist before going live

- [ ] DNS records propagated (`dig +short releases.watchnexus.ca` works)
- [ ] SSH root login disabled
- [ ] ufw enabled, only ports 22/80/443 open
- [ ] Caddy reaches "active (running)"
- [ ] All three subdomains return valid TLS certs
- [ ] License API systemd unit reaches "active (running)"
- [ ] `releases.watchnexus.ca/v1.0.0/` lists artifacts
- [ ] `releases.watchnexus.ca/latest.json` returns valid JSON
- [ ] `licenses.watchnexus.ca/api/health` returns `{"status":"ok"}`
- [ ] Daily backup timer enabled and ran at least once
- [ ] B2 restic repo initialised and first snapshot taken
- [ ] Uptime monitoring configured for all 3 checks
- [ ] Test activation succeeded with a placeholder key
- [ ] `latest` symlink points at the right version

When every box is ticked, the VPS is production-ready and you can flip
"COMING SOON" on `watchnexus.ca/launch` to "BUY NOW" with confidence.

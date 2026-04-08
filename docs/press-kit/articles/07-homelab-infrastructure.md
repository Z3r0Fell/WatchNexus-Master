# One Binary, 35 Modules: How WatchNexus Simplifies the Self-Hosted Media Stack

**Target:** ServeTheHome, r/homelab, r/DataHoarder, NAS community forums, Unraid forums  
**Format:** Infrastructure-focused article  
**Word Count:** ~1,500  
**Tone:** Practical, hardware-aware, infrastructure-focused

---

If you've spent any time on r/homelab or r/selfhosted, you've seen the screenshots: a Portainer dashboard with 15 containers running Sonarr, Radarr, Lidarr, Prowlarr, qBittorrent, Bazarr, Overseerr, Jellyfin, Tautulli, and a reverse proxy to tie it all together. Each container pulling 100-500 MB of RAM. Each with its own configuration that needs to survive reboots and updates.

WatchNexus asks: what if all of that was one binary?

## The Resource Problem

Here's what a typical media automation stack looks like on a modest homelab server:

| Container | RAM Usage | CPU Idle | Storage |
|-----------|-----------|----------|---------|
| Sonarr | 180-250 MB | 1-3% | ~100 MB |
| Radarr | 180-250 MB | 1-3% | ~100 MB |
| Prowlarr | 120-180 MB | <1% | ~50 MB |
| qBittorrent | 80-200 MB | <1% | ~30 MB |
| Bazarr | 100-150 MB | <1% | ~50 MB |
| Jellyfin | 300-800 MB | 2-5% | ~200 MB |
| Overseerr | 150-200 MB | <1% | ~50 MB |
| Tautulli | 80-120 MB | <1% | ~50 MB |
| **Total** | **1.2-2.1 GB** | **7-15%** | **~630 MB** |

On a Raspberry Pi 4 with 4 GB RAM, that's 30-50% of your memory consumed before you even start watching something. On a mini PC like an Intel NUC or Beelink, it's manageable but wasteful.

WatchNexus consolidates this into a single process:

| | Traditional Stack | WatchNexus |
|---|---|---|
| **RAM (idle)** | 1.2-2.1 GB | 200-400 MB |
| **Processes** | 8+ containers | 1 binary |
| **Config files** | 8+ separate configs | 1 SQLite database |
| **Disk footprint** | ~630 MB | 58 MB (Linux) |
| **Update process** | 8 container pulls | 1 binary swap |
| **Setup time** | 4-6 hours | 2 minutes |
| **Cross-app sync** | API keys, manual | Automatic (shared DB) |

## What's Inside the Binary

WatchNexus v2.8.4 ships with 35 modules. Here are the ones that matter most for homelab use:

### Media Pipeline
- **Marmalade** (Library Manager): Scans directories, fetches TMDB metadata, organizes into Movies/TV/Anime libraries. Equivalent to Jellyfin's library scanner.
- **Compote** (Indexer Search): Multi-source search across Nyaa.si, YTS, EZTV, Torznab/Newznab. Returns quality (4K/1080p/720p), codec (HEVC/x264/AV1), size, and seeder counts. Replaces Prowlarr.
- **Fondue** (Movie Automation): Radarr-style movie monitoring with quality profiles. Add movies to a watchlist and it finds them.
- **Saffron** (Scheduled Tasks): Background automation for library scans, indexer checks, and maintenance. 8 task types with run history.
- **Churro** (Download Clients): qBittorrent integration, plus a built-in torrent engine.

### Infrastructure
- **Tunnel** (VPN Portal): Built-in WireGuard management. Add peers, generate keys, monitor bandwidth -- from the web UI. No more editing `/etc/wireguard/wg0.conf` manually.
- **Bastion** (Security): TOTP 2FA, IP filtering, API keys, audit logging, session management. If you're exposing this to the internet, you want this.
- **Fortress** (Integrity): SHA-256 checksums of all assemblies at startup. Periodic verification. Auto-locks on tampering.
- **Sourdough** (Backup): Automated backup scheduling with config export. Point it at a directory and schedule daily/weekly backups.

### Monitoring
- **Nutmeg** (System Stats): CPU, memory, disk, process monitoring from the System page.
- **Zest** (Log Viewer): Application log browser with search and filtering.
- The System Dashboard shows all 35 modules with version numbers and active/inactive status.

## Hardware Recommendations

### Minimum (Light Use)
- **Intel N100 / N95 mini PC** or equivalent
- 4 GB RAM (8 GB recommended)
- 2 GB SSD for the application (plus media storage)
- Any 64-bit Linux distribution

### Recommended (Moderate Library)
- **Intel N305 / AMD Ryzen 5** mini PC
- 16 GB RAM
- 256 GB NVMe SSD (OS + app + database)
- Separate HDD/NAS for media storage
- Ubuntu 22.04+ or Debian 12+

### NAS Integration
WatchNexus works well alongside existing NAS setups:

1. **Synology/QNAP**: Run WatchNexus on a separate mini PC, mount NAS shares via NFS/SMB
2. **TrueNAS**: Run in a jail or VM, or on separate hardware with NFS mounts
3. **Unraid**: Docker container support coming soon. Currently runs on bare metal or in a VM

Point WatchNexus at your NAS media shares for library scanning, and it handles everything else locally.

## Installation

### Bare Metal (Recommended for Homelabs)

```bash
# Download
wget https://github.com/watchnexus/releases/download/v2.8.4/WatchNexus-v2.8.4-linux-x64.tar.gz

# Extract and install
tar xzf WatchNexus-v2.8.4-linux-x64.tar.gz
cd WatchNexus-v2.8.4-linux-x64
sudo bash install.sh

# Verify it's running
sudo systemctl status watchnexus
curl http://localhost:8001/api/health
```

The install script:
- Creates a `watchnexus` system user
- Copies the binary to `/opt/watchnexus`
- Creates a systemd service that auto-starts on boot
- Restarts on crash

### Docker Compose (Coming Soon)

```yaml
version: '3.8'
services:
  watchnexus:
    image: watchnexus/server:2.8.4
    ports:
      - "8001:8001"
    volumes:
      - ./config:/app/data
      - /mnt/media/movies:/media/movies
      - /mnt/media/tv:/media/tv
      - /mnt/media/anime:/media/anime
    environment:
      - TZ=America/New_York
    restart: unless-stopped
```

Multi-arch support planned: `linux/amd64`, `linux/arm64`, `linux/arm/v7`.

## Power Consumption

On a typical Intel N100 mini PC:

| State | Power Draw |
|-------|------------|
| Idle (no active streams) | 6-8W |
| Library scan | 8-12W |
| Active indexer search | 8-10W |
| Single stream playback | 10-15W |

Compare this to running 8 separate containers, which typically adds 2-4W of overhead from container runtime processing alone.

## Backup Strategy

WatchNexus stores everything in a single SQLite database. Your backup strategy is simple:

```bash
# Daily cron job
0 3 * * * cp /opt/watchnexus/data/watchnexus.db /mnt/backup/watchnexus/watchnexus-$(date +%Y%m%d).db
```

Or use the built-in Sourdough backup module to schedule automated exports from the web UI.

Media files stay on your NAS with their own backup strategy. WatchNexus only stores metadata and configuration -- typically under 50 MB even for large libraries.

## The Honest Assessment

**Where WatchNexus wins:**
- Setup time: 2 minutes vs. 4-6 hours
- Resource usage: ~300 MB vs. ~1.5 GB RAM
- Configuration: One database vs. 8 config files
- Security: Built-in 2FA and VPN

**Where the traditional stack still wins:**
- **Transcoding**: Jellyfin's hardware transcoding (QSV/NVENC/VA-API) is mature and well-tested. WatchNexus doesn't have this yet.
- **Community plugins**: Jellyfin and Sonarr/Radarr have years of community plugins. WatchNexus's plugin ecosystem is nascent.
- **Battle-tested**: Sonarr/Radarr have been in production for years. WatchNexus is at v2.8.4 -- newer and less battle-hardened.

For homelabbers who prioritize simplicity and resource efficiency over maximum transcoding capability, WatchNexus is worth evaluating. For those who need hardware transcoding today, run WatchNexus alongside Jellyfin -- they complement each other.

---

*WatchNexus v2.8.4 -- 58 MB binary, 35 modules, 2-minute install.*

---

## Submission Notes
- **ServeTheHome**: Email tips@servethehome.com. Focus on hardware recommendations and power consumption.
- **r/homelab**: Text post. Include hardware specs. Mention resource comparison.
- **r/DataHoarder**: Focus on library management and metadata features.
- **Unraid Forums**: Focus on VM/bare-metal installation until Docker image is ready.
- Include a screenshot of the System Dashboard showing all 35 modules.

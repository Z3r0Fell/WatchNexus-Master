# WatchNexus: The Self-Hosted Media Pipeline That Replaces Six Applications

**Target:** It's FOSS, CommandLinux, LinuxHandbook, FOSS Force, Linux Magazine  
**Format:** Tutorial-style article with installation guide  
**Word Count:** ~2,000  
**Tone:** Consumer-friendly but technically competent, Linux-enthusiast voice

---

If you've ever tried to set up a complete media management system on Linux, you know the drill. Install Sonarr for TV shows. Install Radarr for movies. Install Prowlarr to manage your indexers. Install qBittorrent for downloads. Install Jellyfin for playback. Configure them to talk to each other via API keys. Repeat every time you rebuild your server.

WatchNexus takes a different approach: one application, one database, one configuration. Install it once, and you have a complete media pipeline running on your Linux box in under two minutes.

## What Is WatchNexus?

WatchNexus is a self-hosted media management pipeline built on .NET 10 with a React frontend. It handles the complete media lifecycle: searching for content, downloading it, organizing your library, and playing it back -- all from a single, unified web interface.

Think of it as what would happen if Jellyfin, Sonarr, Radarr, and Prowlarr had a baby that was raised by someone who really cares about UI design.

### What It Replaces

| Traditional Setup | WatchNexus Module | What It Does |
|-------------------|-------------------|-------------|
| Jellyfin/Plex | Marmalade | Library management, TMDB metadata, playback |
| Sonarr/Radarr | Fondue + Saffron | Movie and TV automation |
| Prowlarr | Compote | Multi-indexer search (Nyaa.si, YTS, EZTV, Torznab) |
| qBittorrent | Churro | Download client management |
| Overseerr | Requests | Content request management |
| Tautulli | Analytics | Viewing statistics |

But WatchNexus goes beyond just consolidation. It includes 35 modules total, including features you won't find in the traditional stack:

- **Bastion** -- A full security center with TOTP two-factor authentication, LDAP integration, IP filtering, API keys, and audit logging
- **Tunnel** -- Built-in WireGuard VPN management, so you can access your media server securely from anywhere
- **Fortress** -- Runtime assembly integrity checking that detects file tampering
- **Sourdough** -- Automated backup and restore scheduling
- **Sprout** -- RSS feed generator so you can subscribe to your own library updates

## Installation on Linux

### Option 1: Release Build (Recommended)

The release build is a self-contained binary. No .NET runtime installation required.

```bash
# Download the latest release
wget https://github.com/watchnexus/releases/download/v1.0.1/WatchNexus-v1.0.1-linux-x64.tar.gz

# Extract
tar xzf WatchNexus-v1.0.1-linux-x64.tar.gz
cd WatchNexus-v1.0.1-linux-x64

# Install as a systemd service
sudo bash install.sh

# Check the service status
sudo systemctl status watchnexus
```

That's it. Open `http://your-server-ip:8001` in your browser.

**Default credentials:** `admin@watchnexus.ca` / `admin` (change these immediately)

### Option 2: From Source

```bash
# Install .NET 10 SDK
wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh --channel 10.0

# Clone and build
git clone https://github.com/watchnexus/watchnexus.git
cd watchnexus/src/watchnexus/core
dotnet run

# In another terminal, start the frontend
cd watchnexus/frontend
yarn install
yarn start
```

### Option 3: Docker (Coming Soon)

```yaml
# docker-compose.yml (preview)
version: '3.8'
services:
  watchnexus:
    image: watchnexus/server:1.0.1
    ports:
      - "8001:8001"
    volumes:
      - ./config:/app/data
      - /path/to/media:/media
    restart: unless-stopped
```

Docker images will support `linux/amd64`, `linux/arm64`, and `linux/arm/v7` (Raspberry Pi 3+).

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 4 GB | 8 GB |
| Disk | 2 GB + media storage | SSD recommended |
| OS | Any 64-bit Linux | Ubuntu 22.04+, Debian 12+ |
| Architecture | x86_64, arm64 | x86_64 |

## Setting Up Your First Library

After logging in, the first thing you'll want to do is add a media library:

1. Navigate to **Library** in the sidebar
2. Click **Add Library**
3. Choose a type (Movies, TV Shows, or Anime)
4. Point it at your media directory (e.g., `/media/movies`)
5. WatchNexus will scan the directory and fetch metadata from TMDB automatically

The library page shows your collections with poster art, recently added items, and quick access to browse or search.

## Searching for Content

The **Indexers** page (powered by the Compote module) lets you search across multiple sources simultaneously:

1. Go to **Settings > Indexers** and configure your indexer sources
2. Supported types:
   - **Nyaa.si** -- Anime and Asian media
   - **YTS** -- Movies
   - **EZTV** -- TV shows
   - **Torznab/Newznab** -- Standard protocol (works with Jackett)
   - **Generic RSS** -- Any RSS feed
3. Navigate to **Indexers** in the sidebar
4. Enter your search query
5. Results show quality (4K/1080p/720p), codec (HEVC/x264/AV1), file size, and seeder count
6. Click **Grab** to add to your download queue

## Security: Not an Afterthought

One thing that sets WatchNexus apart from most self-hosted media software is its security posture. The Bastion module provides:

- **Two-Factor Authentication**: Real TOTP implementation. Scan a QR code with your authenticator app, get 8 backup codes. This isn't a half-baked implementation -- it follows RFC 6238 exactly.
- **Audit Logging**: Every login attempt, setting change, and API call is logged. Search, filter, and export logs in JSON format.
- **Session Management**: See every active session with device type, browser, and IP address. Kill sessions remotely.
- **API Keys**: Generate keys with granular permissions for external integrations.

For remote access, the Tunnel module provides a full WireGuard VPN interface instead of relying on external reverse proxy configurations. Add peers, generate keys, monitor bandwidth -- all from the web UI.

## How It Compares

The self-hosted media server landscape has shifted significantly. According to recent surveys, Jellyfin now holds over 50% market share among homelab enthusiasts, surpassing Plex. Docker Compose is the dominant deployment method at 83%.

WatchNexus positions itself differently. Rather than competing as another media server, it aims to be the entire stack. If Jellyfin is the best media player, WatchNexus is the best media pipeline -- handling the entire journey from discovery to playback.

| Feature | Jellyfin | Plex | WatchNexus |
|---------|----------|------|------------|
| Media playback | Excellent | Excellent | Good |
| Indexer search | No (needs Prowlarr) | No | Built-in |
| Download automation | No (needs Sonarr/Radarr) | No | Built-in |
| Download client | No (needs qBittorrent) | No | Built-in |
| 2FA security | Basic | Basic | Full TOTP |
| VPN management | No | No | Built-in WireGuard |
| Single binary | No | No | Yes |

## What's Still Missing

In the interest of transparency:

- **Hardware transcoding** (QSV/NVENC/VA-API) is not yet implemented. Direct play works fine, but if you need on-the-fly transcoding for different devices, you'll still want Jellyfin alongside WatchNexus.
- **Mobile apps** don't exist yet. The web interface is responsive and works on mobile browsers, but there are no native apps.
- **Plugin ecosystem** is in early stages. The marketplace exists, but community plugins are limited.

## Conclusion

WatchNexus won't replace Jellyfin's playback quality or Sonarr's automation maturity overnight. But if you're tired of managing six applications that barely talk to each other, and you want a single installation that handles the full media lifecycle with genuine security features, it's worth a look.

Version 1.0.1 is available now. 58 MB download, two-minute installation, 35 modules ready to go.

---

*WatchNexus is free, self-hosted software. Release builds are available for Linux x64 and Windows x64.*

---

## Submission Notes
- **CommandLinux**: Email [email protected]. Must be 1000+ words, 100% original, include code/CLI examples. No AI-generated content (ensure human editing).
- **It's FOSS**: Email editors via contact page. Focus on practical Linux usage.
- **LinuxHandbook**: Focus on installation tutorial angle. Include terminal commands.
- **FOSS Force**: Email editors. Frame as FOSS alternative coverage.
- Include screenshots of the dashboard, library, and search pages.

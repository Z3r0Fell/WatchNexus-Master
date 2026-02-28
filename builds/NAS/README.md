# WatchNexus NAS Installation Guide

This guide covers installation on common NAS platforms: Synology, QNAP, TrueNAS, and generic Linux-based NAS systems.

---

## Synology DSM

### Using Docker (Recommended)

1. Install **Docker** from Package Center
2. Open Docker → Registry
3. Search for `watchnexus/watchnexus`
4. Download the image
5. Go to Image → Launch
6. Configure:
   - **Port:** 8001 → 8001
   - **Volume:** `/volume1/docker/watchnexus` → `/data`
   - **Volume:** `/volume1/media/movies` → `/media/movies` (Read-only)
   - **Volume:** `/volume1/media/tv` → `/media/tv` (Read-only)
   - **Environment:**
     - `JWT_SECRET` = your-secret
     - `TZ` = Your/Timezone
7. Apply and start

### Using Container Manager (DSM 7.2+)

1. Open Container Manager → Project
2. Create new project
3. Use this `docker-compose.yml`:

```yaml
version: '3.8'
services:
  watchnexus:
    image: watchnexus/watchnexus:latest
    container_name: watchnexus
    ports:
      - "8001:8001"
    volumes:
      - /volume1/docker/watchnexus:/data
      - /volume1/media/movies:/media/movies:ro
      - /volume1/media/tv:/media/tv:ro
    environment:
      - JWT_SECRET=your-secret-here
      - TZ=America/New_York
    restart: unless-stopped
```

---

## QNAP

### Using Container Station

1. Open **Container Station**
2. Go to Images → Pull
3. Enter: `watchnexus/watchnexus:latest`
4. Create Container:
   - **Name:** watchnexus
   - **Port:** 8001 → 8001
   - **Shared Folders:**
     - `/share/Container/watchnexus` → `/data`
     - `/share/Media/Movies` → `/media/movies` (Read-only)
     - `/share/Media/TV` → `/media/tv` (Read-only)
   - **Environment:**
     - `JWT_SECRET` = your-secret
5. Create

---

## TrueNAS SCALE

### Using Apps

1. Go to **Apps** → **Discover Apps**
2. Search for WatchNexus (if available in TrueCharts)
3. Configure and install

### Using Custom App

1. Go to **Apps** → **Discover Apps** → **Custom App**
2. Configure:
   - **Application Name:** watchnexus
   - **Image:** `watchnexus/watchnexus:latest`
   - **Port:** 8001
   - **Storage:**
     - Host Path: `/mnt/pool/apps/watchnexus` → Container: `/data`
     - Host Path: `/mnt/pool/media/movies` → Container: `/media/movies` (Read Only)
     - Host Path: `/mnt/pool/media/tv` → Container: `/media/tv` (Read Only)
   - **Environment Variables:**
     - `JWT_SECRET` = your-secret
     - `TZ` = America/New_York

### Using Docker Compose (TrueNAS SCALE)

```bash
# SSH into your TrueNAS
mkdir -p /mnt/pool/apps/watchnexus
cd /mnt/pool/apps/watchnexus

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  watchnexus:
    image: watchnexus/watchnexus:latest
    container_name: watchnexus
    ports:
      - "8001:8001"
    volumes:
      - ./data:/data
      - /mnt/pool/media/movies:/media/movies:ro
      - /mnt/pool/media/tv:/media/tv:ro
    environment:
      - JWT_SECRET=change-this-secret
      - TZ=America/New_York
    restart: unless-stopped
EOF

# Start
docker-compose up -d
```

---

## TrueNAS CORE (FreeBSD Jail)

TrueNAS CORE uses FreeBSD jails instead of Docker. For WatchNexus, we recommend:

1. Create a new jail
2. Install Python 3.10+ and Node.js
3. Follow the Linux manual installation steps

```bash
# In the jail
pkg install python39 node18 npm-node18 ffmpeg git
npm install -g yarn

# Clone and install
git clone <repository> /opt/watchnexus
cd /opt/watchnexus/src/server
python3.9 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd /opt/watchnexus/src/web
yarn install
```

---

## OpenMediaVault

### Using Docker (OMV-Extras)

1. Install OMV-Extras and Docker plugin
2. Go to **OMV** → **Docker** → **Compose**
3. Add new compose file:

```yaml
version: '3.8'
services:
  watchnexus:
    image: watchnexus/watchnexus:latest
    container_name: watchnexus
    ports:
      - "8001:8001"
    volumes:
      - /srv/docker/watchnexus:/data
      - /srv/media/movies:/media/movies:ro
      - /srv/media/tv:/media/tv:ro
    environment:
      - JWT_SECRET=your-secret
      - TZ=America/New_York
    restart: unless-stopped
```

4. Deploy

---

## Generic Linux NAS

For any Linux-based NAS:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Create directory
mkdir -p /opt/watchnexus

# Run container
docker run -d \
  --name watchnexus \
  --restart unless-stopped \
  -p 8001:8001 \
  -v /opt/watchnexus/data:/data \
  -v /path/to/movies:/media/movies:ro \
  -v /path/to/tv:/media/tv:ro \
  -e JWT_SECRET=your-secret-here \
  -e TZ=America/New_York \
  watchnexus/watchnexus:latest
```

---

## Post-Installation (All Platforms)

1. Access: `http://[NAS-IP]:8001`
2. Create admin account
3. Go to Settings → Media Libraries
4. Add libraries pointing to your mounted media paths (`/media/movies`, `/media/tv`, etc.)

---

## Permissions

If you encounter permission issues:

1. Check that the container user can read your media folders
2. Use PUID/PGID environment variables if supported:
   ```yaml
   environment:
     - PUID=1000
     - PGID=1000
   ```
3. Or adjust folder permissions on the host:
   ```bash
   chmod -R 755 /path/to/media
   ```

---

## Reverse Proxy (Optional)

To access via domain name with HTTPS:

### Nginx Proxy Manager
Add proxy host:
- Domain: `watchnexus.yourdomain.com`
- Forward: `http://[NAS-IP]:8001`
- Enable SSL with Let's Encrypt

### Synology Reverse Proxy
1. Control Panel → Login Portal → Advanced
2. Add Reverse Proxy:
   - Source: `https://watchnexus.yourdomain.com:443`
   - Destination: `http://localhost:8001`

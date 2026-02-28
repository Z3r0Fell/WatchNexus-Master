# WatchNexus on NAS

Guides for Synology, QNAP, TrueNAS, and other NAS systems.

---

## Synology (DSM 7+)

Container Manager → Project → Create:

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
      - JWT_SECRET=change-this
      - TZ=America/New_York
    restart: unless-stopped
```

---

## QNAP

Container Station → Images → Pull `watchnexus/watchnexus:latest`

Create container with:
- Port 8001
- Mount `/share/Container/watchnexus` → `/data`
- Mount your media folders to `/media/movies`, `/media/tv`, etc.

---

## TrueNAS Scale

Apps → Custom App:

- **Image:** `watchnexus/watchnexus:latest`
- **Port:** 8001
- **Storage:** Mount your pool paths
- **Environment:** Set `JWT_SECRET` and `TZ`

Or SSH in and use docker-compose:

```bash
mkdir -p /mnt/pool/apps/watchnexus
cd /mnt/pool/apps/watchnexus

cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  watchnexus:
    image: watchnexus/watchnexus:latest
    ports:
      - "8001:8001"
    volumes:
      - ./data:/data
      - /mnt/pool/media/movies:/media/movies:ro
      - /mnt/pool/media/tv:/media/tv:ro
    environment:
      - JWT_SECRET=change-this
      - TZ=America/New_York
    restart: unless-stopped
EOF

docker-compose up -d
```

---

## TrueNAS Core (FreeBSD)

TrueNAS Core uses jails, not Docker. You'll need to set up a jail and install dependencies manually:

```bash
# In the jail
pkg install python39 node18 npm-node18 ffmpeg git
npm install -g yarn

git clone https://github.com/watchnexus/watchnexus.git /opt/watchnexus
cd /opt/watchnexus/src/server
python3.9 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## OpenMediaVault

Install Docker via OMV-Extras, then use docker-compose.

---

## Permission issues

If the container can't read your media:

1. Check folder permissions on the NAS
2. Try adding `PUID` and `PGID` environment variables matching your NAS user
3. Or just `chmod 755` the media folders

---

## Reverse proxy

To access via domain with HTTPS:

**Nginx Proxy Manager:**
- Domain: `watchnexus.yourdomain.com`  
- Forward to: `http://[NAS-IP]:8001`
- Enable SSL

**Synology built-in:**
- Control Panel → Login Portal → Advanced → Reverse Proxy
- Source: `https://watchnexus.yourdomain.com:443`
- Destination: `http://localhost:8001`

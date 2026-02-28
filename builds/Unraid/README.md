# WatchNexus for Unraid

## Installation via Community Applications

1. Open Unraid Web UI
2. Go to **Apps** tab
3. Search for "WatchNexus"
4. Click **Install**
5. Configure paths and settings
6. Click **Apply**

## Manual Installation

1. Go to **Docker** tab
2. Click **Add Container**
3. Click the **Template** dropdown and select **Add Container**
4. Fill in:
   - **Name:** WatchNexus
   - **Repository:** `watchnexus/watchnexus:latest`
   - **Network Type:** Bridge
   
5. Add Port Mapping:
   - **Container Port:** 8001
   - **Host Port:** 8001
   
6. Add Path Mappings:
   - `/data` → `/mnt/user/appdata/watchnexus`
   - `/media/movies` → `/mnt/user/media/movies` (Read-Only)
   - `/media/tv` → `/mnt/user/media/tv` (Read-Only)
   - `/media/music` → `/mnt/user/media/music` (Read-Only)
   
7. Add Variables:
   - `JWT_SECRET` = (generate a random string)
   - `TMDB_API_KEY` = (optional, get free at themoviedb.org)
   - `TZ` = Your/Timezone
   
8. Click **Apply**

## Post-Installation

1. Access WatchNexus at: `http://[UNRAID-IP]:8001`
2. Create your admin account
3. Add media libraries pointing to `/media/movies`, `/media/tv`, etc.

## Integration with Other Containers

### qBittorrent
If you have qBittorrent installed:
1. Open WatchNexus Settings → Downloads
2. Enter qBittorrent connection details:
   - Host: `172.17.0.1` (Docker bridge IP) or container name
   - Port: 8080 (or your configured port)
   - Username/Password: Your qBit credentials

### Prowlarr/Jackett
For indexer integration:
1. Open WatchNexus Settings → Indexers
2. Add your indexer URLs and API keys

## Updating

1. Go to **Docker** tab
2. Click the WatchNexus icon
3. Select **Update**

Or via terminal:
```bash
docker pull watchnexus/watchnexus:latest
docker restart watchnexus
```

## Backup

Your data is stored in `/mnt/user/appdata/watchnexus`. 

Use Unraid's built-in backup tools or:
```bash
cp -r /mnt/user/appdata/watchnexus /mnt/user/backup/watchnexus-$(date +%Y%m%d)
```

## Troubleshooting

### Check logs
```bash
docker logs watchnexus
```

### Container won't start
1. Check that all paths exist
2. Verify port 8001 isn't in use
3. Check Unraid Docker log

### Can't see media
1. Verify path mappings are correct
2. Check that WatchNexus user has read permissions
3. Try using PUID/PGID that match your media folder ownership

# WatchNexus Unraid Installation

## Community Applications

1. Copy `watchnexus.xml` to `/boot/config/plugins/dockerMan/templates-user/`
2. Go to **Docker** tab in Unraid
3. Click **Add Container**
4. Select **WatchNexus** from templates
5. Configure your media paths and click **Apply**

## Manual Docker Installation

```bash
docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v /mnt/user/appdata/watchnexus/data:/opt/watchnexus/backend/data \
  -v /mnt/user/appdata/watchnexus/logs:/opt/watchnexus/backend/logs \
  -v /mnt/user/media:/media:ro \
  -e TMDB_API_KEY=your_key_here \
  --restart unless-stopped \
  watchnexus/watchnexus:latest
```

## Configuration

| Path | Container Path | Description |
|------|---------------|-------------|
| `/mnt/user/appdata/watchnexus/data` | `/opt/watchnexus/backend/data` | Database and config |
| `/mnt/user/appdata/watchnexus/logs` | `/opt/watchnexus/backend/logs` | Log files |
| `/mnt/user/media` | `/media` | Your media library (read-only) |

## Access

Dashboard: `http://YOUR_UNRAID_IP:8001`

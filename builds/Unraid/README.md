# WatchNexus on Unraid

## Install via Community Apps

1. Apps tab → Search "WatchNexus" → Install
2. Set your media paths
3. Done

## Manual install

Go to Docker → Add Container:

- **Repository:** `watchnexus/watchnexus:latest`
- **Port:** 8001 → 8001

Path mappings:
- `/mnt/user/appdata/watchnexus` → `/data`
- `/mnt/user/media/movies` → `/media/movies` (read only)
- `/mnt/user/media/tv` → `/media/tv` (read only)

Variables:
- `JWT_SECRET` = some random string
- `TZ` = America/New_York (or your timezone)

## After install

1. Go to http://[UNRAID-IP]:8001
2. Create account
3. Settings → Libraries → Add your media paths

## Connecting to qBittorrent

If you have qBit running on Unraid:

1. WatchNexus Settings → Downloads
2. Host: `172.17.0.1` (docker bridge) or your qBit container name
3. Port: whatever qBit uses (usually 8080)
4. Your qBit username/password

## Updates

Docker tab → WatchNexus icon → Update

Or:
```bash
docker pull watchnexus/watchnexus:latest
docker restart watchnexus
```

## Logs

```bash
docker logs watchnexus
```

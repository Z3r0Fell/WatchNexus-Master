# WatchNexus Docker Setup

Run WatchNexus in a container. No Python/Node install needed on the host.

## Quick start

```bash
docker-compose up -d
```

Open http://localhost:8001

## Configuration

Edit `docker-compose.yml` to mount your media:

```yaml
volumes:
  - /your/movies:/media/movies:ro
  - /your/tv:/media/tv:ro
```

The `:ro` makes them read-only (recommended).

## Environment variables

| Variable | What it does |
|----------|--------------|
| `JWT_SECRET` | Auth token secret. Change this. |
| `TMDB_API_KEY` | For fetching metadata. Optional. |
| `TZ` | Timezone, e.g. `America/New_York` |

## Manual docker run

```bash
docker build -t watchnexus .

docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v /path/to/data:/data \
  -v /path/to/movies:/media/movies:ro \
  -e JWT_SECRET=change-me \
  watchnexus
```

## Updating

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Logs

```bash
docker-compose logs -f
```

## Backup

```bash
docker run --rm \
  -v watchnexus_data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/watchnexus-$(date +%Y%m%d).tar.gz /data
```

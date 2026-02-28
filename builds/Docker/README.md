# WatchNexus Docker Deployment

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd watchnexus

# Edit docker-compose.yml to set your media paths
nano builds/Docker/docker-compose.yml

# Build and start
cd builds/Docker
docker-compose up -d

# View logs
docker-compose logs -f
```

Access WatchNexus at: http://localhost:8001

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | **MUST CHANGE** |
| `TMDB_API_KEY` | TMDB API key for metadata | Optional |
| `TZ` | Timezone | `America/New_York` |
| `PORT` | Backend port | `8001` |

### Volume Mounts

Edit `docker-compose.yml` to mount your media directories:

```yaml
volumes:
  - /your/movies/path:/media/movies:ro
  - /your/tv/path:/media/tv:ro
  - /your/music/path:/media/music:ro
```

The `:ro` suffix makes them read-only for safety.

## Build Manually

```bash
# From repository root
docker build -f builds/Docker/Dockerfile -t watchnexus .

# Run
docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v watchnexus_data:/data \
  -v /path/to/media:/media:ro \
  -e JWT_SECRET=your-secret-here \
  watchnexus
```

## Updating

```bash
cd builds/Docker
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Backup

```bash
# Backup data
docker run --rm \
  -v watchnexus_data:/data:ro \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/watchnexus-backup-$(date +%Y%m%d).tar.gz /data
```

## Troubleshooting

### Check logs
```bash
docker-compose logs -f watchnexus
```

### Enter container
```bash
docker exec -it watchnexus /bin/bash
```

### Reset database
```bash
docker-compose down -v  # Warning: deletes all data
docker-compose up -d
```

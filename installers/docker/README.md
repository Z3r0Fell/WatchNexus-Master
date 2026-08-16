# WatchNexus Docker Installation

## Quick Start

```bash
# Pull the official image
docker pull watchnexus/watchnexus:1.0.3-standard

# Start WatchNexus
docker compose up -d

# Access the dashboard
open http://localhost:8001
```

## Configuration

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `WATCHNEXUS_PORT` | `8001` | Server port |
| `TMDB_API_KEY` | *(empty)* | TMDB API key for metadata |

### Media Volumes
Edit `docker-compose.yml` to mount your media directories:

```yaml
volumes:
  - /path/to/movies:/media/movies:ro
  - /path/to/tvshows:/media/tvshows:ro
  - /path/to/music:/media/music:ro
```

### Persistent Data
Data is stored in Docker volumes:
- `watchnexus-data` - Database and configuration
- `watchnexus-logs` - Application logs

## Management

```bash
# View logs
docker compose logs -f watchnexus

# Restart
docker compose restart

# Update
docker compose pull && docker compose up -d

# Stop
docker compose down

# Remove (including data)
docker compose down -v
```

## Building from Source

```bash
docker build -t watchnexus:latest .
docker run -d -p 8001:8001 --name watchnexus watchnexus:latest
```

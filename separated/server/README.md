# WatchNexus Server

The backend API server for WatchNexus - a unified media pipeline.

## Tech Stack
- **Framework**: FastAPI (Python 3.9+)
- **Database**: SQLite (via aiosqlite)
- **Auth**: JWT tokens
- **API Style**: REST

## Features
- User authentication (password + quick login)
- Media library management (Marmalade)
- Indexer integration (Compote)
- Download management (Fondue torrent engine)
- Playlist management (Drizzle)
- Jellyfin API compatibility (Gelatin)
- Subtitle integration (Garnish)
- System health monitoring (Zest)

## Quick Start

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Run server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

## Environment Variables

See `.env.example` for all configuration options.

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## License

GPL-2.0

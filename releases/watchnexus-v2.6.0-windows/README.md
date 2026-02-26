# WatchNexus v2.6.0

## Quick Start (Linux/macOS)
```bash
./start.sh
```

Then open http://localhost:8001 in your browser.

## Requirements
- Python 3.9+
- Internet connection (for TMDB metadata)

## What's New in v2.6.0
- **Weather Gadget**: Real-time weather and 7-day forecast (Open-Meteo)
- **Podcasts**: Subscribe to RSS feeds, playback progress, queue
- **Internet Radio**: 50,000+ stations worldwide
- **Photos**: Local photo library browser
- **Web Video**: Stream from YouTube, Vimeo, etc (yt-dlp)

## Configuration
Edit `server/.env` to set:
- `TMDB_API_KEY`: Get from https://themoviedb.org/settings/api
- `JWT_SECRET`: Random string for session security

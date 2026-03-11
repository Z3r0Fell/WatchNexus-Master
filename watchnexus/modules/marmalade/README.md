# Marmalade - Library Manager

Media library management module for WatchNexus.

## Features
- Directory scanning with file type detection
- TMDB API integration for movie/TV metadata
- Poster and backdrop art retrieval
- Genre, rating, and runtime enrichment
- Background async scanning with progress tracking

## API Routes
- `GET /api/libraries` - List all libraries
- `POST /api/libraries` - Create library
- `DELETE /api/libraries/{id}` - Delete library
- `POST /api/libraries/{id}/scan` - Start background scan
- `GET /api/libraries/{id}/scan/status` - Check scan progress
- `GET /api/libraries/{id}/media` - Get media items

## Configuration
Set `TMDB_API_KEY` in Settings > Integrations or via environment variable.

## Supported File Types
`.mkv`, `.mp4`, `.avi`, `.mov`, `.wmv`, `.flv`, `.m4v`, `.webm`, `.mp3`, `.flac`, `.wav`, `.aac`, `.ogg`

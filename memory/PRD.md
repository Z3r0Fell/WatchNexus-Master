# WatchNexus - Product Requirements Document

## Project Status: ALPHA / DEVELOPMENT

**NOT PRODUCTION READY** - See README.md for detailed assessment.

## What's Been Built

### Frontend (React)
- Custom UI with glassmorphism, violet theme
- TMDB discovery (trending, search, genres)
- Watchlist, watch progress
- Sidebar navigation
- User auth (JWT)

### Backend (FastAPI)
- TMDB API proxy with caching
- User auth endpoints
- Jellyfin API proxy at /api/jellyfin/*
- MongoDB for user data

### Jellyfin Fork
- Rebranded strings (151+ changed)
- Custom theme CSS with animations
- Server running on port 8096

## What's NOT Done
- Video playback in React UI
- Local library browsing in React UI
- User sync between systems
- IPTV setup wizard
- Real download integration
- Desktop packaging
- Installers

## Files Structure
- /app/frontend - React UI
- /app/backend - FastAPI
- /app/watchnexus/server - Jellyfin server
- /app/README.md - Comprehensive docs

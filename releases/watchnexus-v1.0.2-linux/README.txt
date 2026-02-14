WatchNexus v1.0.2 - Unified Media Pipeline
============================================

QUICK START
-----------
1. Make sure MongoDB is running (or use Docker):
   docker run -d --name mongodb -p 27017:27017 mongo:7

2. Run the start script:
   ./start-watchnexus.sh

3. Open http://localhost:8001 in your browser

REQUIREMENTS
------------
- Python 3.10+ (tested on 3.14)
- MongoDB 6.0+
- ffmpeg (optional, for transcoding)

NOTES
-----
- First run will install Python dependencies (may take a few minutes)
- Configuration is stored in backend/.env
- Downloads go to /media/downloads by default

TORRENT ENGINE
--------------
WatchNexus includes a built-in torrent engine (Fondue) using LTorrent.
This is a pure Python implementation with NO system dependencies.

Supports:
- Magnet links (full support)
- .torrent files
- Sequential download for streaming

SUPPORT
-------
GitHub: https://github.com/watchnexus/watchnexus

WatchNexus v1.0.1 - Unified Media Pipeline
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
WatchNexus includes a built-in torrent engine (Fondue) using aiotorrent.
This is a pure Python implementation with NO system dependencies.

Note: aiotorrent currently supports .torrent files only.
Magnet link support is planned for future versions.

SUPPORT
-------
GitHub: https://github.com/watchnexus/watchnexus

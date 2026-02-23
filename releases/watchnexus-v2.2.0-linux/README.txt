
╔════════════════════════════════════════════════════════════════════╗
║  WatchNexus v2.2.0 - Unified Media Pipeline                      ║
║  Your Personal Netflix, Plex & Jellyfin - All in One               ║
╚════════════════════════════════════════════════════════════════════╝

🚀 QUICK START (Linux/Mac)
─────────────────────────
1. Open a terminal in this folder
2. Run: ./start-watchnexus.sh
3. Open http://localhost:8001 in your browser
4. Create your account and start watching!

That's it! No database setup, no Docker, no complex configuration.


📋 REQUIREMENTS
─────────────────────────
• Python 3.10 or higher
• That's literally it!

Optional:
• ffmpeg (for transcoding)
• TMDB API key (for movie/TV metadata)


🎬 FEATURES
─────────────────────────
• Stream movies and TV shows
• Built-in torrent engine (no external apps needed)
• Automatic subtitle downloads
• Jellyfin/Emby client compatible
• Watch parties with friends
• Works on your local network


💾 DATA STORAGE
─────────────────────────
All your data is stored locally:
• Database: backend/watchnexus.db (SQLite)
• Config: backend/.env
• Downloads: configurable in settings


🔧 TORRENT ENGINE
─────────────────────────
WatchNexus includes Fondue, a built-in torrent engine:
• 100% Python - no system dependencies
• Supports magnet links and .torrent files  
• Sequential download for instant streaming
• No qBittorrent/Deluge required!


📱 CLIENT APPS
─────────────────────────
Connect existing Jellyfin/Emby apps to WatchNexus:
• Jellyfin iOS/Android apps
• Emby apps
• Kodi with Jellyfin addon
Just point them to: http://your-server:8001/emby


🆘 TROUBLESHOOTING
─────────────────────────
"Permission denied": chmod +x start-watchnexus.sh
"Python not found": Install Python 3.10+
"Port in use": Another app is using port 8001


📚 MORE INFO
─────────────────────────
GitHub: https://github.com/watchnexus/watchnexus

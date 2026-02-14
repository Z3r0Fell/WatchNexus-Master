#!/usr/bin/env python3
"""
WatchNexus Release Package Generator
Creates distributable ZIP packages for Linux, Windows, and macOS
"""

import os
import shutil
import zipfile
from pathlib import Path
from datetime import datetime

VERSION = "1.2.3"  # Port conflict prompt, Drizzle playlist system, auth token fix
PROJECT_ROOT = Path("/app")
RELEASES_DIR = PROJECT_ROOT / "releases"
DIST_DIR = PROJECT_ROOT / "dist"

# Files/folders to exclude from packages
EXCLUDE_PATTERNS = [
    "__pycache__",
    "*.pyc",
    ".git",
    ".env",
    "venv",
    "node_modules",
    ".DS_Store",
    "*.log",
    "test_reports",
    "tests",
    "watchnexus.db",  # Don't include dev database
]

def should_exclude(path: Path) -> bool:
    """Check if a path should be excluded."""
    name = path.name
    for pattern in EXCLUDE_PATTERNS:
        if pattern.startswith("*"):
            if name.endswith(pattern[1:]):
                return True
        elif name == pattern:
            return True
    return False

def copy_directory(src: Path, dst: Path, exclude_tests: bool = True):
    """Copy directory with exclusions."""
    if not src.exists():
        print(f"  Warning: {src} does not exist, skipping")
        return
    
    for item in src.iterdir():
        if should_exclude(item):
            continue
        if exclude_tests and item.name == "tests":
            continue
            
        dst_item = dst / item.name
        
        if item.is_dir():
            dst_item.mkdir(parents=True, exist_ok=True)
            copy_directory(item, dst_item, exclude_tests)
        else:
            dst_item.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dst_item)

def create_linux_package():
    """Create Linux release package."""
    print("\n📦 Creating Linux package...")
    
    pkg_name = f"watchnexus-v{VERSION}-linux"
    pkg_dir = RELEASES_DIR / pkg_name
    
    # Clean existing
    if pkg_dir.exists():
        shutil.rmtree(pkg_dir)
    pkg_dir.mkdir(parents=True)
    
    # Copy backend
    print("  Copying backend...")
    copy_directory(PROJECT_ROOT / "backend", pkg_dir / "backend")
    
    # Copy frontend build
    print("  Copying frontend...")
    frontend_build = PROJECT_ROOT / "frontend" / "build"
    if frontend_build.exists():
        copy_directory(frontend_build, pkg_dir / "frontend", exclude_tests=False)
    else:
        print("  Warning: Frontend build not found, run 'yarn build' first")
    
    # Create start script
    start_script = pkg_dir / "start-watchnexus.sh"
    start_script.write_text('''#!/bin/bash
#===============================================
#  WatchNexus - Unified Media Pipeline
#  Version: ''' + VERSION + '''
#  
#  ZERO EXTERNAL DEPENDENCIES
#  Just Python - that's it!
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8001
PID_FILE="$SCRIPT_DIR/watchnexus.pid"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
NC='\\033[0m'

# Function to check what's running on port 8001
check_port() {
    if command -v lsof &> /dev/null; then
        PROCESS_INFO=$(lsof -i:$PORT -sTCP:LISTEN 2>/dev/null)
        if [ -n "$PROCESS_INFO" ]; then
            PID=$(lsof -i:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)
            PNAME=$(ps -p $PID -o comm= 2>/dev/null)
            echo "$PID|$PNAME"
        fi
    elif command -v ss &> /dev/null; then
        PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\\K[0-9]+' | head -1)
        if [ -n "$PID" ]; then
            PNAME=$(ps -p $PID -o comm= 2>/dev/null)
            echo "$PID|$PNAME"
        fi
    elif command -v netstat &> /dev/null; then
        PID=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | grep -oP '[0-9]+(?=/)' | head -1)
        if [ -n "$PID" ]; then
            PNAME=$(ps -p $PID -o comm= 2>/dev/null)
            echo "$PID|$PNAME"
        fi
    fi
}

# Function to kill process on port
kill_port() {
    RESULT=$(check_port)
    if [ -n "$RESULT" ]; then
        PID=$(echo "$RESULT" | cut -d'|' -f1)
        kill "$PID" 2>/dev/null
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null
        fi
        return 0
    fi
    return 1
}

# Handle stop command
if [ "$1" = "stop" ]; then
    echo -e "${YELLOW}Stopping WatchNexus...${NC}"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm -f "$PID_FILE"
            echo -e "${GREEN}✓ Stopped (PID: $PID)${NC}"
            exit 0
        fi
        rm -f "$PID_FILE"
    fi
    # Also check port directly
    if kill_port; then
        echo -e "${GREEN}✓ Stopped process on port $PORT${NC}"
    else
        echo -e "${YELLOW}No WatchNexus instance found running${NC}"
    fi
    exit 0
fi

# Handle status command
if [ "$1" = "status" ]; then
    RESULT=$(check_port)
    if [ -n "$RESULT" ]; then
        PID=$(echo "$RESULT" | cut -d'|' -f1)
        PNAME=$(echo "$RESULT" | cut -d'|' -f2)
        echo -e "${GREEN}Port $PORT is in use${NC}"
        echo -e "  PID:     $PID"
        echo -e "  Process: $PNAME"
        echo -e "  URL:     http://localhost:$PORT"
        if [ -f "$SCRIPT_DIR/backend/logs/watchnexus.log" ]; then
            echo -e "  Logs:    $SCRIPT_DIR/backend/logs/watchnexus.log"
        fi
    else
        echo -e "${YELLOW}Port $PORT is free - WatchNexus is not running${NC}"
    fi
    exit 0
fi

# Handle kill command (force kill whatever is on 8001)
if [ "$1" = "kill" ]; then
    RESULT=$(check_port)
    if [ -n "$RESULT" ]; then
        PID=$(echo "$RESULT" | cut -d'|' -f1)
        PNAME=$(echo "$RESULT" | cut -d'|' -f2)
        echo -e "${YELLOW}Killing process on port $PORT...${NC}"
        echo -e "  PID:     $PID"
        echo -e "  Process: $PNAME"
        kill_port
        echo -e "${GREEN}✓ Killed${NC}"
    else
        echo -e "${YELLOW}Nothing running on port $PORT${NC}"
    fi
    exit 0
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     🎬 ${GREEN}WatchNexus v''' + VERSION + '''${NC}                    ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}     Unified Media Pipeline                     ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: Python 3 not found${NC}"
    echo "  Install Python 3.10+ from your package manager:"
    echo "    Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip"
    echo "    Fedora: sudo dnf install python3"
    echo "    Arch: sudo pacman -S python"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo -e "  Python version: ${GREEN}$PYTHON_VERSION${NC}"

# Check if port 8001 is in use
RESULT=$(check_port)
if [ -n "$RESULT" ]; then
    PID=$(echo "$RESULT" | cut -d'|' -f1)
    PNAME=$(echo "$RESULT" | cut -d'|' -f2)
    echo ""
    echo -e "${YELLOW}⚠ Port $PORT is already in use${NC}"
    echo -e "  ${CYAN}PID:${NC}     $PID"
    echo -e "  ${CYAN}Process:${NC} $PNAME"
    echo ""
    
    # Check if it's already WatchNexus running
    if [[ "$PNAME" == *"python"* ]] || [[ "$PNAME" == *"uvicorn"* ]]; then
        echo -e "  ${BLUE}This looks like a WatchNexus instance.${NC}"
    fi
    
    echo -e "  Would you like to kill this process and start WatchNexus?"
    echo -e "  ${CYAN}[Y/n]:${NC} "
    read -r RESPONSE
    
    # Default to yes if empty or y/Y
    if [[ -z "$RESPONSE" ]] || [[ "$RESPONSE" =~ ^[Yy]$ ]]; then
        echo -e "  ${GREEN}Killing process...${NC}"
        kill_port
        sleep 1
        echo -e "  ${GREEN}✓ Port $PORT is now free${NC}"
        echo ""
    else
        echo -e "  ${RED}Aborting. Port $PORT is still in use.${NC}"
        echo -e "  ${YELLOW}You can manually stop the process with:${NC}"
        echo -e "    kill $PID"
        echo -e "  ${YELLOW}Or run WatchNexus with:${NC}"
        echo -e "    ./start-watchnexus.sh kill"
        exit 1
    fi
fi

# Check/create Python venv
if [ ! -f "backend/venv/bin/activate" ]; then
    echo ""
    echo -e "${YELLOW}First run - setting up Python environment...${NC}"
    echo "  This may take 1-2 minutes."
    echo ""
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
    deactivate
    cd ..
    echo -e "${GREEN}✓ Setup complete!${NC}"
    echo ""
fi

# Create minimal .env if needed (SQLite doesn't need external config)
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << EOF
# WatchNexus Configuration
# Database: SQLite (automatic, no setup needed)
# Add your TMDB API key for movie/TV metadata:
# TMDB_API_KEY=your_key_here
EOF
fi

cd backend
source venv/bin/activate

# Create logs directory
mkdir -p logs

echo ""
echo -e "  ${GREEN}Starting WatchNexus server...${NC}"
echo ""
echo -e "  📺 Open in browser: ${BLUE}http://localhost:$PORT${NC}"
echo -e "  📁 Logs:            ${BLUE}$SCRIPT_DIR/backend/logs/watchnexus.log${NC}"
echo -e "  🛑 Stop:            ${YELLOW}Ctrl+C${NC} or ${YELLOW}./start-watchnexus.sh stop${NC}"
echo ""
echo -e "  ${CYAN}Commands:${NC}"
echo -e "    ./start-watchnexus.sh stop   - Stop the server"
echo -e "    ./start-watchnexus.sh status - Check what's on port 8001"
echo -e "    ./start-watchnexus.sh kill   - Force kill port 8001"
echo ""

# Save PID for stop command
echo $$ > "$PID_FILE"

# Trap to clean up PID file on exit
trap "rm -f $PID_FILE" EXIT

python -m uvicorn server:app --host 127.0.0.1 --port $PORT
''')
    os.chmod(start_script, 0o755)
    
    # Create README
    readme = pkg_dir / "README.txt"
    readme.write_text(f'''
╔════════════════════════════════════════════════════════════════════╗
║  WatchNexus v{VERSION} - Unified Media Pipeline                      ║
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
''')
    
    print(f"  ✓ Linux package created: {pkg_dir}")
    return pkg_dir

def create_windows_package():
    """Create Windows release package."""
    print("\n📦 Creating Windows package...")
    
    pkg_name = f"watchnexus-v{VERSION}-windows"
    pkg_dir = RELEASES_DIR / pkg_name
    
    # Clean existing
    if pkg_dir.exists():
        shutil.rmtree(pkg_dir)
    pkg_dir.mkdir(parents=True)
    
    # Copy backend
    print("  Copying backend...")
    copy_directory(PROJECT_ROOT / "backend", pkg_dir / "backend")
    
    # Copy frontend build
    print("  Copying frontend...")
    frontend_build = PROJECT_ROOT / "frontend" / "build"
    if frontend_build.exists():
        copy_directory(frontend_build, pkg_dir / "frontend", exclude_tests=False)
    
    # Create Windows batch file
    batch_script = pkg_dir / "START-WATCHNEXUS.bat"
    batch_script.write_text('''@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title WatchNexus v''' + VERSION + '''

echo.
echo ╔════════════════════════════════════════════════╗
echo ║     WatchNexus v''' + VERSION + '''                        ║
echo ║     Unified Media Pipeline                     ║
echo ║     ZERO EXTERNAL DEPENDENCIES                 ║
echo ╚════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Check for Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found!
    echo.
    echo Please install Python 3.10 or higher:
    echo   1. Go to https://www.python.org/downloads/
    echo   2. Download Python 3.10+
    echo   3. IMPORTANT: Check "Add Python to PATH" during install
    echo.
    pause
    exit /b 1
)

REM Show Python version
for /f "tokens=*" %%i in ('python --version') do echo   %%i detected

REM Check/create venv
if not exist "backend\\venv\\Scripts\\activate.bat" (
    echo.
    echo [SETUP] First run - setting up Python environment...
    echo   This may take 1-2 minutes.
    echo.
    cd backend
    python -m venv venv
    call venv\\Scripts\\activate.bat
    pip install --upgrade pip --quiet
    pip install -r requirements.txt
    call deactivate
    cd ..
    echo.
    echo [OK] Setup complete!
)

REM Create minimal .env if needed
if not exist "backend\\.env" (
    echo # WatchNexus Configuration> backend\\.env
    echo # Database: SQLite (automatic, no setup needed)>> backend\\.env
    echo # Add your TMDB API key for movie/TV metadata:>> backend\\.env
    echo # TMDB_API_KEY=your_key_here>> backend\\.env
)

cd backend
call venv\\Scripts\\activate.bat
echo.
echo   Starting WatchNexus server...
echo.
echo   Open in your browser: http://localhost:8001
echo   Press Ctrl+C to stop
echo.
python -m uvicorn server:app --host 127.0.0.1 --port 8001
''')
    
    # Create README
    readme = pkg_dir / "README.txt"
    readme.write_text(f'''
╔════════════════════════════════════════════════════════════════════╗
║  WatchNexus v{VERSION} - Unified Media Pipeline                      ║
║  Your Personal Netflix, Plex & Jellyfin - All in One               ║
╚════════════════════════════════════════════════════════════════════╝

🚀 QUICK START (Windows)
─────────────────────────
1. Install Python 3.10+ from https://www.python.org/downloads/
   ⚠️ IMPORTANT: Check "Add Python to PATH" during installation!
   
2. Double-click START-WATCHNEXUS.bat

3. Open http://localhost:8001 in your browser

4. Create your account and start watching!

That's it! No database setup, no Docker, no complex configuration.


📋 REQUIREMENTS
─────────────────────────
• Python 3.10 or higher (with "Add to PATH" checked)
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
• Database: backend\\watchnexus.db (SQLite)
• Config: backend\\.env
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
"Python not found": 
  - Reinstall Python with "Add to PATH" checked
  - Or add Python to PATH manually

"Port in use": 
  - Another app is using port 8001
  - Close the other app or change port


📚 MORE INFO
─────────────────────────
GitHub: https://github.com/watchnexus/watchnexus
''')
    
    print(f"  ✓ Windows package created: {pkg_dir}")
    return pkg_dir

def create_zip(source_dir: Path, output_name: str):
    """Create a ZIP file from a directory."""
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = DIST_DIR / f"{output_name}.zip"
    
    print(f"  Creating {zip_path.name}...")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_path in source_dir.rglob('*'):
            if file_path.is_file():
                arcname = file_path.relative_to(source_dir.parent)
                zf.write(file_path, arcname)
    
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"  ✓ Created: {zip_path} ({size_mb:.1f} MB)")
    return zip_path

def main():
    print("=" * 50)
    print(f"WatchNexus Release Generator v{VERSION}")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)
    
    # Create packages
    linux_dir = create_linux_package()
    windows_dir = create_windows_package()
    
    # Create ZIPs
    print("\n📦 Creating ZIP archives...")
    create_zip(linux_dir, f"watchnexus-v{VERSION}-linux")
    create_zip(windows_dir, f"watchnexus-v{VERSION}-windows")
    
    print("\n" + "=" * 50)
    print("✅ Release packages created successfully!")
    print("=" * 50)
    print(f"\nPackages available in: {DIST_DIR}")
    print("\nTo test locally:")
    print("  Linux:   cd releases/watchnexus-v{VERSION}-linux && ./start-watchnexus.sh")
    print("  Windows: cd releases\\watchnexus-v{VERSION}-windows && START-WATCHNEXUS.bat")

if __name__ == "__main__":
    main()

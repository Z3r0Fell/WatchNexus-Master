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

VERSION = "1.0.1"  # Updated version with aiotorrent fix
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
#===============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo "=============================================="
echo "  WatchNexus v''' + VERSION + ''' - Starting..."
echo "=============================================="
echo ""

# Check for MongoDB
if ! command -v mongod &> /dev/null && ! pgrep -x mongod > /dev/null && ! docker ps 2>/dev/null | grep -q mongo; then
    echo -e "${YELLOW}WARNING: MongoDB not detected${NC}"
    echo "  Install MongoDB or use Docker:"
    echo "    docker run -d --name mongodb -p 27017:27017 mongo:7"
    echo ""
fi

# Check/create Python venv
if [ ! -f "backend/venv/bin/activate" ]; then
    echo "Setting up Python environment (first run)..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    cd ..
    echo -e "${GREEN}Setup complete!${NC}"
    echo ""
fi

# Check/create .env
if [ ! -f "backend/.env" ]; then
    echo "Creating default configuration..."
    cat > backend/.env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
EOF
fi

cd backend
source venv/bin/activate
echo ""
echo "Starting WatchNexus server..."
echo -e "Access at: ${GREEN}http://localhost:8001${NC}"
echo "Press Ctrl+C to stop."
echo ""
python -m uvicorn server:app --host 127.0.0.1 --port 8001
''')
    os.chmod(start_script, 0o755)
    
    # Create README
    readme = pkg_dir / "README.txt"
    readme.write_text(f'''WatchNexus v{VERSION} - Unified Media Pipeline
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

echo ==============================================
echo   WatchNexus v''' + VERSION + ''' - Starting...
echo ==============================================
echo.

cd /d "%~dp0"

REM Check for Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python not found. Please install Python 3.10+
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check/create venv
if not exist "backend\\venv\\Scripts\\activate.bat" (
    echo Setting up Python environment (first run)...
    cd backend
    python -m venv venv
    call venv\\Scripts\\activate.bat
    pip install --upgrade pip
    pip install -r requirements.txt
    call venv\\Scripts\\deactivate.bat
    cd ..
    echo Setup complete!
    echo.
)

REM Check/create .env
if not exist "backend\\.env" (
    echo Creating default configuration...
    (
        echo MONGO_URL=mongodb://localhost:27017
        echo DB_NAME=watchnexus
    ) > backend\\.env
)

cd backend
call venv\\Scripts\\activate.bat
echo.
echo Starting WatchNexus server...
echo Access at: http://localhost:8001
echo Press Ctrl+C to stop.
echo.
python -m uvicorn server:app --host 127.0.0.1 --port 8001
''')
    
    # Create README
    readme = pkg_dir / "README.txt"
    readme.write_text(f'''WatchNexus v{VERSION} - Unified Media Pipeline
============================================

QUICK START (Windows)
---------------------
1. Install Python 3.10+ from https://www.python.org/downloads/
   IMPORTANT: Check "Add Python to PATH" during installation

2. Install MongoDB:
   - Download from https://www.mongodb.com/try/download/community
   - Or use Docker Desktop

3. Double-click START-WATCHNEXUS.bat

4. Open http://localhost:8001 in your browser

REQUIREMENTS
------------
- Python 3.10+ (add to PATH during install)
- MongoDB 6.0+
- ffmpeg (optional, for transcoding)

NOTES
-----
- First run will install Python dependencies (may take a few minutes)
- Configuration is stored in backend\\.env
- Downloads go to C:\\Users\\<you>\\Downloads by default

SUPPORT
-------
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

#!/usr/bin/env python3
"""
WatchNexus Repository Splitter
Splits the monorepo into separate module repositories for GitHub
"""

import os
import shutil
from pathlib import Path

BASE_DIR = Path("/app")
SPLIT_DIR = BASE_DIR / "WN-Split"

def create_readme(repo_path, name, emoji, description, dependencies, endpoints=None):
    """Create a README.md for the module"""
    endpoints_section = ""
    if endpoints:
        endpoints_section = "\n## API Endpoints\n\n" + "\n".join(f"- `{e}`" for e in endpoints)
    
    readme = f"""# {name} {emoji}

{description}

Part of the [WatchNexus](https://github.com/WatchNexus/watchnexus) modular media pipeline.

## Installation

```bash
pip install {repo_path.name}
```

## Dependencies

{chr(10).join(f"- {d}" for d in dependencies) if dependencies else "None (base package)"}
{endpoints_section}

## Usage

```python
from {repo_path.name.replace('-', '_')} import *

# See documentation for full usage
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
"""
    (repo_path / "README.md").write_text(readme)

def create_setup_py(repo_path, name, description, dependencies):
    """Create setup.py for the module"""
    deps = [f'"{d}"' for d in dependencies] if dependencies else []
    
    setup = f'''from setuptools import setup, find_packages

setup(
    name="{repo_path.name}",
    version="1.0.0",
    description="{description}",
    author="WatchNexus Team",
    author_email="team@watchnexus.com",
    url="https://github.com/WatchNexus/{repo_path.name}",
    packages=find_packages(where="src"),
    package_dir={{"": "src"}},
    install_requires=[
        {", ".join(deps)}
    ],
    python_requires=">=3.9",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
'''
    (repo_path / "setup.py").write_text(setup)

def create_license(repo_path):
    """Create MIT LICENSE file"""
    license_text = """MIT License

Copyright (c) 2024-2025 WatchNexus

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
    (repo_path / "LICENSE").write_text(license_text)

def create_contributing(repo_path):
    """Create CONTRIBUTING.md"""
    contributing = """# Contributing to WatchNexus

Thank you for your interest in contributing!

## How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Write/update tests
5. Run tests: `pytest tests/`
6. Commit: `git commit -m 'Add amazing feature'`
7. Push: `git push origin feature/amazing-feature`
8. Open a Pull Request

## Code Style

- Follow PEP 8 for Python code
- Use type hints
- Write docstrings for public functions
- Keep functions focused and small

## Testing

All new features must include tests. Run the test suite with:

```bash
pytest tests/ -v
```

## Questions?

Open an issue or join our Discord community.
"""
    (repo_path / "CONTRIBUTING.md").write_text(contributing)

def create_gitignore(repo_path):
    """Create .gitignore"""
    gitignore = """# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual environments
venv/
ENV/
env/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Testing
.pytest_cache/
.coverage
htmlcov/

# OS
.DS_Store
Thumbs.db
"""
    (repo_path / ".gitignore").write_text(gitignore)

def split_wn_core():
    """Create wn-core - Core framework and shared utilities"""
    repo = SPLIT_DIR / "wn-core"
    src = repo / "src" / "wn_core"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    # Create __init__.py
    init_content = '''"""
WatchNexus Core - Shared utilities and base components
"""

from .config import Config, load_config
from .database import get_database, DatabaseManager
from .auth import create_token, verify_token, require_auth
from .utils import format_size, format_duration, sanitize_filename

__version__ = "1.0.0"
__all__ = [
    "Config", "load_config",
    "get_database", "DatabaseManager", 
    "create_token", "verify_token", "require_auth",
    "format_size", "format_duration", "sanitize_filename"
]
'''
    (src / "__init__.py").write_text(init_content)
    
    # Extract config utilities
    config_content = '''"""Configuration management for WatchNexus"""
import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    """Application configuration"""
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "watchnexus"
    jwt_secret: str = "change-me-in-production"
    tmdb_api_key: Optional[str] = None
    
    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            mongo_url=os.environ.get("MONGO_URL", cls.mongo_url),
            db_name=os.environ.get("DB_NAME", cls.db_name),
            jwt_secret=os.environ.get("JWT_SECRET", cls.jwt_secret),
            tmdb_api_key=os.environ.get("TMDB_API_KEY"),
        )

def load_config() -> Config:
    """Load configuration from environment"""
    return Config.from_env()
'''
    (src / "config.py").write_text(config_content)
    
    # Database utilities
    db_content = '''"""Database connection management"""
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

_client: Optional[AsyncIOMotorClient] = None
_db = None

class DatabaseManager:
    """Manages MongoDB connections"""
    
    def __init__(self, mongo_url: str, db_name: str):
        self.mongo_url = mongo_url
        self.db_name = db_name
        self.client = None
        self.db = None
    
    async def connect(self):
        self.client = AsyncIOMotorClient(self.mongo_url)
        self.db = self.client[self.db_name]
        return self.db
    
    async def disconnect(self):
        if self.client:
            self.client.close()

def get_database():
    """Get the current database instance"""
    global _db
    return _db
'''
    (src / "database.py").write_text(db_content)
    
    # Auth utilities
    auth_content = '''"""Authentication utilities"""
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
from functools import wraps

def create_token(user_id: str, secret: str, expires_hours: int = 24) -> str:
    """Create a JWT token"""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=expires_hours),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256")

def verify_token(token: str, secret: str) -> Optional[Dict]:
    """Verify and decode a JWT token"""
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None

def require_auth(func):
    """Decorator to require authentication"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Implementation depends on framework
        return await func(*args, **kwargs)
    return wrapper
'''
    (src / "auth.py").write_text(auth_content)
    
    # Utility functions
    utils_content = '''"""Common utility functions"""
import re
from typing import Union

def format_size(size_bytes: Union[int, float]) -> str:
    """Format bytes to human readable string"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} PB"

def format_duration(seconds: int) -> str:
    """Format seconds to HH:MM:SS"""
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"

def sanitize_filename(filename: str) -> str:
    """Remove invalid characters from filename"""
    return re.sub(r\'[<>:"/\\\\|?*]\', "", filename)
'''
    (src / "utils.py").write_text(utils_content)
    
    create_readme(repo, "WatchNexus Core", "🎯", 
                  "Core framework and shared utilities for WatchNexus modules.",
                  [])
    create_setup_py(repo, "wn-core", "WatchNexus Core Framework",
                    ["motor>=3.0.0", "pyjwt>=2.0.0", "python-dotenv>=1.0.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-core created")

def split_wn_marmalade():
    """Create wn-marmalade - Media server module"""
    repo = SPLIT_DIR / "wn-marmalade"
    src = repo / "src" / "wn_marmalade"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    # Copy marmalade server code
    source_file = BASE_DIR / "backend" / "marmalade_server.py"
    if source_file.exists():
        shutil.copy(source_file, src / "server.py")
    
    # Create __init__.py
    init_content = '''"""
WatchNexus Marmalade - Media Server Module 🍊
"""
from .server import MarmaladeServer, MediaLibrary

__version__ = "1.0.0"
__all__ = ["MarmaladeServer", "MediaLibrary"]
'''
    (src / "__init__.py").write_text(init_content)
    
    create_readme(repo, "WatchNexus Marmalade", "🍊",
                  "Media server module for library management, scanning, and streaming.",
                  ["wn-core>=1.0.0", "aiofiles>=23.0.0"],
                  ["GET /api/marmalade/libraries", "POST /api/marmalade/libraries",
                   "GET /api/marmalade/media", "GET /api/marmalade/stream/{id}"])
    create_setup_py(repo, "wn-marmalade", "WatchNexus Media Server",
                    ["wn-core>=1.0.0", "aiofiles>=23.0.0", "watchdog>=3.0.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-marmalade created")

def split_wn_compote():
    """Create wn-compote - Indexer manager with Syrup scrapers"""
    repo = SPLIT_DIR / "wn-compote"
    src = repo / "src" / "wn_compote"
    src.mkdir(parents=True, exist_ok=True)
    (src / "syrup").mkdir(exist_ok=True)
    (src / "syrup" / "scrapers").mkdir(exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    # Copy compote
    source_file = BASE_DIR / "backend" / "compote.py"
    if source_file.exists():
        shutil.copy(source_file, src / "compote.py")
    
    # Copy syrup scrapers
    syrup_source = BASE_DIR / "backend" / "syrup_scrapers.py"
    if syrup_source.exists():
        shutil.copy(syrup_source, src / "syrup" / "scrapers.py")
    
    # Create __init__.py files
    (src / "__init__.py").write_text('''"""
WatchNexus Compote - Indexer Manager 🍇
Includes Syrup scrapers and Pulp usenet support
"""
from .compote import CompoteManager

__version__ = "1.0.0"
__all__ = ["CompoteManager"]
''')
    
    (src / "syrup" / "__init__.py").write_text('''"""Syrup - Web Scrapers"""
from .scrapers import *
''')
    
    create_readme(repo, "WatchNexus Compote", "🍇",
                  "Indexer manager with Syrup scrapers for torrent sites and Pulp for Usenet.",
                  ["wn-core>=1.0.0", "beautifulsoup4>=4.12.0", "aiohttp>=3.9.0"],
                  ["GET /api/compote/indexers", "GET /api/syrup/search",
                   "POST /api/compote/test"])
    create_setup_py(repo, "wn-compote", "WatchNexus Indexer Manager",
                    ["wn-core>=1.0.0", "beautifulsoup4>=4.12.0", "aiohttp>=3.9.0", "lxml>=5.0.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-compote created")

def split_wn_fondue():
    """Create wn-fondue - Torrent download engine"""
    repo = SPLIT_DIR / "wn-fondue"
    src = repo / "src" / "wn_fondue"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "fondue.py"
    if source_file.exists():
        shutil.copy(source_file, src / "engine.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Fondue - Torrent Download Engine 🫕
"""
from .engine import FondueEngine

__version__ = "1.0.0"
__all__ = ["FondueEngine"]
''')
    
    create_readme(repo, "WatchNexus Fondue", "🫕",
                  "Built-in torrent download engine with magnet link support.",
                  ["wn-core>=1.0.0", "libtorrent>=2.0.0"],
                  ["GET /api/fondue/status", "POST /api/fondue/add",
                   "GET /api/fondue/torrents", "DELETE /api/fondue/{id}"])
    create_setup_py(repo, "wn-fondue", "WatchNexus Torrent Engine",
                    ["wn-core>=1.0.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-fondue created")

def split_wn_garnish():
    """Create wn-garnish - Subtitle service"""
    repo = SPLIT_DIR / "wn-garnish"
    src = repo / "src" / "wn_garnish"
    src.mkdir(parents=True, exist_ok=True)
    (src / "providers").mkdir(exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "garnish.py"
    if source_file.exists():
        shutil.copy(source_file, src / "service.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Garnish - Subtitle Service 🌿
"""
from .service import GarnishService

__version__ = "1.0.0"
__all__ = ["GarnishService"]
''')
    
    create_readme(repo, "WatchNexus Garnish", "🌿",
                  "Subtitle fetching service with multiple provider support (Addic7ed, OpenSubtitles).",
                  ["wn-core>=1.0.0", "beautifulsoup4>=4.12.0"],
                  ["GET /api/garnish/search/tv", "GET /api/garnish/search/movie",
                   "POST /api/garnish/download"])
    create_setup_py(repo, "wn-garnish", "WatchNexus Subtitle Service",
                    ["wn-core>=1.0.0", "beautifulsoup4>=4.12.0", "aiohttp>=3.9.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-garnish created")

def split_wn_potluck():
    """Create wn-potluck - Watch party service"""
    repo = SPLIT_DIR / "wn-potluck"
    src = repo / "src" / "wn_potluck"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "potluck.py"
    if source_file.exists():
        shutil.copy(source_file, src / "manager.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Potluck - Watch Party Service 🍲
"""
from .manager import PotluckManager

__version__ = "1.0.0"
__all__ = ["PotluckManager"]
''')
    
    create_readme(repo, "WatchNexus Potluck", "🍲",
                  "Watch party service for synchronized viewing with friends.",
                  ["wn-core>=1.0.0", "websockets>=12.0"],
                  ["POST /api/potluck/create", "GET /api/potluck/{code}",
                   "WS /ws/potluck/{code}"])
    create_setup_py(repo, "wn-potluck", "WatchNexus Watch Party Service",
                    ["wn-core>=1.0.0", "websockets>=12.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-potluck created")

def split_wn_gelatin():
    """Create wn-gelatin - External access module"""
    repo = SPLIT_DIR / "wn-gelatin"
    src = repo / "src" / "wn_gelatin"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "gelatin.py"
    if source_file.exists():
        shutil.copy(source_file, src / "server.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Gelatin - External Access Module 🍮
"""
from .server import GelatinServer

__version__ = "1.0.0"
__all__ = ["GelatinServer"]
''')
    
    create_readme(repo, "WatchNexus Gelatin", "🍮",
                  "External access and tunneling for remote connections.",
                  ["wn-core>=1.0.0"],
                  ["GET /api/gelatin/status", "POST /api/gelatin/tunnel",
                   "GET /api/gelatin/access-token"])
    create_setup_py(repo, "wn-gelatin", "WatchNexus External Access",
                    ["wn-core>=1.0.0", "aiohttp>=3.9.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-gelatin created")

def split_wn_sieve():
    """Create wn-sieve - Media health checker"""
    repo = SPLIT_DIR / "wn-sieve"
    src = repo / "src" / "wn_sieve"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "sieve.py"
    if source_file.exists():
        shutil.copy(source_file, src / "checker.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Sieve - Media Health Checker 🫗
"""
from .checker import SieveChecker

__version__ = "1.0.0"
__all__ = ["SieveChecker"]
''')
    
    create_readme(repo, "WatchNexus Sieve", "🫗",
                  "Media file health checking and repair utilities.",
                  ["wn-core>=1.0.0"],
                  ["POST /api/sieve/check", "POST /api/sieve/repair",
                   "GET /api/sieve/scan"])
    create_setup_py(repo, "wn-sieve", "WatchNexus Media Health Checker",
                    ["wn-core>=1.0.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-sieve created")

def split_wn_milk():
    """Create wn-milk - Theme engine"""
    repo = SPLIT_DIR / "wn-milk"
    src = repo / "src" / "wn_milk"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "milk.py"
    if source_file.exists():
        shutil.copy(source_file, src / "engine.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Milk - Theme Engine 🥛
Smooth, creamy theme customization
"""
from .engine import MilkEngine, Theme

__version__ = "1.0.0"
__all__ = ["MilkEngine", "Theme"]
''')
    
    create_readme(repo, "WatchNexus Milk", "🥛",
                  "Theme engine with 6 built-in themes and Theme Forge visual editor.",
                  ["wn-core>=1.0.0"],
                  ["GET /api/milk/themes", "GET /api/milk/current",
                   "PUT /api/milk/current", "POST /api/milk/custom"])
    create_setup_py(repo, "wn-milk", "WatchNexus Theme Engine",
                    ["wn-core>=1.0.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-milk created")

def split_wn_gadgets():
    """Create wn-gadgets - Plugin system"""
    repo = SPLIT_DIR / "wn-gadgets"
    src = repo / "src" / "wn_gadgets"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "gadgets.py"
    if source_file.exists():
        shutil.copy(source_file, src / "manager.py")
    
    adapter_file = BASE_DIR / "backend" / "plugin_adapter.py"
    if adapter_file.exists():
        shutil.copy(adapter_file, src / "adapter.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Gadgets - Plugin System 🔧
"""
from .manager import GadgetManager
from .adapter import PluginAdapter

__version__ = "1.0.0"
__all__ = ["GadgetManager", "PluginAdapter"]
''')
    
    create_readme(repo, "WatchNexus Gadgets", "🔧",
                  "Plugin/extension system with Kodi, Jellyfin, and Plex plugin conversion.",
                  ["wn-core>=1.0.0"],
                  ["GET /api/gadgets/installed", "POST /api/gadgets/install",
                   "POST /api/adapter/convert"])
    create_setup_py(repo, "wn-gadgets", "WatchNexus Plugin System",
                    ["wn-core>=1.0.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-gadgets created")

def split_wn_relish():
    """Create wn-relish - IPTV/Live TV module"""
    repo = SPLIT_DIR / "wn-relish"
    src = repo / "src" / "wn_relish"
    src.mkdir(parents=True, exist_ok=True)
    (repo / "tests").mkdir(exist_ok=True)
    
    source_file = BASE_DIR / "backend" / "relish.py"
    if source_file.exists():
        shutil.copy(source_file, src / "iptv.py")
    
    (src / "__init__.py").write_text('''"""
WatchNexus Relish - IPTV/Live TV Module 🥒
"""
from .iptv import RelishManager

__version__ = "1.0.0"
__all__ = ["RelishManager"]
''')
    
    create_readme(repo, "WatchNexus Relish", "🥒",
                  "IPTV and Live TV support with M3U playlists and EPG guide.",
                  ["wn-core>=1.0.0"],
                  ["GET /api/relish/channels", "POST /api/relish/playlist",
                   "GET /api/relish/epg"])
    create_setup_py(repo, "wn-relish", "WatchNexus IPTV Module",
                    ["wn-core>=1.0.0", "aiohttp>=3.9.0"])
    create_license(repo)
    create_contributing(repo)
    create_gitignore(repo)
    print("✓ wn-relish created")

def split_wn_frontend():
    """Create wn-frontend - React frontend application"""
    repo = SPLIT_DIR / "wn-frontend"
    
    # Copy entire frontend
    frontend_src = BASE_DIR / "frontend"
    if frontend_src.exists():
        # Copy key directories
        for item in ["src", "public"]:
            src_path = frontend_src / item
            if src_path.exists():
                shutil.copytree(src_path, repo / item, dirs_exist_ok=True)
        
        # Copy config files
        for file in ["package.json", "tailwind.config.js", "craco.config.js", 
                     "jsconfig.json", ".env.example"]:
            src_file = frontend_src / file
            if src_file.exists():
                shutil.copy(src_file, repo / file)
    
    # Create .env.example
    env_example = """# WatchNexus Frontend Configuration
REACT_APP_BACKEND_URL=http://localhost:8001/api
"""
    (repo / ".env.example").write_text(env_example)
    
    readme = """# WatchNexus Frontend 🖥️

React-based frontend for WatchNexus media server.

## Tech Stack

- React 18
- TailwindCSS
- Shadcn/UI
- Framer Motion
- React Router

## Installation

```bash
# Install dependencies
yarn install

# Start development server
yarn start

# Build for production
yarn build
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
REACT_APP_BACKEND_URL=http://your-server:8001/api
```

## License

MIT License
"""
    (repo / "README.md").write_text(readme)
    create_license(repo)
    create_gitignore(repo)
    
    # Add node_modules to gitignore
    with open(repo / ".gitignore", "a") as f:
        f.write("\nnode_modules/\n.env\n")
    
    print("✓ wn-frontend created")

def split_wn_electron():
    """Create wn-electron - Electron desktop wrapper"""
    repo = SPLIT_DIR / "wn-electron"
    src = repo / "src"
    src.mkdir(parents=True, exist_ok=True)
    
    # Copy electron files if they exist
    electron_src = BASE_DIR / "electron"
    if electron_src.exists():
        for item in electron_src.iterdir():
            if item.is_file():
                shutil.copy(item, repo / item.name)
            elif item.is_dir() and item.name != "node_modules":
                shutil.copytree(item, repo / item.name, dirs_exist_ok=True)
    
    readme = """# WatchNexus Electron 🖥️

Desktop application wrapper for WatchNexus.

## Platforms

- Windows (x64)
- macOS (Intel & Apple Silicon)
- Linux (AppImage, deb)

## Development

```bash
# Install dependencies
npm install

# Start in development
npm run dev

# Build for current platform
npm run build

# Build for all platforms
npm run build:all
```

## License

MIT License
"""
    (repo / "README.md").write_text(readme)
    create_license(repo)
    create_gitignore(repo)
    print("✓ wn-electron created")

def split_wn_docs():
    """Create wn-docs - Documentation repository"""
    repo = SPLIT_DIR / "wn-docs"
    
    # Copy all documentation
    docs_src = BASE_DIR / "docs"
    if docs_src.exists():
        for item in docs_src.iterdir():
            if item.is_file():
                shutil.copy(item, repo / item.name)
    
    readme = """# WatchNexus Documentation 📚

Official documentation for WatchNexus media server.

## Contents

- [User Guide](USER-GUIDE.md)
- [Plugin Development](PLUGIN-DEVELOPMENT-GUIDE.md)
- [Theme Development](THEME-DEVELOPMENT-GUIDE.md)
- [Gadgets Guide](GADGETS-GUIDE.md)
- [API Reference](API-REFERENCE.md)
- [Kickstarter Campaign](KICKSTARTER-CAMPAIGN.md)

## Contributing

Found an error or want to improve the docs? PRs welcome!

## License

MIT License
"""
    (repo / "README.md").write_text(readme)
    create_license(repo)
    print("✓ wn-docs created")

def split_wn_website():
    """Create wn-website - Marketing website"""
    repo = SPLIT_DIR / "wn-website"
    
    # Copy static website
    website_src = BASE_DIR / "website-static"
    if website_src.exists():
        for item in website_src.iterdir():
            if item.is_file():
                shutil.copy(item, repo / item.name)
            elif item.is_dir():
                shutil.copytree(item, repo / item.name, dirs_exist_ok=True)
    
    readme = """# WatchNexus Website 🌐

Official marketing website for WatchNexus.

## Pages

- Home / Landing page
- Features
- Download
- Documentation
- FAQ
- Legal / Terms

## Hosting

Static HTML - can be hosted on any web server or GitHub Pages.

## License

MIT License
"""
    (repo / "README.md").write_text(readme)
    create_license(repo)
    print("✓ wn-website created")

def create_main_readme():
    """Create the main WN-Split README"""
    readme = """# WatchNexus - Modular Media Pipeline 🎬

> One app to replace Sonarr, Radarr, Prowlarr, qBittorrent, Bazarr, and Jellyfin

## Repositories

| Module | Description | Status |
|--------|-------------|--------|
| [wn-core](./wn-core) | 🎯 Core framework and utilities | ✅ |
| [wn-marmalade](./wn-marmalade) | 🍊 Media server & library | ✅ |
| [wn-compote](./wn-compote) | 🍇 Indexer manager + scrapers | ✅ |
| [wn-fondue](./wn-fondue) | 🫕 Torrent download engine | ✅ |
| [wn-garnish](./wn-garnish) | 🌿 Subtitle service | ✅ |
| [wn-potluck](./wn-potluck) | 🍲 Watch party service | ✅ |
| [wn-gelatin](./wn-gelatin) | 🍮 External access | ✅ |
| [wn-sieve](./wn-sieve) | 🫗 Media health checker | ✅ |
| [wn-milk](./wn-milk) | 🥛 Theme engine | ✅ |
| [wn-gadgets](./wn-gadgets) | 🔧 Plugin system | ✅ |
| [wn-relish](./wn-relish) | 🥒 IPTV/Live TV | ✅ |
| [wn-frontend](./wn-frontend) | 🖥️ React frontend | ✅ |
| [wn-electron](./wn-electron) | 💻 Desktop app | ✅ |
| [wn-docs](./wn-docs) | 📚 Documentation | ✅ |
| [wn-website](./wn-website) | 🌐 Marketing website | ✅ |

## Quick Start

```bash
# Clone all repositories
git clone https://github.com/WatchNexus/wn-core.git
git clone https://github.com/WatchNexus/wn-frontend.git
# ... etc

# Or use the meta package
pip install watchnexus
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   wn-frontend                        │
│                 (React + Tailwind)                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Marmalade │ │ Compote  │ │ Fondue   │ │Garnish │ │
│  │ (Media)  │ │(Indexers)│ │(Torrents)│ │ (Subs) │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Potluck  │ │ Gelatin  │ │  Milk    │ │Gadgets │ │
│  │ (Party)  │ │ (Remote) │ │ (Themes) │ │(Plugins│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
├─────────────────────────────────────────────────────┤
│                    wn-core                           │
│            (Database, Auth, Config)                  │
└─────────────────────────────────────────────────────┘
```

## License

MIT License - see individual repositories for details.

## Support

- [Documentation](./wn-docs)
- [Discord Community](https://discord.gg/watchnexus)
- [Kickstarter](https://kickstarter.com/watchnexus)
"""
    (SPLIT_DIR / "README.md").write_text(readme)
    print("✓ Main README created")

def main():
    print("🚀 Splitting WatchNexus into modules...\n")
    
    # Create all modules
    split_wn_core()
    split_wn_marmalade()
    split_wn_compote()
    split_wn_fondue()
    split_wn_garnish()
    split_wn_potluck()
    split_wn_gelatin()
    split_wn_sieve()
    split_wn_milk()
    split_wn_gadgets()
    split_wn_relish()
    split_wn_frontend()
    split_wn_electron()
    split_wn_docs()
    split_wn_website()
    create_main_readme()
    
    print("\n✅ All modules created in /app/WN-Split/")
    print("\nTo upload to GitHub:")
    print("1. Create repos on github.com/WatchNexus")
    print("2. cd into each wn-* folder")
    print("3. git init && git add . && git commit -m 'Initial commit'")
    print("4. git remote add origin https://github.com/WatchNexus/wn-*.git")
    print("5. git push -u origin main")

if __name__ == "__main__":
    main()

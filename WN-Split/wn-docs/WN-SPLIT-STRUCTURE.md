# WN-Split - WatchNexus Modular Repository Structure

This document outlines how to split WatchNexus into separate repositories under the **WN-Split** GitHub organization/project for community contributions.

## Repository Structure

```
github.com/WN-Split/
├── wn-core/                # Core framework and shared utilities
├── wn-marmalade/           # 🍊 Media server module
├── wn-compote/             # 🍇 Indexer manager (includes Syrup, Preserve, Pulp)
├── wn-fondue/              # 🫕 Torrent download engine
├── wn-garnish/             # 🌿 Subtitle service
├── wn-potluck/             # 🍲 Watch party service
├── wn-gelatin/             # 🍮 External access/tunneling
├── wn-sieve/               # 🫗 Media health checker
├── wn-milk/                # 🥛 Theme engine (NEW)
├── wn-gadgets/             # 🔧 Plugin/extension system (NEW)
├── wn-juice/               # 🧃 Color picker component (NEW)
├── wn-frontend/            # React frontend application
├── wn-electron/            # Electron desktop wrapper
└── wn-docs/                # Documentation and guides
```

---

## Individual Repository Specifications

### 1. wn-core
**Core framework and shared utilities**

```
wn-core/
├── src/
│   ├── config/           # Configuration management
│   ├── database/         # MongoDB connection & models
│   ├── auth/             # JWT & OAuth handlers
│   ├── utils/            # Shared utilities
│   └── types/            # TypeScript/Python type definitions
├── tests/
├── README.md
├── setup.py              # Python package setup
└── package.json          # npm package (for shared TS types)
```

**Dependencies:** None (base package)
**Exports:**
- Database connection helpers
- Authentication middleware
- Configuration loader
- Logging utilities
- Common type definitions

---

### 2. wn-marmalade
**🍊 Media Server Module**

```
wn-marmalade/
├── src/
│   ├── server.py         # Main Marmalade server
│   ├── scanner.py        # Library scanner
│   ├── streaming.py      # Video streaming with range support
│   ├── metadata.py       # TMDB metadata fetcher
│   └── transcoding.py    # FFmpeg transcoding (future)
├── tests/
├── README.md
└── setup.py
```

**Dependencies:** wn-core, wn-sieve
**API Endpoints:**
- `GET /api/marmalade/libraries`
- `POST /api/marmalade/libraries`
- `GET /api/marmalade/media`
- `GET /api/marmalade/stream/{id}`

---

### 3. wn-compote
**🍇 Indexer Manager (Syrup + Preserve + Pulp)**

```
wn-compote/
├── src/
│   ├── compote.py        # Main indexer manager
│   ├── syrup/            # Indexer aggregator
│   │   ├── __init__.py
│   │   ├── manager.py
│   │   └── scrapers/
│   │       ├── base.py
│   │       ├── x1337.py
│   │       ├── yts.py
│   │       └── eztv.py
│   ├── preserve/         # Cloudflare bypass
│   │   ├── __init__.py
│   │   └── solver.py
│   └── pulp/             # Usenet handler
│       ├── __init__.py
│       └── nzb.py
├── tests/
├── README.md
└── setup.py
```

**Dependencies:** wn-core
**API Endpoints:**
- `GET /api/compote/indexers`
- `GET /api/syrup/search`
- `POST /api/preserve/solve`

---

### 4. wn-fondue
**🫕 Torrent Download Engine**

```
wn-fondue/
├── src/
│   ├── engine.py         # FondueEngine class
│   ├── settings.py       # Engine settings
│   ├── torrent.py        # Torrent data models
│   └── tracker.py        # Tracker management
├── tests/
├── README.md
└── setup.py
```

**Dependencies:** wn-core, libtorrent
**API Endpoints:**
- `GET /api/downloads/engine/status`
- `POST /api/downloads/engine/add_magnet`
- `GET /api/downloads/engine/torrents`

---

### 5. wn-garnish
**🌿 Subtitle Service**

```
wn-garnish/
├── src/
│   ├── service.py        # GarnishService class
│   ├── providers/
│   │   ├── base.py
│   │   ├── addic7ed.py
│   │   └── opensubtitles.py
│   └── parser.py         # SRT/VTT parser
├── tests/
├── README.md
└── setup.py
```

**Dependencies:** wn-core
**API Endpoints:**
- `GET /api/subtitles/search/tv`
- `GET /api/subtitles/search/movie`
- `POST /api/subtitles/download`

---

### 6. wn-potluck
**🍲 Watch Party Service**

```
wn-potluck/
├── src/
│   ├── manager.py        # PotluckManager class
│   ├── party.py          # Potluck data model
│   ├── websocket.py      # WebSocket handlers
│   └── sync.py           # Playback synchronization
├── tests/
├── README.md
└── setup.py
```

**Dependencies:** wn-core, wn-gelatin
**API Endpoints:**
- `POST /api/watch-party/create`
- `GET /api/watch-party/{code}`
- `WS /ws/party/{code}`

---

### 7. wn-gelatin
**🍮 External Access Module**

```
wn-gelatin/
├── src/
│   ├── server.py         # GelatinServer class
│   ├── discovery.py      # LAN discovery
│   ├── tunnel.py         # Tunnel management
│   └── tokens.py         # Access token generation
├── tests/
├── README.md
└── setup.py
```

**Dependencies:** wn-core
**API Endpoints:**
- `GET /api/gelatin/status`
- `POST /api/gelatin/tunnel/create`
- `POST /api/gelatin/access-token`

---

### 8. wn-sieve
**🫗 Media Health Checker**

```
wn-sieve/
├── src/
│   ├── checker.py        # SieveChecker class
│   ├── repair.py         # FFmpeg repair utilities
│   └── reports.py        # Health report models
├── tests/
├── README.md
└── setup.py
```

**Dependencies:** wn-core, ffmpeg
**API Endpoints:**
- `POST /api/media-health/check`
- `POST /api/media-health/repair`
- `GET /api/media-health/scan`

---

## Script to Split Repositories

Create a script to split the monorepo:

```bash
#!/bin/bash
# split-repos.sh - Split WatchNexus into separate repositories

GITHUB_ORG="WN-Split"
MODULES=(
    "marmalade:backend/marmalade_server.py"
    "compote:backend/compote.py,backend/syrup_scrapers.py"
    "fondue:backend/fondue.py"
    "garnish:backend/garnish.py"
    "potluck:backend/potluck.py"
    "gelatin:backend/gelatin.py"
    "sieve:backend/sieve.py"
)

for module_spec in "${MODULES[@]}"; do
    IFS=':' read -r module files <<< "$module_spec"
    repo_name="wn-$module"
    
    echo "Creating $repo_name..."
    
    # Create repo directory
    mkdir -p "../$repo_name/src"
    
    # Copy files
    IFS=',' read -ra file_list <<< "$files"
    for file in "${file_list[@]}"; do
        cp "$file" "../$repo_name/src/"
    done
    
    # Create setup.py
    cat > "../$repo_name/setup.py" << EOF
from setuptools import setup, find_packages

setup(
    name="$repo_name",
    version="1.0.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "wn-core>=1.0.0",
    ],
)
EOF
    
    # Create README
    cat > "../$repo_name/README.md" << EOF
# $repo_name

Part of the WatchNexus modular media pipeline.

## Installation

\`\`\`bash
pip install $repo_name
\`\`\`

## Usage

See main WatchNexus documentation.
EOF
    
    # Initialize git
    cd "../$repo_name"
    git init
    git add .
    git commit -m "Initial commit"
    cd -
    
    echo "$repo_name created successfully"
done
```

---

## Contributing Guidelines

Each repository should include:

1. **CONTRIBUTING.md** - How to contribute
2. **CODE_OF_CONDUCT.md** - Community standards
3. **SECURITY.md** - Security policy
4. **.github/workflows/** - CI/CD pipelines
5. **tests/** - Unit and integration tests

### Pull Request Process

1. Fork the specific module repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `pytest tests/`
5. Submit PR with clear description
6. Module maintainer reviews and merges

---

## Version Synchronization

All WN-Split modules use **semantic versioning** and maintain compatibility:

| wn-core | Compatible Modules |
|---------|-------------------|
| 1.0.x   | All 1.0.x modules |
| 1.1.x   | All 1.1.x modules |
| 2.0.x   | All 2.0.x modules |

Use the `wn-meta` package to install compatible versions:

```bash
pip install wn-meta==1.0.0  # Installs all modules at compatible versions
```

---

## Benefits of Modular Structure

1. **Independent Development** - Teams can work on modules separately
2. **Selective Installation** - Users install only what they need
3. **Easier Testing** - Smaller codebases, faster test cycles
4. **Community Contributions** - Lower barrier to entry
5. **Plugin Ecosystem** - Third-party modules can extend functionality

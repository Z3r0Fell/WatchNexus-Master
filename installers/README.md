# WatchNexus Installers

Platform-specific installers for WatchNexus v1.0.3.

## Supported Platforms

| Platform | Type | Directory | Status |
|----------|------|-----------|--------|
| Docker | Container | `docker/` | Ready |
| Linux | Shell script | `linux/` | Ready |
| Windows | Batch installer | `windows/` | Ready |
| macOS | Shell + .app bundle | `macos/` | Ready |
| Unraid | Docker template | `unraid/` | Ready |

## Quick Start

### Docker (Recommended)
```bash
cd docker && docker compose up -d
```

### Linux
```bash
chmod +x linux/install.sh && ./linux/install.sh
```

### Windows
```cmd
windows\install.bat
```

### macOS
```bash
chmod +x macos/install.sh && ./macos/install.sh
```

### Unraid
Copy `unraid/watchnexus.xml` to your Unraid templates directory.

## Prerequisites

All platforms require:
- **Python 3.10+**
- **Node.js 18+** and **Yarn**
- **FFmpeg** (optional, for transcoding)

Docker handles all dependencies automatically.

## Post-Installation

1. Open `http://localhost:8001` in your browser
2. Create your admin account
3. Configure TMDB API key in Settings > Integrations
4. Add your first media library in Library Manager
5. Scan your library to fetch metadata

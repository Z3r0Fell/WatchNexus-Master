# WatchNexus Tiramisu - Auto-Updater 🍰

**Codename:** Tiramisu  
**Version:** 1.0.0

Automatic update checking, downloading, and installation for WatchNexus.

## Features

- Check for updates from GitHub releases
- Download updates with progress tracking
- Automatic backup before installing
- One-click update installation
- Rollback to previous versions
- CLI and library interfaces

## Installation

```bash
pip install requests
```

## CLI Usage

```bash
# Check for updates
python tiramisu.py check

# Download and install
python tiramisu.py update

# Rollback to previous version
python tiramisu.py rollback

# List backups
python tiramisu.py backups

# Show version
python tiramisu.py version
```

## Library Usage

```python
from tiramisu import TiramisuUpdater

updater = TiramisuUpdater()

# Check for updates
update = updater.check_for_updates()
if update:
    print(f"New version: {update.version}")
    
    # Download and install
    updater.download_and_install(update)
```

## Callbacks

```python
updater = TiramisuUpdater(
    on_update_available=lambda u: print(f"Update: {u.version}"),
    on_download_progress=lambda p, b: print(f"Progress: {p}%"),
    on_update_complete=lambda v: print(f"Updated to {v}"),
    on_error=lambda e: print(f"Error: {e}")
)
```

## License

GPL-2.0

# WatchNexus v2.6.5 - Arch Linux Release

**QA & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

## Quick Install

```bash
sudo bash install.sh
```

This installs WatchNexus to `/opt/watchnexus` and registers a systemd service.

## Manual Install (makepkg)

```bash
makepkg -si
```

## Usage

```bash
# Start/stop
sudo systemctl start watchnexus
sudo systemctl stop watchnexus

# View logs
journalctl -u watchnexus -f

# Access
http://localhost:8001
```

## Configuration

- Default port: `8001` (edit `/etc/systemd/system/watchnexus.service` to change)
- Database: SQLite at `/opt/watchnexus/data/watchnexus.db`
- The binary is fully self-contained — no .NET runtime dependency required

## System Requirements

- x86_64 architecture
- 512MB RAM minimum, 1GB recommended
- glibc 2.17+ (any modern Arch install)

**QA Dashboard:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

# WatchNexus v2.6.5 - Windows Release

**QA & Testing Reports:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

## Quick Start

1. Run `start-watchnexus.bat` (or double-click `WatchNexus.Core.exe`)
2. Open `http://localhost:8001` in your browser
3. Create an account and start using WatchNexus

## Install as Windows Service

Run PowerShell as Administrator:
```powershell
.\install-service.ps1
```

This registers WatchNexus as a system service that auto-starts on boot.

## Configuration

- Default port: `8001` (set `ASPNETCORE_URLS` env var to change)
- Database: SQLite, stored in `data/watchnexus.db` next to the executable
- Logs: Console output (or Windows Event Log when running as service)

## System Requirements

- Windows 10/11 or Windows Server 2019+
- 512MB RAM minimum, 1GB recommended
- No additional dependencies (self-contained .NET 10 build)

**QA Dashboard:** [https://z3r0fell.github.io/watchnexus-qa/](https://z3r0fell.github.io/watchnexus-qa/)

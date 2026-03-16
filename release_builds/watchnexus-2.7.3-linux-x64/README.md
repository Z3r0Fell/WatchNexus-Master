# WatchNexus v2.7.3 - Linux Release

## Quick Start
```bash
./start-watchnexus.sh
```
Open http://localhost:8001 in your browser.

## Requirements
- .NET 10 runtime (`dotnet --version` should show 10.x)
- Install: https://dotnet.microsoft.com/download/dotnet/10.0

## Configuration
- Default port: 8001 (set `ASPNETCORE_URLS` env var to change)
- Database: SQLite at `data/watchnexus.db`

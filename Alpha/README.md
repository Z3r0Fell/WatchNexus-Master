# WatchNexus v2.7.3-alpha

> **ALPHA BUILD — CONFIDENTIAL — NOT FOR PUBLIC DISTRIBUTION**

This is a pre-release alpha build for internal testing purposes only. Do not redistribute or share publicly.

## Release Artifacts

| Platform | Archive | Size |
|----------|---------|------|
| Windows x64 | `release_builds/watchnexus-2.7.3-alpha-win-x64.tar.gz` | ~62MB |
| Linux x64 | `release_builds/watchnexus-2.7.3-alpha-linux-x64.tar.gz` | ~61MB |

Both archives are **self-contained** — no .NET runtime installation required.

## Quick Start

### Windows
```
1. Extract watchnexus-2.7.3-alpha-win-x64.tar.gz
2. Run start-watchnexus.bat
3. Open http://localhost:8001
```

### Linux
```bash
tar xzf watchnexus-2.7.3-alpha-linux-x64.tar.gz
cd watchnexus-2.7.3-alpha-linux-x64
sudo bash install.sh
# Open http://localhost:8001
```

## What to Test

- **Authentication** — Register, login, session persistence
- **Library Management** — Add libraries, scan media, browse
- **Gadgets** — All 10 gadgets should display with names, icons, and working toggles
- **API Management (Crumbs)** — 11 services, key storage, test connections
- **Weather / Radio / Podcasts** — Real-time data from external APIs
- **Fortress Security** — Check `/api/fortress/status` and `/api/fortress/audit`

## Reporting Issues

When filing a bug, include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser + OS version
4. Screenshots if applicable
5. Output from `GET /api/fortress/audit` (security event log)

## Version Identification

All banners, endpoints, and module manifests are tagged `2.7.3-alpha`. If you see `2.7.3` without the `-alpha` suffix, you are running a different build.

Verify via: `GET /api/health` — should return `{"version": "2.7.3-alpha"}`

## Source Code

The `src/` directory contains the full tagged source for reference. This is the same code that produced the release archives.

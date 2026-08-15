# WatchNexus Update Repo (Z3r0Fell/WatchNexus-Master)

Three channels the app polls (see docs/UPDATE-SYSTEM.md in the main repo):

| Folder | Purpose | Applied how |
|---|---|---|
| `Patches/` | Hot-fixes for the **running** version | Live, no restart (binaries staged for next boot) |
| `Updates/` | Announce a **new version** | Shows "Update Available" banner with your notes + download link |
| `Releases/` | Downloadable installers/builds | Listed by `GET /api/system/updates/releases` |

## Push a hot-patch (example)
1. Put the fixed file(s) under `Patches/files/<patch_id>/<install-path>`
2. Run `./make-patch.sh <patch_id> 1.0.1` to generate `Patches/1.0.1.json` with SHA-256s
3. Commit + push — servers pick it up on their next auto-check (or instantly via "Check for Updates")

## Announce a new version
Edit `Updates/latest.json`, bump `latest_version`, push. Servers show the update banner.

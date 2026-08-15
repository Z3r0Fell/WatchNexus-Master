# WatchNexus Update System — Hot Patching Without Downtime

WatchNexus can pull fixes from a **private GitHub patch repo** and apply them
to a running server. The rule is simple:

| What changed | How it's applied | Restart? |
|---|---|---|
| Frontend files (JS/CSS/HTML under the served `web` root) | Replaced live, atomically | **No** — users pick it up on next page load |
| Config/data files next to the binary (`target: "data"`) | Replaced live | **No** |
| Binaries (`.dll` / `.exe` / `.so`, `target: "app"`) | Staged into `pending-update/`, swapped in at next boot | **Yes** — one graceful restart, a few seconds |

Nothing is ever applied without a **SHA-256 match** against the manifest, and
every overwritten file is backed up to `patch-backups/<patch_id>/` first.

## Server configuration

Set in `appsettings.Production.json` (or environment):

```json
{
  "PATCH_REPO_URL": "https://api.github.com/repos/Z3r0Fell/WatchNexus-Master",
  "PATCH_REPO_TOKEN": "github_pat_..."
}
```

## Patch repo layout

The update repo is `Z3r0Fell/WatchNexus-Master` (github.com/Z3r0Fell/WatchNexus-Master)
with three channels:

```
Patches/                            ← hot-fixes for the RUNNING version
├── 1.0.0.json                      ← manifest for servers running v1.0.0
└── files/
    └── 2026-07-22-hotfix-01/       ← one folder per patch_id
        ├── static/js/fix.js        ← file paths mirror their install path
        └── WatchNexus.Core.dll
Updates/                            ← full version-update announcements
└── latest.json                     ← latest_version + notes + download_url
Releases/                           ← downloadable installers/builds
└── WatchNexus-1.0.1-win-x64.exe    ← linked from Updates/latest.json
```

### `Updates/latest.json` schema

```json
{
  "latest_version": "1.0.1",
  "release_date": "2026-08-01",
  "release_notes": "Fixes X, adds Y",
  "changelog": "https://github.com/Z3r0Fell/WatchNexus-Master/blob/main/Updates/CHANGELOG-1.0.1.md",
  "download_url": "https://github.com/Z3r0Fell/WatchNexus-Master/tree/main/Releases",
  "size_mb": 85,
  "mandatory": false,
  "min_version": "1.0.0"
}
```

The server compares `latest_version` to its own version; only a strictly
newer version shows the "Update Available" banner. If `Updates/latest.json`
does not exist, the check falls back to the license server manifest.
`GET /api/system/updates/releases` lists the `Releases/` folder contents
with direct download links.

## Patch manifest schema — `Patches/<version>.json`

```json
{
  "patch_id": "2026-07-22-hotfix-01",
  "description": "Fix dashboard crash on empty library",
  "severity": "high",
  "silent": true,
  "files": [
    {
      "path": "static/js/main.abc123.js",
      "target": "web",
      "sha256": "<sha256 of the file>"
    },
    {
      "path": "WatchNexus.Core.dll",
      "target": "app",
      "url": "https://github.com/<owner>/<repo>/releases/download/hotfix-01/WatchNexus.Core.dll",
      "sha256": "<sha256 of the file>"
    }
  ]
}
```

- `target`: `web` (SPA root, live), `data` (app dir, live), `app` (app dir, staged for restart)
- `url` optional — when omitted the file is fetched from
  `Patches/files/<patch_id>/<path>` in the update repo (GitHub contents API,
  works for files up to ~1 MB; use `url` / release assets for bigger files)
- `sha256` is **mandatory** per file. Generate with `sha256sum <file>`.
- `silent: true` + the server's "Auto-Install Silent Patches" setting =
  fully hands-free rollout on the next auto-check cycle.

## How a rollout works

1. You push the manifest + files to the patch repo.
2. Every server checks on its configured interval (default 24 h, min 1 h) via
   the `UpdateBackgroundService`. Owners can also hit **Check for Updates** in
   Settings → Updates for an immediate pull.
3. Silent patches auto-apply. Non-silent patches show an **Apply Patch** button.
4. Web/config fixes are live immediately — zero interruption.
5. If the patch contained a binary, the UI shows a **"Restart to finish"**
   banner; `POST /api/system/updates/restart` performs a graceful stop and the
   service manager (systemd / Windows service / Docker restart policy) brings
   it back with the staged binary applied at boot.

## Bumping the version

A patch never changes the app version — it hot-fixes the current one. Full
version upgrades (1.0.0 → 1.0.1) go through the license-server manifest and
the normal installer/Docker channel.

## Safety properties

- Path traversal is rejected (`..`, absolute paths, escaping the target root).
- Whole patch is downloaded + verified **before** any file is touched.
- Backups of every replaced file in `patch-backups/<patch_id>/`.
- Applying the same `patch_id` twice is a no-op for the auto-updater
  (`update_patch_done:<patch_id>` marker).
- `apply-patch`, `restart`, and update-settings writes are **admin-only**;
  the server re-fetches the manifest itself and never trusts a client file list.

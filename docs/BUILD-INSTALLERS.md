# WatchNexus — Open-Source Installer Build (Arch Linux + fish)

> **Stack:** fpm + NSIS. All open-source. Net tooling cost: **$0**.
> Replaces the BitRock InstallBuilder workflow entirely.
> Outcome: twelve installer artifacts for v1.0.0 RTP —
> three tiers × four formats (DEB / RPM / pacman / NSIS .exe).

---

## 0. One-time setup on the Arch laptop

Open a fish shell and run:

```fish
# System packages
sudo pacman -S --needed ruby dotnet-sdk nodejs npm yarn jq \
    osslsigncode rpm-tools nsis fakeroot base-devel

# fpm (Ruby gem)
gem install --user-install fpm

# Add the user-install gem bin dir to PATH (fish-style)
set -Ux PATH (ruby -e 'puts Gem.user_dir')/bin $PATH
which fpm   # should print ~/.local/share/gem/.../bin/fpm
```

Optional, for Windows signing:

```fish
# Drop your Authenticode .pfx here:
sudo mkdir -p /opt/signing
sudo cp watchnexus.pfx /opt/signing/

# Stash the passphrase in fish (session-only)
set -x WN_SIGN_PASS 'your-pfx-passphrase'
```

---

## 1. Get the v1.0.0 source

```fish
cd ~
git clone https://github.com/z3r0fell/watchnexus.git
cd watchnexus
git checkout main   # or 'git checkout v1.0.0' once the tag is pushed
```

---

## 2. Run the one-shot build

```fish
cd ~/watchnexus
chmod +x build/build-installers.fish
./build/build-installers.fish all
```

That single command:

1. **Stages** all three tiers via `prepare-installers.sh` (publish
   backend per RID + tier-baked frontend).
2. **Builds DEB / RPM / pacman packages** for each tier via `fpm`.
3. **Builds Windows NSIS installers** for each tier via `makensis`.
4. **(opt-in)** Builds Docker images + tarballs (`--docker`).
5. **Generates community-hub artifacts** for Unraid, HexOS, TrueNAS
   SCALE, CasaOS, Portainer, and Synology — submit-ready.
6. **(opt-in)** Signs Windows EXEs with `osslsigncode` (`--sign`).
7. **Generates SHA-256 manifests** via `fortress-build.sh sign`,
   optionally uploading them to the licence server (`--upload`).

Expected runtime on a recent laptop: ~12 minutes for `all` (without
`--docker`); add ~5 min if you also build Docker images.

To build a single tier:

```fish
./build/build-installers.fish ultra
```

Common flag combos:

```fish
# Everything, signed, with Docker images, uploaded to license server
./build/build-installers.fish all --sign --upload --docker

# Iterate on community-hub manifests only (skip slow staging)
./build/build-installers.fish all --skip-stage --no-community   # opt out
```

### Re-running without redoing the slow staging step

If a previous run already produced `stage/{standard,pro,ultra}/publish/...`,
skip the 7-minute publish/yarn phase and jump straight to packaging:

```fish
./build/build-installers.fish all --skip-stage
```

Use this whenever you're iterating on the `.deb` / NSIS / signing logic
and don't need to recompile the backend.

---

## 3. Sign Windows EXEs (if you have an EV cert)

```fish
./build/build-installers.fish all --sign
```

The script will:

1. Verify `osslsigncode` and `openssl` are installed.
2. Look for the certificate at `/opt/signing/watchnexus.pfx`
   (override with `set -x WN_PFX_PATH /elsewhere/yours.pfx`).
3. **Prompt you for the passphrase** (input is hidden as you type).
4. Verify the passphrase opens the `.pfx` *before* doing any work, so
   you don't waste 12 minutes only to find out you typoed.
5. Run the full build pipeline.
6. Sign every Windows EXE with `osslsigncode` (SHA-256 digest,
   DigiCert timestamp server by default).
7. Re-verify the attached signature on each EXE.
8. Wipe the passphrase out of the environment when done.

If you'd rather skip the prompt (e.g. in CI), pre-set the env var:

```fish
set -x WN_SIGN_PASS 'your-pfx-passphrase'
./build/build-installers.fish all --sign
```

The script detects an already-set `$WN_SIGN_PASS` and uses it without
prompting (it still verifies the passphrase against the cert before
the build runs).

### Other knobs

| Variable | Default | Notes |
|---|---|---|
| `WN_PFX_PATH` | `/opt/signing/watchnexus.pfx` | Path to your `.pfx` certificate |
| `WN_SIGN_PASS` | *(prompts)* | PFX passphrase |
| `WN_TIMESTAMP_URL` | `http://timestamp.digicert.com` | RFC-3161 timestamp server. Sectigo: `http://timestamp.sectigo.com`. SSL.com: `http://ts.ssl.com` |

> If you don't have the EV cert yet, **skip --sign** and ship the
> unsigned `.exe`. Backers will see one SmartScreen "More info → Run
> anyway" click on first install. Add `--sign` once the cert arrives.

---

## 4. Upload SHA-256 hashes to the license server

```fish
set -x WN_LICENSE_TOKEN 'your-publishing-token'
./build/build-installers.fish all --sign --upload
```

`--upload` POSTs the per-tier `SHA256SUMS.txt` to
`https://licenses.watchnexus.ca/api/releases/hashes` so client
activations can verify integrity at runtime.

---

## 5. The output

After a successful run you'll have:

```
release/
├── standard/
│   ├── deb/             watchnexus-standard_1.0.0_amd64.deb
│   ├── rpm/             watchnexus-standard-1.0.0-1.x86_64.rpm
│   ├── arch/            watchnexus-standard-1.0.0-1-x86_64.pkg.tar.zst
│   ├── windows/         watchnexus-standard-1.0.0-windows-x64.exe
│   ├── docker/          watchnexus-standard-1.0.0-docker.tar  (--docker)
│   ├── community-hubs/  Submit-ready manifests for community stores:
│   │   ├── docker-compose.yml          (generic reference compose file)
│   │   ├── unraid-watchnexus-standard.xml  (Unraid CA template)
│   │   ├── casaos-app.json             (CasaOS App Store)
│   │   ├── hexos-compose.yml           (HexOS custom stack)
│   │   ├── portainer-template.json     (Portainer App Templates)
│   │   ├── portainer-stack.yml         (Portainer stack file)
│   │   ├── synology-README.md          (Container Manager walkthrough)
│   │   └── truenas/
│   │       ├── Chart.yaml              (TrueNAS SCALE community train)
│   │       └── values.yaml             (default Helm values)
│   └── SHA256SUMS.txt
├── pro/         (same layout)
└── ultra/       (same layout)
```

Community-hub artifacts are generated by default. Disable with `--no-community`.
Docker image tarballs require `--docker` and a running Docker daemon.

### Community-hub submission targets

| File | Submit to |
|---|---|
| `unraid-watchnexus-<tier>.xml` | https://github.com/selfhosters/unRAID-CA-templates → PR your XML |
| `casaos-app.json` | https://github.com/IceWhaleTech/CasaOS-AppStore → PR |
| `hexos-compose.yml` | HexOS dashboard → Add Custom Stack → paste contents |
| `portainer-template.json` + `portainer-stack.yml` | Self-host the JSON, point Portainer at the URL |
| `synology-README.md` | Send to users; nothing to submit (no official Synology store) |
| `truenas/{Chart,values}.yaml` | https://github.com/truecharts/community → PR to apps/stable/ |
| `docker-compose.yml` | Reference doc; ship with each GitHub release |

---

## 6. Smoke-test

Disposable VM/container, one per platform:

| Platform | Command |
|---|---|
| Fedora  | `sudo dnf install ./watchnexus-ultra-1.0.0-1.x86_64.rpm && systemctl status watchnexus` |
| Debian  | `sudo apt install ./watchnexus-ultra_1.0.0_amd64.deb && systemctl status watchnexus` |
| Arch    | `sudo pacman -U ./watchnexus-ultra-1.0.0-1-x86_64.pkg.tar.zst && systemctl status watchnexus` |
| Windows | Double-click the EXE; confirm `services.msc` shows `WatchNexusCore` running |

All four should respond on `curl http://localhost:8001/api/cellar/first-launch`.

---

## 7. Upload to the Ubuntu VPS (storage only)

```fish
rsync -avh --progress release/ \
    watchnexus@releases.watchnexus.ca:/srv/releases/v1.0.0/

ssh watchnexus@releases.watchnexus.ca \
    'ln -sfn v1.0.0 /srv/releases/latest'
```

Done.

---

## Tool reference

### What each tool does

| Tool | Role | Cost |
|---|---|---|
| `dotnet publish` | Compiles self-contained backend binaries per RID | Free (MIT) |
| `yarn build` | Builds tier-baked React frontend | Free (BSD) |
| `fpm` | Generates `.deb`, `.rpm`, `.pkg.tar.zst` from a directory tree | Free (MIT) |
| `makensis` (NSIS) | Compiles a `.nsi` script into a Windows `.exe` installer | Free (zlib) |
| `osslsigncode` | Authenticode-signs the Windows EXE (only if you have an EV cert) | Free (GPLv3) |
| `fortress-build.sh sign` | Walks the release tree, emits per-tier SHA256SUMS, optionally POSTs to license server | Custom, in repo |

### Where each tier's payload comes from

Both `fpm` and `makensis` consume the directory tree produced by
`prepare-installers.sh`:

```
stage/<tier>/
├── publish/
│   ├── linux-x64/    ← input for fpm (deb/rpm/pacman)
│   ├── win-x64/      ← input for makensis (Windows EXE)
│   └── web/          ← copied into both Linux and Windows installers
├── tier.json
├── LICENSE.txt
├── LICENSE.html
└── README.md
```

### Why no Docker / Unraid in this script?

Those are separate flows:
- **Docker**: `build/docker-build.sh` (already in the repo)
- **Unraid**: templates at `build/unraid/watchnexus*.xml` published
  to the Community Apps repo

Neither needs fpm or NSIS.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Windows: app crashes on launch looking for `src\separated` | You're running a pre-v1.0.0 build. The runtime DLL-compile path was removed. Update to the current `main`. |
| No Start-Menu icon / no Desktop icon | You ran `WatchNexus.Core.exe` directly instead of installing via the NSIS `.exe`. Run the NSIS installer (it creates Start-Menu + Desktop shortcuts automatically). |
| Where are the Windows logs? | `%PROGRAMDATA%\WatchNexus\logs\boot-*.log` — also reachable via Start Menu → WatchNexus → "WatchNexus Logs Folder" |
| Where are the Linux logs? | `/var/lib/watchnexus/logs/boot-*.log` (systemd) or `<install dir>/logs/boot-*.log` (standalone). Also `journalctl -u watchnexus`. |
| App opens a console window and immediately closes | Should now pause with "Press any key to close..." before exiting on Windows interactive launches. If it still vanishes, you're on a pre-v1.0.0 build. |
| `fpm: command not found` | `gem install --user-install fpm` and add `~/.local/share/gem/.../bin` to PATH |
| `makensis: command not found` | `sudo pacman -S nsis` |
| `dotnet publish` fails: "SDK not found" | `sudo pacman -S dotnet-sdk` (must be ≥10.0) |
| `fpm` says "Need package 'fakeroot'" | `sudo pacman -S fakeroot` |
| NSIS errors out on missing icon | Run `prepare-installers.sh` first — the icon lives at `build/packaging/resources/watchnexus.ico` |
| `osslsigncode` signing fails | Verify `$WN_PFX_PATH` (default `/opt/signing/watchnexus.pfx`) exists; the script pre-validates the passphrase before running |
| Windows EXE flagged by SmartScreen on a fresh test machine | Normal until ~2,500 unique downloads accumulate reputation. Sign the EXE and trust the process. |
| Service fails to start on Linux post-install | `journalctl -u watchnexus -n 50` — check `/var/lib/watchnexus` perms and that the `watchnexus` user exists. Also `/var/lib/watchnexus/logs/boot-*.log`. |

---

## Comparison with the deleted InstallBuilder layer

| Capability | InstallBuilder | fpm + NSIS |
|---|---|---|
| Tooling cost | ~$3,000 / yr (Enterprise) | **$0** |
| Build host | Linux, Windows, macOS | Linux only (Arch ideal) |
| Output formats | DEB, RPM, EXE, MSI, .app, .pkg | DEB, RPM, pacman, EXE |
| Config file | Single XML | Inline flags in fish script + small NSIS template |
| Code-signing | Pluggable | Pluggable (osslsigncode) |
| Idempotency on rebuild | Yes | Yes |
| Open-source | No | Yes |

We lose: native `.app` / `.pkg` for macOS (deferred to $25K stretch
goal anyway), and the single-XML config "all targets in one file"
feature. Worth it for $3K/yr saved + full open-source toolchain.

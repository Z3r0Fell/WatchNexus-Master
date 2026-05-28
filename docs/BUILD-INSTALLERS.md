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
4. **Generates SHA-256 manifests** via `fortress-build.sh sign`.

Expected runtime on a recent laptop: ~12 minutes for `all`.

To build a single tier:

```fish
./build/build-installers.fish ultra
```

---

## 3. Sign Windows EXEs (if you have an EV cert)

```fish
set -x WN_SIGN_PASS 'your-pfx-passphrase'
./build/build-installers.fish all --sign
```

This re-runs the entire pipeline, then signs every Windows EXE with
`osslsigncode` against `/opt/signing/watchnexus.pfx` (DigiCert
timestamp server).

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
│   ├── deb/     watchnexus-standard_1.0.0_amd64.deb        (~85 MB)
│   ├── rpm/     watchnexus-standard-1.0.0-1.x86_64.rpm     (~85 MB)
│   ├── arch/    watchnexus-standard-1.0.0-1-x86_64.pkg.tar.zst (~80 MB)
│   ├── windows/ watchnexus-standard-1.0.0-windows-x64.exe  (~95 MB)
│   └── SHA256SUMS.txt
├── pro/         (same layout)
└── ultra/       (same layout)
```

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
| `fpm: command not found` | `gem install --user-install fpm` and add `~/.local/share/gem/.../bin` to PATH |
| `makensis: command not found` | `sudo pacman -S nsis` |
| `dotnet publish` fails: "SDK not found" | `sudo pacman -S dotnet-sdk` (must be ≥10.0) |
| `fpm` says "Need package 'fakeroot'" | `sudo pacman -S fakeroot` |
| NSIS errors out on missing icon | Run `prepare-installers.sh` first — the icon lives at `build/installbuilder/resources/watchnexus.ico` |
| `osslsigncode` signing fails | Verify `/opt/signing/watchnexus.pfx` exists and `$WN_SIGN_PASS` is set in your current fish session |
| Windows EXE flagged by SmartScreen on a fresh test machine | Normal until ~2,500 unique downloads accumulate reputation. Sign the EXE and trust the process. |
| Service fails to start on Linux post-install | `journalctl -u watchnexus -n 50` — check `/var/lib/watchnexus` perms and that the `watchnexus` user exists |

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

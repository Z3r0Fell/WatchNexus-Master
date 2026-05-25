# WatchNexus — InstallBuilder 26 Step-by-Step (Arch laptop)

> **Audience:** the WatchNexus build operator on an Arch Linux laptop with
> **BitRock InstallBuilder 26** installed at `/opt/installbuilder-26/`.
> **Outcome:** twelve signed installer artifacts for **v1.0.0 (RTP)** —
> three tiers × four platforms (Windows / Fedora / Debian / Arch). The
> Docker image is built separately by `build/docker-build.sh`.

If you want the full reference manual (CI snippets, signing internals,
license-server upload), see [`installbuilder.md`](installbuilder.md).
This document is the **shortest path** to a release.

---

## 0. One-time setup

Run these once on a fresh Arch laptop. Skip on subsequent releases.

```bash
# Toolchain
sudo pacman -S --needed base-devel git jq nodejs npm yarn dotnet-sdk osslsigncode

# .NET 10 SDK check (must be 10.x)
dotnet --version

# InstallBuilder 26 — confirm install path & license
/opt/installbuilder-26/bin/builder --version

# (optional) put builder on PATH
echo 'export PATH=/opt/installbuilder-26/bin:$PATH' >> ~/.bashrc && source ~/.bashrc
```

Drop your Authenticode `.pfx` for Windows signing at
`/opt/signing/watchnexus.pfx`. Keep its passphrase in `$WN_SIGN_PASS`.

---

## 1. Get the v1.0.0 source

```bash
cd ~
git clone https://github.com/watchnexus/watchnexus.git
cd watchnexus
git checkout v1.0.0           # or the tag for this release
```

If you received the release as a tarball, extract it instead:

```bash
mkdir -p ~/watchnexus && cd ~/watchnexus
tar -xzf ~/Downloads/watchnexus-1.0.0-src.tar.gz --strip-components=1
```

You should now have `build/`, `src/`, `frontend/`, `docs/`, `README.md`,
`LICENSE.txt`, `LICENSE.html`, `CHANGELOG.md` at the repo root.

---

## 2. Stage all three tiers

```bash
chmod +x build/prepare-installers.sh
./build/prepare-installers.sh all
```

This produces:

```
stage/standard/   publish/{win-x64,linux-x64,web}/  tier.json  LICENSE.*  README.md
stage/pro/        ...
stage/ultra/      ...
```

Expect ~5–10 minutes on first run (yarn install + dotnet restore). The
script prints sizes per tier; if any is missing or empty, stop and
re-run with `bash -x build/prepare-installers.sh <tier>`.

---

## 3. Run InstallBuilder 26 — the matrix

For each tier × platform target, invoke `builder build`:

```bash
PROJECT=$PWD/build/installbuilder/watchnexus.xml
BUILDER=/opt/installbuilder-26/bin/builder
VERSION=1.0.0

for TIER in standard pro ultra; do
  for TARGET in windows-x64 rpm deb linux-x64; do
    "$BUILDER" build "$PROJECT" "$TARGET" \
      --setvars tier=$TIER productVersion=$VERSION \
      --setvars payload_root=$PWD/stage/$TIER
  done
done
```

That single loop produces **12 installer artifacts** under
`release/<tier>/<platform>/`:

| File | Used on |
|---|---|
| `watchnexus-<tier>-1.0.0-windows-x64.exe`        | Windows |
| `watchnexus-<tier>-1.0.0-1.x86_64.rpm`           | Fedora / RHEL |
| `watchnexus-<tier>_1.0.0_amd64.deb`              | Debian / Ubuntu |
| `watchnexus-<tier>-1.0.0-linux-x64-installer.run`| Generic Linux + Arch wrapper input |

### 3.1 Arch (`.pkg.tar.zst`) — native on this laptop

Because you're already on Arch, no Docker workaround is needed. Wrap
the `linux-x64-installer.run` with the included PKGBUILD template:

```bash
chmod +x build/installbuilder/arch/build-arch.sh
WATCHNEXUS_VERSION=$VERSION ./build/installbuilder/arch/build-arch.sh all
```

This drops `release/<tier>/arch/watchnexus-<tier>-1.0.0-1-x86_64.pkg.tar.zst`
for each tier.

---

## 4. Sign the Windows executables

```bash
export WN_SIGN_PASS='<your pfx passphrase>'

for TIER in standard pro ultra; do
  IN=release/$TIER/windows-x64/watchnexus-$TIER-1.0.0-windows-x64.exe
  OUT=release/$TIER/windows-x64/watchnexus-$TIER-1.0.0-windows-x64-signed.exe
  osslsigncode sign \
    -pkcs12 /opt/signing/watchnexus.pfx \
    -pass "$WN_SIGN_PASS" \
    -n "WatchNexus ${TIER^}" \
    -i https://watchnexus.ca \
    -t http://timestamp.digicert.com \
    -in  "$IN" \
    -out "$OUT"
  mv "$OUT" "$IN"
done
```

Verify with `osslsigncode verify "$IN"` — you should see a green
signature with a timestamp from DigiCert.

---

## 5. Hash + register with the license server

```bash
WN_UPLOAD_HASHES=1 \
WN_LICENSE_TOKEN='<your release-publishing token>' \
WN_LICENSE_API='https://licenses.watchnexus.ca' \
  ./build/fortress-build.sh sign release
```

Outputs `release/<tier>/SHA256SUMS.txt` and POSTs them to
`/api/releases/hashes` on the license server so client activations can
verify integrity at runtime.

If you only want local hashes (e.g., dry run), omit
`WN_UPLOAD_HASHES=1`.

---

## 6. Smoke-test each installer

Spin up disposable VMs / containers and run:

| Platform | Command |
|---|---|
| Fedora  | `sudo dnf install ./watchnexus-ultra-1.0.0-1.x86_64.rpm && systemctl status watchnexus` |
| Debian  | `sudo apt install ./watchnexus-ultra_1.0.0_amd64.deb && systemctl status watchnexus` |
| Arch    | `sudo pacman -U ./watchnexus-ultra-1.0.0-1-x86_64.pkg.tar.zst && systemctl status watchnexus` |
| Windows | Double-click the signed `.exe`; confirm `services.msc` shows `WatchNexusCore` running |
| Docker  | `docker load -i watchnexus-ultra-1.0.0-docker.tar && docker run -p 8001:8001 watchnexus/ultra:1.0.0` |

All five should respond on `curl http://localhost:8001/api/cellar/first-launch`.

---

## 7. Upload to the Ubuntu VPS

Once smoke tests pass, sync the entire `release/` tree to the Ubuntu
VPS for distribution:

```bash
rsync -avh --progress \
  release/ \
  watchnexus@releases.watchnexus.ca:/srv/releases/v1.0.0/
```

Then on the VPS, point the public download links at the new directory
(typical pattern: a single symlink swap, e.g.,
`ln -sfn v1.0.0 /srv/releases/latest`).

---

## 8. Release checklist

Tick these before announcing:

- [ ] `prepare-installers.sh all` printed sane sizes for win-x64 / linux-x64 / web per tier.
- [ ] InstallBuilder produced 12 artifacts × no warnings in stderr.
- [ ] Arch `pkg.tar.zst` built natively (no `makepkg` errors).
- [ ] Every Windows EXE shows `osslsigncode verify` &rarr; Signature: ok.
- [ ] `fortress-build.sh sign release` exited 0 and hashes posted to license server.
- [ ] Smoke tests passed on all 5 platforms.
- [ ] Files rsynced to `releases.watchnexus.ca`.
- [ ] `latest` symlink updated.
- [ ] `CHANGELOG.md` entry for v1.0.0 (RTP) is in the published copy.

When all boxes are ticked, flip the marketing site banner and email
the launch list.

---

## Troubleshooting cheatsheet

| Symptom | Fix |
|---|---|
| `dotnet: command not found` | `sudo pacman -S dotnet-sdk` (must be ≥10.0) |
| `yarn build` fails on memory | `NODE_OPTIONS=--max-old-space-size=4096 yarn build` |
| `builder build` complains *"Tier payload not found"* | Re-run `prepare-installers.sh <tier>`; verify `stage/<tier>/publish/web/index.html` exists |
| Signed EXE flagged by SmartScreen | Submit the EXE to <https://www.microsoft.com/en-us/wdsi/filesubmission> for reputation seeding |
| Arch package build fails as root | Run `build-arch.sh` as a regular user (`makepkg` refuses root) |
| License-server upload returns 401 | Regenerate `WN_LICENSE_TOKEN` in the license portal (Settings → Publishing tokens) |

---

<p align="center"><sub>WatchNexus &middot; RTP v1.0.0 &middot; this document is the canonical build runbook.</sub></p>

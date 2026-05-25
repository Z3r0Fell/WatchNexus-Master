# WatchNexus — InstallBuilder Packaging Guide

> Target: **WatchNexus v2.9.0**
> Tooling: **BitRock InstallBuilder Enterprise** (≥ 24.x)
> Scope: Windows, Linux (Fedora / Debian / Arch), Docker
> Tiers: **Standard**, **Pro**, **Ultra** — packaged as **three independent installers per platform**

This document is the canonical reference for producing release artifacts on the Arch Linux build VPS (or any host with InstallBuilder installed). The output of this guide is twelve installer artifacts per release cycle (3 tiers × 4 platform groups).

---

## 1. Prerequisites

### 1.1 Host requirements (Arch Linux VPS recommended)

| Component | Version | Install command (Arch) |
|---|---|---|
| InstallBuilder Enterprise | ≥ 24.x | Download from `https://installbuilder.com/download.html`, extract to `/opt/installbuilder` |
| .NET SDK | 10.0 | `pacman -S dotnet-sdk` (or `/opt/dotnet/dotnet` symlink) |
| Node.js | ≥ 20 LTS | `pacman -S nodejs npm yarn` |
| Yarn | ≥ 1.22 | `npm i -g yarn` |
| Docker (for Docker installers) | ≥ 24 | `pacman -S docker docker-buildx && systemctl enable --now docker` |
| rpmbuild | latest | `pacman -S rpm-tools` |
| dpkg-deb | latest | `pacman -S dpkg` |
| makepkg (PKGBUILD) | bundled | included with `base-devel` |

### 1.2 InstallBuilder licence

InstallBuilder Enterprise is required for cross-platform output (Windows EXE + Linux RPM/DEB + folder/tar.gz). Place the licence file at:

```
/opt/installbuilder/license/license.xml
```

The `builder` CLI auto-detects it. Confirm with:

```bash
/opt/installbuilder/bin/builder --version
```

### 1.3 Repository layout assumed

```
/app
├── build/
│   ├── build-tiers.sh          # produces /app/dist/{standard,pro,ultra}
│   └── installbuilder/
│       ├── watchnexus.xml      # InstallBuilder project (this guide ships it)
│       ├── resources/          # Icons, EULA, banner images
│       └── scripts/            # Pre/post-install hooks
└── dist/
    ├── standard/   ← inputs for the Standard installer
    ├── pro/        ← inputs for the Pro installer
    └── ultra/      ← inputs for the Ultra installer
```

---

## 2. Build pipeline overview

```
                          ┌──────────────────────────┐
                          │  build-tiers.sh all      │  (already in repo)
                          │  → dist/{tier}/          │
                          └────────────┬─────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
        dotnet publish          yarn build             tier.json + assets
        (per tier, per RID)     (frontend bundle)      (manifest + icons)
                │                      │                      │
                └──────────┬───────────┴──────────────────────┘
                           ▼
                ┌──────────────────────────┐
                │  builder                 │  (InstallBuilder CLI)
                │  --target {platform}     │
                │  --setvars tier={tier}   │
                └────────────┬─────────────┘
                             ▼
                /app/release/{tier}/{platform}/
                   ├── watchnexus-{tier}-2.9.0-windows-x64.exe
                   ├── watchnexus-{tier}-2.9.0-linux-x64.rpm
                   ├── watchnexus-{tier}-2.9.0-linux-x64.deb
                   ├── watchnexus-{tier}-2.9.0-linux-x64.pkg.tar.zst
                   └── watchnexus-{tier}-2.9.0-docker.tar
```

---

## 3. Stage 1 — Prepare tier payloads

Run from the repo root on the build VPS:

```bash
cd /app
chmod +x build/build-tiers.sh
./build/build-tiers.sh all
```

This produces:

```
/app/dist/standard/
/app/dist/pro/
/app/dist/ultra/
```

Each tier directory holds the C# controllers, React pages, `tier.json`, and shared infra for that tier.

### 3.1 Compile backend per RID

For every tier, publish self-contained binaries for the supported runtime identifiers:

```bash
TIERS=(standard pro ultra)
RIDS=(win-x64 linux-x64)

for TIER in "${TIERS[@]}"; do
  for RID in "${RIDS[@]}"; do
    dotnet publish /app/dist/$TIER/backend/WatchNexus.Core.csproj \
      -c Release -r $RID --self-contained true \
      -p:PublishSingleFile=true -p:PublishTrimmed=false \
      -o /app/dist/$TIER/publish/$RID
  done
done
```

### 3.2 Bundle the frontend (once per tier)

```bash
for TIER in "${TIERS[@]}"; do
  cd /app/frontend
  REACT_APP_TIER=$TIER yarn build
  mkdir -p /app/dist/$TIER/publish/web
  cp -r build/* /app/dist/$TIER/publish/web/
done
```

`REACT_APP_TIER` is read by `LicenseContext.js` to gate tier-specific routes at runtime.

---

## 4. Stage 2 — InstallBuilder project

The shipped project file `/app/build/installbuilder/watchnexus.xml` accepts two variables:

| Variable | Values | Effect |
|---|---|---|
| `tier` | `standard` \| `pro` \| `ultra` | Selects payload directory and product name |
| `productVersion` | semver string | Stamps the installer + registry/desktop metadata |

### 4.1 CLI invocation pattern

```bash
BUILDER=/opt/installbuilder/bin/builder
PROJECT=/app/build/installbuilder/watchnexus.xml

# Windows EXE (cross-built from Linux)
$BUILDER build $PROJECT windows-x64 \
  --setvars tier=ultra productVersion=2.9.0

# Linux RPM (Fedora, RHEL)
$BUILDER build $PROJECT rpm \
  --setvars tier=ultra productVersion=2.9.0

# Linux DEB (Debian, Ubuntu)
$BUILDER build $PROJECT deb \
  --setvars tier=ultra productVersion=2.9.0

# Generic Linux tarball (used as input for the Arch PKGBUILD)
$BUILDER build $PROJECT linux-x64 \
  --setvars tier=ultra productVersion=2.9.0
```

Output lands in `/app/release/<tier>/<platform>/`.

### 4.2 Build matrix loop

```bash
for TIER in standard pro ultra; do
  for TARGET in windows-x64 rpm deb linux-x64; do
    $BUILDER build $PROJECT $TARGET \
      --setvars tier=$TIER productVersion=2.9.0
  done
done
```

---

## 5. Platform-specific notes

### 5.1 Windows

- The InstallBuilder Windows target produces an NSIS-style `.exe`. The shipped XML registers WatchNexus as a Windows service (`WatchNexusCore`) on port `8001` via `sc.exe`.
- Authenticode signing is performed **after** InstallBuilder via `signtool.exe`. On the Arch build host use `osslsigncode`:

  ```bash
  osslsigncode sign -pkcs12 /opt/signing/watchnexus.pfx \
    -pass "$WN_SIGN_PASS" -n "WatchNexus" -i https://watchnexus.ca \
    -t http://timestamp.digicert.com \
    -in  /app/release/ultra/windows/watchnexus-ultra-2.9.0-windows-x64.exe \
    -out /app/release/ultra/windows/watchnexus-ultra-2.9.0-windows-x64-signed.exe
  ```

- The installer writes `HKLM\Software\WatchNexus\Tier` so the Fortress integrity check (`Program.cs`) can validate the running tier matches the installed tier.

### 5.2 Linux — Fedora (RPM)

- `rpm` target output: `/app/release/<tier>/rpm/watchnexus-<tier>-2.9.0-1.x86_64.rpm`.
- Install: `sudo dnf install ./watchnexus-ultra-2.9.0-1.x86_64.rpm`.
- The RPM `%post` scriptlet (defined in `scripts/post-install.sh`) does:
  1. Creates the `watchnexus` system user
  2. Installs the systemd unit `/etc/systemd/system/watchnexus.service`
  3. Runs `systemctl daemon-reload && systemctl enable --now watchnexus`

### 5.3 Linux — Debian (DEB)

- `deb` target output: `/app/release/<tier>/deb/watchnexus-<tier>_2.9.0_amd64.deb`.
- Install: `sudo apt install ./watchnexus-ultra_2.9.0_amd64.deb`.
- Same systemd post-install hook as the RPM (InstallBuilder shares the script across both targets).

### 5.4 Linux — Arch (PKGBUILD wrapper)

InstallBuilder does not produce a native `.pkg.tar.zst`. Instead, the shipped Arch flow wraps the `linux-x64` tarball with a `PKGBUILD`.

```bash
# After: $BUILDER build $PROJECT linux-x64 --setvars tier=ultra productVersion=2.9.0
TIER=ultra
cp /app/release/$TIER/linux/watchnexus-$TIER-2.9.0-linux-x64-installer.run \
   /app/build/installbuilder/arch/$TIER/

cd /app/build/installbuilder/arch/$TIER
makepkg -f --sign --noconfirm
# → watchnexus-ultra-2.9.0-1-x86_64.pkg.tar.zst
```

The `PKGBUILD` template lives at `/app/build/installbuilder/arch/PKGBUILD.in` and is rendered per tier by the loop in `scripts/build-arch.sh` (created on first run; not required for non-Arch outputs).

### 5.5 Docker

The Docker installer is a **loadable image tarball** built from the InstallBuilder `linux-x64` payload. The Dockerfile at `/app/build/installbuilder/docker/Dockerfile` consumes `/app/release/<tier>/linux/watchnexus-<tier>-2.9.0-linux-x64-installer.run`.

```bash
TIER=ultra
docker buildx build \
  --build-arg TIER=$TIER \
  --build-arg VERSION=2.9.0 \
  -t watchnexus/$TIER:2.9.0 \
  -f /app/build/installbuilder/docker/Dockerfile \
  /app/release/$TIER/linux

docker save watchnexus/$TIER:2.9.0 \
  -o /app/release/$TIER/docker/watchnexus-$TIER-2.9.0-docker.tar
```

Consumers load it with:

```bash
docker load -i watchnexus-ultra-2.9.0-docker.tar
docker run -d --name watchnexus -p 8001:8001 \
  -v /srv/watchnexus:/var/lib/watchnexus \
  watchnexus/ultra:2.9.0
```

---

## 6. Verification

After every build, run the Fortress checksum step:

```bash
/app/build/fortress-build.sh sign /app/release
```

This walks all installer files and writes `SHA256SUMS.txt` per tier folder. The licence server (`https://licenses.watchnexus.ca`) verifies these hashes during activation.

Smoke test each installer in a disposable VM/container before publishing:

| Platform | Test command |
|---|---|
| Windows | `powershell -c "Start-Process -Wait .\watchnexus-ultra-2.9.0-windows-x64.exe /S"` |
| Fedora | `sudo dnf install ./watchnexus-ultra-2.9.0-1.x86_64.rpm && systemctl status watchnexus` |
| Debian | `sudo apt install ./watchnexus-ultra_2.9.0_amd64.deb && systemctl status watchnexus` |
| Arch | `sudo pacman -U ./watchnexus-ultra-2.9.0-1-x86_64.pkg.tar.zst && systemctl status watchnexus` |
| Docker | `docker run --rm -p 8001:8001 watchnexus/ultra:2.9.0` then `curl http://localhost:8001/api/cellar/first-launch` |

All five must respond on `/api/cellar/first-launch` before the artifact is considered shippable.

---

## 7. CI integration

The existing `.github/workflows/docker-publish.yml` builds Docker images. To extend to InstallBuilder artifacts, add a second job that runs on the self-hosted Arch VPS:

```yaml
build-installers:
  runs-on: [self-hosted, arch, installbuilder]
  needs: build-tiers
  strategy:
    matrix:
      tier: [standard, pro, ultra]
      target: [windows-x64, rpm, deb, linux-x64]
  steps:
    - uses: actions/checkout@v4
    - run: ./build/build-tiers.sh ${{ matrix.tier }}
    - run: |
        /opt/installbuilder/bin/builder build \
          /app/build/installbuilder/watchnexus.xml \
          ${{ matrix.target }} \
          --setvars tier=${{ matrix.tier }} productVersion=2.9.0
    - uses: actions/upload-artifact@v4
      with:
        name: watchnexus-${{ matrix.tier }}-${{ matrix.target }}
        path: /app/release/${{ matrix.tier }}/
```

---

## 8. Release checklist

- [ ] `./build/build-tiers.sh all` succeeds with three populated `dist/` folders
- [ ] `dotnet publish` produced binaries for `win-x64` and `linux-x64` per tier
- [ ] `yarn build` produced a frontend bundle per tier with `REACT_APP_TIER` baked in
- [ ] `builder build` matrix completes 12 artifacts (3 tiers × 4 targets)
- [ ] Windows EXE signed with `osslsigncode`
- [ ] `fortress-build.sh sign /app/release` produced `SHA256SUMS.txt` for every tier
- [ ] Smoke test passed for all 12 installers
- [ ] Artifacts uploaded to `https://releases.watchnexus.ca/v2.9.0/`
- [ ] Licence server updated with new SHA256 hashes for v2.9.0

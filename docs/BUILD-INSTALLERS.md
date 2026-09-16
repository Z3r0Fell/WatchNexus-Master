# WatchNexus — Release Build (Docker-Only)

> **Business decision (2026-09-16):** Docker is the **only** installation
> and release channel. Native installers (`.deb` / `.rpm` / `.pkg.tar.zst` /
> Windows `.exe`) and AppImages are discontinued — no per-release native
> installs are built or shipped. Updates are delivered by re-pulling the
> version tag: `docker pull watchnexus/watchnexus:<version>-<tier>`.

---

## 1. Release images (the single release path)

`build/docker-build.sh` builds and pushes all three tier images:

```bash
cd WatchNexus-Master

# Build all tiers
./build/docker-build.sh

# Build + push all tiers (7 tags: version-{standard,pro,ultra},
# latest-{standard,pro,ultra}, latest→ultra)
./build/docker-build.sh --push

# Multi-arch (linux/amd64, linux/arm64)
./build/docker-build.sh --push --multiarch
```

Registry is overridable via `DOCKER_REGISTRY` (default `watchnexus`).

---

## 2. Distribution support artifacts

`build/build-installers.fish` still exists but now only emits the
Docker-adjacent artifacts that accompany the images:

```fish
# Community-hub templates only (Unraid / TrueNAS / CasaOS / HexOS /
# Portainer / Synology) — all Docker/compose based
./build/build-installers.fish all

# Also export offline `docker save` tarballs per tier
./build/build-installers.fish all --docker
```

It no longer requires fpm, makensis/NSIS, or osslsigncode.

---

## 3. Upload hashes to the license server (optional)

```fish
set -x WN_LICENSE_TOKEN 'your-publishing-token'
bash build/fortress-build.sh sign release
```

`fortress-build.sh sign` walks the release tree (`.tar` / `.tar.gz` /
`.zip` artifacts), emits per-tier `SHA256SUMS.txt`, and optionally
POSTs them to `https://licenses.watchnexus.ca/api/releases/hashes`.

---

## 4. The output

```
release/
├── standard/
│   ├── docker/          watchnexus-standard-<version>-docker.tar  (--docker)
│   ├── community-hubs/  Docker/compose manifests for community stores:
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

Docker image tarballs require `--docker` and the matching images present
locally (build them first via `build/docker-build.sh <tier>`).

---

## 5. Smoke-test

Every release is verified against the published images:

| Check | Command |
|---|---|
| Image pulls | `docker pull watchnexus/watchnexus:<version>-{standard,pro,ultra}` |
| First-launch API | `docker run -p 8002:8002 -v wn-data:/app/data -e WATCHNEXUS_PORT=8002 watchnexus/watchnexus:<version>-standard` then `curl http://localhost:8002/api/cellar/first-launch` → `{"has_license":false,...}` |
| Health | `curl http://localhost:8002/api/health` → 200 |
| Compose | `docker compose --profile {standard,pro,ultra} up -d` |

---

## 6. Tool reference

| Tool | Role | Cost |
|---|---|---|
| `docker build` / `buildx` | Builds tier images (single/multi-arch) | Free (Apache-2.0 / MPL-2.0) |
| `docker save` | Exports offline `.tar` bundles per tier | Free |
| `fortress-build.sh sign` | Walks the release tree, emits per-tier SHA256SUMS, optionally POSTs to license server | Custom, in repo |

`prepare-installers.sh` (native-installer staging) and the NSIS / fpm
packaging under `build/packaging/` are retained in the repo for
reference but are **not** part of the release process.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker build` wants a registry you don't own | Set `DOCKER_REGISTRY` to your namespace (default `watchnexus`) |
| `--multiarch` fails on the builder | Use docker `buildx`; on classic builder do single-arch builds (`./build/docker-build.sh --push`) |
| `docker save` "image not present locally" | Run `./build/docker-build.sh <tier>` first to build the tag locally |
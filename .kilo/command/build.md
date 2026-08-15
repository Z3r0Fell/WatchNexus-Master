---
description: Build commands and procedures for WatchNexus (frontend, backend, Electron, Docker, installers, signing)
---
# WatchNexus Build Procedures

## Frontend (React)
- **Build**: `yarn build` (from `src/web/`)
- **Test**: `yarn test` (8/8 Jest tests)
- **Lint**: `yarn lint` (if configured)

## Backend (C# / .NET 10)
- **Build**: `dotnet build src/watchnexus/core/WatchNexus.Core.csproj`
- **Test**: `dotnet test src/watchnexus/core/WatchNexus.Core.Tests/WatchNexus.Core.Tests.csproj` (87/87 pass)
- **Publish (self-contained false)**: `dotnet publish src/watchnexus/core/WatchNexus.Core.csproj -c Release -o <output> --self-contained false`
- **Publish (self-contained)**: add `-r <rid>` (linux-x64, linux-arm64, win-x64, osx-arm64, etc.)

## Electron Tray App
- **Check main.js syntax**: `node --check electron/main.js`
- **Build**: `yarn electron:build` or `yarn electron:build:dir` (via electron-builder)
- **Package**: produces `dist/` with NSIS/DMG/pkg artifacts

## Docker
- **Build image**: `docker build -t watchnexus/watchnexus:1.0.1-<tier> .`
- **Build + push**: `./build/docker-build.sh --push`
- **Login**: `docker login -u watchnexus --password-stdin` (token stored in ~/.docker/config.json)
- **Run**: `docker run -d -p 8001:8001 --name watchnexus watchnexus/watchnexus:1.0.1-standard`
- **Compose**: `docker compose --profile <tier> up -d`

## Installers (Linux .deb/.rpm/.pkg.tar.zst)
- **Build script**: `./build/build-installers.fish` (requires fish shell)
- **FPM packaging**: uses `fpm` to build native packages from publish directory
- **Output**: `stage/` then `WN_Releases/<tier>/`

## Installers (Windows)
- **NSIS**: `build/packaging/nsis/watchnexus.nsi.in` → compile with NSIS 3
- **Batch**: `installers/windows/install.bat` (legacy, creates scheduled task)

## Patches / Signing
- **Generate keypair**: `./sign-manifest.sh generate-keypair`
- **Sign manifest**: `./sign-manifest.sh sign <manifest.json> <private.pem>`
- **Verify**: `./sign-manifest.sh verify <manifest.json> <public.pem>`
- **Patch service**: Ed25519 via BouncyCastle.Cryptography; `PATCH_SIGNING_PUBLIC_KEY` in appsettings.json

## CI
- **GitHub Actions**: `.github/workflows/tests.yml` (test), `security-scan.yml` (CodeQL + gitleaks)
- **Node version**: 22 (Dockerfile, CI, installers/docker/Dockerfile)

## Versioning
- Current version: `1.0.1`
- Increment per release: `1.0.1` → `1.0.2` → `1.0.3`
- Update in: `src/watchnexus/core/Program.cs`, docs, press kit, docker tags, installer filenames

## Artifacts
- `WN_Releases/` — built installers (gitignored, regenerated)
- `stage/` — build staging (gitignored)
- `dist/` — Electron output (gitignored)

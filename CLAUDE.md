# WatchNexus — working notes for Claude Code

Self-hosted media server: **C#/.NET 10** (ASP.NET Core + EF Core + SQLite) and a
**React 19** SPA. Distributed as tier-specific Docker images (Standard / Pro / Ultra)
with module licensing.

## Repository map

- `src/watchnexus/core/` — server entry point (`Program.cs`, controllers, EF context, auth).
- `src/watchnexus/shared/` — `IWatchNexusModule`, shared contracts.
- `src/watchnexus/modules/<name>/` — drop-in modules (`bastion`, `beacon`, `compote`,
  `drizzle`, `fondue`, `gelatin`, `lobster`, `marmalade`, `syrup`, `tunnel`, `zest`).
  Each has a `module.json` manifest; loaded by `ModuleLoader.cs`.
- `src/watchnexus/tests/` — xUnit tests (`WatchNexus.Core.Tests`).
- `src/web/` — React 19 + CRACO frontend (also symlinked as `frontend/`).
- `backend/` — Python helper service (`server.py`) used by some tooling; separate tests.
- `docs/` — API, build, module, theme, and release documentation.
- `k8s/`, `deploy/`, `docker-compose.yml`, `Dockerfile` — deployment and tier builds.
- `RELEASE_CHECKLIST.md`, `CHANGELOG.md` — current release state (v1.0.4).
- `ARCHITECTURE_MAP.md`, `SECURITY_AUDIT_REPORT.md`, `PERFORMANCE_REPORT.md` — deep dives.

## Commands

```bash
# Backend restore / build / test
dotnet restore src/watchnexus/WatchNexus.sln
dotnet build   src/watchnexus/WatchNexus.sln -p:SkipFrontendBuild=true
dotnet test    src/watchnexus/WatchNexus.sln --no-restore -p:SkipFrontendBuild=true

# Run the server (serves the built SPA on http://localhost:8001)
dotnet run --project src/watchnexus/core/WatchNexus.Core.csproj

# Frontend
cd src/web && yarn install --frozen-lockfile
yarn build
yarn test --watchAll=false --ci

# Container (tier profile)
docker compose --profile standard up -d
```

CI runs the same commands in `.github/workflows/tests.yml`; mirror them before
declaring work finished.

## Invariants to preserve

- **Path safety:** every filesystem access goes through `MediaPaths.IsAllowedPath`
  (`SecurityHelpers.cs`). Never build paths from user input without it.
- **SSRF:** outbound user-supplied URLs must pass `IsAllowedUrl` (private, loopback,
  link-local, and multicast are rejected).
- **Ownership:** every library/media/settings query is scoped by `UserId`.
- **Async:** pass `CancellationToken` through; never block with `.Result`/`.Wait()`.
- **EF Core:** `AsNoTracking()` on read-only queries; keep the composite indexes in
  `AppDbContext` intact; SQLite uses WAL mode — do not change the connection string.
- **Secrets:** never commit keys. License/API configuration comes from environment
  variables (`LICENSE_SERVER_API_KEY`, `WATCHNEXUS_*`).
- **Tiers:** features gated by tier must ship only in the matching image; check
  `docs/TIER-MANIFESTS.md` before moving code across module boundaries.

## Current state (2026-11-02)

- Branch `main`, last commit `d253d81d` (v1.0.4 Docker-only distribution).
- The working tree is **dirty**: ~76 modified, 9 deleted, 16 untracked files. Treat all
  of it as the user's in-progress work — **never revert, checkout, or clean it** without
  explicit confirmation. Diff before editing a file.
- 12 unchecked items remain in `RELEASE_CHECKLIST.md` (lines ~131-192): release
  artifacts, signed Fortress manifest, update manifests, image verification, website,
  and announcements. These are the remaining release tasks.
- The repo is ~17 GB because of build artifacts, media, and release bundles. Avoid
  recursive scans of the whole tree; scope `rg`/`find` to `src/`, `docs/`, `backend/`.

## Working style

- Make the smallest correct change; match the surrounding C#/React style.
- Run the targeted test project after backend changes and `yarn build` after frontend
  changes. Report failures verbatim; do not silently skip tests.
- When a task spans core + module + SPA, plan first and list the files you intend to
  touch.
- If a request would touch licensing, signing (`sign-manifest.sh`, `signing/`), or
  release publishing, confirm with the user before running anything destructive.

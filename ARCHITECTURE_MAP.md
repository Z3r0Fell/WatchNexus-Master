# WatchNexus Architecture Map & Dependency Graph

## System Overview

WatchNexus is a **multi-tier media server** with three license tiers (Standard, Pro, Ultra) delivered via:
- **Backend**: C#/.NET 10 ASP.NET Core (38+ controllers, modular architecture)
- **Frontend**: React 19 + CRA + Tailwind (60+ pages, 30+ components)
- **Deployment**: Docker multi-stage builds (3 tier images) — Docker-only since v1.0.4 (native installers discontinued)
- **License Server**: Separate FastAPI service (WN-License-Server) for serial validation

---

## Core Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WATCHNEXUS CORE (Program.cs)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  AppDbContext │  │   Fortress   │  │ ModuleLoader │  │ AuthService  │   │
│  │  (EF Core)    │  │  (Integrity) │  │  (Plugins)   │  │  (JWT/CSRF)  │   │
│  └──────┬────────┘  └──────┬────────┘  └──────┬────────┘  └──────┬────────┘   │
└─────────┼──────────────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (SQLite)                                 │
│  Users, Settings, Libraries, MediaItems, Downloads, IPTV, Podcasts,        │
│  Radio, Photos, Playlists, WebVideo, VPN, AuditLog, TranscodeJobs,         │
│  MediaRequests, NotificationLogs, PlayEvents, ApiKeys, IpRules             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        TIER ENFORCEMENT (FortressFilter)                    │
│  ProtectedRoutes: 43 module codenames → required tier (pro/ultra)          │
│  GadgetRoutes: 7 aliases → codenames                                       │
│  ExemptPaths: /api/crucible/ffmpeg-status                                  │
│  Resolves tier via CellarController.ResolveTier() from DB                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         MODULE SYSTEM (ModuleLoader)                        │
│  Built-in modules (compiled): 10 (lobster, bastion, compote, drizzle,      │
│                               fondue, gelatin, marmalade, syrup, tunnel, zest)│
│  External DLL modules: loaded from modules/{name}/WatchNexus.Module.{name}.dll│
│  Separated modules: compiled at runtime from source (dev only)             │
│  Each module: module.json manifest → IWatchNexusModule implementation      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Controller Communication Map

### Auth & Security Layer
```
AuthController (/api/auth)
    ├── POST /setup           → Creates first admin (SeedAccounts)
    ├── POST /login           → Issues JWT + httpOnly cookie (wn_token)
    ├── POST /refresh         → Token refresh with version check
    ├── POST /logout          → Increments token version (revokes all)
    └── GET  /me              → Current user profile

SecurityController (/api/security)
    ├── IP Rules (block/allow)
    ├── API Keys (CRUD + permissions)
    └── Rate limit status

CellarController (/api/cellar) — LICENSE TIER GATEKEEPER
    ├── POST /activate        → Validates serial with WN-License-Server
    ├── POST /deactivate      → Revokes license, reverts to Standard
    ├── GET  /status          → Current tier + unlocked modules
    ├── GET  /tiers           → Tier manifest (modules per tier)
    └── GET  /first-launch    → OOBE status (needs_setup, needs_activation)
```

### Core Media Pipeline
```
LibrariesController (/api/libraries)
    ├── CRUD libraries       → MediaItem scan jobs (background)
    └── GET /recent          → Recently added media

MediaControllers (/api/media) — PRO TIER (compote, fondue, saffron, sourdough)
    ├── Indexer search (Compote)     → Jackett/Prowlarr integration
    ├── Media management            → File organization, renaming
    ├── Quality profiles            → Sonarr/Radarr-style profiles
    ├── Scheduled scans             → Library refresh automation
    └── Download clients            → qBittorrent, Transmission

ContentController (/api/content) — PRO TIER (terrine, iptv)
    ├── TMDB proxy             → Metadata enrichment
    ├── Progress tracking      → Watch progress per user
    ├── Watchlist              → User watchlists
    └── Recommendations        → ML-based suggestions
```

### Live TV & Streaming (PRO/ULTRA)
```
IptvController (/api/iptv) — PRO TIER
    ├── M3U/XTREAM sources   → Channel/EPG management
    ├── Channel groups       → Favorites, categories
    ├── Stream proxy         → Transcoding via FFmpeg
    └── DVR                  → Recording scheduling

StreamingController (/api/streaming) — PRO TIER
    ├── Login management     → Service credentials (Netflix, etc.)
    ├── Session handling     → DRM, Widevine CDM
    └── Playback URLs        → Manifest generation
```

### Download & Processing (ULTRA)
```
StrudelController (/api/strudel) — ULTRA TIER
    ├── Download management     → Sabnzbd, NZBGet, qBittorrent
    ├── Category mapping        → Auto-sort by media type
    ├── Post-processing         → Unpack, rename, move
    └── Failed handling         → Retry, manual intervention

CrucibleController (/api/crucible) — ULTRA TIER
    ├── Transcode jobs        → FFmpeg pipeline (H.265, AV1)
    ├── Quality presets       → Hardware accel (VA-API, NVENC, QSV)
    ├── Probe/analyze         → MediaInfo integration
    └── Thumbnail/sprite gen  → Video preview generation
```

### Social & Sharing (ULTRA)
```
WatchPartyController (/api/watch-party) — ULTRA TIER
    ├── WebSocket sync        → Real-time playback sync
    ├── Chat                  → Party messaging
    └── Invite codes          → Private rooms

MarzipanController (/api/matrix) — ULTRA TIER
    ├── Matrix bridge         → Synapse admin API
    ├── Room management       → Spaces, encryption
    └── Bot integration       → Automated notifications
```

### Infrastructure (ULTRA)
```
VpnController (/api/vpn) — ULTRA TIER
    ├── WireGuard peers       → Mesh networking (Lobster)
    ├── Server config         → Endpoint, MTU, DNS
    └── Peer management       → Keys, allowed IPs, transfer stats

BrineController (/api/brine) — ULTRA TIER
    ├── SSH tunnel manager    → Reverse tunnels, port forwards
    ├── Connection pooling    → Persistent connections
    └── Health monitoring     → Latency, reconnection
```

### Utility & System
```
SystemController (/api/system)
    ├── Health check          → /api/health (k8s probe)
    ├── Updates check         → GitHub + License Server channels
    ├── FFmpeg status         → Binary detection (EXEMPT from tier)
    ├── Logs                  → Structured log retrieval
    └── Diagnostics           → Disk, memory, CPU, network

SettingsController (/api/settings)
    ├── App settings          → Key-value store (encrypted)
    ├── User preferences      → Per-user UI settings
    └── Feature flags         → Module enable/disable
```

---

## Data Flow Patterns

### 1. License Activation Flow
```
Frontend (ActivationSettings.jsx)
    → POST /api/cellar/activate { serial }
    → CellarController.ValidateSerial()
    → HTTP POST to LICENSE_SERVER_URL/api/integrate/activate
    → License Server: DB lookup → tier → returns { tier, modules_unlocked }
    → CellarController: Store encrypted in Settings (cellar_license)
    → FortressFilter: On next request, GetCurrentTier() reads from DB
    → All subsequent API calls gated by FortressFilter
```

### 2. Media Request Flow (Meringue → Strudel → Crucible)
```
User requests media (MediaRequests page)
    → POST /api/meringue/requests { tmdbId, mediaType }
    → MediaRequest entity created (status: pending)
    → Admin approves → status: approved
    → Strudel (Download) picks up via background service
    → DownloadItem created → qBittorrent/Sabnzbd API
    → On completion → Crucible (Transcode) picks up
    → TranscodeJob created → FFmpeg processing
    → On completion → MediaItem added to Library
    → Library scan picks up → MediaItem indexed
```

### 3. Live TV Stream Flow
```
User plays channel (LiveTVPage)
    → GET /api/iptv/channels/{id}/stream
    → IptvController: Resolve stream URL (M3U/XTREAM)
    → If transcoding needed → POST /api/crucible/transcode { inputUrl, profile }
    → CrucibleController: Creates TranscodeJob, returns HLS/DASH manifest
    → Frontend: HLS.js player consumes manifest
    → FFmpeg: Real-time segment generation
```

### 4. Module Load Flow (Startup)
```
Program.cs → ModuleLoader.DiscoverAndRegister()
    → Scan src/watchnexus/modules/ for module.json
    → Deserialize ModuleManifest
    → Check for pre-built DLL (WatchNexus.Module.{name}.dll)
    → If DLL: Load via ModuleLoadContext (isolated AL Context)
    → If no DLL: BuiltInModule (controllers already mapped)
    → ModuleRegistry.Register(manifest) → codename → tier mapping
    → FortressFilter uses ModuleRegistry for dynamic tier checks
```

### 5. Patch/Update Flow
```
UpdateBackgroundService (every 6h)
    → GET Updates/latest.json from GitHub
    → If newer version: notify via NotificationLog
    → Patches/{version}.json from GitHub (PATCH_REPO_URL)
    → PatchService.FetchManifestRawAsync() → VerifyManifestSignature()
    → If valid: PatchService.ApplyAsync(manifest)
    → Files with target "web"/"data": Applied live (atomic write)
    → Files with target "app": Staged to pending-update/
    → Next boot: PatchService.ApplyPendingUpdates() swaps binaries
```

---

## Frontend Architecture

### Routing & Auth
```
App.js → BrowserRouter
    ├── Public Routes
    │   ├── /login, /setup, /activation
    │   └── /health (iframe embed)
    ├── ProtectedRoute (requires auth)
    │   ├── Dashboard, Settings, Library, Media, etc.
    │   └── TierRoute (requires specific tier)
    │       ├── /pro/* (compote, fondue, saffron, sourdough, etc.)
    │       └── /ultra/* (security, rind, pepper, crucible, etc.)
    └── AdminRoute (requires admin role)
        └── /admin/*
```

### Context Hierarchy
```
AuthProvider (JWT + cookie + token version)
    └── LicenseProvider (tier + unlocked modules from /api/cellar/status)
        └── ThemeProvider (dark/light + custom CSS vars)
            └── GadgetContext (module registry from /api/modules/status)
                └── App Routes
```

### API Layer
```
api.js (axios instance)
    ├── interceptors: attach wn_token cookie, CSRF header
    ├── baseURL: REACT_APP_BACKEND_URL (empty = same-origin)
    ├── error handling: 401 → logout, 403 → tier upgrade prompt
    └── endpoints: 259 unique /api/ paths (per audit)

marmaladeClient.js (separate axios instance)
    ├── Media metadata API (TMDB proxy)
    └── withCredentials: true
```

---

## External Dependencies

### Required Services
| Service | Purpose | Tier | Config |
|---------|---------|------|--------|
| **WN-License-Server** | Serial validation, activation | All | LICENSE_SERVER_URL, LICENSE_SERVER_API_KEY |
| **TMDB API** | Movie/TV metadata, posters | Pro+ | TMDB_API_KEY |
| **Jackett/Prowlarr** | Torrent indexer aggregation | Pro (compote) | JACKETT_URL, JACKETT_API_KEY |
| **qBittorrent/Sabnzbd/NZBGet** | Download clients | Ultra (strudel) | Host, port, auth |
| **FFmpeg** | Transcoding, thumbnails | Ultra (crucible) | Binary path (auto-detect) |
| **Tailscale** | Mesh VPN (Lobster) | Standard | TS_AUTH_KEY |
| **Matrix/Synapse** | Chat bridge (Marzipan) | Ultra | SYNAPSE_URL, ACCESS_TOKEN |
| **WireGuard** | VPN (Brine/Vpn) | Ultra | Config via UI |

### Optional Services
| Service | Purpose |
|---------|---------|
| **Plex/Jellyfin/Emby** | External library sync |
| **Trakt.tv** | Watch history sync |
| **Last.fm** | Music scrobbling |
| **Discord/Telegram/Slack** | Notification webhooks (Pepper) |
| **Prometheus/Grafana** | Metrics export |

---

## Security Architecture

### Defense in Depth
```
1. Network: Docker read-only, no-new-privileges, cap_drop ALL, tmpfs /tmp
2. Transport: TLS via reverse proxy (Caddy/nginx), HSTS, CSP headers
3. Auth: JWT (httpOnly cookie preferred) + CSRF double-submit
4. Rate Limiting: /api/auth/* 10/min/IP, mutations 120/min/IP
5. Tier Enforcement: FortressFilter on EVERY API request
6. Integrity: Fortress SHA-256 baseline + runtime checks (every 10th request)
7. Encryption at Rest: DataProtection API → AppSetting.Value, VPN keys
8. Input Validation: SSRF guard (SsrfGuard.IsAllowedUrl), path traversal prevention
9. Secrets: Never in code — env vars, gitignored appsettings.Production.json
```

### Known Security Issues (from audits)
- **C1**: SubtitlesController + PhotosController arbitrary file read (PhysicalFile no allowlist)
- **C2**: SubtitlesController arbitrary file write (DownloadSubtitle)
- **C3**: Compote indexer search SSRF (no SsrfGuard on user-controlled base_url)
- **H1**: PodcastsController feed SSRF + XXE risk
- **H2**: WebVideoController + SubtitlesController arbitrary URL proxy
- **H4**: No ownership model — Libraries/GetAll returns all users' data

---

## Build & Release Pipeline

### Docker Multi-Stage Build (Dockerfile)
```
Stage 1 (frontend-build): node:22-alpine → yarn install → yarn build
Stage 2 (backend-build): mcr.microsoft.com/dotnet/sdk:10.0
    → dotnet restore → COPY core + shared → dotnet publish -c Release
Stage 3 (runtime): mcr.microsoft.com/dotnet/aspnet:10.0-noble
    → Install ffmpeg, mediainfo, curl
    → Create watchnexus user (non-root)
    → COPY --from=backend-build /publish ./
    → COPY --from=frontend-build /build/frontend/build ./web/build/
    → ENTRYPOINT ["dotnet", "WatchNexus.Core.dll"]
```

### Tier Builds (build/docker-build.sh)
```
for TIER in standard pro ultra; do
    docker build --build-arg TIER=$TIER -t watchnexus/watchnexus:1.0.3-$TIER .
    docker tag watchnexus/watchnexus:1.0.3-$TIER watchnexus/watchnexus:latest-$TIER
    docker push watchnexus/watchnexus:1.0.3-$TIER
    docker push watchnexus/watchnexus:latest-$TIER
done
# latest = ultra
```

### Release Support Artifacts (build/build-installers.fish)
```
1. Docker images via build/docker-build.sh (all 7 tags, multi-arch amd64/arm64)
2. Community-hub templates (Unraid, TrueNAS, CasaOS, HexOS, Portainer, Synology)
3. Optional offline `docker save` tarballs per tier (--docker)
4. Generate SHA256SUMS via fortress-build.sh sign
5. Stage to WN_Releases/v{VERSION}/{tier}/
6. Update Updates/latest.json on License Server MongoDB
```

---

## Test Coverage Baseline

| Layer | Framework | Tests | Status |
|-------|-----------|-------|--------|
| Backend Unit | xUnit | 87 | ✅ All Pass |
| Frontend Unit | Jest + RTL | 8 | ✅ All Pass |
| Integration | None | 0 | ❌ Missing |
| E2E | Playwright (dep installed) | 0 | ❌ Missing |
| Security | CodeQL (CI) | - | ✅ Configured |
| Dependency Audit | dotnet list / yarn audit | - | ✅ Configured |

---

## Phase 1 Complete — Ready for Phase 2 QA Swarm

### 20 Subagent Roles Defined

| # | Agent Role | Focus Area | Key Files |
|---|------------|------------|-----------|
| 1 | **Architecture Discovery** | Full codebase mapping, module registry | Program.cs, Fortress.cs, ModuleLoader.cs |
| 2 | **Database Schema** | EF Core models, migrations, indices | AppDbContext.cs, Migrations/* |
| 3 | **Backend API Mapper** | All 38+ controllers, 259 endpoints | Controllers/*, api.js |
| 4 | **Frontend Mapper** | 60+ pages, context, routing | pages/*, context/*, App.js |
| 5 | **Tier/License Enforcement** | FortressFilter, CellarController | FortressController.cs, CellarController.cs |
| 6 | **Module System** | ModuleLoader, manifests, external DLLs | ModuleLoader.cs, modules/*/module.json |
| 7 | **Auth & Security** | JWT, CSRF, DataProtection, SSRF | AuthService.cs, SecurityHelpers.cs, CsrfProtection.cs |
| 8 | **Media Pipeline** | Library scan, indexers, download, transcode | MediaControllers, StrudelController, CrucibleController |
| 9 | **Live TV/Streaming** | IPTV, streaming services, DVR | IptvController, StreamingController |
| 10 | **Social/Sharing** | WatchParty, Matrix, notifications | WatchPartyConnectionManager, MarzipanController, PepperController |
| 11 | **Infrastructure** | VPN, Lobster, Brine, Tunnels | VpnController, BrineController, LobsterModule |
| 12 | **Build/Deploy** | Docker, installers, CI/CD | Dockerfile, docker-compose.yml, build/*, .github/workflows/ |
| 13 | **Frontend QA** | React components, state, hooks | components/*, hooks/*, pages/* |
| 14 | **Backend QA** | Controllers, services, background jobs | Controllers/*, Services/* |
| 15 | **State Management** | Context, Redux-like patterns, persistence | context/*, LicenseContext.js, AuthContext.js |
| 16 | **Security Auditor** | Injection, auth bypass, data leaks | All controllers, SsrfGuard, Fortress |
| 17 | **Performance Profiler** | DB queries, memory, caching, async | AppDbContext, background services |
| 18 | **Error Handling** | Graceful degradation, logging, fallbacks | Program.cs boot log, try/catch patterns |
| 19 | **Integration Tester** | Cross-module flows, API contracts | Module boundaries, FortressFilter |
| 20 | **Release Engineer** | README, API docs, Dockerfiles, cleanup | docs/, *.md, Dockerfile, package.json |

---

## Next Steps (Phase 2)

1. **Spawn QA Swarm** — Deploy agents 13-19 to write exhaustive test suites
2. **Integration Agents** — Agent 19 focuses on cross-module glue
3. **Diagnostic Loop** — Route failures to agents 16-18 for root cause
4. **Fix Loop** — Domain agents (8-11) implement fixes
5. **Convergence** — Re-run until all green
6. **Phase 3** — Security hardening, performance, docs, release prep
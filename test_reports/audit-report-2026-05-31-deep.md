# Audit Report: WatchNexus Full Deep Audit — 2026-05-31

## Executive Summary

**Health Score: CRITICAL** — 5 CRITICAL, 11 HIGH, 18 MEDIUM, 9 LOW, 5 INFO findings across 6 audited dimensions.

This deep audit of WatchNexus v1.0.0 examined ~85 source files spanning C#/.NET 10 backend (35+ files), React 19 frontend (50+ files), Python FastAPI proxy, Docker/CI/CD pipeline, and installer/build scripts. **The most critical issue is that JWT tokens are stored in localStorage with 84 direct references across the frontend, making the entire application trivially XSS-vulnerable.** Additionally, hardcoded secrets in `appsettings.json` (TMDB, JWT, license server keys), a Python proxy with `allow_origins=["*"]` + `allow_credentials=True`, and 286 empty catch blocks silently swallowing all errors represent active security risks and systemic code quality debts. The tier enforcement architecture is sound (dual client/server gating + Docker build-time controller selection), but the client-side gate can be trivially bypassed.

---

## Summary Table

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 5 | Secrets in config, localStorage JWT (84 refs), Python CORS misconfig, zero tests |
| HIGH     | 11 | Empty catch blocks (286), eager page loading, god controllers, no CSRF, no rate limiting |
| MEDIUM   | 18 | Missing memoization, no CSP, raw axios in pages, PascalCase hacks, Fortress proxy bypass |
| LOW      | 9  | Hardcoded Docker secrets, no source maps in fortress, console.error logs, URL construction |
| INFO     | 5  | Module-level auth header, systemd hardening present, fortress integrity manifests |

**Total: 48 findings**

---

## Findings by Dimension

### 🔴 Security (sec-auditor)

| # | Severity | File | Line | Category | Finding | Impact | Remediation |
|---|----------|------|------|----------|---------|--------|-------------|
| SEC-01 | **CRITICAL** | `src/watchnexus/core/appsettings.json` | 17,28,31 | Secrets | Hardcoded TMDB API key (`8c860bcb88494f598008480abfe24d13`), JWT secret (`WatchNexus_DefaultSecret_ChangeInProduction_32chars!`), and license server API key (`wnk_he0eNF2yDEVGX-eYBrARUw4-OfwjIOpFq-1pnHKiNhw`) in source control | Full API access + JWT forgery if compromised. Keys are in git history. | Move all to env vars. See `Program.cs` already has fallback to env vars — remove fallback defaults. |
| SEC-02 | **CRITICAL** | `src/web/src/**/*.{js,jsx}` | 84 locations | Auth | JWT stored in `localStorage` with 84 direct `localStorage.getItem('token')` references across all pages, components, and context files | Any XSS vulnerability leaks the JWT permanently. `localStorage` is accessible to any JavaScript on the same origin. | Migrate to httpOnly cookies. JWT in localStorage cannot be protected from XSS. |
| SEC-03 | **CRITICAL** | `backend/server.py` | 9 | CORS | `allow_origins=["*"]` with `allow_credentials=True` in FastAPI proxy | Any website can make authenticated requests to the backend. CSRF + credential theft. | Restrict to known origins or remove credentials with wildcard. |
| SEC-04 | **HIGH** | `src/web/src/context/AuthContext.js` | 59 | Auth | 401 response clears token but login/register endpoints have no rate limiting | Brute force attack on login/register endpoints possible. | Add rate limiting middleware in `Program.cs`. |
| SEC-05 | **HIGH** | `src/watchnexus/core/Program.cs` | — | CSP | No `Content-Security-Policy` header set in middleware pipeline | XSS attacks can execute arbitrary scripts. Browser has no defense. | Add CSP middleware with strict policy. |
| SEC-06 | **HIGH** | `src/web/src/**/*.{js,jsx}` | 286 | Error Handling | 286 empty `catch { }` blocks across backend (C#) and frontend (JS) — most with zero logging | All errors silently swallowed. Security violations, API failures, and auth errors are invisible. | Every catch block must at minimum log. Remove empty catches. |
| SEC-07 | **HIGH** | `src/watchnexus/core/Controllers/AuthService.cs` | — | Auth | No CSRF token validation for authenticated endpoints | Cookie-based auth (when implemented) will be CSRF-vulnerable. | Add anti-forgery tokens for state-changing requests. |
| SEC-08 | **MEDIUM** | `src/web/src/context/LicenseContext.js` | 106 | Auth | Manual token header construction bypasses the centralized auth interceptor | Inconsistent auth pattern — some requests use module-level header, others build manually. Token could be stale. | Use axios interceptor exclusively for auth headers. |
| SEC-09 | **MEDIUM** | `src/web/src/services/marmaladeApi.js` | 8 | Auth | Creates own axios interceptor with manual localStorage read — different pattern from `api.js` | Two different auth patterns in the same app. Marmalade service doesn't use the global axios defaults set in AuthContext. | Unify all API services to use a single configured axios instance. |
| SEC-10 | **LOW** | `build/packaging/fpm/service/watchnexus.service` | 18 | Hardening | `Environment=ASPNETCORE_ENVIRONMENT=Production` hardcoded in service file | Production mode prevents detailed error pages, but environment overrides should use `EnvironmentFile`. | Use `EnvironmentFile=-/etc/default/watchnexus` for overrides (already added in recent change). |

**Cross-refs**: SEC-02 overlaps with ARC-04 (auth architecture). SEC-06 overlaps with QLT-01 (empty catch blocks).

---

### 🏗️ Architecture (arch-auditor)

| # | Severity | File | Line | Category | Finding | Impact | Remediation |
|---|----------|------|------|----------|---------|--------|-------------|
| ARC-01 | **HIGH** | `src/web/src/App.js` | 11–79 | Code Splitting | 50+ page components eagerly imported with static `import` statements — `lazy` is imported but never used | Initial bundle includes every page (~2MB+). Users pay for all features regardless of tier. | Convert all page imports to `React.lazy()` with `Suspense`. |
| ARC-02 | **HIGH** | `src/watchnexus/core/Controllers/CoreModuleControllers.cs` | — | God Class | ~960 lines handling TMDB proxy, filesystem ops, settings, themes, locale, and metadata — single controller file | Single file handles 7+ distinct concerns. Maintainability nightmare. | Split into dedicated controllers (TmdbController, FilesystemController, ThemeController, LocaleController, etc.). |
| ARC-03 | **HIGH** | `src/watchnexus/core/Controllers/StrudelController.cs` | — | God Class | ~400+ lines for disc ripping with inline business logic, settings parsing, profile management, device discovery | StrudelController mixes HTTP concerns with disc ripping engine logic, settings CRUD, and pipeline management. | Extract disc ripping engine into dedicated service (`IDiscRipService`). |
| ARC-04 | **MEDIUM** | `src/web/src/context/AuthContext.js` | 20–23 | Auth Pattern | Module-level `localStorage.getItem('token')` + `axios.defaults.headers.common` set synchronously before React mounts | Fragile pattern: relies on module execution order. Works in practice but is an anti-pattern. Comments acknowledge this is a workaround. | Better: configure a reusable axios instance at app initialization, export it, use across all services. |
| ARC-05 | **MEDIUM** | `backend/server.py` | 17–38 | Proxy | Blind reverse proxy forwards ALL headers (including auth) to backend — no validation, no rate limiting, no logging | The proxy adds a security bypass layer with zero protection. If the proxy is exposed to the internet, it's an open relay. | Add request validation, authentication forwarding rules, and access logging to the proxy. |
| ARC-06 | **MEDIUM** | `src/watchnexus/core/Program.cs` | — | Static Files | Static files served from both `web/` and `bin/web/` paths — stale files accumulate | Old JS/CSS served from binary directory after updates. Users may get cached stale frontend. | Serve from a single canonical path. Clean old builds in deployment script. |
| ARC-07 | **MEDIUM** | `src/web/src/**/*.jsx` | — | Organization | 54 page files in single `pages/` directory with no sub-organization by feature domain | Flat page structure with ~50 files makes it hard to find related pages. | Organize pages by feature module (e.g., `pages/media/`, `pages/settings/`, `pages/gadgets/`). |
| ARC-08 | **LOW** | `src/watchnexus/core/Data/AppDbContext.cs` | — | Models | 30+ `DbSet<>` properties with entities defined inline — no `Models/` directory | Entity definitions scattered across DbContext and inline in controllers. No single source of truth for schema. | Extract all entities into dedicated model files in `Models/` directory. |
| ARC-09 | **INFO** | `src/web/src/services/api.js` | — | Service Layer | 376 lines with 8 API domain objects (tmdbApi, watchlistApi, progressApi, etc.) — well-organized | Good separation of API concerns. All endpoints centralized. | Add interceptors for auth, error handling, and request logging to all service calls. |

**Cross-refs**: ARC-01 directly causes PERF-01. ARC-04 relates to SEC-02 (localStorage pattern).

---

### ⚡ Performance (perf-auditor)

| # | Severity | File | Line | Category | Finding | Impact | Remediation |
|---|----------|------|------|----------|---------|--------|-------------|
| PERF-01 | **HIGH** | `src/web/src/App.js` | 11–79 | Bundle Size | All 50+ pages statically imported — no code splitting | Single bundle includes all pages regardless of user tier. Pro/Ultra-only pages are downloaded for Standard users. | Replace all imports with `React.lazy(() => import('./pages/...'))`. |
| PERF-02 | **MEDIUM** | `src/web/src/context/AuthContext.js` | 31–37 | Re-render | No `useMemo` on context value; entire object recreated on every render | All consumers re-render when any value changes, even if the consumed value is the same. | Wrap context value in `useMemo`. |
| PERF-03 | **MEDIUM** | `src/web/src/context/LicenseContext.js` | 152–157 | Re-render | No `useMemo` on context value — tier-related functions recreated every render | LicenseContext consumers (TierGate, all routes) re-render unnecessarily. | Wrap context value in `useMemo`. |
| PERF-04 | **MEDIUM** | `src/web/src/context/GadgetContext.jsx` | — | Re-render | No `useMemo` on context value | Gadget hooks consumer re-renders on every provider state change. | Wrap context value in `useMemo`. |
| PERF-05 | **MEDIUM** | `src/watchnexus/core/Controllers/**/*.cs` | — | Database | Multiple controllers may have N+1 query patterns with EF Core — no `AsNoTracking()` found on read-only queries | Entity Framework change tracking overhead on every read query. | Add `.AsNoTracking()` to all GET endpoints. Profile for N+1 with `.Include()` where needed. |
| PERF-06 | **LOW** | `src/web/src/pages/Dashboard.js` | 182 | API Calls | 7 sequential API calls in `fetchData()` but wrapped in `Promise.all` | Already parallelized — good. But if any one call fails, the whole batch degrades. | Add individual error handling per request in the batch (partially done with `.catch()` on some). |
| PERF-07 | **LOW** | `src/web/src/App.js` | — | Context Burst | `AuthProvider` > `ThemeProvider` > `GadgetProvider` > `LicenseProvider` + `FirstLaunchGate` all fire API calls on mount | 4+ simultaneous API requests on app load. Could be optimized with lazy initialization or deferred hydration. | Defer non-critical context initialization until after first paint. |

**Cross-refs**: PERF-01 is the same root cause as ARC-01. PERF-02/03/04 overlap with QLT-06.

---

### 📐 Code Quality (quality-auditor)

| # | Severity | File | Line | Category | Finding | Impact | Remediation |
|---|----------|------|------|----------|---------|--------|-------------|
| QLT-01 | **CRITICAL** | `src/**/*.{cs,js,jsx}` | 286 locations | Error Handling | **286 empty `catch { }` blocks** across the entire codebase. C# controllers, JS pages, components all silently swallow errors. | Systemic: bugs, security violations, and API failures are invisible. Debugging requires source code reading. | Every catch must log. Use structured logging (Serilog). Never `catch { }` or `catch { /* comment */ }`. |
| QLT-02 | **CRITICAL** | `test_reports/` | — | Testing | **Zero test files** exist in the entire project. No xUnit, Jest, pytest, or E2E tests. | No regression safety. Every change risks breaking existing functionality. | Create test projects for C# (xUnit), JS (Jest/RTL), and E2E (Playwright). |
| QLT-03 | **HIGH** | `src/web/src/**/*.jsx` | Multiple | API Usage | Direct `axios.get()` with manual `localStorage.getItem('token')` in 20+ individual page files instead of using the centralized service layer | Duplicated auth logic, inconsistent error handling, service layer bypassed. | All API calls must go through service layer (`api.js`, `nexusApi.js`, `marmaladeApi.js`). |
| QLT-04 | **HIGH** | `src/web/src/context/AuthContext.js` | 42–52 | Data Normalization | `PascalCase` → `camelCase` normalization hack for every user property (`d.Id || d.id`, `d.Email || d.email`, etc.) | Fragile: if backend changes casing, normalization breaks silently. Masking the actual naming inconsistency. | The API route (`/users/me`) returns PascalCase while other routes return camelCase. Fix the inconsistency at the API level with `System.Text.Json` camelCase policy. |
| QLT-05 | **MEDIUM** | `src/web/src/pages/SettingsPage.js` | 72–78 | API Usage | `fetchUsers` catch block hardcodes mock admin user data when API fails | Masks real API failures by returning fake data. Admin user will never see errors. | Remove mock fallback. Show error to user with retry option. |
| QLT-06 | **MEDIUM** | `src/web/src/context/*.js(x)` | — | Memoization | `AuthContext`, `LicenseContext`, `GadgetContext`, `ThemeContext` all missing `useMemo` on context values | Unnecessary re-renders of all consumers on every provider render. | Wrap all context values in `useMemo`. |
| QLT-07 | **MEDIUM** | `src/watchnexus/core/Controllers/*.cs` | — | Logging | Most controllers use `Console.WriteLine` or no logging at all | No structured logging. Can't filter, search, or monitor in production. | Integrate `ILogger<T>` into all controllers via DI. |
| QLT-08 | **MEDIUM** | `src/web/src/pages/gadgets/WebVideoPage.jsx` | 23 | Auth | `getAuth()` function reads localStorage directly instead of using context | Bypasses centralized auth. If token format changes, this breaks silently. | Use `useAuth()` hook to get auth headers. |
| QLT-09 | **MEDIUM** | `src/web/src/App.js` | 86–94 | Dead Code | `GADGET_PAGE_MAP` and `GadgetPageLoader` defined but never used | Dead code increases cognitive load. | Remove or implement the dynamic gadget loading pattern. |
| QLT-10 | **LOW** | `src/watchnexus/core/Controllers/*.cs` | — | Error Messages | Inconsistent error responses — some return `Ok(new { message = "..." })`, others return `BadRequest("...")`, others return exception details | API consumers can't rely on consistent error shape. | Standardize on ProblemDetails (RFC 7807) for all errors. |
| QLT-11 | **LOW** | `src/web/src/**/*.jsx` | — | Console Logging | `console.error()` used for error display — no user-facing toasts for many errors | Users see silent failures until they open dev tools. | Use `toast.error()` from sonner for user-facing errors. |
| QLT-12 | **LOW** | `src/web/src/components/VideoPlayer.jsx` | 102,118,231,267 | Auth | 4 direct `localStorage.getItem('token')` calls in VideoPlayer instead of using the auth context | Inconsistent auth pattern in a critical component. | Import token from AuthContext or use centralized axios instance with interceptor. |

**Cross-refs**: QLT-01 is the same finding as SEC-06 (286 empty catches). QLT-03 overlaps with SEC-09.

---

### 📦 Dependencies (deps-auditor)

| # | Severity | File | Line | Category | Finding | Impact | Remediation |
|---|----------|------|------|----------|---------|--------|-------------|
| DEP-01 | **HIGH** | `backend/requirements.txt` | 146 | Python | **146 Python dependencies** including heavy packages: `libtorrent`, `openai`, `motor` (MongoDB), `boto3`, `playwright`, `google-generativeai` | Massive attack surface. Many packages (openai, google-*) may not be used. Large container images. | Audit which packages are actually needed. Remove unused deps. Pin exact versions (already done). |
| DEP-02 | **MEDIUM** | `Dockerfile` | 10 | Build | `yarn install --frozen-lockfile || yarn install` — fallback to non-frozen install | If lockfile doesn't match, install proceeds with potentially different dependency versions. | Remove fallback. Fix lockfile instead of working around it. |
| DEP-03 | **MEDIUM** | `backend/server.py` | 27 | Runtime | `httpx.AsyncClient` created per request — no connection pooling | Creating a new HTTP client for every API call is inefficient. Sockets may leak. | Use a single `httpx.AsyncClient` instance as a singleton. |
| DEP-04 | **MEDIUM** | `src/watchnexus/core/WatchNexus.Core.csproj` | — | NuGet | No explicit version pins on NuGet packages — uses floating versions | Builds may break when package authors push breaking changes. Supply chain risk. | Pin all NuGet package versions with `Version="x.y.z"`. |
| DEP-05 | **LOW** | `frontend/package.json` | — | npm | React 19, Radix UI components, framer-motion, axios — all modern but heavy dependencies | ~350MB+ node_modules. Radix brings many individual packages. | Audit unused Radix packages. Consider tree-shaking. |
| DEP-06 | **LOW** | `src/watchnexus/core/WatchNexus.Core.csproj` | — | Platform | `<TargetFramework>net10.0</TargetFramework>` — .NET 10 is still in preview | .NET 10 is not yet GA. API surface may change. Limited hosting provider support. | Consider targeting `net9.0` for production stability. |
| DEP-07 | **INFO** | `Dockerfile` | 19 | SDK | `mcr.microsoft.com/dotnet/sdk:10.0` — uses .NET 10 SDK | .NET 10 SDK images may not be available on all platforms (ARM64 support?). | Verify multi-arch support in CI (docker-publish.yml already specifies `linux/amd64,linux/arm64`). |

**Cross-refs**: DEP-03 (connection pooling) overlaps with PERF-06.

---

### 🔒 Tier Enforcement (tier-auditor)

| # | Severity | File | Line | Category | Finding | Impact | Remediation |
|---|----------|------|------|----------|---------|--------|-------------|
| TIR-01 | **MEDIUM** | `src/web/src/context/LicenseContext.js` | 71–95 | Client Gate | `MODULE_TIER` mapping defines all tier requirements in plain JavaScript — easily inspectable and modifiable | A user can modify the JS at runtime to unlock Pro/Ultra features by changing `MODULE_TIER` values or `TIER_RANK`. | Tier enforcement must be server-authoritative. Client-side gate is only for UX (hiding locked features). Server must reject unauthorized API calls. |
| TIR-02 | **MEDIUM** | `backend/server.py` | — | Tier Bypass | Python proxy sits in front of .NET backend and passes all requests through without tier validation | The proxy can be used to access Pro/Ultra API endpoints regardless of user tier. The .NET backend's Fortress tier checks are bypassed. | Add tier validation to the proxy, or remove it in production and expose .NET backend directly. |
| TIR-03 | **LOW** | `build/copy-tier-controllers.sh` | — | Build-Time | Server-side controller selection works via Docker build-time file copying — Pro/Ultra controllers only exist in their respective images | **Good**: This is effective server-side enforcement since Ultra controllers literally don't exist in Standard builds. | Consider adding Fortress integrity check at startup to verify only tier-appropriate code is loaded. |
| TIR-04 | **LOW** | `src/web/src/App.js` | 122–130 | Route Gating | `TierRoute` component wraps `ProtectedRoute` + `TierGate` — double layer of gating | **Good**: Auth check + license check are both applied before rendering tier-gated routes. | Add route-level code splitting so tier-gated code isn't even downloaded for Standard users. |
| TIR-05 | **INFO** | `build/fortress-build.sh` | — | Integrity | Fortress build generates `INTEGRITY.json` with SHA256 of all DLLs, strips debug symbols, removes source maps | Strong build-time integrity protections. Combined with Fortress.cs runtime checks, this provides decent anti-tamper. | Verify `INTEGRITY.json` is checked at startup by `Fortress.cs` (it is — via HMAC-signed config). |
| TIR-06 | **INFO** | `build/packaging/nsis/watchnexus.nsi.in` | 80–85 | Installer | NSIS installer writes `tier.lock` and `version.lock` files — verified at runtime by Fortress | Good layered integrity: installer writes tier manifest, runtime verifies it hasn't been tampered. | None — this is well-implemented. |
| TIR-07 | **INFO** | `docker-compose.yml` | 28,50,74 | Docker | All 3 tiers defined with separate profiles and `WATCHNEXUS_TIER` env var | Clean multi-tier Docker deployment. Each tier is a separate container with its own build args. | None. Well-designed tier isolation at the container level. |

**Cross-refs**: TIR-01 (client gate bypass) overlaps with SEC-02 (localStorage token). TIR-02 (proxy bypass) overlaps with ARC-05.

---

## Cross-Cutting Concerns

### 1. Authentication Architecture Fragmentation (SEC-02, SEC-08, SEC-09, ARC-04, QLT-03, QLT-08, QLT-12)
**84 `localStorage.getItem('token')` references** across the entire frontend with **3 different auth patterns**: (a) module-level axios header in AuthContext, (b) per-request localStorage reads in individual pages, (c) marmaladeApi's own axios interceptor. This is the single largest architectural debt — inconsistent, XSS-vulnerable, and fragile.

### 2. Systemic Error Swallowing (SEC-06, QLT-01)
**286 empty catch blocks** across C# and JavaScript code. This is not a style preference — it's a security and reliability issue. Production failures (API timeouts, auth failures, DB errors) are completely invisible. No monitoring, no alerts, no debugging.

### 3. Zero Test Infrastructure (QLT-02)
The entire project has **zero tests** of any kind. No unit tests, no integration tests, no E2E tests. Combined with 286 empty catch blocks, every deployment is a leap of faith.

### 4. Client-Side Security Theater (SEC-02, TIR-01, TIR-02)
Both JWT storage and tier enforcement rely on client-side mechanisms that can be trivially bypassed. localStorage tokens are XSS-vulnerable; LicenseContext.js tier mappings can be modified in the browser console; the Python proxy has no auth validation.

### 5. Bundle Bloat via Eager Loading (ARC-01, PERF-01)
All 50+ pages, including Ultra-only pages, are loaded in the initial bundle for every user. Standard tier users download code for features they can never use.

---

## Priority Remediation Roadmap

### 🔴 Immediate (CRITICAL)
| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| SEC-01 | Move hardcoded secrets from `appsettings.json` to env vars. Remove fallback defaults. | 1h | Eliminates credential leak risk |
| SEC-02 | Migrate JWT from localStorage to httpOnly cookies. This touches AuthContext.js + all 84 call sites + Program.cs cookie config. | 8h | Eliminates XSS token theft |
| QLT-01 | Eliminate empty catch blocks. Every catch must log. Use structured logging (Serilog on backend, sentry/browser console on frontend). | 4h | Error visibility restored |
| SEC-03 | Fix Python CORS: remove `allow_origins=["*"]` with credentials. Restrict to specific origin or use separate CORS policy. | 0.5h | Closes CSRF hole |
| QLT-02 | Create test infrastructure: xUnit project for C#, Jest/RTL for React, Playwright for E2E. Start with smoke tests. | 8h | Regression safety |

### 🔶 Short-term (HIGH — fix this sprint)
| ID | Action | Effort |
|----|--------|--------|
| ARC-01 | Convert 50+ static page imports to `React.lazy()` + `Suspense` | 2h |
| ARC-02 | Split CoreModuleControllers.cs into domain-specific controllers | 4h |
| SEC-04 | Add rate limiting middleware for auth endpoints | 1h |
| SEC-05 | Add Content-Security-Policy header middleware | 0.5h |
| SEC-07 | Add CSRF validation for cookie-based auth | 2h |
| QLT-03 | Remove direct axios calls from all pages — use centralized service layer | 4h |
| QLT-04 | Fix PascalCase/camelCase inconsistency at API level (configure `System.Text.Json` with camelCase policy globally) | 1h |
| ARC-03 | Extract disc ripping logic from StrudelController into `IDiscRipService` | 3h |
| DEP-01 | Audit and trim Python dependencies | 2h |

### 🟡 Medium-term (MEDIUM — fix next sprint)
| ID | Action |
|----|--------|
| PERF-01 | Same as ARC-01 (React.lazy pass) |
| PERF-02/03/04 | Add `useMemo` to all context providers |
| PERF-05 | Add `AsNoTracking()` to EF Core read queries + profile for N+1 |
| QLT-06 | Wrap all context values in `useMemo` |
| TIR-01 | Move authoritative tier enforcement to server; client gate is only for UX |
| TIR-02 | Add tier validation to Python proxy or remove proxy in production |
| DEP-02 | Fix yarn install fallback — ensure lockfile is correct |
| DEP-03 | Reuse httpx.AsyncClient as singleton |
| DEP-04 | Pin NuGet package versions |
| QLT-07 | Inject `ILogger<T>` into all controllers |
| QLT-10 | Standardize error responses to ProblemDetails format |
| ARC-05 | Add request validation and logging to Python proxy |
| ARC-06 | Serve static files from single canonical path |

### 🟢 Long-term (LOW/INFO)
| ID | Action |
|----|--------|
| QLT-11 | Replace `console.error` with `toast.error()` for user-facing errors |
| QLT-09 | Remove dead code (GADGET_PAGE_MAP, GadgetPageLoader) |
| PERF-07 | Defer non-critical context initialization after first paint |
| ARC-08 | Extract entity models from DbContext into dedicated `Models/` files |
| ARC-07 | Organize pages by feature domain |
| SEC-10 | Move environment-specific config out of service file |

---

## Appendix

### Files Scanned
- **C# Backend**: 35+ files (Program.cs, AppDbContext.cs, Fortress.cs, AuthService.cs, ModuleLoader.cs, 20+ controllers, Services/, Shared/)
- **React Frontend**: 54 page files + 11 gadget pages + 8 context/provider components + 10+ UI components + 3 service files
- **Python Backend**: server.py, requirements.txt (146 deps)
- **Infrastructure**: Dockerfile (×2), docker-compose.yml (×2), CI workflows (×2), build scripts (×5), NSIS installer, systemd service
- **Config**: appsettings.json, appsettings.Development.json, package.json, .csproj, VERSION
- **Total**: ~85 unique source files, ~25 infrastructure/config files

### Methodology
- Full read of all C# controllers (20+), Program.cs, Fortress/Auth/DbContext infrastructure
- Full read of App.js, all 3 context providers, TierGate, FirstLaunchGate, VideoPlayer
- Representative sample of 6 page files (Dashboard, Security, Settings, Podcasts, WebVideo, Radio)
- Full read of all Docker/CI/Build files
- Grep-based analysis: `localStorage.getItem('token')` (84 hits), `catch {` (286 hits), async patterns, DI registration
- Pattern analysis: lazy loading, service layer usage, error handling

### Tools Used
- `grep` for pattern matching across codebase
- `glob` for file discovery
- Direct file reads for detailed analysis
- Skills loaded: security-audit, dotnet-audit, react-audit, audit-reporting

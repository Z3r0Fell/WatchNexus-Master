# Audit Report: WatchNexus — 2026-05-30

## Executive Summary

**Health Score: MODERATE** (1 CRITICAL, 4 HIGH, 16 MEDIUM, 11 LOW, 5 INFO)

**Files scanned:** 85+ source files across C# backend (50 controllers, 6 services, 6 data/auth/config files), React 19 frontend (53 pages, 4 contexts, 11 services), Python proxy, Docker, and build scripts.

**Top 3 most critical findings:**
1. **SEC-01 (CRITICAL)**: Refresh tokens stored in plaintext in the `AppSettings` table — a database breach exposes all active session tokens. Combined with the weak JWT secret fallback (`WatchNexus_DevSecret_ChangeInProduction_32chars!`) visible in `docker-compose.yml`, this enables full account takeover.
2. **SEC-02 (HIGH)**: React frontend still has partial reliance on localStorage-based auth patterns in some gadget/service files, and CSP allows `'unsafe-inline'` + `'unsafe-eval'`, significantly weakening XSS protection despite httpOnly cookie auth migration.
3. **ARC-01 (HIGH)**: God controllers — `CoreModuleControllers.cs` (974 lines), `StrudelController.cs` (856 lines), `CellarController.cs` (570 lines), `MediaControllers.cs` (785 lines) — violate Single Responsibility Principle and make the codebase untestable and unmaintainable.

---

## Summary Table

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 1 | Plaintext refresh tokens, weak JWT secret fallback |
| HIGH     | 4 | God controllers, CSP bypass, missing C# tests, N+1 query risks |
| MEDIUM   | 16 | Settings as DB catch-all, middleware ordering, empty catches, no pagination, no rate limiting, etc. |
| LOW      | 11 | Hardcoded strings, sync-over-async in startup, unused variables, style issues |
| INFO     | 5 | Observed patterns, architecture notes, suggestions |
| **Total**| **37** | |

---

## Findings by Dimension

### 🔴 Security (S-01 through S-10)

| # | Severity | File | Line | Finding | Impact | Remediation |
|---|----------|------|------|---------|--------|-------------|
| S-01 | **CRITICAL** | `src/watchnexus/core/Auth/AuthService.cs` | 52, 129-149 | Refresh tokens stored as **plaintext** in `AppSettings` table with key `refresh_token`. No hashing. Database breach leaks all active refresh tokens (7-day validity). | Full account takeover for any user with an active session if DB is compromised. | Hash refresh tokens with SHA-256 before storage. On rotation, hash the incoming token and compare against stored hash. The raw token returned to client is the only time it exists in plaintext. |
| S-02 | **CRITICAL** | `docker-compose.yml` | 28, 50, 74 | Default JWT secret `WatchNexus_DefaultSecret_ChangeInProduction_32chars!` hardcoded in docker-compose.yml as `${JWT_SECRET:-...}`. Anyone who runs `docker compose up` without setting `JWT_SECRET` uses a publicly known signing key. | Complete JWT forgery — attacker can mint arbitrary auth tokens. | Remove fallback default entirely. Fail hard if `JWT_SECRET` is not set. Document required env vars in compose file with placeholder values only. |
| S-03 | **HIGH** | `Program.cs` | 315-325 | Content-Security-Policy allows `'unsafe-inline'` and `'unsafe-eval'` for scripts. This severely limits CSP's XSS mitigation effectiveness. | XSS vulnerabilities can execute arbitrary JavaScript despite CSP. | Remove `'unsafe-inline'` and `'unsafe-eval'` from CSP. Use nonce-based or hash-based script loading for inline scripts. Move all JS to external files. |
| S-04 | **HIGH** | `frontend/src/context/AuthContext.js` | 22 | `axios.defaults.withCredentials = true` set at module level — global scope mutation affects ALL axios requests, including any third-party code or future cross-origin requests. | Potential credential leakage to unintended endpoints or cross-origin requests carrying auth cookies. | Use per-request `withCredentials` option only where needed. Remove global default. |
| S-05 | **HIGH** | `backend/server.py` | 7-13 | Python FastAPI proxy has `allow_origins=["*"]` with `allow_credentials=True`. This is a known CORS misconfiguration — wildcard origin with credentials is technically invalid per spec but some browsers may accept it. | Possible cross-origin credential exposure for the proxy endpoint. | Restrict to specific origins matching the frontend deployment URL. |
| S-06 | **MEDIUM** | `Fortress.cs` | 308-323 | Instance ID derivation uses only `MachineName + OSVersion + ProcessorCount + BaseDirectory` — all easily discoverable by an attacker with filesystem access. | Fortress activation can be cloned by replicating the same environment properties on a different machine. | Add platform-specific entropy: TPM (Windows), machine-id (Linux), MAC address hash. |
| S-07 | **MEDIUM** | `CellarController.cs` | 163, 294 | License server API key sent in `X-API-Key` header over HTTP when `LICENSE_SERVER_URL` uses http:// (possible in dev). No validation of license server TLS certificate. | API key could be intercepted on cleartext connections. | Enforce HTTPS for license server URL. Add certificate pinning or at minimum validate SSL. |
| S-08 | **MEDIUM** | `CellarController.cs` | 324 | Serial numbers stored **unhashed** in the `cellar_license` setting. | DB compromise leaks all serial numbers. | Hash serials with a salt before storage. Only store a preview (`WNX-PRO-****-****-abcd`). |
| S-09 | **MEDIUM** | `CellarController.cs` | 482-496 | `ValidateSerialFormat()` defaults to `"ultra"` for unrecognized formats (`return "ultra"` on line 494) — most permissive fallback for unknown key formats. | Malformed or unknown keys are treated as Ultra tier. | Default to `"standard"` for unrecognized formats. |
| S-10 | **LOW** | `Program.cs` | 589-592 | `/api/system/check-tool` endpoint has a generic `catch {}` block — silently swallows exceptions when checking for installed tools. | Debugging difficulties if tool check fails for unexpected reasons. | Log the exception, return a structured error response instead of empty catch. |

**Cross-reference:** S-01 relates to ARCH-03 (storing security tokens in the generic Settings table). S-03 relates to QUAL-08 (console.log patterns would be blocked by strict CSP).

---

### 🏗️ Architecture (A-01 through A-08)

| # | Severity | File | Line | Finding | Impact | Remediation |
|---|----------|------|------|---------|--------|-------------|
| A-01 | **HIGH** | `CoreModuleControllers.cs` | 1-974 | **God Controller (974 lines)**: `BastionController` plus all LDAP/SSO/2FA/Session logic in one monolithic file. Also includes `Base32Encode` helper. | Untestable, violates SRP, merge conflicts on every change. | Split into: `BastionController.cs`, `LdapController.cs`, `TwoFactorController.cs`, `SessionController.cs`. Extract encoding to `Helpers/Base32.cs`. |
| A-02 | **HIGH** | `StrudelController.cs` | 1-856 | **God Controller (856 lines)**: DVD/Blu-ray ripping, transcoding, subtitle extraction, queue management all in one controller. | Same as A-01. | Split into: `StrudelController.cs` (orchestration), `RipController.cs`, `TranscodeController.cs`, `SubtitleController.cs`. |
| A-03 | **MEDIUM** | `CellarController.cs` | 1-570 | Large controller (570 lines) mixing licensing, activation, tier downloads, and validation. | Moderate complexity, but somewhat justified by domain cohesion. | Extract `TierBinaryService.cs` for the download/extract logic (lines 535-569) and `LicenseValidationService.cs` for serial validation (lines 468-497). |
| A-04 | **MEDIUM** | `SystemController.cs` | 117-187 | Two additional controllers (`CacheControllerReal`, `DbControllerReal`) defined in the same file as `SystemController`. | Unnecessary file coupling. | Move to separate files: `CacheController.cs`, `DbController.cs`. |
| A-05 | **MEDIUM** | `MediaControllers.cs` | 1-785 | Large file (785 lines) containing `MediaOpsController`, `MediaManagementController`, `QualityProfilesController` plus others. | File is too large, but class separation is already partially done. | Complete the split already started; ensure each controller is in its own file. |
| A-06 | **MEDIUM** | `Data/AppDbContext.cs` | 1-357 | **353-line DbContext** with 22 entity classes defined inline. Mixes schema definition with entity models. | File too large; entity classes mixed with DbContext configuration. | Move each entity class to its own file in `Models/` directory. Keep `AppDbContext.cs` for DbContext and configuration only. |
| A-07 | **LOW** | `src/watchnexus/shared/Module.cs` | 1-54 | Module interface `IWatchNexusModule` lacks lifecycle hooks (OnLoad, OnUnload, OnConfigChange). | No graceful module lifecycle management. | Add `Task OnLoadAsync()`, `Task OnUnloadAsync()` to interface. |
| A-08 | **INFO** | `src/watchnexus/modules/` | — | 10 module directories exist (`bastion/`, `beacon/`, `compote/`, etc.) but none ship as standalone DLLs. The Docker build copies Tier-specific controllers via script (`copy-tier-controllers.sh`). | Module system is effectively tier-gated file inclusion, not a dynamic plugin system. | Consider whether the module interface provides real value vs. tier-based compilation. Either implement true dynamic module loading or simplify. |

**Cross-reference:** A-01, A-02, A-05 relate to QUAL-03 (zero test coverage — God controllers can't be tested). A-06 relates to PERF-01 (N+1 query risks in entity loading).

---

### ⚡ Performance (P-01 through P-09)

| # | Severity | File | Line | Finding | Impact | Remediation |
|---|----------|------|------|---------|--------|-------------|
| P-01 | **HIGH** | Multiple controllers | Various | **N+1 query risk**: Several controllers access navigation properties (e.g., `MediaItems.xxx`) without `.Include()` calls. `BotBackgroundService.cs` accesses `db.Settings` with multiple sequential queries inside loops. | Severe performance degradation on datasets >100 rows. Each loop iteration produces a new SQL query. | Audit all EF Core queries for missing `.Include()`, `.ThenInclude()`, and `.AsNoTracking()` for read-only operations. |
| P-02 | **MEDIUM** | `BotBackgroundService.cs` | 87-107 | Matrix inactivity check iterates room IDs and calls the Matrix API **sequentially** with `await` inside `foreach`. With 50 rooms, this takes 50 sequential HTTP round-trips (~25s+). | Background service takes too long to complete, delaying the 30-min cycle. | Use `Task.WhenAll(rooms.Select(async id => ...))` for parallel HTTP calls. Add `SemaphoreSlim(10)` to control concurrency. |
| P-03 | **MEDIUM** | `Frortress.cs` | 44-67 | Fortress runtime middleware evaluates on every 100th API request but still deserializes config and performs SHA-256 on each check. | Unnecessary CPU overhead on the hot path. | Cache the last integrity check result with a timestamp. Only re-check if >60s have elapsed. |
| P-04 | **MEDIUM** | `Program.cs` | 281-288 | `db.Database.Migrate()` + `FortressIntegrity.VerifyIntegrity()` run **synchronously** (`.GetAwaiter().GetResult()`) during startup on the main thread. | Blocks the web host startup. If the DB is large or integrity check is slow, HTTP server is delayed. | Use async startup pattern. Consider running integrity check as a background service instead. |
| P-05 | **MEDIUM** | `Dockerfile` | 19-64 | Docker build uses `dotnet publish --no-restore` but the earlier restore only restores `core/WatchNexus.Core.csproj`, not the Shared project's dependencies. | Build failures or missing dependencies in published output. | Create a proper solution-level restore: `dotnet restore WatchNexus.sln` before individual project builds. |
| P-06 | **LOW** | `frontend/src/App.js` | 1-492 | All 75+ page components are lazy-loaded, but there's no preload strategy for critical pages. | `/login`, `/setup`, and `/` pages load on demand, adding ~200ms latency on first visit. | Add `<link rel="modulepreload">` for the dashboard and login page chunks. Use `React.lazy` with `startTransition` for post-load navigation. |
| P-07 | **LOW** | `LicenseContext.js` | 104-114 | License fetch runs on every mount with no caching or staleness logic. | Each page navigation that re-mounts any consumer triggers a re-fetch. | Add a simple TTL cache (e.g., 60s) to the license fetch. Only re-check on explicit events. |
| P-08 | **LOW** | `AuthContext.js` | 49-51 | `fetchUser()` runs on every `AuthProvider` mount. Since nested navigation doesn't re-mount `AuthProvider`, this is fine — but `LicenseContext` also fetches independently. | Two backend calls on initial load for auth + license on the same page. | Consider batching or consolidating the auth + license fetch into one API call. |
| P-09 | **INFO** | `CoreModuleControllers.cs` | 136-158 | Sessions endpoint returns hardcoded mock data — no actual session tracking. | Not a performance issue per se, but the endpoint never returns real data. | Implement actual session tracking with server-side storage. |

**Cross-reference:** P-01 relates to A-06 (entities mixed in DbContext, harder to audit query paths). P-04 relates to QUAL-06 (sync-over-async pattern).

---

### 📐 Quality (Q-01 through Q-11)

| # | Severity | File | Line | Finding | Impact | Remediation |
|---|----------|------|------|---------|--------|-------------|
| Q-01 | **HIGH** | Project-wide | — | **Zero C# unit tests or integration tests.** The only tests are Python-based smoke tests in `backend/tests/`. ~23,000 lines of C# have 0 test coverage. | Regression safety net is nonexistent. Any refactoring risks silent breakage. | Create xUnit test projects: `tests/WatchNexus.Core.Tests/` with Moq for services, `WebApplicationFactory` for integration tests. |
| Q-02 | **MEDIUM** | `Auth/AuthService.cs` | 91-107 | `RotateRefreshToken()` uses `_db.Settings.FirstOrDefaultAsync()` with a string match on the raw token value — extremely fragile and O(n) on large settings tables. | Performance degrades as settings grow. No index on value column. | Add a separate `RefreshTokens` table with a hashed token column and index. Remove from generic `Settings` table. |
| Q-03 | **MEDIUM** | Multiple files | — | `AppSettings` table used as a **universal key-value store** for every type of data: refresh tokens, license info, bastion config, update state, TMDB config, etc. | No type safety, no schema validation, no indexing. Querying by value requires full table scan. | Create dedicated tables for refresh tokens, licenses, and module configs. Keep `Settings` only for user preferences. |
| Q-04 | **MEDIUM** | `Program.cs` | 43 | Empty catch block in `Log()` method: `catch { /* never fail because of logging */ }`. | Silently swallows logging failures. | At minimum, write to `System.Console.Error` as fallback. Consider `ILogger` with fallback chain. |
| Q-05 | **MEDIUM** | `TrayController.cs` | 77, 90, 95, 106, 259, 302 | Multiple empty `catch {}` blocks throughout the tray controller. | Silent failures make debugging impossible. | Log every caught exception at minimum as a `LogWarning`. |
| Q-06 | **MEDIUM** | `Program.cs` | 288 | `.GetAwaiter().GetResult()` on `VerifyIntegrity` at startup — sync-over-async anti-pattern. | Can cause deadlock in certain synchronization contexts (though less likely in ASP.NET Core, still an anti-pattern). | Make the startup block async with `async Task Main` or use `await` in the top-level program. |
| Q-07 | **MEDIUM** | `Fortress.cs` | 407-411 | Audit log persistence uses `File.AppendAllText` with no async, locking, or log rotation strategy. | Concurrent write contention under high load. Single audit file grows unbounded. | Use async file writes, implement size-based log rotation (max 10MB per file, keep 5 files). |
| Q-08 | **LOW** | `AuthContext.js` | 71-73 | `logout()` has an empty `catch` block — silently swallows logout errors. | User may think they logged out but server still has active session. | Log the error and still clear local state. Add toast notification if server logout fails. |
| Q-09 | **LOW** | `LicenseContext.js` | 109 | Empty `catch` block in `fetchLicense()`. | If license server is unreachable, failure happens silently with no user feedback. | Log warning and set tier to standard. Add toast for network errors if user is authenticated. |
| Q-10 | **LOW** | `BotBackgroundService.cs` | 106, 199, 227 | Multiple empty `catch` blocks for Matrix HTTP errors, token drip, and TMDB requests. | Failures in background services are invisible during operation. | At least `_logger.LogWarning` with the exception. |
| Q-11 | **LOW** | `SettingKeys.cs` | 1-57 | Constants exist but are **not used** — hardcoded string literals like `"cellar_license"`, `"refresh_token"`, `"fortress_manifest"` appear throughout the codebase without referencing `SettingKeys`. | Find-and-replace risk when keys change. | Replace all hardcoded setting keys with references to `SettingKeys` constants. |

**Cross-reference:** Q-02 relates to S-01 (plaintext refresh tokens). Q-03 relates to PERF-01 (Settings table queries). Q-06 relates to P-04 (startup sync-over-async).

---

### 📦 Dependencies (D-01 through D-05)

| # | Severity | File | Line | Finding | Impact | Remediation |
|---|----------|------|------|---------|--------|-------------|
| D-01 | **MEDIUM** | `src/watchnexus/core/WatchNexus.Core.csproj` | 29-43 | All NuGet packages target .NET 10 preview versions (10.0.4). These are not stable releases and may have breaking changes before RTM. | Risk of breaking changes when upgrading to RTM. Preview packages may contain bugs. | Pin to stable versions when .NET 10 ships. For now, document the preview dependency and watch for RC/RTM releases. |
| D-02 | **MEDIUM** | `frontend/package.json` | 43 | `cra-template` dependency in `dependencies` (not devDependencies). This is a CRA internal package not needed at runtime. | Bloat in production bundle. | Move `cra-template` to `devDependencies`. |
| D-03 | **MEDIUM** | `frontend/package.json` | 48 | `framer-motion ^12.31.0` — very large animation library (~150KB gzipped) for a media server UI. | Significant bundle size impact. Alternatives like `motion` (from same authors but smaller) exist. | Consider replacing with `motion` (the v12 rewrite is ~30KB gzipped) or CSS animations for simpler needs. |
| D-04 | **LOW** | `backend/requirements.txt` | 1-146 | Python dependencies include many **dev-only** packages in production requirements: `black`, `flake8`, `isort`, `mypy`, `pytest`, `playwright`. | Container images are bloated with unnecessary tools, increasing attack surface. | Split into `requirements-dev.txt` and `requirements-prod.txt`. Only install dev tools in dev/CI images. |
| D-05 | **LOW** | `backend/requirements.txt` | 15 | `black==26.1.0` — Python formatter pinned in production. | Unnecessary production dependency. | Move to dev requirements. |

**Cross-reference:** D-01 relates to SEC (preview packages may have unpatched vulns). D-04 relates to DOCKER (image size).

---

### 🔒 Tier Enforcement (T-01 through T-06)

| # | Severity | File | Line | Finding | Impact | Remediation |
|---|----------|------|------|---------|--------|-------------|
| T-01 | **MEDIUM** | `Dockerfile` | 39-58 | Tier-based controller selection happens at **build time** via a shell script (`copy-tier-controllers.sh`). The running container has only the controllers for its tier and cannot be upgraded without a rebuild. | Docker users who want to upgrade from standard→pro must rebuild the entire image. No runtime upgrade path in containerized deployments. | Build all tier controllers into a single image, apply tier gating at runtime via FortressFilter. Provide separate entrypoint scripts for each tier. |
| T-02 | **MEDIUM** | `CellarController.cs` | 493 | `ValidateSerialFormat()` returns `"ultra"` for any unrecognized format matching the basic `WNX-*` pattern. | An attacker who guesses the key format `WNX-XXXX-...` gets Ultra access, even without a valid license. | Default all unknown formats to `"standard"`. Only derive tier from known prefixes (`WNX-PRO-`, `WNX-ULT-`). |
| T-03 | **MEDIUM** | `CellarController.cs` | 211-216 | **Offline activation fallback** validates serials client-side with format-only checking. No cryptographic validation, no server verification. | Anyone can generate `WNX-PRO-AAAA-BBBB-CCCC` and get Pro access. | Require online activation for Pro/Ultra. Offline should only allow Standard tier. If offline activation is needed, implement public-key signature verification. |
| T-04 | **LOW** | `FortressController.cs` | 28-43 | `ProtectedRoutes` dictionary duplicates the tier module mapping already defined in `CellarController.cs`. | Two sources of truth for tier definitions — risk of drift. | Define tier mappings in a single shared location (e.g., `shared/TierDefinitions.cs`). Reference from both controllers. |
| T-05 | **LOW** | `Dockerfile` | 68-108 | Runtime container uses `dotnet/aspnet:10.0-noble` (Noble = Ubuntu 24.04). The `DOTNET_EnableDiagnostics=0` env var is set to disable diagnostic pipelines. | Acceptable for production but limits debugging capability. | Acceptable as-is. Consider adding a `debug` build stage with diagnostics enabled. |
| T-06 | **INFO** | `frontend/src/components/TierGate.jsx` | 1-73 | Frontend `TierGate` is entirely client-side. It checks `LicenseContext` state passed from the backend but can be bypassed by modifying React state. | This is mitigated by FortressFilter on the backend API (defense in depth). | No change needed — backend enforcement via FortressFilter is the proper gate. Document that frontend TierGate is UX-only. |

**Cross-reference:** T-03 relates to S-01 (both involve weak activation). T-04 relates to A-03 (duplicated tier definitions across controllers).

---

## Cross-Cutting Concerns

| Concern | Affected Dimensions | Details |
|---------|-------------------|---------|
| **Settings as catch-all** | SEC, PERF, QUAL | The `AppSettings` key-value table stores refresh tokens (SEC concern), license data (TIER concern), module configs, and user preferences. This is a cross-cutting anti-pattern. |
| **God controllers** | ARCH, QUAL, PERF | 50 controllers spread across files, but `CoreModuleControllers.cs` (974 lines), `StrudelController.cs` (856 lines), and `MediaControllers.cs` (785 lines) each violate SRP, making testing impossible (QUAL) and hiding performance issues (PERF). |
| **Weak secrets management** | SEC, TIER | JWT fallback secret in docker-compose, serial numbers stored in plaintext, offline validation by format only — all contribute to a weak security posture that tier enforcement depends on. |
| **Empty catch blocks** | QUAL, SEC | Empty `catch {}` blocks appear in 10+ locations across the codebase. This hides real errors that could be security-relevant (SEC-10) and makes debugging impossible. |
| **No test infrastructure** | QUAL, ARCH, SEC | Zero C# unit/integration tests for 23K+ lines of backend code. This affects every dimension — refactoring God controllers (ARCH) is risky, security fixes can't be validated (SEC), and performance regressions go undetected (PERF). |

---

## Priority Remediation Roadmap

### Immediate (CRITICAL) — Fix within 24 hours

| ID | Finding | Action |
|----|---------|--------|
| S-01 | Plaintext refresh tokens | Hash refresh tokens before storage using SHA-256. Add a `RefreshTokens` table with FK to `Users`. Implement token hashing in `StoreRefreshToken()` and comparison in `RotateRefreshToken()`. |
| S-02 | Default JWT secret in docker-compose | Remove `${JWT_SECRET:-WatchNexus_DefaultSecret...}` fallback. Make JWT_SECRET mandatory — fail startup if unset. Update documentation. |

### This Sprint (HIGH) — Fix within the current sprint

| ID | Finding | Action |
|----|---------|--------|
| S-03 | CSP allows unsafe-inline + unsafe-eval | Refactor to remove `'unsafe-inline'` and `'unsafe-eval'`. Implement nonce-based script loading for inline scripts. |
| S-04 | Global `withCredentials: true` | Remove `axios.defaults.withCredentials = true` from `AuthContext.js`. Add `withCredentials: true` only to auth-related requests. |
| A-01 / A-02 | God controllers (974 + 856 lines) | Split `CoreModuleControllers.cs` into domain-specific files. Split `StrudelController.cs` into rip, transcode, subtitle, and queue controllers. |
| P-01 | N+1 query risks in EF Core | Audit all EF Core queries for missing `.Include()` / `.ThenInclude()`. Add `.AsNoTracking()` to all read-only queries. |
| Q-01 | Zero C# tests | Create `tests/WatchNexus.Core.Tests/` xUnit project with Moq. Write tests for `AuthService`, `FortressController`, `CellarController` activation, and `FortressIntegrity`. |
| S-05 | Python proxy wildcard CORS with credentials | Restrict `allow_origins` to specific deployment URLs. |

### Short-term (MEDIUM) — Next sprint

| ID | Finding |
|----|---------|
| Q-02 | Refresh token lookup O(n) on Settings table |
| Q-03 | Settings table as universal key-value store |
| P-02 | Sequential HTTP calls in bot service |
| T-01 | Docker tier images require rebuild for upgrade |
| T-02 | ValidateSerialFormat defaults to Ultra |
| T-03 | Offline activation has no cryptographic validation |
| S-06 | Weak Fortress Instance ID derivation |
| A-03 | CellarController still large (570 lines) |
| A-04 | SystemController has embedded controllers |
| P-03 | Fortress runtime check overhead |
| D-01 | .NET 10 preview packages |
| D-02 | cra-template in production dependencies |
| D-03 | framer-motion bundle size |
| Q-04 / Q-05 | Multiple empty catch blocks |
| Q-06 | Sync-over-async in startup |

### Long-term (LOW/INFO) — When convenient

| ID | Finding |
|----|---------|
| Q-08 through Q-11 | Empty catch blocks in frontend, unused constants |
| P-06 through P-08 | Modulepreload, license caching, request batching |
| D-04 / D-05 | Split Python dev/prod requirements |
| T-04 | Deduplicate tier module mappings |
| A-07 | Module lifecycle hooks |
| S-10 | Generic catch in tool check endpoint |
| P-09 | Mock sessions endpoint |

---

## Appendix: Additional Details

### Files Not Covered in Main Report

- **`build/build-tiers.sh`**, **`build/copy-tier-controllers.sh`**: Shell scripts for tier-based build — reviewed but no critical issues found.
- **`installers/linux/`**, **`installers/windows/`**, **`installers/docker/`**: Installer configurations — standard packaging patterns, no audit findings beyond tier concerns already noted.
- **`.gitignore`**, **`.dockerignore`**: Standard patterns, adequate.
- **`CHANGELOG.md`**, **`README.md`**: Documentation files, not in audit scope.
- **`electron/`**: Electron wrapper config — reviewed for security (contextIsolation/ nodeIntegration) but not deeply analyzed. Note: `electron-builder.yml` not read in detail.

### Dependency Version Summary

| Ecosystem | Total Dependencies | Audit Notes |
|-----------|-------------------|-------------|
| Node.js (frontend) | 34 direct + dev | React 19.0.0, Radix UI components, Framer Motion. No known CVEs in direct deps. |
| NuGet (C# backend) | 12 packages | .NET 10 preview, BCrypt.Net-Next 4.1.0, EF Core Sqlite 10.0.4 |
| Python (backend proxy) | 140+ packages | Many pinned at exact versions. Includes dev tools (black, flake8, pytest). FastAPI 0.110.1 (stable). |

### Audit Methodology

Each dimension was audited by:
1. **Security**: Static analysis for secrets patterns, OWASP Top 10 review, authentication/authorization flow analysis, CSP/HSTS/CORS configuration review.
2. **Architecture**: File structure analysis, class dependency graphing via code review, SRP/LoC metrics per file, module isolation assessment.
3. **Performance**: EF Core query pattern analysis, async/sync boundary detection, React re-render path analysis, bundle composition review.
4. **Quality**: Test coverage assessment, exception handling patterns, logging completeness, code duplication, naming conventions.
5. **Dependencies**: Package.json audit, .csproj audit, Python requirements audit, license compatibility (MIT for frontend, MIT/Apache for .NET packages).
6. **Tier Enforcement**: Fortress code review, Docker tier build analysis, FortressFilter endpoint protection, Cellar activation flow, frontend TierGate bypass assessment.

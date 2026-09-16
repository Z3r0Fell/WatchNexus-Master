# WatchNexus Error Handling Audit Report

**Date:** 2026-08-16  
**Auditor:** Error Handling Specialist  
**Scope:** Backend (`src/watchnexus/core/`) + Frontend (`src/web/src/`)

---

## Executive Summary

The codebase has **basic error handling** but lacks **production-grade resilience patterns**. Key gaps include:
- No global exception middleware → inconsistent 500 responses
- Single root ErrorBoundary → entire app crashes on any component error
- Minimal API interceptors → no centralized auth/upgrade/retry logic
- No structured logging with correlation IDs → debugging is difficult
- Background services lack crash resilience → silent failures

---

## 1. Backend Error Handling Audit

### 1.1 Global Exception Handling — **MISSING**

**Current State:** No `app.UseExceptionHandler()` or custom middleware. Exceptions bubble to Kestrel, returning generic 500 with no consistent JSON format.

**Evidence:** `Program.cs:572-584` — middleware pipeline has no exception handler.

**Impact:** 
- Clients receive HTML error pages or empty 500s
- No correlation IDs for support tracing
- Sensitive stack traces may leak in development

**Required:** Global exception middleware returning consistent JSON:
```json
{
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "correlationId": "abc-123-def",
  "timestamp": "2026-08-16T12:00:00Z"
}
```

---

### 1.2 Controller Action Filters — **PARTIAL**

**Current State:** 
- `FortressFilter` (`FortressController.cs:22-158`) — excellent tier enforcement with consistent 403 format
- Controllers manually handle exceptions with inconsistent patterns:
  - `MediaOpsController.cs:104` — `catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }`
  - `CellarController.cs:228-231` — returns 503 with user-friendly message for license server unreachable
  - `SecurityController.cs:114-117` — returns 501 with `{ error: "NOT_IMPLEMENTED", message: "..." }`

**Gaps:**
- No base controller with shared error handling
- Constraint violations (unique, FK) return raw 500
- No ProblemDetails (RFC 7807) standard

---

### 1.3 Database Error Translation — **MISSING**

**Current State:** EF Core exceptions bubble up unhandled.

**Evidence:** `AuthService.cs:56` — `_db.Users.Any(u => u.Email == email)` could throw on DB lock; `SecurityController.cs:56` — `await _db.SaveChangesAsync()` no try/catch.

**Required:** Translate common SQLite errors:
| SQLite Error | HTTP Status | User Message |
|--------------|-------------|--------------|
| `SQLITE_CONSTRAINT_UNIQUE` | 409 | "This item already exists" |
| `SQLITE_CONSTRAINT_FOREIGNKEY` | 400 | "Referenced item does not exist" |
| `SQLITE_BUSY` / `SQLITE_LOCKED` | 503 | "Database temporarily unavailable, please retry" |
| `SQLITE_READONLY` | 503 | "Database is read-only — check permissions" |

---

### 1.4 External API Error Handling — **INCONSISTENT**

**Patterns Found:**

| Service | Location | Timeout | Retry | Circuit Breaker | Fallback |
|---------|----------|---------|-------|-----------------|----------|
| License Server | `CellarController.cs:197` | 15s | No | No | 503 with message |
| TMDB | `BotBackgroundService.cs:258` | 15s | No | No | Silent skip |
| Matrix/Synapse | `BotBackgroundService.cs:78, 165` | 15s | No | No | Log warning |
| qBittorrent | `qbittorrentApi.testConnection` | Default | No | No | N/A |
| FFmpeg | `MediaOpsController.cs:55` | 10min | No | No | 503 with install hint |

**Gaps:**
- No `Polly` policies for retry/timeout/circuit-breaker
- No shared `HttpClient` configuration with resilience
- TMDB failures in background service silently ignored
- License server unreachable → hard 503 (no cached tier fallback)

---

### 1.5 Background Service Crash Resilience — **WEAK**

**Current State:** All `BackgroundService` implementations wrap loop body in try/catch but only log and continue.

**Evidence:**
- `UpdateBackgroundService.cs:38-41` — catches all, logs warning, continues
- `BotBackgroundService.cs:40-43` — catches all, logs error, continues
- `WatchPartyConnectionManager.cs` — not reviewed but likely similar

**Gaps:**
- No exponential backoff on repeated failures
- No dead letter queue for failed operations
- No health check endpoint to detect stuck services
- No automatic restart policy (relies on Kubernetes/systemd)

---

### 1.6 Logging — **PARTIAL**

**Current State:**
- `Program.cs:203-213` — JSON console in production, filters EF Core commands
- `Fortress.cs:24` — custom `Logger` delegate
- Services use `ILogger<T>` with structured logging

**Gaps:**
- No correlation IDs propagated through request pipeline
- No PII scrubbing (emails, IPs, tokens may appear in logs)
- Audit logs in `SecurityController.cs:119` store raw IP + user ID — good for audit, but not scrubbed for debug logs
- Boot logger in `Program.cs` writes full stack traces to file — good for startup crashes

---

## 2. Frontend Error Handling Audit

### 2.1 React Error Boundaries — **INSUFFICIENT**

**Current State:** Single `ErrorBoundary` at root (`App.js:228-250`).

**Evidence:** `ErrorBoundary.jsx` — basic class component, shows "Reload Page" button, dumps error message in `<details>`.

**Gaps:**
- **No route-level boundaries** — any component crash kills entire app
- **No per-gadget boundaries** — gadget failure takes down dashboard
- **No error reporting integration** (Sentry, etc.)
- **No recovery UI** — only full page reload

---

### 2.2 API Error Interceptors — **MINIMAL**

**Current State:** Two axios instances with basic interceptors:

1. `api.js:19-31` — handles timeout + network error only
2. `nexusApi.js:13-25` — identical minimal handling

**Missing Centralized Handling:**
| HTTP Status | Current | Required |
|-------------|---------|----------|
| 401 | Nothing | Auto-logout + redirect to `/login` |
| 403 | Nothing | Show upgrade banner if tier-locked, else "Access denied" |
| 409 | Nothing | Show conflict message (duplicate, etc.) |
| 422 | Nothing | Surface validation errors inline |
| 429 | Nothing | Show rate limit message with retry-after |
| 503 | Nothing | Show "Service unavailable, retrying..." with auto-retry |
| 5xx | Nothing | Show generic error + correlation ID for support |

---

### 2.3 Network Failure UI — **MISSING**

**Current State:** No offline detection, no retry buttons on failed requests.

**Evidence:** No `navigator.onLine` listeners, no offline banner component.

**Required:**
- Global offline banner (top of app)
- Retry buttons on failed queries (TanStack Query style)
- Queue mutations offline, replay on reconnect

---

### 2.4 Form Validation Errors — **INCONSISTENT**

**Current State:** 
- Some pages use `toast.error(e.response?.data?.detail || 'Failed')` — relies on backend `detail` field
- Others use bare `catch { toast.error('Failed') }` — no user context
- No inline field-level validation display

**Evidence:** `LibraryManagerPage.js:148, 162, 178, 189` — mixed patterns.

---

### 2.4 WebSocket Reconnection — **MISSING**

**Current State:** `WatchPartyPage.jsx:62-69` — raw WebSocket, no reconnection logic.

```javascript
socket.onerror = () => toast.error('WebSocket error');
// No onclose handler, no reconnect
```

**Required:** Exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s).

---

## 3. Graceful Degradation Patterns — **MOSTLY MISSING**

| Scenario | Current Behavior | Required |
|----------|------------------|----------|
| TMDB down | Background service skips silently; frontend shows empty results | Show cached metadata, disable search with banner |
| License server down | Hard 503 on activation; tier checks fail closed | Use cached tier, show warning banner |
| Download client down | 503 from engine endpoints | Pause queue, auto-retry with backoff |
| Transcode failure | 500 with stderr | Mark job failed, notify user, allow retry |
| Database locked | 500 | Queue requests, exponential backoff, surface "busy" |

**Positive Example:** `CellarController.ResolveTier()` — tamper-evident read falls back to "standard" on parse/hash error (line 449-464).

---

## 4. User-Appropriate Errors — **PARTIAL**

**Good:**
- `FortressFilter` returns `{ error: "FORTRESS_TIER_LOCKED", message: "...", required_tier, current_tier, upgrade_url }` — actionable
- `CellarController` returns user-friendly messages for license errors
- `MediaOpsController` returns `install_hint` for missing FFmpeg

**Gaps:**
- Many 500s return raw `ex.Message` — technical details leak to UI
- No error codes for support correlation (except Fortress)
- No feature flags for progressive rollout
- Stack traces in development only (good) but no structured error IDs

---

## 5. Code Examples — Current Patterns

### Backend: Inconsistent Controller Error Handling

```csharp
// MediaOpsController.cs:104 — BAD: leaks exception message
catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }

// CellarController.cs:228-231 — GOOD: user-friendly, no internal details
catch (Exception ex)
{
    return StatusCode(503, new { success = false, message = $"Cannot reach license server: {ex.Message}" });
}

// SecurityController.cs:114-117 — GOOD: structured 501
[HttpGet("sessions")]
public IActionResult Sessions() => StatusCode(501, new { error = "NOT_IMPLEMENTED", message = "Session management is not yet implemented." });
```

### Frontend: Inconsistent Toast Error Handling

```javascript
// LibraryManagerPage.js:162 — GOOD: uses backend detail
catch (e) { toast.error(e.response?.data?.detail || 'Failed to add library'); }

// LibraryManagerPage.js:148 — WEAK: generic message
catch { toast.error('Failed to load libraries'); }

// WatchPartyPage.jsx:69 — WEAK: no reconnect
socket.onerror = () => toast.error('WebSocket error');
```

---

## 6. Recommended Fixes — Priority Order

### P0 — Critical (Do First)

1. **Global Exception Middleware** — Consistent JSON errors, correlation IDs, PII scrubbing
2. **Route-Level Error Boundaries** — Isolate gadget/page crashes, show recovery UI
3. **API Error Interceptor** — Centralized 401/403/429/503 handling with user messages + retry

### P1 — High

4. **Database Error Translator** — Map SQLite errors to 409/400/503 with user messages
5. **Polly Resilience Policies** — Shared HttpClient with retry/timeout/circuit-breaker
6. **Background Service Health** — Exponential backoff, dead letter queue, health endpoint

### P2 — Medium

7. **Structured Logging** — Correlation IDs, PII scrubbing, audit vs debug separation
8. **Offline/Network UI** — Banner, retry buttons, mutation queue
9. **WebSocket Reconnection** — Exponential backoff for WatchParty
10. **Inline Form Validation** — Field-level error display component

### P3 — Low

11. **ProblemDetails (RFC 7807)** — Standardize error response format
12. **Error Code Registry** — Document all error codes for support
13. **Feature Flags** — Progressive rollout infrastructure

---

## 7. Implementation Plan — 3 Critical Fixes

### Fix 1: Global Exception Middleware (Backend)
**File:** `src/watchnexus/core/Middleware/ExceptionMiddleware.cs` (new)
- Catches all unhandled exceptions
- Returns consistent JSON with `error`, `message`, `correlationId`, `timestamp`
- Logs structured error with correlation ID
- Scrubs PII from logs (emails, tokens, IPs)
- Development mode includes stack trace

### Fix 2: Route-Level Error Boundary (Frontend)
**File:** `src/web/src/components/RouteErrorBoundary.jsx` (new)
- Wraps each lazy-loaded route
- Shows inline recovery UI (retry, go home, report)
- Integrates with toast for error reporting
- Preserves sidebar/navigation on page crash

### Fix 3: Enhanced API Interceptor (Frontend)
**File:** `src/web/src/services/api.js` (modify) + `src/web/src/services/apiErrorHandler.js` (new)
- 401 → logout + redirect with toast
- 403 → tier-locked → upgrade banner; else access denied
- 429 → show retry-after, auto-retry once
- 503 → show "Service unavailable" with auto-retry (exponential backoff)
- Extracts user-friendly message from backend `detail`/`message` fields
- Adds correlation ID to toast for support

---

## Appendix: Files Reviewed

### Backend (25+ controllers, 10+ services)
- `Program.cs` — startup, middleware pipeline, boot logging
- `Fortress.cs` / `FortressController.cs` — integrity, tier enforcement
- `CellarController.cs` — license activation, tier resolution
- `MediaControllers.cs` — media ops, health check, repair
- `SecurityController.cs` — audit, IP rules, API keys
- `AuthService.cs` — JWT, login, user creation
- `UpdateBackgroundService.cs` — auto-update with signature verification
- `BotBackgroundService.cs` — Matrix bot, token drip, featured film
- `PatchService.cs` — not fully reviewed (hot patching)

### Frontend (60+ pages, 10+ contexts/services)
- `App.js` — routing, ErrorBoundary, providers
- `ErrorBoundary.jsx` — root error boundary
- `api.js` / `nexusApi.js` — axios instances + interceptors
- `AuthContext.js` — auth state, login/logout
- `use-toast.js` / `sonner.jsx` — toast system
- Sample pages: `LibraryManagerPage.js`, `WatchPartyPage.jsx`, `SettingsPage.js`, `VpnPage.js`, `SecurityPage.js`
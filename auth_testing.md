# Auth & Security — notes for testing/fork agents

WatchNexus v1.0.0 hardening (June 2026). Read this before testing auth flows.

## Accounts (dev SQLite DB)
- ADMIN:  owner@watchnexus.local / password123  (role: admin)
- MEMBER: member@home.local      / hometime1    (role: user)

## Behaviors that look like bugs but are intentional
- **Login is rate-limited to 10 requests/min/IP.** A 429 after ~10 rapid attempts
  is expected. Pace auth calls (the security suite uses a 7s gap).
- **Logout / password-reset invalidate ALL of that user's JWTs** (server-side
  token-version bump in the `AppSetting` table, key `sec_tokenver:{userId}`).
  When testing logout, use a SEPARATE account from any reused session token, or
  later calls with the old token will (correctly) return 401.
- **Public registration is disabled** — `POST /api/auth/register` → 403. Create
  users via admin-only `POST /api/users`.
- **License activation requires the real license server** (`licenses.watchnexus.ca`).
  Test serials are rejected; there is no offline/format unlock. To functionally
  test Ultra-gated controllers, temporarily set `LICENSE_SERVER_URL=""` in
  `/app/src/watchnexus/core/appsettings.json`, restart, activate with
  `WNX-ULT-AAAA-BBBB-CCCC`, then RESTORE appsettings.
- **JWT secret auto-generates** on first boot to `{dataDir}/jwt.key` if not
  provided via env. Deleting that file invalidates all tokens.
- **Admin-only endpoints**: `GET/POST/PUT/DELETE /api/users`, `/api/users/{id}/reset-password`,
  all of `/api/fortress/*` (status/verify/reseal/audit). A `user`-role token → 403.

## Regression suites
- `/app/backend/tests/test_watchnexus_v100_security.py` — 25 tests, security epic.
- `/app/backend/tests/test_watchnexus_v100_controller_sweep.py` — 74 tests, all
  controllers (needs offline license mode for the Ultra endpoints).

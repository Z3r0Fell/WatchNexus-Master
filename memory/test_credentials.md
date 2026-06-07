# Test Credentials

## OOBE (Out-Of-Box Experience) — v1.0.0 RTP onwards
The default `admin@watchnexus.local / admin` seed account was **removed** in v1.0.0
to eliminate the known-weak-credential CVE class. On a fresh install:

1. The frontend `FirstLaunchGate` polls `GET /api/auth/setup-status`.
2. With zero users in the DB, it returns `needs_setup: true` and renders the
   admin-creation wizard.
3. The user posts to `POST /api/auth/setup` with `{email, username, password}`
   and that becomes the first admin account.
4. Step 2 of the wizard asks for an optional license serial.

## Headless / CI seeding
To pre-seed an admin (e.g. for automated tests or scripted deploys), set these
env vars before first boot:

```
WATCHNEXUS_SEED_ADMIN_EMAIL=qa@example.com
WATCHNEXUS_SEED_ADMIN_PASSWORD=<a strong password>
```

Both must be set, and the seed only runs when the Users table is empty.

## For the testing agent
If a previous session created an account via the wizard, the credentials it used
should be recorded here by the agent that ran the test. If this file is empty
when you see it, the DB is fresh and the wizard needs to be exercised first.

## Current dev accounts (June 2026 — security hardening pass)
- ADMIN:  owner@watchnexus.local / password123  (role: admin)
- MEMBER: member@home.local      / hometime1    (role: user)
Both exist in the dev SQLite DB at
`/app/src/watchnexus/core/bin/Release/net10.0/data/watchnexus.db`.

NOTE: Public registration is DISABLED (POST /api/auth/register → 403). New
accounts are created by an admin via Settings → Users (POST /api/users, admin
only). Login is rate-limited to 10 requests/minute/IP (429 after that is expected).

## Environment note (forked container)
The .NET backend (`watchnexus-server` in supervisor) launches via
`/opt/dotnet/dotnet`, but in this forked pod the SDK lives at `/root/.dotnet`.
If the backend is FATAL with "can't find command '/opt/dotnet/dotnet'", run:
`ln -sfn /root/.dotnet /opt/dotnet && sudo supervisorctl restart watchnexus-server`
(`/opt` is outside `/app` so the platform may wipe this symlink between syncs.)

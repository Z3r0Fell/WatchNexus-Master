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

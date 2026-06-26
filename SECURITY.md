# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |

## Reporting a Vulnerability

Please report security vulnerabilities responsibly. **Do not open a public issue.**

- Email: **security@watchnexus.ca**
- Include: affected version, reproduction steps, impact, and any PoC.

We aim to acknowledge reports within **72 hours** and provide a remediation
timeline after triage. Coordinated disclosure is appreciated — we will credit
reporters (with permission) once a fix ships.

## Hardening notes for self-hosters

- Run WatchNexus behind a TLS-terminating reverse proxy and set `FORCE_HTTPS=1`.
- Supply `JWT_SECRET`, `TMDB_API_KEY`, and `LICENSE_SERVER_API_KEY` via
  environment variables or a non-committed `appsettings.Production.json`.
- Keep the data directory (`/var/lib/watchnexus/data`) and the Data Protection
  key ring (`dp-keys/`) readable only by the service account.
- Auth uses an httpOnly `SameSite=Strict` JWT cookie plus a double-submit CSRF
  token. Do not disable these in production.

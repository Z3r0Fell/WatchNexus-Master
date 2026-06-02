---
name: security-audit
description: Use when performing security-focused code audits of .NET + React applications. Covers secrets detection, auth bypass, injection, XSS, CVE scanning, and anti-tampering review.
---

# Security Audit Methodology

## Secrets Detection Patterns
```regex
# High-confidence secrets patterns
api[Kk]ey\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}['\"]
secret\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]
token\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}['\"]
password\s*[:=]\s*['\"].+['\"]
connection[Ss]tring\s*[:=]\s*['\"].+['\"]
```

## .NET Security Checklist
- `[Authorize]` on all controllers except auth/anonymous endpoints
- JWT: validate `ValidateIssuer`, `ValidateAudience`, `ValidateLifetime` are all true
- Anti-forgery tokens on state-changing requests
- Data Protection API (DPAPI) for sensitive config
- No `FromSqlRaw` / `ExecuteSqlRaw` without parameterization
- CORS: specific origins, not `AllowAnyOrigin()` with credentials

## React Security Checklist
- No `dangerouslySetInnerHTML` with user-controlled data
- DOMPurify or similar sanitization for HTML rendering
- Content Security Policy meta tag
- Auth tokens in httpOnly cookies, not localStorage
- `rel="noopener noreferrer"` on external links

## CVE Scanning Commands
```bash
# npm
npm audit --json

# NuGet
dotnet list package --vulnerable

# Python
pip-audit -r requirements.txt
safety check -r requirements.txt
```

## Fortress Bypass Vectors
1. Environment variable overrides
2. Debug mode disabling checks
3. File permission changes on checksum store
4. LD_PRELOAD / DLL injection
5. Time-of-check to time-of-use (TOCTOU) race conditions

# Beyond Passwords: How WatchNexus Approaches Security for Self-Hosted Software

**Target:** The Hacker News (THN), DarkReading, r/netsec, OpenSSF Blog, Trail of Bits Blog  
**Format:** Security-focused technical article  
**Word Count:** ~1,800  
**Tone:** Security-professional, threat-model-aware, precise

---

Self-hosted applications occupy an unusual position in the security landscape. They're deployed on home networks or small office servers, often exposed to the internet via port forwarding or reverse proxies, and typically administered by a single person who is also the sole user. The threat model is unique: you're protecting a consumer application with enterprise-grade exposure.

Most self-hosted media applications treat security as an afterthought. A JWT token, maybe HTTP Basic Auth, and a recommendation to "put it behind a reverse proxy." WatchNexus takes a different approach, implementing a layered security architecture across three dedicated modules: Bastion (access control), Tunnel (network security), and Fortress (integrity verification).

## Threat Model

For a self-hosted media server, the realistic threats are:

1. **Credential stuffing / brute force** against the web interface
2. **Unauthorized access** if the server is exposed to the internet
3. **Session hijacking** on shared or compromised networks
4. **Binary tampering** if an attacker gains filesystem access
5. **API abuse** from misconfigured or leaked API keys

WatchNexus addresses each of these with specific countermeasures.

## Layer 1: Authentication (Bastion)

### TOTP Two-Factor Authentication

Bastion implements RFC 6238 TOTP (Time-based One-Time Password) for second-factor authentication. The implementation details:

- **Secret Generation**: 20-byte random secret generated via `RandomNumberGenerator.Fill()`, then Base32-encoded for compatibility with authenticator apps
- **QR Code URI**: Standard `otpauth://totp/WatchNexus:{email}?secret={base32}&issuer=WatchNexus&digits=6&period=30` format, compatible with Google Authenticator, Authy, 1Password, and Bitwarden
- **Backup Codes**: 8 randomly generated 8-digit codes stored as hashed values, single-use

```
POST /api/bastion/2fa/setup
Response:
{
  "secret": "JBSWY3DPEHPK3PXP...",
  "qrUri": "otpauth://totp/WatchNexus:admin@watchnexus.local?secret=...",
  "backupCodes": ["12345678", "87654321", ...]
}
```

**What we didn't do**: We didn't build a custom OTP library. The TOTP algorithm is straightforward (HMAC-SHA1 of the Unix timestamp divided by the period), but getting the edge cases right (clock skew tolerance, Base32 padding) is where implementations typically break. We use standard library primitives and validate against known-good authenticator app outputs.

### Session Management

Every authenticated session is tracked with:
- Session token (stored server-side, not in a cookie)
- Device type and browser (parsed from User-Agent)
- IP address and geolocation (when available)
- Creation timestamp and last activity
- Explicit session termination (remote kill)

The session list is available in the Bastion UI, allowing administrators to:
- View all active sessions across all users
- Identify unfamiliar devices or locations
- Terminate specific sessions without affecting others

### Audit Logging

Every security-relevant action generates an audit log entry:

```json
{
  "action": "login_success",
  "userId": "6388ac73-...",
  "ipAddress": "192.168.1.100",
  "details": "Browser: Chrome 120, OS: Linux",
  "status": "success",
  "timestamp": "2026-03-24T13:04:21Z"
}
```

Logged actions include: login attempts (success and failure), 2FA setup/verification, setting changes, API key creation/revocation, session creation/termination, and IP rule modifications.

Logs are searchable, filterable by action type and status, and exportable as JSON for external SIEM integration.

### IP Filtering

Bastion supports IP-based access rules:
- Whitelist mode: Only specified IPs/ranges can access the application
- Blacklist mode: Block specific IPs/ranges
- Rate limiting on authentication endpoints

For a self-hosted server exposed via port forwarding, IP whitelisting to known VPN exit nodes or office IP ranges provides a meaningful reduction in attack surface.

## Layer 2: Network Security (Tunnel)

Rather than recommending users set up a separate VPN service, WatchNexus includes a built-in WireGuard management interface.

### WireGuard Peer Management

The Tunnel module provides:
- **Peer CRUD**: Add, modify, and remove WireGuard peers from the web UI
- **Automatic Key Generation**: Public/private key pairs generated server-side. No manual `wg genkey | wg pubkey` pipeline.
- **Configuration Export**: Download peer configurations for mobile/desktop clients

### SSL Certificate Management

Tunnel manages SSL certificates for the WatchNexus web interface:
- Certificate status monitoring (expiry dates, issuer info)
- Certificate renewal reminders
- Support for Let's Encrypt and self-signed certificates

### External Connectivity Testing

A built-in connectivity checker that:
- Verifies the server is reachable from the internet
- Detects the external IP address
- Tests DNS resolution
- Validates port accessibility

This replaces the common "open a browser on your phone, try the external IP, and hope it works" debugging process.

## Layer 3: Integrity Verification (Fortress)

Fortress addresses the scenario where an attacker gains filesystem access to the server (e.g., via a compromised SSH key or a vulnerable service on the same machine).

### Assembly Baseline Computation

At application startup, Fortress computes SHA-256 hashes of every .NET assembly (DLL) in the application directory:

```
Startup:
  watchnexus.dll -> SHA256: a1b2c3d4...
  Microsoft.AspNetCore.dll -> SHA256: e5f6g7h8...
  (... all assemblies)
```

These baselines are stored in memory (not on disk, where an attacker could modify them).

### Runtime Verification

A background service periodically recomputes hashes and compares them against the baselines:

```
Verification cycle (every 5 minutes):
  watchnexus.dll -> SHA256: a1b2c3d4... [MATCH]
  Microsoft.AspNetCore.dll -> SHA256: e5f6g7h8... [MATCH]
  ✓ All assemblies verified
```

If a mismatch is detected:

```
Verification cycle:
  watchnexus.dll -> SHA256: x9y0z1a2... [MISMATCH]
  ⚠ Tampering detected - API auto-locked
```

### Auto-Lockdown

On tampering detection, Fortress:
1. Logs a security event with full details
2. Locks the API (returns 503 for all requests)
3. Preserves the tampered state for forensic examination

The lockdown requires a manual restart with integrity re-verification to restore service.

### Limitations

Fortress is not a silver bullet:
- An attacker with root access can modify the running process's memory
- The baselines are computed at startup; if the binary is compromised before first launch, the tampered version becomes the baseline
- It doesn't protect against vulnerabilities in the application logic itself

It's a detection layer, not a prevention layer. It catches accidental corruption, supply chain attacks on the binary distribution, and opportunistic file modification.

## API Security

### API Key Management

WatchNexus provides granular API key management through the Bastion module:
- Per-key name and description for identification
- Usage tracking (last used timestamp, request count)
- Revocation without affecting other keys or user sessions

API keys are generated using `RandomNumberGenerator` and stored as SHA-256 hashes (the plaintext is shown once at creation, then discarded).

### Rate Limiting

Authentication endpoints are rate-limited to prevent brute-force attacks. The limits are:
- Login: 5 attempts per minute per IP
- 2FA verification: 3 attempts per minute per session
- API key creation: 10 per hour per user

## Security Feature Summary

| Feature | Module | Status |
|---------|--------|--------|
| JWT Authentication | Core | Active |
| Password Hashing (bcrypt) | Core | Active |
| TOTP 2FA | Bastion | Active |
| Session Management | Bastion | Active |
| Audit Logging | Bastion | Active |
| IP Filtering | Bastion | Active |
| API Key Management | Bastion | Active |
| Rate Limiting | Core | Active |
| CORS Policy | Core | Active |
| WireGuard VPN | Tunnel | Active |
| SSL Management | Tunnel | Active |
| Assembly Integrity | Fortress | Active |

Eight active security features are visible on the System Dashboard, each with a green indicator confirming operational status.

## Conclusion

Self-hosted software shouldn't require users to bolt on security as an afterthought. By building authentication, network security, and integrity verification into the application itself, WatchNexus reduces the gap between "I installed it" and "it's production-ready" from hours of reverse proxy configuration and VPN setup to minutes.

The security architecture isn't perfect -- no consumer application's is. But it represents a meaningful improvement over the "JWT and a prayer" approach that dominates the self-hosted software landscape.

---

*WatchNexus v1.0.1. Full security architecture documentation available in the press kit.*

---

## Submission Notes
- **The Hacker News (THN)**: Submit via thehackernews.com/p/submit-news.html. Focus on the unique Fortress integrity verification angle.
- **DarkReading**: Apply to contributor program. Frame as "security lessons from self-hosted software."
- **r/netsec**: Technical post. Be prepared for rigorous scrutiny of the threat model and implementation.
- **OpenSSF Blog**: Guest blog program. Frame around supply chain security (Fortress module).
- **Trail of Bits**: Blog submission. Focus on the assembly integrity verification approach.
- Include the System Dashboard screenshot showing the 8 security features.

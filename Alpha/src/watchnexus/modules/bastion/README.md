# Bastion - Security Module

Security and access control module for WatchNexus.

## Features
- Audit logging with action tracking
- IP filtering (block/allow rules)
- API key management with SHA-256 hashing
- Session tracking and revocation
- OWASP security headers
- Rate limiting support

## API Routes
- `GET /api/security/stats` - Security statistics
- `GET /api/security/audit` - Audit log viewer (paginated)
- `GET|POST|DELETE /api/security/ip-rules` - IP rule management
- `GET|POST|DELETE /api/security/api-keys` - API key management
- `GET /api/security/sessions` - Active sessions
- `POST /api/security/sessions/{id}/revoke` - Revoke session

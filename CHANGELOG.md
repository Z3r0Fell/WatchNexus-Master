# WatchNexus Changelog

## v2.8.0 (March 11, 2026)

### New Features
- **Security Module (Bastion)**: Full CRUD for audit logs, IP rules, API keys, session management
- **VPN Module (Tunnel)**: WireGuard server/peer configuration, QR code generation, status monitoring
- **System Info Endpoint**: `/api/info` returns CPU, memory, disk, module health
- **Library Bridge Routes**: `/api/libraries` CRUD mapped to Marmalade backend
- **Integration Settings**: TMDB API key and qBittorrent connection management via `/api/settings/integrations`
- **Background Library Scanning**: Async scan with job tracking and status polling
- **Logs Bridge Routes**: `/api/logs` for log file browsing and latest entries
- **Platform Installers**: Docker, Linux, Windows, macOS, Unraid

### Bug Fixes
- Fixed `/api/users/me` returning 405 (was missing GET route)
- Fixed VPN Traffic stats showing NaN when no data
- Fixed Log Viewer system stats showing NaN values
- Fixed MediaType enum mismatch between frontend and backend

### Infrastructure
- Cleaned up root-level legacy scripts (capture, marketing, split)
- Removed duplicate/broken C# code from /app/src/
- Disabled broken dotnet supervisor entry
- Updated README.md with current architecture
- Updated src/README.md with module documentation

### Testing
- iteration_31: 20/20 backend tests passed, all frontend flows working
- iteration_32: 24/24 backend tests passed, all pages loading correctly

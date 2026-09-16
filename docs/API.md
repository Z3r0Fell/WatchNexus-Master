# WatchNexus API Reference

**Version:** 1.0.4  
**Base URL:** `http://<host>:8001/api`  
**Authentication:** JWT via `wn_token` httpOnly cookie or `Authorization: Bearer <token>` header  
**CSRF Protection:** Double-submit cookie (`csrf_token` + `X-CSRF-Token` header)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Core & System](#core--system)
3. [Users & Profiles](#users--profiles)
4. [License & Activation](#license--activation)
5. [TMDB Proxy](#tmdb-proxy)
6. [Watchlist & Progress](#watchlist--progress)
7. [Libraries & Media](#libraries--media)
8. [Settings](#settings)
9. [Logs & Diagnostics](#logs--diagnostics)
10. [Downloads](#downloads)
11. [Module-Specific Endpoints](#module-specific-endpoints)
12. [WebSocket Endpoints](#websocket-endpoints)
13. [Error Format](#error-format)
14. [Rate Limits](#rate-limits)
15. [Tier Requirements](#tier-requirements)

---

## Authentication

### POST `/api/auth/setup-status`

Check if initial admin setup is needed.

**Response (200):**
```json
{
  "needs_setup": true,
  "user_count": 0,
  "version": "1.0.4"
}
```

### POST `/api/auth/setup`

Create first admin account (only works when `needs_setup: true`).

**Request:**
```json
{
  "email": "admin@example.com",
  "username": "admin",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "abc123",
    "email": "admin@example.com",
    "username": "admin",
    "avatar": null,
    "role": "admin",
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```

**Cookies Set:**
- `wn_token` (httpOnly, Secure, SameSite=Strict, 7 days)
- `csrf_token` (readable by JS, SameSite=Strict, 7 days)

### POST `/api/auth/login`

Authenticate with email/password.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword123"
}
```

**Response (200):** Same as `/setup` + cookies.

### POST `/api/auth/logout`

Invalidate current session (server-side token version bump).

**Response (200):**
```json
{ "status": "logged_out" }
```

### GET `/api/auth/me`

Get current authenticated user.

**Response (200):**
```json
{
  "id": "abc123",
  "email": "admin@example.com",
  "username": "admin",
  "avatar": null,
  "role": "admin",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

### POST `/api/auth/register`

**Disabled** — Returns `403`. Use admin user management instead.

---

## Core & System

### GET `/api/health`

Liveness probe — **no auth required**.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "version": "1.0.4"
}
```

### GET `/api/info`

Detailed system info — **requires auth**.

**Response (200):**
```json
{
  "version": "1.0.4",
  "codename": "WatchNexus",
  "framework": ".NET 10.0.0",
  "hostname": "server",
  "platform": "Linux 6.8.0",
  "architecture": "X64",
  "dotnet_version": "10.0.0",
  "cpu_count": 8,
  "memory_used": 2147483648,
  "uptime": 86400,
  "security": {
    "jwt_auth": true,
    "password_hashing": true,
    "rate_limiting": true,
    "cors_policy": true,
    "two_factor": true,
    "session_management": true,
    "ip_filtering": true,
    "api_key_auth": true
  },
  "modules": [
    { "name": "Marmalade", "codename": "marmalade", "version": "1.0.4", "status": "active" },
    { "name": "Bastion", "codename": "bastion", "version": "1.0.4", "status": "active" },
    ...
  ]
}
```

---

## Users & Profiles

### GET `/api/users/me`

Current user profile (alias for `/api/auth/me`).

### GET `/api/users/profiles`

**Public** — List all users for login picker.

**Response (200):**
```json
[
  { "id": "abc123", "username": "admin", "email": "admin@example.com", "avatar": null },
  { "id": "def456", "username": "user1", "email": "user1@example.com", "avatar": "avatar.png" }
]
```

### GET `/api/users`

**Admin only** — List all users with full details.

### POST `/api/users`

**Admin only** — Create user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "securepassword123",
  "role": "user"
}
```

### PUT `/api/users/{id}`

**Admin only** — Update user (role only).

**Request:**
```json
{ "role": "admin" }
```

### POST `/api/users/{id}/reset-password`

**Admin only** — Reset user password (invalidates all sessions).

### DELETE `/api/users/{id}`

**Admin only** — Delete user (cannot delete self or last admin).

### POST `/api/users/me/password`

**Authenticated** — Change own password.

**Request:**
```json
{
  "current_password": "oldpass",
  "new_password": "newpass123"
}
```

---

## License & Activation

### GET `/api/cellar/first-launch`

Check activation status.

**Response (200):**
```json
{
  "has_license": false,
  "setup_completed": true,
  "needs_activation": true
}
```

### POST `/api/cellar/activate-first-launch`

Activate license on first launch.

**Request:**
```json
{
  "license_key": "WNX-PRO-XXXX-XXXX-XXXX",
  "hardware_id": "abc123",
  "device_name": "My Server"
}
```

**Response (200):**
```json
{
  "success": true,
  "license": {
    "plan": "pro",
    "tier": "pro",
    "seats": 3,
    "expires": "2027-01-15T00:00:00Z"
  }
}
```

### POST `/api/cellar/activate`

Activate/re-activate license.

### GET `/api/cellar/validate`

Validate current license.

### POST `/api/cellar/deactivate`

Deactivate license.

---

## TMDB Proxy

All endpoints require auth and valid TMDB API key (configured in Settings → Integrations).

### GET `/api/tmdb/search`

Search movies/TV.

**Query:** `query`, `page=1`, `media_type=multi`

### GET `/api/tmdb/trending`

Trending media.

### GET `/api/tmdb/trending/{mediaType}/{timeWindow}`

Trending by type/window (e.g., `movie/week`).

### GET `/api/tmdb/popular/{mediaType}`

Popular movies/TV.

### GET `/api/tmdb/movie/now_playing`

Movies in theaters.

### GET `/api/tmdb/tv/on_the_air`

TV airing now.

### GET `/api/tmdb/movie/{id}`

Movie details with credits, similar, videos, images.

### GET `/api/tmdb/tv/{id}`

TV show details.

### GET `/api/tmdb/tv/{id}/season/{seasonNum}`

Season details.

### GET `/api/tmdb/discover/{mediaType}`

Discover with filters.

**Query:** `page=1`, `with_genres`, `sort_by`

### GET `/api/tmdb/genres/{mediaType}`

Genre list.

---

## Watchlist & Progress

### GET `/api/watchlist`

Get user's watchlist.

### POST `/api/watchlist`

Add to watchlist.

**Request:** TMDB item object (requires `tmdb_id` or `id`).

### DELETE `/api/watchlist/{tmdbId}`

Remove from watchlist.

### GET `/api/watch-progress`

Get watch progress (continue watching).

### GET `/api/watch-progress/all`

Alias for above.

### POST `/api/watch-progress`

Update progress.

**Request:**
```json
{
  "tmdb_id": 12345,
  "media_type": "movie",
  "progress": 45.5,
  "title": "Inception",
  "poster_url": "/path.jpg"
}
```

### DELETE `/api/watch-progress`

Delete specific progress.

**Query:** `tmdb_id`, `media_type`, `season`, `episode`

### DELETE `/api/watch-progress/all`

Clear all progress.

### GET `/api/next-up`

Get next episodes to watch.

**Query:** `limit=10`

---

## Libraries & Media

### GET `/api/libraries`

List user's libraries.

### POST `/api/libraries`

Create library.

**Request:**
```json
{
  "name": "Movies",
  "path": "/data/media/Movies",
  "media_type": "movies"
}
```

### GET `/api/libraries/{id}`

Get library details.

### POST `/api/libraries/{id}/scan`

Trigger library scan.

### GET `/api/libraries/{id}/scan-status`

Get scan progress.

### GET `/api/media`

List media items.

**Query:** `library_id`, `media_type`, `page=1`, `limit=50`, `search`

### GET `/api/media/{id}`

Get media item details.

### GET `/api/media/stream/{id}`

Stream media file (supports range requests).

### GET `/api/media/{id}/progress`

Get user progress for item.

### POST `/api/media/{id}/watched`

Mark as watched.

### GET `/api/media/search`

Search local media.

### GET `/api/media/continue-watching`

Continue watching list.

### GET `/api/media/tv-series`

TV series list.

### POST `/api/media/libraries/{id}/refresh-metadata`

Refresh TMDB metadata for library.

---

## Settings

### GET `/api/settings`

Get all settings (user + global).

### GET `/api/settings/{key}`

Get specific setting.

### PUT `/api/settings`

Bulk update settings.

**Request:** JSON object with key/value pairs. `null` value deletes key.

### PUT `/api/settings/{key}`

Set single setting.

**Request:** `{ "value": "..." }` or raw JSON. `null` deletes.

### DELETE `/api/settings/{key}`

Delete setting.

### GET `/api/settings/integrations`

Get integration status (TMDB, qBittorrent).

### PUT `/api/settings/integrations/tmdb`

Update TMDB API key.

**Request:**
```json
{ "api_key": "your-tmdb-v3-key" }
```

### PUT `/api/settings/integrations/qbittorrent`

Update qBittorrent settings.

**Request:**
```json
{
  "host": "localhost",
  "port": 8080,
  "username": "admin",
  "password": "pass",
  "enabled": true
}
```

### POST `/api/settings/integrations/qbittorrent/test`

Test qBittorrent connection.

---

## Logs & Diagnostics

### GET `/api/logs` / `/api/logs/list`

List log files.

### GET `/api/logs/latest`

Get recent log lines.

**Query:** `lines=100` (max 1000)

### GET `/api/logs/system`

System health metrics.

---

## Downloads

### GET `/api/downloads`

List download items.

**Query:** `status` (queued/downloading/completed/failed)

### POST `/api/downloads`

Add download item.

**Query:** `title`, `media_type`, `tmdb_id`, `size`

### PATCH `/api/downloads/{downloadId}`

Update download status/progress.

**Query:** `status`, `progress`

### DELETE `/api/downloads/{downloadId}`

Delete download item.

### Built-in Engine Endpoints (501 Not Implemented)

The built-in torrent engine is not included in v1.0.4. Use qBittorrent integration instead.

- `GET /api/downloads/engine/status`
- `GET /api/downloads/engine/torrents`
- `POST /api/downloads/engine/add`
- `POST /api/downloads/engine/{id}/pause`
- `POST /api/downloads/engine/{id}/resume`
- `DELETE /api/downloads/engine/{id}`
- ... and more

All return:
```json
{
  "detail": "The built-in torrent engine is not included in v1.0.0. Connect qBittorrent under Settings → Integrations to manage downloads."
}
```

---

## Module-Specific Endpoints

### Security (Ultra) — `/api/security`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/security/status` | Security overview |
| GET | `/api/security/ip-rules` | List IP allow/block rules |
| POST | `/api/security/ip-rules` | Add IP rule |
| DELETE | `/api/security/ip-rules/{id}` | Delete IP rule |
| GET | `/api/security/audit` | Audit log (paginated) |
| GET | `/api/security/api-keys` | List API keys |
| POST | `/api/security/api-keys` | Create API key |
| DELETE | `/api/security/api-keys/{id}` | Revoke API key |

### VPN / Tunnel (Ultra) — `/api/vpn`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vpn/status` | VPN status |
| GET | `/api/vpn/peers` | WireGuard peers |
| POST | `/api/vpn/peers` | Add peer |
| GET | `/api/vpn/peers/{id}/qr` | Peer QR code (public config only) |
| DELETE | `/api/vpn/peers/{id}` | Remove peer |

### Parental Controls / Rind (Ultra) — `/api/rind`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rind/profile` | Parental control profile |
| PUT | `/api/rind/profile` | Update profile (PIN hashed) |
| GET | `/api/rind/check` | Check content access |

### Notifications / Pepper (Ultra) — `/api/pepper`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pepper/channels` | Notification channels |
| POST | `/api/pepper/channels` | Create channel |
| PUT | `/api/pepper/channels/{id}` | Update channel |
| DELETE | `/api/pepper/channels/{id}` | Delete channel |
| POST | `/api/pepper/channels/{id}/test` | Test notification |
| GET | `/api/pepper/history` | Notification history |

### Processing / Crucible (Ultra) — `/api/crucible`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crucible/profiles` | Transcode profiles |
| POST | `/api/crucible/jobs` | Create transcode job |
| GET | `/api/crucible/jobs` | List jobs |
| GET | `/api/crucible/jobs/{id}` | Job status |
| POST | `/api/crucible/jobs/{id}/cancel` | Cancel job |

### Disc Ripping / Strudel (Ultra) — `/api/strudel`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/strudel/drives` | Optical drives |
| POST | `/api/strudel/rip` | Start rip |
| GET | `/api/strudel/jobs` | Rip jobs |
| GET | `/api/strudel/profiles` | HandBrake profiles |

### Live TV / IPTV (Pro) — `/api/iptv`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/iptv/sources` | IPTV sources |
| POST | `/api/iptv/sources` | Add source |
| PUT | `/api/iptv/sources/{id}` | Update source |
| DELETE | `/api/iptv/sources/{id}` | Delete source |
| POST | `/api/iptv/sources/{id}/refresh` | Refresh EPG |
| GET | `/api/iptv/channels` | Channels |
| GET | `/api/iptv/epg` | EPG data |
| GET | `/api/iptv/stream/{channelId}` | Stream channel |

### Indexers / Compote (Pro) — `/api/compote`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/compote/indexers` | Indexers |
| POST | `/api/compote/indexers` | Add indexer |
| PUT | `/api/compote/indexers/{id}` | Update indexer |
| DELETE | `/api/compote/indexers/{id}` | Delete indexer |
| GET | `/api/compote/search` | Search indexers |
| GET | `/api/compote/status` | Sync status |

### Subtitles / Saffron (Pro) — `/api/subtitles`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subtitles/providers` | Subtitle providers |
| POST | `/api/subtitles/search` | Search subtitles |
| POST | `/api/subtitles/download` | Download subtitle |
| GET | `/api/subtitles/file/{*filePath}` | Serve subtitle file |

### Analytics / Truffle (Pro) — `/api/truffle`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/truffle/stats` | Watch statistics |
| GET | `/api/truffle/year-wrapped` | Year Wrapped |
| GET | `/api/truffle/admin/overview` | Admin analytics |

### Requests / Meringue (Pro) — `/api/meringue`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/meringue/requests` | User requests |
| POST | `/api/meringue/requests` | Create request |
| PUT | `/api/meringue/requests/{id}` | Update request (admin) |
| DELETE | `/api/meringue/requests/{id}` | Delete request |

### RSS Feeds / Sprout (Pro) — `/api/sprout`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sprout/feeds` | RSS feeds |
| POST | `/api/sprout/feeds` | Add feed |
| POST | `/api/sprout/feeds/{id}/refresh` | Refresh feed |

### Backups / Sourdough (Pro) — `/api/sourdough`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sourdough/backups` | Backup list |
| POST | `/api/sourdough/backups` | Create backup |
| POST | `/api/sourdough/restore` | Restore backup |

### Download Clients / Churro (Pro) — `/api/churro`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/churro/clients` | Download clients |
| POST | `/api/churro/clients` | Add client |
| POST | `/api/churro/clients/{id}/test` | Test connection |

### Collections / Roux (Pro) — `/api/roux`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/roux/collections` | Collections |
| POST | `/api/roux/collections` | Create collection |

### Web Video / Bisque (Standard) — `/api/webvideo`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webvideo/info` | Video info (YouTube/Vimeo) |
| GET | `/api/webvideo/stream` | Stream (501 - requires yt-dlp) |

### Weather / Sorbet (Standard) — `/api/weather`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/weather/current` | Current weather |
| GET | `/api/weather/forecast` | Forecast |

### Podcasts / Brioche (Standard) — `/api/podcasts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/podcasts` | User podcasts |
| POST | `/api/podcasts` | Subscribe to feed |
| GET | `/api/podcasts/{id}` | Podcast details |
| POST | `/api/podcasts/{id}/refresh` | Refresh feed |

### Radio / Nectar (Standard) — `/api/radio`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/radio/stations` | Search stations |
| GET | `/api/radio/stations/{id}` | Station details |

### Photos / Ganache (Standard) — `/api/photos`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/photos/libraries` | Photo libraries |
| GET | `/api/photos/libraries/{id}/albums` | Albums |
| GET | `/api/photos/libraries/{id}/photos` | Photos |
| GET | `/api/photos/{id}` | Serve photo |

### Media Bridge / Custard (Ultra) — `/api/gadgets/media-bridge`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gadgets/media-bridge/config` | Bridge config |
| GET | `/api/gadgets/media-bridge/libraries` | Remote libraries |
| GET | `/api/gadgets/media-bridge/items` | Remote items |
| GET | `/api/gadgets/media-bridge/images/{itemId}` | Remote images |

### Matrix / Cinnamon (Ultra) — `/api/matrix`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matrix/rooms` | Matrix rooms |
| POST | `/api/matrix/rooms/{id}/send` | Send message |
| GET | `/api/matrix/sync` | Sync |

### Synapse Admin (Ultra) — `/api/synapse-admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/synapse-admin/users` | Users |
| GET | `/api/synapse-admin/rooms` | Rooms |
| POST | `/api/synapse-admin/media/purge` | Purge media |

### Game Bot / Waffle (Ultra) — `/api/bot`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bot/featured-film` | Featured film |
| POST | `/api/bot/quiz/start` | Start quiz |

### Scrobbling / Glaze (Standard) — `/api/glaze`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/glaze/connections` | Trakt/Last.fm connections |
| POST | `/api/glaze/connections` | Connect service |
| POST | `/api/glaze/scrobble` | Scrobble play |

### Gaming / Pretzel (Ultra) — `/api/pretzel`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pretzel/systems` | Console systems |
| GET | `/api/pretzel/games` | Games |
| GET | `/api/pretzel/roms/{system}/{game}` | ROM file |

### Ebooks / Biscotti (Ultra) — `/api/biscotti`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/biscotti/libraries` | Ebook libraries |
| GET | `/api/biscotti/books` | Books |
| GET | `/api/biscotti/read/{id}` | Read book |

### Music Library / Treacle (Ultra) — `/api/treacle`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/treacle/artists` | Artists |
| GET | `/api/treacle/albums` | Albums |
| GET | `/api/treacle/tracks` | Tracks |

### AI Metadata / Sage (Ultra) — `/api/sage`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sage/recommendations` | Recommendations |
| POST | `/api/sage/analyze` | Analyze library |

### Jellyseerr / Parfait (Ultra) — `/api/parfait`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parfait/requests` | Overseerr requests |
| POST | `/api/parfait/requests` | Create request |

### Requests Manager / Menu (Ultra) — `/api/menu`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/menu/requests` | Requests |
| POST | `/api/menu/requests` | Create request |

### Offline Sync / Popsicle (Ultra) — `/api/popsicle`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/popsicle/devices` | Synced devices |
| POST | `/api/popsicle/sync` | Start sync |

### Cloud Backup / Preserves (Ultra) — `/api/preserves`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/preserves/backups` | Cloud backups |
| POST | `/api/preserves/backup` | Create backup |

### Cloud Sync / Marshmallow (Ultra) — `/api/marshmallow`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/marshmallow/status` | Sync status |
| POST | `/api/marshmallow/sync` | Trigger sync |

### Media Sync / Chowder (Ultra) — `/api/chowder`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chowder/servers` | Jellyfin/Emby servers |
| POST | `/api/chowder/sync` | Sync libraries |

### Watch Party (Ultra) — `/api/watch-party`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/watch-party/create` | Create party |
| GET | `/api/watch-party/{code}` | Party details |
| GET | `/api/watch-party/{code}/ws` | WebSocket |

### Lobster Mesh (Ultra) — `/api/lobster`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lobster/status` | Mesh status |
| POST | `/api/lobster/start` | Start mesh |
| POST | `/api/lobster/stop` | Stop mesh |
| GET | `/api/lobster/peers` | Connected peers |
| POST | `/api/lobster/pair` | Pair device |

### Roadmap (All) — `/api/system/roadmap`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/roadmap` | All 501 endpoints with tier/status |

### Changelog (All) — `/api/changelog`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/changelog` | Version history |

---

## WebSocket Endpoints

### Watch Party WebSocket

```
GET /api/watch-party/{partyCode}/ws
```

**Protocol:** JSON messages

**Client → Server:**
```json
{ "type": "chat", "message": "Hello!" }
{ "type": "play", "timestamp": 1234.5 }
{ "type": "pause", "timestamp": 1234.5 }
{ "type": "seek", "timestamp": 5678.0 }
```

**Server → Client:**
```json
{ "type": "chat", "user": "admin", "message": "Hello!", "timestamp": "..." }
{ "type": "state", "playing": true, "timestamp": 1234.5, "leader": "admin" }
{ "type": "user_joined", "user": "user1" }
{ "type": "user_left", "user": "user1" }
```

**Auth:** Requires valid JWT (cookie or Bearer).

---

## Error Format

All errors follow RFC 7807 Problem Details:

```json
{
  "detail": "Human-readable error description",
  "code": "ERROR_CODE",
  "status": 400,
  "traceId": "0HLKT8X9F2J3K"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (invalid/expired token) |
| 403 | Forbidden (tier/role/permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 410 | Gone (removed endpoint) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |
| 501 | Not Implemented (stub endpoint) |
| 503 | Service Unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Login failed |
| `SETUP_COMPLETED` | Setup already done |
| `LICENSE_INVALID` | License key invalid |
| `LICENSE_EXPIRED` | License expired |
| `SEAT_LIMIT_EXCEEDED` | Too many active seats |
| `TIER_REQUIRED` | Endpoint requires higher tier |
| `RESERVED_SETTING` | Cannot modify internal setting |
| `INVALID_TMDB_KEY` | TMDB API key invalid |
| `SSRF_BLOCKED` | URL blocked by SSRF guard |
| `PATH_TRAVERSAL` | Path traversal attempt |
| `FILE_NOT_FOUND` | Media file not found |

---

## Rate Limits

| Policy | Scope | Limit | Window |
|--------|-------|-------|--------|
| `auth` | Per IP | 10 req | 1 min |
| `activation` | Per IP | 5 req | 5 min |
| `global_mutations` | Per IP | 120 req | 1 min |
| `media_streaming` | — | Unlimited | — |

**Headers on rate-limited responses:**
- `Retry-After`: Seconds until next request allowed
- `X-RateLimit-Limit`: Limit
- `X-RateLimit-Remaining`: Remaining
- `X-RateLimit-Reset`: Unix timestamp

---

## Tier Requirements

Endpoints are gated by module codename via `FortressFilter`. The tier mapping:

| Codename | Module | Required Tier |
|----------|--------|---------------|
| `marmalade` | Core Media | Standard |
| `sorbet` | Weather | Standard |
| `brioche` | Podcasts | Standard |
| `nectar` | Radio | Standard |
| `ganache` | Photos | Standard |
| `bisque` | Web Video | Standard |
| `marzipan` | Matrix | Ultra |
| `cinnamon` | Synapse Admin | Ultra |
| `waffle` | Game Bot | Ultra |
| `yeast` | Background Bot | Ultra |
| `fondue` | *arr Automation | Pro |
| `saffron` | Subtitles | Pro |
| `sourdough` | Backups | Pro |
| `taffy` | IPTV/DVR | Pro |
| `churro` | Download Clients | Pro |
| `roux` | Collections | Pro |
| `sprout` | RSS Feeds | Pro |
| `bastion` | Security 2FA | Ultra |
| `tunnel` | VPN | Ultra |
| `strudel` | Disc Ripping | Ultra |
| `crucible` | Media Processing | Ultra |
| `pepper` | Notifications | Ultra |
| `rind` | Parental Controls | Ultra |
| `crumbs` | Integration Hub | Ultra |
| `brine` | Usenet Indexer | Ultra |
| `ladle` | Usenet Downloader | Ultra |
| `custard` | Media Bridge | Ultra |
| `parfait` | Jellyseerr | Ultra |
| `menu` | Requests Manager | Ultra |
| `pretzel` | Gaming | Ultra |
| `biscotti` | Ebooks | Ultra |
| `treacle` | Music Library | Ultra |
| `sage` | AI Metadata | Ultra |
| `truffle` | Analytics | Pro |
| `meringue` | User Requests | Pro |
| `popsicle` | Offline Sync | Ultra |
| `preserves` | Cloud Backup | Ultra |
| `marshmallow` | Cloud Sync | Ultra |
| `chowder` | Media Sync | Ultra |
| `lobster` | Mesh Networking | Ultra |
| `zest` | Health | Standard |
| `pantry` | Filesystem | Standard |
| `nutmeg` | System Stats | Standard |
| `glaze` | Scrobbling | Standard |
| `ripen` | Gadget Registry | Standard |
| `fortress` | Integrity | Standard |
| `setup` | Setup Wizard | Standard |

**Tier hierarchy:** Standard ⊂ Pro ⊂ Ultra

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.4 | 2026-09-15 | Security hardening, API docs, Kubernetes manifests, release pipeline |
| 1.0.3 | 2026-08-16 | Lobster Mesh, configurable port, ErrorBoundary, module publishing |
| 1.0.2 | 2026-08-15 | Security audit fixes, modularity, WatchParty WebSocket |
| 1.0.1 | 2026-08-09 | First RTP release |

---

*Generated from source code. For the most current API, see the running instance at `/api/info`.*
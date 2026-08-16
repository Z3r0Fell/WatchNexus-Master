using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using WatchNexus.Core;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Services;

// ══════════════════════════════════════════════════════════════════════
//  Crash-safe boot logger
//  Writes to %PROGRAMDATA%\WatchNexus\logs (Win) or
//  $WATCHNEXUS_DATA_DIR/logs (Linux/Docker, env-overridable),
//  falling back to <app>/logs. Catches any startup crash and dumps
//  the full exception so the user has something to send to support.
// ══════════════════════════════════════════════════════════════════════
static string ResolveLogDir()
{
    var envDir = Environment.GetEnvironmentVariable("WATCHNEXUS_DATA_DIR");
    if (!string.IsNullOrWhiteSpace(envDir))
        return Path.Combine(envDir, "logs");

    if (OperatingSystem.IsWindows())
    {
        var pd = Environment.GetEnvironmentVariable("PROGRAMDATA")
                 ?? @"C:\ProgramData";
        return Path.Combine(pd, "WatchNexus", "logs");
    }

    return Path.Combine(AppContext.BaseDirectory, "logs");
}

var logDir = ResolveLogDir();
Directory.CreateDirectory(logDir);
var bootLogPath = Path.Combine(logDir, $"boot-{DateTime.UtcNow:yyyyMMdd-HHmmss}.log");
var bootLog = new StreamWriter(bootLogPath, append: false) { AutoFlush = true };

void Log(string msg)
{
    var line = $"[{DateTime.UtcNow:HH:mm:ss.fff}] {msg}";
    Console.WriteLine(line);
    try { bootLog.WriteLine(line); } catch { /* never fail because of logging */ }
}

AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    Log($"[FATAL] Unhandled exception: {e.ExceptionObject}");
    try { bootLog.Flush(); } catch { }
};

try
{

Log($"[WatchNexus] Boot log: {bootLogPath}");

// ══════════════════════════════════════════════════════════════════════
//  --tray  →  user-session controller process
//  ----------------------------------------------------------------
//  Windows Services run in Session 0 — there is no desktop and any
//  NotifyIcon created from inside the service is invisible. So at user
//  login we re-launch ourselves with `--tray`, which skips the entire
//  web host and only shows the systray icon. It talks to the running
//  service over http://localhost:<port>/api/* for Stop / Restart / etc.
// ══════════════════════════════════════════════════════════════════════
if (args.Contains("--tray") || args.Contains("--tray-only"))
{
    // The tray controller is a console-subsystem exe (same binary as the
    // web host / service). Hide the console window so users don't see a
    // stray terminal pop up at login — closing that window would also kill
    // the tray process.
    if (OperatingSystem.IsWindows())
        WindowsConsole.Hide();

    Log("[WatchNexus] --tray mode: starting user-session controller (no web host).");
    var trayPort = int.TryParse(Environment.GetEnvironmentVariable("WATCHNEXUS_PORT"), out var tp) ? tp : 8001;
    var exitCode = WatchNexus.Core.Services.TrayController.Run(trayPort, Log);
    try { bootLog.Flush(); bootLog.Dispose(); } catch { }
    Environment.Exit(exitCode);
}

var builder = WebApplication.CreateBuilder(args);

// ── Apply any staged binary updates BEFORE the host loads assemblies ──
// (hot patches to web/config files apply live and never reach this path;
//  only binary fixes are staged and swapped in here, at boot.)
try
{
    var stagedApplied = WatchNexus.Core.Services.PatchService.ApplyPendingUpdates(Log);
    if (stagedApplied > 0) Log($"[Updater] {stagedApplied} staged binary update(s) applied at boot.");
}
catch (Exception ex) { Log($"[Updater] Pending-update apply failed: {ex.Message}"); }

// ── Resolve project root (works from bin/Debug, published, or installed) ──
static string FindRepoRoot()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir != null)
    {
        if (Directory.Exists(Path.Combine(dir.FullName, "src", "watchnexus", "modules")))
            return dir.FullName;
        if (Directory.Exists(Path.Combine(dir.FullName, "modules")))
            return dir.FullName;
        dir = dir.Parent;
    }
    return AppContext.BaseDirectory;
}
var repoRoot = FindRepoRoot();
Log($"[WatchNexus] Repo root: {repoRoot}");

// ── Configuration ─────────────────────────────────────────────
var port = int.TryParse(Environment.GetEnvironmentVariable("WATCHNEXUS_PORT"), out var p) ? p : 8001;

// ── Database ──────────────────────────────────────────────────
// Production: write the SQLite DB into the data dir (writable),
// not next to the binaries (which live in Program Files and can't
// be written to without elevation).
var dataDir = Environment.GetEnvironmentVariable("WATCHNEXUS_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    if (OperatingSystem.IsWindows())
    {
        var pd = Environment.GetEnvironmentVariable("PROGRAMDATA") ?? @"C:\ProgramData";
        dataDir = Path.Combine(pd, "WatchNexus");
    }
    else
    {
        // Linux service user has /var/lib/watchnexus; standalone runs use ./data
        dataDir = Directory.Exists("/var/lib/watchnexus")
            ? "/var/lib/watchnexus"
            : Path.Combine(AppContext.BaseDirectory, "data");
    }
}
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "watchnexus.db");
Log($"[WatchNexus] Data dir: {dataDir}");
Log($"[WatchNexus] DB path : {dbPath}");

// ── Pre-flight: verify the data dir is actually writable ─────
// EF Core's Migrate() opens SQLite + writes a __EFMigrationsLock table.
// If that fails with "attempt to write a readonly database" the user
// has no actionable signal. So we test write access NOW and emit a
// clear log line + actionable instruction.
try
{
    var writeProbe = Path.Combine(dataDir, ".write-probe");
    File.WriteAllText(writeProbe, "ok");
    File.Delete(writeProbe);
    // Also clear any readonly attribute on a pre-existing db file (an old
    // install or a manual copy can leave the file flagged read-only, which
    // is the most common cause of SQLite Error 8 on Windows services).
    if (File.Exists(dbPath))
    {
        var attrs = File.GetAttributes(dbPath);
        if ((attrs & FileAttributes.ReadOnly) != 0)
        {
            File.SetAttributes(dbPath, attrs & ~FileAttributes.ReadOnly);
            Log($"[WatchNexus] Cleared ReadOnly attribute from existing DB file.");
        }
    }
}
catch (Exception probeEx)
{
    Log($"[WatchNexus] [FATAL] Data dir is not writable: {dataDir}");
    Log($"[WatchNexus]   {probeEx.GetType().Name}: {probeEx.Message}");
    Log($"[WatchNexus]   On Windows, the WatchNexusCore service runs as LocalSystem and should");
    Log($"[WatchNexus]   have write access to C:\\ProgramData\\WatchNexus. If you're seeing this,");
    Log($"[WatchNexus]   either the folder ACL is broken or the service is running as a less-");
    Log($"[WatchNexus]   privileged account. Run this from an elevated PowerShell to repair:");
    Log($"[WatchNexus]     icacls \"{dataDir}\" /grant \"NT AUTHORITY\\SYSTEM:(OI)(CI)F\" /T");
    throw;
}

// Build the connection string explicitly:
//   Mode=ReadWriteCreate  → create the file if it doesn't exist (default,
//                           but stated explicitly for clarity on Windows services).
//   Cache=Shared          → share the page cache across the EF Core pool.
//   Foreign Keys=True     → enforce FK constraints.
var connString = $"Data Source={dbPath};Mode=ReadWriteCreate;Cache=Shared;Foreign Keys=True";
Log($"[WatchNexus] DB conn : {connString}");

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(connString));

// ── Data Protection (encryption-at-rest key ring) ─────────────
// Persists AES keys to the data dir so encrypted credential columns
// (S-20/S-21) stay readable across restarts and are unique per install.
var dpKeysDir = Path.Combine(dataDir, "dp-keys");
Directory.CreateDirectory(dpKeysDir);
try { if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(dpKeysDir, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute); }
catch { /* best effort on permissions */ }
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dpKeysDir))
    .SetApplicationName("WatchNexus");

// ── Structured logging in production (S-10) ───────────────────
// JSON console logs with levels/scopes for production sinks. Dev keeps the
// human-readable default so the boot log stays easy to read.
if (!builder.Environment.IsDevelopment())
{
    builder.Logging.ClearProviders();
    builder.Logging.AddJsonConsole(o => o.IncludeScopes = true);
    // EF logs every SQL command (incl. parameters) at Information — too noisy
    // and a minor info-leak in prod logs. Surface only warnings+.
    builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
}

// ── JWT signing secret ────────────────────────────────────────
// A self-hosted server must NEVER ship a shared/hardcoded signing key (anyone
// could forge admin tokens). Resolve from config/env; if it's missing — or set
// to the legacy weak default — generate a strong 96-char secret and persist it
// to the data dir so it stays stable across restarts and unique per install.
var jwtSecret = ResolveJwtSecret(builder.Configuration, dataDir, Log);
builder.Configuration["Jwt:Secret"] = jwtSecret;

// ── Config sanity warnings (public-readiness) ─────────────────
// Committed appsettings.json ships with BLANK secrets. Real values come from
// env vars or a gitignored appsettings.Production.json. Warn loudly if a
// self-hoster booted without configuring them so features fail visibly, not silently.
if (string.IsNullOrWhiteSpace(builder.Configuration["TMDB_API_KEY"]))
    Log("[WatchNexus] WARNING: TMDB_API_KEY is not configured — content discovery/metadata will be unavailable until you add a key (Settings → Metadata, or the TMDB_API_KEY env var).");
if (string.IsNullOrWhiteSpace(builder.Configuration["LICENSE_SERVER_API_KEY"]))
    Log("[WatchNexus] WARNING: LICENSE_SERVER_API_KEY is not configured — paid-tier (Pro/Ultra) license activation will be unavailable. Standard tier works without it.");

// ── Auth ──────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "WatchNexus",
            ValidAudience = "WatchNexus",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
        // Per-request token-version check enables real logout / password-change
        // invalidation: if the token's "tv" claim no longer matches the stored
        // version for that user, the token is rejected even before expiry.
        opt.Events = new JwtBearerEvents
        {
            // S-02: prefer the httpOnly cookie when present. This makes the cookie
            // authoritative, so any stale "Authorization: Bearer null" header sent
            // by legacy client code is ignored once the cookie is set.
            OnMessageReceived = ctx =>
            {
                var cookie = ctx.Request.Cookies["wn_token"];
                if (!string.IsNullOrEmpty(cookie)) ctx.Token = cookie;
                return Task.CompletedTask;
            },
            OnTokenValidated = async ctx =>
            {
                var uid = ctx.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(uid)) { ctx.Fail("missing subject"); return; }
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var current = await TokenVersionStore.GetAsync(db, uid);
                var tvClaim = ctx.Principal?.FindFirst("tv")?.Value;
                if (!int.TryParse(tvClaim, out var tv) || tv != current)
                    ctx.Fail("token has been revoked");
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<AuthService>();

// ── Rate limiting ─────────────────────────────────────────────
// Per-IP fixed window on the authentication endpoints to blunt credential
// brute-forcing. Other endpoints are unaffected.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = 10,
                QueueLimit = 0,
            }));

    // ── S-16: blanket limiter on all state-changing requests ──
    // GET/HEAD/OPTIONS are exempt (reads + media streaming must not throttle).
    // Every POST/PUT/DELETE/PATCH is capped per-IP to blunt brute force / DoS
    // against the 50+ mutation endpoints that previously had no protection.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var method = httpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method))
            return RateLimitPartition.GetNoLimiter("safe");
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter("mut:" + ip, _ => new FixedWindowRateLimiterOptions
        {
            Window = TimeSpan.FromMinutes(1),
            PermitLimit = 120,
            QueueLimit = 0,
        });
    });
});

// ── Services ──────────────────────────────────────────────────
builder.Services.AddHttpClient();
builder.Services.AddControllers(options =>
{
    // ── FORTRESS PROTOCOL: API-level tier enforcement ──
    options.Filters.Add<FortressFilter>();
});
builder.Services.AddEndpointsApiExplorer();
// Swagger is a dev-time convenience only — never expose the API schema on a
// public production server.
if (builder.Environment.IsDevelopment())
    builder.Services.AddSwaggerGen();

// ── Background Services ──
builder.Services.AddHostedService<WatchNexus.Core.Services.BotBackgroundService>();
builder.Services.AddHostedService<WatchNexus.Core.Services.TrayIconService>();
builder.Services.AddScoped<WatchNexus.Core.Services.PatchService>();
builder.Services.AddHostedService<WatchNexus.Core.Services.UpdateBackgroundService>();

// CORS — restrict to configured origins when ALLOWED_ORIGINS is set
// (comma-separated). When unset we reflect the request origin but DO NOT allow
// credentials; the API is bearer-token based (no cookies), so this is safe and
// keeps LAN access frictionless. Set ALLOWED_ORIGINS to lock it down further.
var allowedOrigins = (builder.Configuration["ALLOWED_ORIGINS"]
        ?? Environment.GetEnvironmentVariable("ALLOWED_ORIGINS"))
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(opt => opt.AddDefaultPolicy(pol =>
{
    if (allowedOrigins is { Length: > 0 })
        pol.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader().AllowCredentials();
    else
        pol.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrEmpty(origin)) return false;
            return origin.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase)
                || origin.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase);
        }).AllowAnyMethod().AllowAnyHeader();
}));

// ── Load external modules ─────────────────────────────────────
// Production installs (Program Files / /opt/watchnexus) ship pre-built
// module DLLs alongside the binaries — no source compilation at runtime.
var modulesPath = Path.Combine(AppContext.BaseDirectory, "modules");
if (!Directory.Exists(modulesPath))
    modulesPath = Path.Combine(repoRoot, "src", "watchnexus", "modules"); // dev tree
if (Directory.Exists(modulesPath))
    ModuleLoader.DiscoverAndRegister(builder.Services, modulesPath);
else
    Log($"[WatchNexus] No external modules directory found ({modulesPath}) — built-in modules only");

// Note: the legacy "separated modules" runtime DLL-compile path was removed
// in v1.0.0 RTP. Production installs do not ship the .NET SDK and cannot
// invoke `dotnet build` at startup. All tiered modules are built-in.

// ── Build app ─────────────────────────────────────────────────
var app = builder.Build();

// ── Wire encryption-at-rest protector (S-20/S-21) ─────────────
// Must happen before any DbContext query materializes so the EF value
// converters can encrypt/decrypt credential columns.
SecretProtector.Initialize(
    app.Services.GetRequiredService<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>()
       .CreateProtector("WatchNexus.Secrets.v1"));

// ── Init Database (EF Core Migrations) ────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    Log($"[WatchNexus] Database migrated and ready at {dbPath}");

    // ── FORTRESS PROTOCOL: Integrity verification ──
    var (integrityValid, violations) = FortressIntegrity.VerifyIntegrity(db).GetAwaiter().GetResult();
    if (integrityValid)
        Log("[Fortress] Integrity check PASSED");
    else
    {
        Log($"[Fortress] WARNING: Integrity violations detected ({violations.Count}):");
        foreach (var v in violations) Log($"  - {v}");
    }

    // Seed default accounts if none exist
    SeedAccounts(db);
}

static string ResolveJwtSecret(IConfiguration config, string dataDir, Action<string> log)
{
    const string legacyWeak = "WatchNexus_DefaultSecret_ChangeInProduction_32chars!";
    var provided = config["Jwt:Secret"] ?? Environment.GetEnvironmentVariable("JWT_SECRET");
    if (!string.IsNullOrWhiteSpace(provided) && provided != legacyWeak && provided.Length >= 32)
        return provided;

    var keyFile = Path.Combine(dataDir, "jwt.key");
    try
    {
        if (File.Exists(keyFile))
        {
            var existing = File.ReadAllText(keyFile).Trim();
            if (existing.Length >= 32) return existing;
        }
        var generated = Convert.ToHexString(RandomNumberGenerator.GetBytes(48)); // 96 hex chars
        File.WriteAllText(keyFile, generated);
        try { if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(keyFile, UnixFileMode.UserRead | UnixFileMode.UserWrite); }
        catch { /* best effort on permissions */ }
        log($"[WatchNexus] Generated a new per-install JWT secret at {keyFile}");
        return generated;
    }
    catch (Exception ex)
    {
        // If we genuinely cannot persist a secret, fail fast rather than silently
        // falling back to a known/shared key.
        throw new InvalidOperationException(
            $"Unable to resolve or generate a JWT signing secret (data dir: {dataDir}). " +
            $"Set the JWT_SECRET environment variable to a strong random value. Inner: {ex.Message}", ex);
    }
}

void SeedAccounts(AppDbContext db){
    // ── OOBE (Out-Of-Box Experience) ──
    // We deliberately do NOT seed a default admin/admin account in v1.0.0
    // RTP. A self-hosted media server that ships with a known-weak admin
    // credential is a security footgun (Jellyfin had this CVE in 2018, Plex
    // doesn't ship one at all, Emby got rid of theirs years ago).
    //
    // Instead the frontend shows a first-launch wizard (`FirstLaunchGate`)
    // when `GET /api/auth/setup-status` reports `needs_setup: true` (i.e.
    // zero users in the DB). The wizard calls `POST /api/auth/setup` to
    // create the first admin, then continues into the license-tier step.
    //
    // If you need an admin seeded for headless / scripted deploys
    // (e.g. CI), set `WATCHNEXUS_SEED_ADMIN_EMAIL` and
    // `WATCHNEXUS_SEED_ADMIN_PASSWORD` env vars on first boot.
    if (db.Users.Any()) return;

    var seedEmail = Environment.GetEnvironmentVariable("WATCHNEXUS_SEED_ADMIN_EMAIL");
    var seedPass  = Environment.GetEnvironmentVariable("WATCHNEXUS_SEED_ADMIN_PASSWORD");
    if (!string.IsNullOrWhiteSpace(seedEmail) && !string.IsNullOrWhiteSpace(seedPass))
    {
        var admin = new WatchNexus.Shared.AppUser
        {
            Email = seedEmail.Trim(),
            Username = seedEmail.Split('@')[0],
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(seedPass),
            Role = "admin"
        };
        db.Users.Add(admin);
        db.SaveChanges();
        Log($"[WatchNexus] Seeded admin from env: {admin.Email}");
    }
    else
    {
        Log("[WatchNexus] No users present — first-launch wizard will create the admin account.");
    }
}

// ── Logging directory (already created at top of file) ────────
// logDir + bootLog already set up at top of Program.cs

// ── Middleware ─────────────────────────────────────────────────
// ── Reverse-proxy / TLS awareness (S-19) ──────────────────────
// Production is fronted by a TLS-terminating reverse proxy (Caddy/nginx/
// Traefik). Honour X-Forwarded-Proto/For so the app knows the original
// scheme + client IP. Proxies aren't on a known subnet in self-hosted
// setups, so we accept forwarded headers from any hop.
var fwd = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
fwd.KnownIPNetworks.Clear();
fwd.KnownProxies.Clear();
app.UseForwardedHeaders(fwd);

// When FORCE_HTTPS is set, advertise HSTS so browsers pin TLS. We do NOT
// add UseHttpsRedirection — Kestrel listens HTTP only and the proxy does
// TLS, so a redirect here would loop. HSTS upgrades future requests.
var forceHttps = (Environment.GetEnvironmentVariable("FORCE_HTTPS") ?? "")
    .Trim().ToLowerInvariant() is "1" or "true" or "yes";

app.UseCors();

// Security headers (OWASP)
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    // CSP — blocks injected/external scripts (the primary token-theft vector for
    // an SPA that holds its JWT in localStorage). 'unsafe-inline' is required by
    // the CRA build (no nonce); external script origins are still denied.
    ctx.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; " +
        "font-src 'self' data:; " +
        "media-src 'self' blob: https:; " +
        "connect-src 'self' https: wss:; " +
        "frame-ancestors 'none'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'";
    if (forceHttps)
        ctx.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});

// ── Serve Frontend (SPA) — MUST be before auth so static files load without tokens
// The first candidate whose directory actually CONTAINS index.html wins. This
// makes both layouts work: {base}/web/build (Docker) and {base}/web (native
// install), instead of naively picking {base}/web because the folder exists
// even when the build lives one level deeper.
var frontendSearchPaths = new[]
{
    Path.Combine(AppContext.BaseDirectory, "web", "build"),   // Docker layout
    Path.Combine(AppContext.BaseDirectory, "web"),            // production install layout
    Path.Combine(AppContext.BaseDirectory, "..", "web"),      // alt production layout
    Path.Combine(AppContext.BaseDirectory, "wwwroot"),
    Path.Combine(repoRoot, "src", "web", "build"),            // dev tree
    Path.Combine(repoRoot, "..", "web", "build"),             // dev tree (repoRoot = src/watchnexus)
    Path.Combine(repoRoot, "web", "build"),
};
var webRoot = frontendSearchPaths.FirstOrDefault(p => Directory.Exists(p) && File.Exists(Path.Combine(p, "index.html")));
if (webRoot != null)
{
    var fullPath = Path.GetFullPath(webRoot);
    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = new PhysicalFileProvider(fullPath)
    });
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(fullPath),
        RequestPath = ""
    });
    Log($"[WatchNexus] Serving frontend from {fullPath}");
    WatchNexus.Core.Services.PatchService.WebRoot = fullPath;
}
else
{
    Log($"[WatchNexus] No frontend build found - API only mode");
    Log($"[WatchNexus] Build frontend with: cd src/web && yarn build");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseCsrfProtection();
app.UseWebSockets();
app.MapControllers();

// ── Map external module routes ────────────────────────────────
ModuleLoader.MapAllRoutes(app);

// ── WatchParty WebSocket ──────────────────────────────────────
app.MapGet("/api/watch-party/{partyCode}/ws", async (HttpContext context, string partyCode) =>
{
    var manager = context.RequestServices.GetRequiredService<WatchNexus.Core.Services.WatchPartyConnectionManager>();
    await manager.HandleConnection(context, partyCode);
}).RequireAuthorization();

// ── SPA fallback — catch-all for client-side routes (NOT /api/*) ─
if (webRoot != null)
{
    var fullPath = Path.GetFullPath(webRoot);
    app.MapFallback(async context =>
    {
        // Never intercept API routes — let them 404 properly
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = 404;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"detail\":\"Not Found\"}");
            return;
        }
        context.Response.ContentType = "text/html";
        await context.Response.SendFileAsync(Path.Combine(fullPath, "index.html"));
    });
}

// ── Fortress: Runtime integrity checks ────────────────────────
Fortress.Logger = Log;
Fortress.Initialize(app);
ModuleLoader.Logger = Log;

// ── Start ─────────────────────────────────────────────────────
var discovered = ModuleLoader.DiscoveredManifests.Count;
var external = ModuleLoader.LoadedModules.Count;
Log($"[WatchNexus] v1.0.3 starting on port {port}");
Log($"[WatchNexus] Modules: {discovered} registered ({external} external DLL, {discovered - external} built-in)");
Log($"[WatchNexus] Logs at: {logDir}");
Log($"[WatchNexus] Open http://localhost:{port} in your browser to begin.");
app.Run($"http://0.0.0.0:{port}");

}
catch (Exception ex)
{
    Log("");
    Log("══════════════════════════════════════════════════════════════════════");
    Log("[WatchNexus] FATAL — startup failed.");
    Log($"  Type:        {ex.GetType().FullName}");
    Log($"  Message:     {ex.Message}");
    Log($"  Stack trace:");
    foreach (var line in (ex.StackTrace ?? "").Split('\n'))
        Log($"    {line.TrimEnd()}");
    if (ex.InnerException != null)
    {
        Log("  Inner exception:");
        Log($"    {ex.InnerException.GetType().FullName}: {ex.InnerException.Message}");
    }
    Log("══════════════════════════════════════════════════════════════════════");
    Log($"  Full log saved to: {bootLogPath}");
    Log("  Please attach this file when reporting the issue at:");
    Log("    https://github.com/z3r0fell/watchnexus/issues");
    Log("══════════════════════════════════════════════════════════════════════");

    // On Windows, double-clicked .exe closes immediately on exit — give
    // the user a chance to read the message before the window vanishes.
    if (OperatingSystem.IsWindows() && Environment.UserInteractive)
    {
        Console.WriteLine();
        Console.WriteLine("Press any key to close...");
        try { Console.ReadKey(intercept: true); } catch { /* no console attached */ }
    }

    Environment.ExitCode = 1;
}
finally
{
    try { bootLog?.Flush(); bootLog?.Dispose(); } catch { }
}

// Windows console-window helper. `WatchNexus.Core.exe` is a console-subsystem
// binary (it also hosts the web server + Windows service), so when launched in
// `--tray` mode from the logon Run key it would otherwise flash a terminal
// window on the desktop. We hide it before the tray message pump starts.
internal static class WindowsConsole
{
    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static void Hide()
    {
        if (!OperatingSystem.IsWindows()) return;
        try
        {
            var hwnd = GetConsoleWindow();
            if (hwnd != IntPtr.Zero) ShowWindow(hwnd, 0 /* SW_HIDE */);
        }
        catch { /* best-effort — a visible console is cosmetic, not fatal */ }
    }
}

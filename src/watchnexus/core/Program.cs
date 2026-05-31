using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using WatchNexus.Core;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Core.Controllers;

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
    Log("[WatchNexus] --tray mode: starting user-session controller (no web host).");
    var trayPort = int.TryParse(Environment.GetEnvironmentVariable("WATCHNEXUS_PORT"), out var tp) ? tp : 8001;
    var exitCode = WatchNexus.Core.Services.TrayController.Run(trayPort, Log);
    try { bootLog.Flush(); bootLog.Dispose(); } catch { }
    Environment.Exit(exitCode);
}

var builder = WebApplication.CreateBuilder(args);

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
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? "WatchNexus_DefaultSecret_ChangeInProduction_32chars!";
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
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<AuthService>();

// ── Services ──────────────────────────────────────────────────
builder.Services.AddHttpClient();
builder.Services.AddControllers(options =>
{
    // ── FORTRESS PROTOCOL: API-level tier enforcement ──
    options.Filters.Add<FortressFilter>();
})
.AddJsonOptions(opt =>
{
    opt.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── Background Services ──
builder.Services.AddHostedService<WatchNexus.Core.Services.BotBackgroundService>();
builder.Services.AddHostedService<WatchNexus.Core.Services.TrayIconService>();

// CORS
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

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

// ── Init Database (EF Core Migrations) ────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    Console.WriteLine($"[WatchNexus] Database migrated and ready at {dbPath}");

    // ── FORTRESS PROTOCOL: Integrity verification ──
    var (integrityValid, violations) = FortressIntegrity.VerifyIntegrity(db).GetAwaiter().GetResult();
    if (integrityValid)
        Console.WriteLine("[Fortress] Integrity check PASSED");
    else
    {
        Console.WriteLine($"[Fortress] WARNING: Integrity violations detected ({violations.Count}):");
        foreach (var v in violations) Console.WriteLine($"  - {v}");
    }

    // Seed default accounts if none exist
    SeedAccounts(db);
}

static void SeedAccounts(AppDbContext db)
{
    // Create default admin if no users exist
    if (!db.Users.Any())
    {
        var admin = new WatchNexus.Shared.AppUser
        {
            Email = "admin@watchnexus.local",
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin"),
            Role = "admin"
        };
        db.Users.Add(admin);
        db.SaveChanges();
        Console.WriteLine($"[WatchNexus] Seeded default admin account: admin@watchnexus.local");
    }
}

// ── Logging directory (already created at top of file) ────────
// logDir + bootLog already set up at top of Program.cs

// ── Middleware ─────────────────────────────────────────────────
app.UseCors();

// Security headers (OWASP)
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

// ── Serve Frontend (SPA) — MUST be before auth so static files load without tokens
var frontendSearchPaths = new[]
{
    Path.Combine(AppContext.BaseDirectory, "web"),         // production install layout
    Path.Combine(AppContext.BaseDirectory, "..", "web"),   // alt production layout
    Path.Combine(AppContext.BaseDirectory, "wwwroot"),
    Path.Combine(repoRoot, "src", "web", "build"),         // dev tree
    Path.Combine(repoRoot, "web", "build"),
};
var webRoot = frontendSearchPaths.FirstOrDefault(p => Directory.Exists(p));
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
    Console.WriteLine($"[WatchNexus] Serving frontend from {fullPath}");
}
else
{
    Console.WriteLine($"[WatchNexus] No frontend build found - API only mode");
    Console.WriteLine($"[WatchNexus] Build frontend with: cd src/web && yarn build");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Map external module routes ────────────────────────────────
ModuleLoader.MapAllRoutes(app);

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
Fortress.Initialize(app);

// ── Start ─────────────────────────────────────────────────────
var discovered = ModuleLoader.DiscoveredManifests.Count;
var external = ModuleLoader.LoadedModules.Count;
Log($"[WatchNexus] v1.0.0 starting on port {port}");
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

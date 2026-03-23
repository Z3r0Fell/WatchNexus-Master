using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using WatchNexus.Core;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;

var builder = WebApplication.CreateBuilder(args);

// ── Resolve project root (works from bin/Debug, published, or installed) ──
static string FindRepoRoot()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir != null)
    {
        // Check if this directory contains src/watchnexus/modules
        if (Directory.Exists(Path.Combine(dir.FullName, "src", "watchnexus", "modules")))
            return dir.FullName;
        // Check if this directory contains separated/ (repo root marker)
        if (Directory.Exists(Path.Combine(dir.FullName, "separated")))
            return dir.FullName;
        dir = dir.Parent;
    }
    return AppContext.BaseDirectory;
}
var repoRoot = FindRepoRoot();
Console.WriteLine($"[WatchNexus] Repo root: {repoRoot}");

// ── Configuration ─────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? "WatchNexus_DefaultSecret_ChangeInProduction_32chars!";
var port = int.TryParse(Environment.GetEnvironmentVariable("WATCHNEXUS_PORT"), out var p) ? p : 8002;

// ── Database ──────────────────────────────────────────────────
var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "watchnexus.db");

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite($"Data Source={dbPath}"));

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
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── Background Services ──
builder.Services.AddHostedService<WatchNexus.Core.Services.BotBackgroundService>();
builder.Services.AddHostedService<WatchNexus.Core.Services.TrayIconService>();

// CORS
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// ── Load external modules ─────────────────────────────────────
var modulesPath = Path.Combine(repoRoot, "src", "watchnexus", "modules");
if (!Directory.Exists(modulesPath))
    modulesPath = Path.Combine(repoRoot, "modules"); // published layout
ModuleLoader.DiscoverAndRegister(builder.Services, modulesPath);

// ── Load separated modules (dynamic DLL compilation & loading) ─
var separatedPath = Path.Combine(repoRoot, "separated");
if (!Directory.Exists(separatedPath))
    separatedPath = Path.Combine(repoRoot, "src", "separated"); // alt layout
ModuleLoader.CompileAndLoadSeparated(builder.Services, separatedPath);

// ── Build app ─────────────────────────────────────────────────
var app = builder.Build();

// ── Init Database (EF Core Migrations) ────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    Console.WriteLine($"[WatchNexus] Database migrated and ready at {dbPath}");

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

// ── Logging directory ─────────────────────────────────────────
var logDir = Path.Combine(AppContext.BaseDirectory, "logs");
Directory.CreateDirectory(logDir);

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
    Path.Combine(repoRoot, "src", "web", "build"),
    Path.Combine(repoRoot, "web", "build"),
    Path.Combine(AppContext.BaseDirectory, "web", "build"),
    Path.Combine(AppContext.BaseDirectory, "wwwroot"),
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
var separated = ModuleLoader.SeparatedModules.Count;
Console.WriteLine($"[WatchNexus] v2.8.3 starting on port {port}");
Console.WriteLine($"[WatchNexus] Modules: {discovered} registered ({external} external DLL, {separated} separated, {discovered - external - separated} built-in)");
app.Run($"http://0.0.0.0:{port}");

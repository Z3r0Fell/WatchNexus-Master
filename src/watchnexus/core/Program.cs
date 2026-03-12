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
var port = int.TryParse(Environment.GetEnvironmentVariable("WATCHNEXUS_PORT"), out var p) ? p : 8001;

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

// CORS
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// ── Load external modules ─────────────────────────────────────
var modulesPath = Path.Combine(repoRoot, "src", "watchnexus", "modules");
if (!Directory.Exists(modulesPath))
    modulesPath = Path.Combine(repoRoot, "modules"); // published layout
ModuleLoader.DiscoverAndRegister(builder.Services, modulesPath);

// ── Build app ─────────────────────────────────────────────────
var app = builder.Build();

// ── Init Database ─────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    Console.WriteLine($"[WatchNexus] Database initialized at {dbPath}");
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

// ── Serve Frontend (SPA fallback) ─────────────────────────────
var frontendSearchPaths = new[]
{
    Path.Combine(repoRoot, "src", "web", "build"),              // repo: src/web/build
    Path.Combine(repoRoot, "web", "build"),                    // repo root: web/build
    Path.Combine(repoRoot, "web", "build"),                 // published: web/build
    Path.Combine(AppContext.BaseDirectory, "web", "build"),  // alongside binary
    Path.Combine(AppContext.BaseDirectory, "wwwroot"),        // standard ASP.NET
};
var webRoot = frontendSearchPaths.FirstOrDefault(p => Directory.Exists(p));
if (webRoot != null)
{
    var fullPath = Path.GetFullPath(webRoot);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(fullPath),
        RequestPath = ""
    });
    app.MapFallbackToFile("index.html", new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(fullPath)
    });
    Console.WriteLine($"[WatchNexus] Serving frontend from {fullPath}");
}
else
{
    Console.WriteLine($"[WatchNexus] No frontend build found - API only mode");
    Console.WriteLine($"[WatchNexus] Build frontend with: cd src/web && yarn build");
}

// ── Start ─────────────────────────────────────────────────────
var discovered = ModuleLoader.DiscoveredManifests.Count;
var external = ModuleLoader.LoadedModules.Count;
Console.WriteLine($"[WatchNexus] v2.6.5 starting on port {port}");
Console.WriteLine($"[WatchNexus] Modules: {discovered} registered ({external} external DLL, {discovered - external} built-in)");
app.Run($"http://0.0.0.0:{port}");

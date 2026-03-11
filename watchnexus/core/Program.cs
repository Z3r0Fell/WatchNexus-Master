using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using WatchNexus.Core;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;

var builder = WebApplication.CreateBuilder(args);

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
var modulesPath = Path.Combine(AppContext.BaseDirectory, "..", "modules");
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
var webRoot = Path.Combine(AppContext.BaseDirectory, "..", "web", "build");
if (Directory.Exists(webRoot))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(webRoot),
        RequestPath = ""
    });
    app.MapFallbackToFile("index.html", new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(webRoot)
    });
    Console.WriteLine($"[WatchNexus] Serving frontend from {webRoot}");
}
else
{
    Console.WriteLine($"[WatchNexus] No frontend build found at {webRoot} - API only mode");
}

// ── Start ─────────────────────────────────────────────────────
Console.WriteLine($"[WatchNexus] v3.0.0-beta starting on port {port}");
Console.WriteLine($"[WatchNexus] Modules loaded: {ModuleLoader.LoadedModules.Count} external + 5 built-in");
app.Run($"http://0.0.0.0:{port}");

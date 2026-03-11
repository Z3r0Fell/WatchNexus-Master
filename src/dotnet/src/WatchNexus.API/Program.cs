using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using WatchNexus.API.Middleware;
using WatchNexus.Domain.Interfaces;
using WatchNexus.Infrastructure.Data;
using WatchNexus.Infrastructure.Repositories;
using WatchNexus.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// Force port 8001 for Emergent platform compatibility
builder.WebHost.UseUrls("http://0.0.0.0:8001");

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/watchnexus-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Configuration
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "WatchNexus-Default-Secret-Key-Change-In-Production-32chars";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "WatchNexus";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "WatchNexus";

// Database
var dbProvider = builder.Configuration["Database:Provider"] ?? "Sqlite";
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Data Source=watchnexus.db";

builder.Services.AddDbContext<WatchNexusDbContext>(options =>
{
    switch (dbProvider.ToLower())
    {
        case "postgresql":
        case "postgres":
            options.UseNpgsql(connectionString);
            break;
        case "sqlserver":
        case "mssql":
            options.UseSqlServer(connectionString);
            break;
        default:
            options.UseSqlite(connectionString);
            break;
    }
});

// Repositories
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

// Services
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IFileBrowserService, FileBrowserService>();
builder.Services.AddScoped<ILibraryScannerService, LibraryScannerService>();
builder.Services.AddScoped<IMetadataService, TmdbMetadataService>();
builder.Services.AddScoped<IDownloadService, QBittorrentService>();
builder.Services.AddScoped<ITranscodingService, TranscodingService>();

// HttpClient
builder.Services.AddHttpClient();

// Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower;
    });

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "WatchNexus API", 
        Version = "v3.0.0",
        Description = "Unified media pipeline API — .NET 8 / C# Edition"
    });
    
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Ensure database exists
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WatchNexusDbContext>();
    await db.Database.EnsureCreatedAsync();
    Log.Information("Database initialized: {Provider}", dbProvider);
}

// Security middleware pipeline (order matters)
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<RateLimitingMiddleware>();
app.UseMiddleware<IpFilteringMiddleware>();

// Logging
app.UseSerilogRequestLogging();

// Swagger (always on for now)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "WatchNexus API v3.0.0");
    c.RoutePrefix = "api/docs";
});

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Audit logging (after auth so we have user context)
app.UseMiddleware<AuditLoggingMiddleware>();

app.MapControllers();

// Health check at root
app.MapGet("/", () => Results.Ok(new 
{ 
    name = "WatchNexus", 
    version = "3.0.0", 
    framework = ".NET 8",
    status = "running"
}));

Log.Information("WatchNexus API v3.0.0 (.NET 8) starting on port 8001");

app.Run();

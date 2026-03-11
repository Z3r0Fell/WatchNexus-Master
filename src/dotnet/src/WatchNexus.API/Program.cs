using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using WatchNexus.Domain.Interfaces;
using WatchNexus.Infrastructure.Data;
using WatchNexus.Infrastructure.Repositories;
using WatchNexus.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddControllers();

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
        Version = "v2.7.0",
        Description = "Unified media pipeline API"
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

// Migrate database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WatchNexusDbContext>();
    await db.Database.MigrateAsync();
}

// Middleware
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Serve static files (React frontend)
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// Fallback to React app for SPA routing
app.MapFallbackToFile("index.html");

Log.Information("WatchNexus API starting on {Urls}", string.Join(", ", app.Urls));

app.Run();

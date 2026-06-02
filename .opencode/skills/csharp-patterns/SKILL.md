---
name: csharp-patterns
description: Use when writing or modifying C#/.NET 10 backend code. Covers controller conventions, EF Core patterns, service layer design, DI registration, and tier gating.
---

# C# Patterns for WatchNexus

## Controller Pattern
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MediaController : ControllerBase
{
    private readonly IMediaService _mediaService;
    private readonly ILogger<MediaController> _logger;

    public MediaController(IMediaService mediaService, ILogger<MediaController> logger)
    {
        _mediaService = mediaService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<MediaDto>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int size = 20,
        [FromQuery] string? search = null)
    {
        var result = await _mediaService.GetAllAsync(page, size, search);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MediaDto>> GetById(int id)
    {
        var result = await _mediaService.GetByIdAsync(id);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<MediaDto>> Create([FromBody] CreateMediaDto dto)
    {
        var result = await _mediaService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }
}
```

## Service Layer Pattern
```csharp
public interface IMediaService
{
    Task<PagedResult<MediaDto>> GetAllAsync(int page, int size, string? search);
    Task<MediaDto?> GetByIdAsync(int id);
    Task<MediaDto> CreateAsync(CreateMediaDto dto);
    Task<MediaDto> UpdateAsync(int id, UpdateMediaDto dto);
    Task DeleteAsync(int id);
}

public class MediaService : IMediaService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;

    public MediaService(AppDbContext db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    public async Task<PagedResult<MediaDto>> GetAllAsync(int page, int size, string? search)
    {
        var query = _db.Media.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(m => m.Title.Contains(search));

        var total = await query.CountAsync();
        var items = await query
            .Include(m => m.Genre)
            .Skip((page - 1) * size)
            .Take(size)
            .ProjectTo<MediaDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        return new PagedResult<MediaDto> { Items = items, Total = total, Page = page, Size = size };
    }
    // ...
}
```

## EF Core Query Patterns
```csharp
// Read-only: AsNoTracking + projection
var dtos = await _db.Media
    .AsNoTracking()
    .Where(m => m.IsActive)
    .Select(m => new MediaDto { Id = m.Id, Title = m.Title })
    .ToListAsync();

// With includes (eager loading, never lazy)
var movie = await _db.Movies
    .Include(m => m.Genre)
    .Include(m => m.Cast).ThenInclude(c => c.Actor)
    .FirstOrDefaultAsync(m => m.Id == id);

// Pagination
var page = await _db.Media
    .Skip((pageNum - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();

// Update
var entity = await _db.Media.FindAsync(id);
if (entity != null)
{
    _mapper.Map(dto, entity);
    await _db.SaveChangesAsync();
}
```

## DI Registration (Program.cs pattern)
```csharp
builder.Services.AddScoped<IMediaService, MediaService>();
builder.Services.AddScoped<IMediaRepository, MediaRepository>();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));
```

## Tier Gating (check existing implementation)
```csharp
// Hypothetical pattern — verify against actual Fortress/Tier implementation
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireTierAttribute : Attribute
{
    public Tier RequiredTier { get; }
    public RequireTierAttribute(Tier tier) => RequiredTier = tier;
}

public enum Tier { Standard, Pro, Ultra }
```

## Module Registration
```csharp
public class BastionModule : IWatchNexusModule
{
    public string Name => "Bastion";
    public string Version => "1.0.0";
    public Tier MinimumTier => Tier.Pro;

    public void Register(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<IBastionService, BastionService>();
    }

    public void MapEndpoints(IEndpointRouteBuilder app)
    {
        // Register module-specific endpoints
    }
}
```

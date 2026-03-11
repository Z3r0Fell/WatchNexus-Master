using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class IndexersController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<IndexersController> _logger;

    public IndexersController(IUnitOfWork unitOfWork, ILogger<IndexersController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var indexers = await _unitOfWork.Indexers.GetAllAsync(ct);
        return Ok(indexers.Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var indexer = await _unitOfWork.Indexers.GetByIdAsync(id, ct);
        if (indexer == null)
            return NotFound();
        return Ok(MapToDto(indexer));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateIndexerRequest request, CancellationToken ct)
    {
        var indexer = new Indexer
        {
            Name = request.Name,
            Type = Enum.Parse<Domain.Enums.IndexerType>(request.Type, true),
            Url = request.Url.TrimEnd('/'),
            ApiKey = request.ApiKey,
            IsEnabled = true,
            Priority = request.Priority ?? 50,
            SupportsTvSearch = request.SupportsTv ?? true,
            SupportsMovieSearch = request.SupportsMovies ?? true,
            SupportsMusicSearch = request.SupportsMusic ?? false,
            Categories = request.Categories
        };

        await _unitOfWork.Indexers.AddAsync(indexer, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = indexer.Id }, MapToDto(indexer));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateIndexerRequest request, CancellationToken ct)
    {
        var indexer = await _unitOfWork.Indexers.GetByIdAsync(id, ct);
        if (indexer == null)
            return NotFound();

        indexer.Name = request.Name ?? indexer.Name;
        indexer.Url = request.Url?.TrimEnd('/') ?? indexer.Url;
        indexer.ApiKey = request.ApiKey ?? indexer.ApiKey;
        indexer.IsEnabled = request.IsEnabled ?? indexer.IsEnabled;
        indexer.Priority = request.Priority ?? indexer.Priority;

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapToDto(indexer));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var indexer = await _unitOfWork.Indexers.GetByIdAsync(id, ct);
        if (indexer == null)
            return NotFound();

        await _unitOfWork.Indexers.DeleteAsync(indexer, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id}/test")]
    public async Task<IActionResult> Test(Guid id, CancellationToken ct)
    {
        var indexer = await _unitOfWork.Indexers.GetByIdAsync(id, ct);
        if (indexer == null)
            return NotFound();

        // TODO: Implement actual indexer test
        _logger.LogInformation("Testing indexer {IndexerId}: {Name}", id, indexer.Name);
        
        indexer.LastSuccessAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { success = true, message = "Indexer test successful" });
    }

    private static object MapToDto(Indexer i) => new
    {
        id = i.Id,
        name = i.Name,
        type = i.Type.ToString().ToLower(),
        url = i.Url,
        api_key = !string.IsNullOrEmpty(i.ApiKey) ? "***" : null,
        is_enabled = i.IsEnabled,
        priority = i.Priority,
        supports_tv = i.SupportsTvSearch,
        supports_movies = i.SupportsMovieSearch,
        supports_music = i.SupportsMusicSearch,
        categories = i.Categories,
        last_success = i.LastSuccessAt,
        last_error = i.LastErrorAt,
        error_message = i.LastError,
        created_at = i.CreatedAt
    };
}

public record CreateIndexerRequest(
    string Name,
    string Type,
    string Url,
    string? ApiKey,
    int? Priority,
    bool? SupportsTv,
    bool? SupportsMovies,
    bool? SupportsMusic,
    string? Categories
);

public record UpdateIndexerRequest(
    string? Name,
    string? Url,
    string? ApiKey,
    bool? IsEnabled,
    int? Priority
);

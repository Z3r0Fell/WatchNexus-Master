using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

/// <summary>
/// Application settings management
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;

    public SettingsController(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? throw new UnauthorizedAccessException());

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var userId = GetUserId();
        var settings = await _unitOfWork.AppSettings.FindAsync(s => s.UserId == userId || s.UserId == null, ct);
        return Ok(settings.ToDictionary(s => s.Key, s => s.Value));
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key, CancellationToken ct)
    {
        var userId = GetUserId();
        var setting = await _unitOfWork.AppSettings.FirstOrDefaultAsync(
            s => s.Key == key && (s.UserId == userId || s.UserId == null), ct);

        return setting == null
            ? NotFound(new { message = $"Setting '{key}' not found" })
            : Ok(new { key = setting.Key, value = setting.Value });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] SetSettingRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var isGlobal = request.Global ?? false;
        var ownerUserId = isGlobal ? (Guid?)null : userId;

        var existing = await _unitOfWork.AppSettings.FirstOrDefaultAsync(
            s => s.Key == key && s.UserId == ownerUserId, ct);

        if (existing != null)
        {
            existing.Value = request.Value;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            await _unitOfWork.AppSettings.AddAsync(new AppSetting
            {
                Key = key,
                Value = request.Value,
                UserId = ownerUserId
            }, ct);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { key, value = request.Value });
    }

    [HttpDelete("{key}")]
    public async Task<IActionResult> Delete(string key, CancellationToken ct)
    {
        var userId = GetUserId();
        var setting = await _unitOfWork.AppSettings.FirstOrDefaultAsync(
            s => s.Key == key && (s.UserId == userId || s.UserId == null), ct);

        if (setting == null) return NotFound();

        await _unitOfWork.AppSettings.DeleteAsync(setting, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return NoContent();
    }

    // Bulk set for config pages
    [HttpPost("bulk")]
    public async Task<IActionResult> BulkSet([FromBody] Dictionary<string, string> settings, CancellationToken ct)
    {
        var userId = GetUserId();

        foreach (var (key, value) in settings)
        {
            var existing = await _unitOfWork.AppSettings.FirstOrDefaultAsync(
                s => s.Key == key && s.UserId == userId, ct);

            if (existing != null)
            {
                existing.Value = value;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                await _unitOfWork.AppSettings.AddAsync(new AppSetting
                {
                    Key = key,
                    Value = value,
                    UserId = userId
                }, ct);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { updated = settings.Count });
    }
}

public record SetSettingRequest(string Value, bool? Global);

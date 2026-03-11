using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/gadgets/radio")]
[Authorize]
public class RadioController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;

    public RadioController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value!);

    [HttpGet]
    public async Task<IActionResult> GetStations([FromQuery] string? country, [FromQuery] string? genre, [FromQuery] string? search, CancellationToken ct)
    {
        var stations = await _unitOfWork.RadioStations.GetAllAsync(ct);

        if (!string.IsNullOrEmpty(country))
            stations = stations.Where(s => s.Country?.Equals(country, StringComparison.OrdinalIgnoreCase) == true);

        if (!string.IsNullOrEmpty(genre))
            stations = stations.Where(s => s.Genre?.Contains(genre, StringComparison.OrdinalIgnoreCase) == true);

        if (!string.IsNullOrEmpty(search))
            stations = stations.Where(s => s.Name.Contains(search, StringComparison.OrdinalIgnoreCase));

        return Ok(stations.OrderBy(s => s.Name).Take(100).Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetStation(Guid id, CancellationToken ct)
    {
        var station = await _unitOfWork.RadioStations.GetByIdAsync(id, ct);
        if (station == null) return NotFound();
        return Ok(MapToDto(station));
    }

    [HttpPost]
    public async Task<IActionResult> AddStation([FromBody] CreateRadioStationRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var station = new RadioStation
        {
            Name = request.Name,
            StreamUrl = request.StreamUrl,
            LogoUrl = request.LogoUrl,
            Country = request.Country,
            Language = request.Language,
            Genre = request.Genre,
            Codec = request.Codec,
            Bitrate = request.Bitrate,
            UserId = userId
        };

        await _unitOfWork.RadioStations.AddAsync(station, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(MapToDto(station));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteStation(Guid id, CancellationToken ct)
    {
        var station = await _unitOfWork.RadioStations.GetByIdAsync(id, ct);
        if (station == null) return NotFound();

        await _unitOfWork.RadioStations.DeleteAsync(station, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id}/favorite")]
    public async Task<IActionResult> ToggleFavorite(Guid id, CancellationToken ct)
    {
        var station = await _unitOfWork.RadioStations.GetByIdAsync(id, ct);
        if (station == null) return NotFound();

        station.IsFavorite = !station.IsFavorite;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { is_favorite = station.IsFavorite });
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> GetFavorites(CancellationToken ct)
    {
        var stations = await _unitOfWork.RadioStations.FindAsync(s => s.IsFavorite, ct);
        return Ok(stations.Select(MapToDto));
    }

    [HttpGet("countries")]
    public async Task<IActionResult> GetCountries(CancellationToken ct)
    {
        var stations = await _unitOfWork.RadioStations.GetAllAsync(ct);
        var countries = stations
            .Where(s => !string.IsNullOrEmpty(s.Country))
            .GroupBy(s => s.Country)
            .Select(g => new { country = g.Key, count = g.Count() })
            .OrderByDescending(c => c.count);

        return Ok(countries);
    }

    [HttpGet("genres")]
    public async Task<IActionResult> GetGenres(CancellationToken ct)
    {
        var stations = await _unitOfWork.RadioStations.GetAllAsync(ct);
        var genres = stations
            .Where(s => !string.IsNullOrEmpty(s.Genre))
            .SelectMany(s => s.Genre!.Split(',', StringSplitOptions.TrimEntries))
            .GroupBy(g => g)
            .Select(g => new { genre = g.Key, count = g.Count() })
            .OrderByDescending(g => g.count)
            .Take(50);

        return Ok(genres);
    }

    private static object MapToDto(RadioStation s) => new
    {
        id = s.Id,
        name = s.Name,
        stream_url = s.StreamUrl,
        logo_url = s.LogoUrl,
        country = s.Country,
        language = s.Language,
        genre = s.Genre,
        codec = s.Codec,
        bitrate = s.Bitrate,
        is_favorite = s.IsFavorite
    };
}

public record CreateRadioStationRequest(string Name, string StreamUrl, string? LogoUrl, string? Country, string? Language, string? Genre, string? Codec, int? Bitrate);

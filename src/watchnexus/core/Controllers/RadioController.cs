using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Nectar (Internet Radio) ─────────────────────────────────
[Route("api/gadgets/radio")]
[ApiController]
[Authorize]
public class RadioController : ControllerBase
{
    private readonly AppDbContext _db;
    private const string RadioApi = "https://de1.api.radio-browser.info/json";
    public RadioController(AppDbContext db) => _db = db;

    [HttpGet("stations")]
    public async Task<IActionResult> Stations([FromQuery] string? name, [FromQuery] string? country,
        [FromQuery] string? tag, [FromQuery] int limit = 50, [FromQuery] int offset = 0,
        [FromQuery] string order = "votes", [FromQuery] bool reverse = true)
    {
        var http = this.Http();
        var url = $"{RadioApi}/stations/search?limit={limit}&offset={offset}&order={order}&reverse={reverse}";
        if (!string.IsNullOrEmpty(name)) url += $"&name={Uri.EscapeDataString(name)}";
        if (!string.IsNullOrEmpty(country)) url += $"&country={Uri.EscapeDataString(country)}";
        if (!string.IsNullOrEmpty(tag)) url += $"&tag={Uri.EscapeDataString(tag)}";
        var resp = await http.GetStringAsync(url);
        return Content(resp, "application/json");
    }

    [HttpGet("countries")]
    public async Task<IActionResult> Countries()
    {
        var http = this.Http();
        var resp = await http.GetStringAsync($"{RadioApi}/countries?order=stationcount&reverse=true&hidebroken=true");
        return Content(resp, "application/json");
    }

    [HttpGet("tags")]
    public async Task<IActionResult> Tags([FromQuery] int limit = 100)
    {
        var http = this.Http();
        var resp = await http.GetStringAsync($"{RadioApi}/tags?order=stationcount&reverse=true&limit={limit}&hidebroken=true");
        return Content(resp, "application/json");
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> Favorites()
    {
        var favs = await _db.RadioFavorites
            .Where(f => f.UserId == this.UserId())
            .OrderByDescending(f => f.CreatedAt).ToListAsync();
        return Ok(favs.Select(f => new
        {
            f.Id, station_uuid = f.StationUuid, f.Name,
            stream_url = f.StreamUrl, f.Favicon, f.Country, f.Tags,
            created_at = f.CreatedAt
        }));
    }

    [HttpPost("favorites")]
    public async Task<IActionResult> AddFavorite([FromBody] JsonElement body)
    {
        var fav = new RadioFavorite
        {
            UserId = this.UserId(),
            StationUuid = body.TryGetProperty("stationuuid", out var su) ? su.GetString() ?? "" :
                body.TryGetProperty("station_uuid", out var su2) ? su2.GetString() ?? "" : "",
            Name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
            StreamUrl = body.TryGetProperty("url_resolved", out var ur) ? ur.GetString() :
                body.TryGetProperty("stream_url", out var su3) ? su3.GetString() : null,
            Favicon = body.TryGetProperty("favicon", out var fv) ? fv.GetString() : null,
            Country = body.TryGetProperty("country", out var c) ? c.GetString() : null,
            Tags = body.TryGetProperty("tags", out var tg) ? tg.GetString() : null,
        };
        _db.RadioFavorites.Add(fav);
        await _db.SaveChangesAsync();
        return Ok(new { fav.Id, status = "added" });
    }

    [HttpDelete("favorites/{id}")]
    public async Task<IActionResult> RemoveFavorite(string id)
    {
        var fav = await _db.RadioFavorites.FindAsync(id);
        if (fav != null && fav.UserId == this.UserId())
        {
            _db.RadioFavorites.Remove(fav);
            await _db.SaveChangesAsync();
        }
        return Ok(new { status = "removed" });
    }
}

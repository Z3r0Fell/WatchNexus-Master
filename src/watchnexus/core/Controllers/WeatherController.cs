using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

[Route("api/gadgets/weather")]
[ApiController]
[Authorize]
public class WeatherController : ControllerBase
{
    private readonly AppDbContext _db;
    public WeatherController(AppDbContext db) => _db = db;

    [HttpGet("search")]
    public async Task<IActionResult> SearchLocations([FromQuery] string q = "")
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        var http = this.Http();
        var resp = await http.GetStringAsync(
            $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(q)}&count=10&language=en&format=json");
        var doc = JsonDocument.Parse(resp);
        if (!doc.RootElement.TryGetProperty("results", out var results))
            return Ok(Array.Empty<object>());
        return Ok(results);
    }

    [HttpGet]
    public async Task<IActionResult> GetWeather([FromQuery] double? lat, [FromQuery] double? lon,
        [FromQuery] string unit = "celsius")
    {
        var userId = this.UserId();
        if (lat == null || lon == null)
        {
            var saved = await _db.Settings.FirstOrDefaultAsync(
                s => s.UserId == userId && s.Key == "weather_location");
            if (saved?.Value != null)
            {
                var loc = JsonDocument.Parse(saved.Value).RootElement;
                lat = loc.GetProperty("lat").GetDouble();
                lon = loc.GetProperty("lon").GetDouble();
            }
            else return Ok(new { error = "No location configured" });
        }
        var tempUnit = unit == "fahrenheit" ? "fahrenheit" : "celsius";
        var http = this.Http();
        var url = $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}" +
                  $"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,uv_index" +
                  $"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,uv_index_max" +
                  $"&temperature_unit={tempUnit}&wind_speed_unit=kmh&timezone=auto&forecast_days=7";
        var resp = await http.GetStringAsync(url);
        return Content(resp, "application/json");
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var saved = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == "weather_location");
        var unit = await _db.Settings.FirstOrDefaultAsync(
            s => s.UserId == this.UserId() && s.Key == "weather_unit");
        return Ok(new
        {
            location = saved?.Value,
            unit = unit?.Value ?? "celsius"
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] JsonElement body)
    {
        var userId = this.UserId();
        if (body.TryGetProperty("location", out var loc))
        {
            var existing = await _db.Settings.FirstOrDefaultAsync(
                s => s.UserId == userId && s.Key == "weather_location");
            if (existing != null) existing.Value = loc.GetRawText();
            else _db.Settings.Add(new WatchNexus.Shared.AppSetting
            { Key = "weather_location", Value = loc.GetRawText(), UserId = userId });
        }
        if (body.TryGetProperty("unit", out var u))
        {
            var existing = await _db.Settings.FirstOrDefaultAsync(
                s => s.UserId == userId && s.Key == "weather_unit");
            if (existing != null) existing.Value = u.GetString() ?? "celsius";
            else _db.Settings.Add(new WatchNexus.Shared.AppSetting
            { Key = "weather_unit", Value = u.GetString() ?? "celsius", UserId = userId });
        }
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

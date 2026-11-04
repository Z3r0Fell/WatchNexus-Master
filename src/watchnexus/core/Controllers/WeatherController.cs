using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Sorbet (Weather) ────────────────────────────────────────
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
        using var doc = JsonDocument.Parse(resp);
        // WeatherPage.jsx reads `results[]` with lat/lon (open-meteo uses latitude/longitude).
        if (!doc.RootElement.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array)
            return Ok(new { results = Array.Empty<object>() });
        var list = results.EnumerateArray().Select(r => new
        {
            name = r.TryGetProperty("name", out var n) ? n.GetString() : null,
            country = r.TryGetProperty("country", out var c) ? c.GetString() : null,
            admin1 = r.TryGetProperty("admin1", out var a) ? a.GetString() : null,
            lat = r.TryGetProperty("latitude", out var la) && la.TryGetDouble(out var lav) ? lav : (double?)null,
            lon = r.TryGetProperty("longitude", out var lo) && lo.TryGetDouble(out var lov) ? lov : (double?)null,
        }).Where(r => r.lat != null && r.lon != null).ToList();
        return Ok(new { results = list });
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
                try
                {
                    using var locDoc = JsonDocument.Parse(saved.Value);
                    var loc = locDoc.RootElement;
                    if (loc.TryGetProperty("lat", out var la) && la.TryGetDouble(out var lav)) lat = lav;
                    if (loc.TryGetProperty("lon", out var lo) && lo.TryGetDouble(out var lov)) lon = lov;
                }
                catch (JsonException) { }
            }
            if (lat == null || lon == null) return BadRequest(new { error = "No location configured" });
        }
        var tempUnit = unit == "fahrenheit" ? "fahrenheit" : "celsius";
        var http = this.Http();
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return BadRequest(new { error = "lat/lon out of range" });
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        // Invariant formatting: a comma-decimal culture would produce "52,5" and break the query.
        var url = $"https://api.open-meteo.com/v1/forecast?latitude={lat.Value.ToString(inv)}&longitude={lon.Value.ToString(inv)}" +
                  $"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,uv_index" +
                  $"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,uv_index_max" +
                  $"&temperature_unit={tempUnit}&wind_speed_unit=kmh&timezone=auto&forecast_days=7";
        var resp = await http.GetStringAsync(url);
        return Content(Normalize(resp), "application/json");
    }

    // Keep the raw open-meteo payload, and add the `current.{temperature,feels_like,
    // humidity,wind_speed,description,icon}` and `forecast[]` keys WeatherPage.jsx renders.
    internal static string Normalize(string raw)
    {
        var root = System.Text.Json.Nodes.JsonNode.Parse(raw) as System.Text.Json.Nodes.JsonObject;
        if (root == null) return raw;
        double? D(System.Text.Json.Nodes.JsonNode? n) { try { return n?.GetValue<double>(); } catch { return null; } }
        if (root["current"] is System.Text.Json.Nodes.JsonObject cur)
        {
            var code = (int)(D(cur["weather_code"]) ?? 0);
            cur["temperature"] = D(cur["temperature_2m"]);
            cur["feels_like"] = D(cur["apparent_temperature"]);
            cur["humidity"] = D(cur["relative_humidity_2m"]);
            cur["wind_speed"] = D(cur["wind_speed_10m"]);
            cur["description"] = Describe(code);
            cur["icon"] = Icon(code);
        }
        var forecast = new System.Text.Json.Nodes.JsonArray();
        if (root["daily"] is System.Text.Json.Nodes.JsonObject daily && daily["time"] is System.Text.Json.Nodes.JsonArray days)
        {
            for (int i = 0; i < days.Count; i++)
            {
                double? At(string k) => daily[k] is System.Text.Json.Nodes.JsonArray a && i < a.Count ? D(a[i]) : null;
                var code = (int)(At("weather_code") ?? 0);
                forecast.Add(new System.Text.Json.Nodes.JsonObject
                {
                    ["date"] = days[i]?.ToString(),
                    ["temp_max"] = At("temperature_2m_max"),
                    ["temp_min"] = At("temperature_2m_min"),
                    ["precipitation"] = At("precipitation_sum"),
                    ["description"] = Describe(code),
                    ["icon"] = Icon(code),
                });
            }
        }
        root["forecast"] = forecast;
        return root.ToJsonString();
    }

    // WMO weather interpretation codes (open-meteo).
    private static string Icon(int c) => c switch
    {
        0 => "sun", 1 or 2 => "cloud-sun", 3 or 45 or 48 => "cloud",
        >= 51 and <= 57 => "cloud-drizzle", (>= 61 and <= 67) or (>= 80 and <= 82) => "cloud-rain",
        (>= 71 and <= 77) or 85 or 86 => "snowflake", >= 95 => "bolt", _ => "cloud",
    };

    private static string Describe(int c) => c switch
    {
        0 => "Clear sky", 1 => "Mainly clear", 2 => "Partly cloudy", 3 => "Overcast",
        45 or 48 => "Fog", >= 51 and <= 57 => "Drizzle", >= 61 and <= 67 => "Rain",
        >= 71 and <= 77 => "Snow", >= 80 and <= 82 => "Rain showers", 85 or 86 => "Snow showers",
        >= 95 => "Thunderstorm", _ => "Unknown",
    };

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

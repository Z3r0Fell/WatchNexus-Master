using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// Truffle — Watch Analytics & Year Wrapped.
/// Tracks play events and computes viewing statistics, trends, and year-in-review data.
/// </summary>
[Route("api/truffle")]
[ApiController]
[Authorize]
public class TruffleController : ControllerBase
{
    private readonly AppDbContext _db;
    public TruffleController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { module = "truffle", version = "1.0.1", status = "active", description = "Watch analytics, play tracking, and viewing statistics" });

    // ── Record Play Event ──────────────────────────────────
    [HttpPost("play")]
    public async Task<IActionResult> RecordPlay([FromBody] JsonElement body)
    {
        var ev = new PlayEvent
        {
            UserId = this.UserId(),
            MediaType = body.TryGetProperty("media_type", out var mt) ? mt.GetString() ?? "movie" : "movie",
            TmdbId = body.TryGetProperty("tmdb_id", out var tid) ? tid.ToString() : null,
            Title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
            DurationSeconds = body.TryGetProperty("duration_seconds", out var d) ? d.GetInt32() : 0,
            DeviceType = body.TryGetProperty("device_type", out var dt) ? dt.GetString() : null,
            Quality = body.TryGetProperty("quality", out var q) ? q.GetString() : null,
            StartedAt = DateTime.UtcNow,
        };
        _db.PlayEvents.Add(ev);
        await _db.SaveChangesAsync();
        return Ok(new { id = ev.Id, status = "recorded" });
    }

    [HttpPost("play/{id}/end")]
    public async Task<IActionResult> EndPlay(string id)
    {
        var ev = await _db.PlayEvents.FirstOrDefaultAsync(e => e.Id == id && e.UserId == this.UserId());
        if (ev == null) return NotFound();
        ev.EndedAt = DateTime.UtcNow;
        ev.DurationSeconds = (int)(ev.EndedAt.Value - ev.StartedAt).TotalSeconds;
        await _db.SaveChangesAsync();
        return Ok(new { status = "ended", duration_seconds = ev.DurationSeconds });
    }

    // ── Stats Overview ──────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> Stats([FromQuery] int days = 30)
    {
        var uid = this.UserId();
        var since = DateTime.UtcNow.AddDays(-days);
        var events = await _db.PlayEvents
            .Where(e => e.UserId == uid && e.StartedAt >= since)
            .ToListAsync();

        var totalWatchTime = events.Sum(e => e.DurationSeconds);
        var byType = events.GroupBy(e => e.MediaType)
            .Select(g => new { type = g.Key, count = g.Count(), hours = Math.Round(g.Sum(e => e.DurationSeconds) / 3600.0, 1) })
            .OrderByDescending(x => x.count).ToList();
        var topTitles = events.GroupBy(e => e.Title)
            .Select(g => new { title = g.Key, count = g.Count(), total_minutes = g.Sum(e => e.DurationSeconds) / 60 })
            .OrderByDescending(x => x.count).Take(10).ToList();
        var byHour = events.GroupBy(e => e.StartedAt.Hour)
            .Select(g => new { hour = g.Key, count = g.Count() })
            .OrderBy(x => x.hour).ToList();
        var byDay = events.GroupBy(e => e.StartedAt.DayOfWeek)
            .Select(g => new { day = g.Key.ToString(), count = g.Count() })
            .ToList();

        return Ok(new
        {
            period_days = days,
            total_plays = events.Count,
            total_watch_hours = Math.Round(totalWatchTime / 3600.0, 1),
            unique_titles = events.Select(e => e.Title).Distinct().Count(),
            by_media_type = byType,
            top_titles = topTitles,
            by_hour = byHour,
            by_day_of_week = byDay,
        });
    }

    // Frontend alias
    [HttpGet("activity")]
    public Task<IActionResult> Activity([FromQuery] int limit = 25) => Recent(limit);


    // ── Recent Activity ──────────────────────────────────
    [HttpGet("recent")]
    public async Task<IActionResult> Recent([FromQuery] int limit = 25)
    {
        var uid = this.UserId();
        var events = await _db.PlayEvents
            .Where(e => e.UserId == uid)
            .OrderByDescending(e => e.StartedAt)
            .Take(limit)
            .Select(e => new { e.Id, e.MediaType, e.TmdbId, e.Title, e.DurationSeconds, e.DeviceType, e.Quality, e.StartedAt, e.EndedAt })
            .ToListAsync();
        return Ok(events);
    }

    // ── Year Wrapped ──────────────────────────────────
    [HttpGet("wrapped")]
    public async Task<IActionResult> Wrapped([FromQuery] int? year = null)
    {
        var uid = this.UserId();
        var y = year ?? DateTime.UtcNow.Year;
        var start = new DateTime(y, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(y + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var events = await _db.PlayEvents
            .Where(e => e.UserId == uid && e.StartedAt >= start && e.StartedAt < end)
            .ToListAsync();

        if (events.Count == 0) return Ok(new { year = y, message = "No activity this year" });

        var totalHours = Math.Round(events.Sum(e => e.DurationSeconds) / 3600.0, 1);
        var topTitle = events.GroupBy(e => e.Title).OrderByDescending(g => g.Count()).FirstOrDefault();
        var topGenre = events.GroupBy(e => e.MediaType).OrderByDescending(g => g.Count()).FirstOrDefault();
        var busiestMonth = events.GroupBy(e => e.StartedAt.Month)
            .OrderByDescending(g => g.Count()).FirstOrDefault();
        var busiestDay = events.GroupBy(e => e.StartedAt.DayOfWeek)
            .OrderByDescending(g => g.Count()).FirstOrDefault();
        var longestStreak = CalcStreak(events.Select(e => e.StartedAt.Date).Distinct().OrderBy(d => d).ToList());
        var monthlyTrend = events.GroupBy(e => e.StartedAt.Month)
            .Select(g => new { month = g.Key, plays = g.Count(), hours = Math.Round(g.Sum(e => e.DurationSeconds) / 3600.0, 1) })
            .OrderBy(x => x.month).ToList();

        return Ok(new
        {
            year = y,
            total_plays = events.Count,
            total_hours = totalHours,
            unique_titles = events.Select(e => e.Title).Distinct().Count(),
            favorite_title = topTitle != null ? new { title = topTitle.Key, plays = topTitle.Count() } : null,
            favorite_type = topGenre?.Key,
            busiest_month = busiestMonth != null ? new { month = busiestMonth.Key, plays = busiestMonth.Count() } : null,
            busiest_day = busiestDay?.Key.ToString(),
            longest_streak_days = longestStreak,
            monthly_trend = monthlyTrend,
        });
    }

    // ── Admin: All Users Stats ──────────────────────────────────
    [HttpGet("admin/overview")]
    public async Task<IActionResult> AdminOverview([FromQuery] int days = 30)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var events = await _db.PlayEvents.Where(e => e.StartedAt >= since).ToListAsync();
        var byUser = events.GroupBy(e => e.UserId)
            .Select(g => new { user_id = g.Key, plays = g.Count(), hours = Math.Round(g.Sum(e => e.DurationSeconds) / 3600.0, 1) })
            .OrderByDescending(x => x.plays).ToList();

        return Ok(new
        {
            period_days = days,
            total_plays = events.Count,
            total_hours = Math.Round(events.Sum(e => e.DurationSeconds) / 3600.0, 1),
            active_users = byUser.Count,
            by_user = byUser,
        });
    }

    private static int CalcStreak(List<DateTime> dates)
    {
        if (dates.Count == 0) return 0;
        int max = 1, cur = 1;
        for (int i = 1; i < dates.Count; i++)
        {
            if ((dates[i] - dates[i - 1]).TotalDays == 1) { cur++; if (cur > max) max = cur; }
            else cur = 1;
        }
        return max;
    }
}

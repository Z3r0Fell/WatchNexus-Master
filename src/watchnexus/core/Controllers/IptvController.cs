using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

// ── Taffy (IPTV) ────────────────────────────────────────────
[Route("api/iptv")]
[ApiController]
[Authorize]
public class IptvController : ControllerBase
{
    private readonly AppDbContext _db;
    public IptvController(AppDbContext db) => _db = db;

    private const string IptvFavKey = "iptv_favorite:";

    [HttpGet("sources")]
    public async Task<IActionResult> Sources()
    {
        var sources = await _db.IptvSources.OrderByDescending(s => s.CreatedAt).ToListAsync();
        return Ok(sources.Select(s => new
        {
            s.Id, s.Name, s.Url, epg_url = s.EpgUrl,
            channel_count = s.ChannelCount, last_refreshed = s.LastRefreshed, created_at = s.CreatedAt
        }));
    }

    [HttpPost("sources")]
    public async Task<IActionResult> AddSource(
        [FromQuery] string? name,
        [FromQuery] string? url,
        [FromQuery] string? epg_url)
    {
        if (!SsrfGuard.IsAllowedUrl(url))
            return BadRequest(new { detail = "Source URL is not allowed (only public http/https URLs)" });
        var source = new IptvSource { Name = name ?? "", Url = url ?? "", EpgUrl = epg_url };
        _db.IptvSources.Add(source);
        await _db.SaveChangesAsync();
        try
        {
            var http = this.Http();
            var content = await http.GetStringAsync(url ?? "");
            var channels = ParseM3U(content, source.Id);
            _db.IptvChannels.AddRange(channels);
            source.ChannelCount = channels.Count;
            source.LastRefreshed = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            return Ok(new { source.Id, source.Name, status = "added", parse_error = ex.Message, channel_count = 0 });
        }
        return Ok(new { source.Id, source.Name, status = "added", channel_count = source.ChannelCount });
    }

    [HttpPut("sources/{id}")]
    public async Task<IActionResult> UpdateSource(string id, [FromBody] JsonElement body)
    {
        var source = await _db.IptvSources.FindAsync(id);
        if (source == null) return NotFound();
        if (body.TryGetProperty("name", out var n)) source.Name = n.GetString() ?? source.Name;
        if (body.TryGetProperty("url", out var u))
        {
            var newUrl = u.GetString();
            if (!SsrfGuard.IsAllowedUrl(newUrl))
                return BadRequest(new { detail = "Source URL is not allowed (only public http/https URLs)" });
            source.Url = newUrl;
        }
        if (body.TryGetProperty("epg_url", out var e)) source.EpgUrl = e.GetString();
        await _db.SaveChangesAsync();
        return Ok(new { status = "updated" });
    }

    [HttpPost("sources/{id}/refresh")]
    public async Task<IActionResult> RefreshSource(string id)
    {
        var source = await _db.IptvSources.FindAsync(id);
        if (source == null) return NotFound();
        if (!SsrfGuard.IsAllowedUrl(source.Url))
            return BadRequest(new { detail = "Source URL is not allowed (only public http/https URLs)" });
        var oldChannels = await _db.IptvChannels.Where(c => c.SourceId == id).ToListAsync();
        _db.IptvChannels.RemoveRange(oldChannels);
        try
        {
            var http = this.Http();
            var content = await http.GetStringAsync(source.Url);
            var channels = ParseM3U(content, source.Id);
            _db.IptvChannels.AddRange(channels);
            source.ChannelCount = channels.Count;
            source.LastRefreshed = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex) { return StatusCode(500, new { detail = ex.Message }); }
        return Ok(new { status = "refreshed", channel_count = source.ChannelCount });
    }

    [HttpDelete("sources/{id}")]
    public async Task<IActionResult> DeleteSource(string id)
    {
        var channels = await _db.IptvChannels.Where(c => c.SourceId == id).ToListAsync();
        _db.IptvChannels.RemoveRange(channels);
        var source = await _db.IptvSources.FindAsync(id);
        if (source != null) _db.IptvSources.Remove(source);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpGet("channels")]
    public async Task<IActionResult> Channels([FromQuery] string? source_id, [FromQuery] string? group,
        [FromQuery] string? search, [FromQuery] bool favorites_only = false,
        [FromQuery] int limit = 200, [FromQuery] int offset = 0)
    {
        var uid = this.UserId();
        var query = _db.IptvChannels.AsQueryable();
        if (!string.IsNullOrEmpty(source_id)) query = query.Where(c => c.SourceId == source_id);
        if (!string.IsNullOrEmpty(group)) query = query.Where(c => c.GroupTitle == group);
        if (!string.IsNullOrEmpty(search)) query = query.Where(c => c.Name.Contains(search));

        var favIds = (await _db.Settings
                .Where(s => s.UserId == uid && s.Key.StartsWith(IptvFavKey))
                .Select(s => s.Key).ToListAsync())
            .Select(k => k[IptvFavKey.Length..]).ToList();
        if (favorites_only) query = query.Where(c => favIds.Contains(c.Id));
        var favSet = favIds.ToHashSet();

        var channels = await query.OrderBy(c => c.SortOrder).Skip(offset).Take(limit).ToListAsync();
        return Ok(channels.Select(c => new
        {
            c.Id, c.SourceId, c.Name, group_title = c.GroupTitle,
            stream_url = c.StreamUrl, logo_url = c.LogoUrl, tvg_id = c.TvgId, tvg_name = c.TvgName,
            is_favorite = favSet.Contains(c.Id)
        }));
    }

    [HttpPost("channels/{id}/favorite")]
    public async Task<IActionResult> ToggleFavorite(string id)
    {
        var uid = this.UserId();
        var ch = await _db.IptvChannels.FindAsync(id);
        if (ch == null) return NotFound();
        var key = IptvFavKey + id;
        var row = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == uid && s.Key == key);
        if (row == null)
        {
            _db.Settings.Add(new WatchNexus.Shared.AppSetting { Key = key, UserId = uid, Value = "1" });
            await _db.SaveChangesAsync();
            return Ok(new { is_favorite = true, id });
        }
        _db.Settings.Remove(row);
        await _db.SaveChangesAsync();
        return Ok(new { is_favorite = false, id });
    }

    [HttpGet("channels/{id}")]
    public async Task<IActionResult> Channel(string id)
    {
        var ch = await _db.IptvChannels.FindAsync(id);
        if (ch == null) return NotFound();
        return Ok(new { ch.Id, ch.SourceId, ch.Name, group_title = ch.GroupTitle, stream_url = ch.StreamUrl, logo_url = ch.LogoUrl });
    }

    [HttpGet("groups")]
    public async Task<IActionResult> Groups([FromQuery] string? source_id)
    {
        var query = _db.IptvChannels.AsQueryable();
        if (!string.IsNullOrEmpty(source_id)) query = query.Where(c => c.SourceId == source_id);
        var groups = await query.Where(c => c.GroupTitle != null)
            .GroupBy(c => c.GroupTitle)
            .Select(g => new { name = g.Key, count = g.Count() })
            .OrderByDescending(g => g.count).ToListAsync();
        return Ok(groups);
    }

    [HttpGet("epg/{channelId}")]
    public IActionResult Epg(string channelId) => Ok(Array.Empty<object>());

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var uid = this.UserId();
        var totalChannels = await _db.IptvChannels.CountAsync();
        var totalGroups = await _db.IptvChannels.Where(c => c.GroupTitle != null).Select(c => c.GroupTitle).Distinct().CountAsync();
        return Ok(new
        {
            sources = await _db.IptvSources.CountAsync(),
            channels = totalChannels,
            groups = totalGroups,
            total_channels = totalChannels,
            total_groups = totalGroups,
            favorites_count = await _db.Settings.CountAsync(s => s.UserId == uid && s.Key.StartsWith(IptvFavKey))
        });
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string? source_id, [FromQuery] bool favorites_only = false)
    {
        var query = _db.IptvChannels.AsQueryable();
        if (!string.IsNullOrEmpty(source_id)) query = query.Where(c => c.SourceId == source_id);
        if (favorites_only)
        {
            var uid = this.UserId();
            var favIds = (await _db.Settings
                    .Where(s => s.UserId == uid && s.Key.StartsWith(IptvFavKey))
                    .Select(s => s.Key).ToListAsync())
                .Select(k => k[IptvFavKey.Length..]).ToList();
            query = query.Where(c => favIds.Contains(c.Id));
        }
        var channels = await query.OrderBy(c => c.SortOrder).ToListAsync();
        var sb = new StringBuilder("#EXTM3U\n");
        foreach (var ch in channels)
        {
            sb.Append($"#EXTINF:-1");
            if (!string.IsNullOrEmpty(ch.TvgId)) sb.Append($" tvg-id=\"{ch.TvgId}\"");
            if (!string.IsNullOrEmpty(ch.TvgName)) sb.Append($" tvg-name=\"{ch.TvgName}\"");
            if (!string.IsNullOrEmpty(ch.LogoUrl)) sb.Append($" tvg-logo=\"{ch.LogoUrl}\"");
            if (!string.IsNullOrEmpty(ch.GroupTitle)) sb.Append($" group-title=\"{ch.GroupTitle}\"");
            sb.AppendLine($",{ch.Name}");
            sb.AppendLine(ch.StreamUrl);
        }
        return Ok(new { content = sb.ToString(), filename = "watchnexus.m3u" });
    }

    private static List<IptvChannel> ParseM3U(string content, string sourceId)
    {
        var channels = new List<IptvChannel>();
        var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        string? currentName = null, currentGroup = null, currentLogo = null, currentTvgId = null, currentTvgName = null;
        var order = 0;
        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.StartsWith("#EXTM3U")) continue;
            if (line.StartsWith("#EXTINF:"))
            {
                currentName = line.Contains(",") ? line[(line.LastIndexOf(',') + 1)..].Trim() : "Unknown";
                currentGroup = ExtractAttribute(line, "group-title");
                currentLogo = ExtractAttribute(line, "tvg-logo");
                currentTvgId = ExtractAttribute(line, "tvg-id");
                currentTvgName = ExtractAttribute(line, "tvg-name");
            }
            else if (!line.StartsWith("#") && !string.IsNullOrWhiteSpace(line))
            {
                channels.Add(new IptvChannel
                {
                    SourceId = sourceId, Name = currentName ?? "Unknown", GroupTitle = currentGroup,
                    StreamUrl = line, LogoUrl = currentLogo, TvgId = currentTvgId,
                    TvgName = currentTvgName, SortOrder = order++
                });
                currentName = null; currentGroup = null; currentLogo = null;
            }
        }
        return channels;
    }

    private static string? ExtractAttribute(string line, string attr)
    {
        var key = $"{attr}=\"";
        var idx = line.IndexOf(key, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        var start = idx + key.Length;
        var end = line.IndexOf('"', start);
        return end > start ? line[start..end] : null;
    }
}

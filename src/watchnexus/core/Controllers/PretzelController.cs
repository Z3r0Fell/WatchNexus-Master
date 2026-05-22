using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// PRETZEL — Gaming Console (Ultra)
// Browser-based retro game emulator powered by EmulatorJS.
// Supports: NES, SNES, Genesis/MD, GBA, GB/GBC, N64, PS1, Atari, MAME
// Features: ROM library, save states, controller mapping, fullscreen
// ══════════════════════════════════════════════════════════════════════
[Route("api/pretzel")]
[ApiController]
[Authorize]
public class PretzelController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    public PretzelController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    // ── Supported Systems ───────────────────────────────────────────
    private static readonly Dictionary<string, object> Systems = new()
    {
        ["nes"] = new { name = "Nintendo (NES)", core = "nes", extensions = new[] { ".nes", ".zip" }, color = "#E60012" },
        ["snes"] = new { name = "Super Nintendo (SNES)", core = "snes", extensions = new[] { ".sfc", ".smc", ".zip" }, color = "#7B7BB5" },
        ["gb"] = new { name = "Game Boy", core = "gb", extensions = new[] { ".gb", ".zip" }, color = "#8BAC0F" },
        ["gbc"] = new { name = "Game Boy Color", core = "gbc", extensions = new[] { ".gbc", ".zip" }, color = "#663399" },
        ["gba"] = new { name = "Game Boy Advance", core = "gba", extensions = new[] { ".gba", ".zip" }, color = "#4A148C" },
        ["n64"] = new { name = "Nintendo 64", core = "n64", extensions = new[] { ".n64", ".z64", ".v64", ".zip" }, color = "#009944" },
        ["genesis"] = new { name = "Sega Genesis / Mega Drive", core = "segaMD", extensions = new[] { ".md", ".gen", ".bin", ".zip" }, color = "#0072BC" },
        ["mastersystem"] = new { name = "Sega Master System", core = "segaMS", extensions = new[] { ".sms", ".zip" }, color = "#000080" },
        ["gamegear"] = new { name = "Sega Game Gear", core = "segaGG", extensions = new[] { ".gg", ".zip" }, color = "#1A1A2E" },
        ["psx"] = new { name = "PlayStation", core = "psx", extensions = new[] { ".bin", ".cue", ".iso", ".pbp", ".chd", ".zip" }, color = "#003087" },
        ["atari2600"] = new { name = "Atari 2600", core = "atari2600", extensions = new[] { ".a26", ".bin", ".zip" }, color = "#CC0000" },
        ["atari7800"] = new { name = "Atari 7800", core = "atari7800", extensions = new[] { ".a78", ".bin", ".zip" }, color = "#CC6600" },
        ["arcade"] = new { name = "Arcade (MAME)", core = "mame2003", extensions = new[] { ".zip" }, color = "#FFD700" },
        ["nds"] = new { name = "Nintendo DS", core = "nds", extensions = new[] { ".nds", ".zip" }, color = "#A0A0A0" },
        ["pce"] = new { name = "PC Engine / TurboGrafx-16", core = "pce", extensions = new[] { ".pce", ".zip" }, color = "#FF6600" },
    };

    // ── Get Supported Systems ───────────────────────────────────────
    [HttpGet("systems")]
    public IActionResult GetSystems()
    {
        return Ok(Systems.Select(kv => new { id = kv.Key, kv.Value }).ToList());
    }

    // ── Game Library ────────────────────────────────────────────────
    [HttpGet("games")]
    public async Task<IActionResult> GetGames([FromQuery] string? system = null)
    {
        var allGames = await _db.Settings
            .Where(s => s.Key.StartsWith("pretzel_game:"))
            .ToListAsync();

        var games = new List<object>();
        foreach (var g in allGames)
        {
            try
            {
                var doc = JsonDocument.Parse(g.Value ?? "{}").RootElement;
                var gameSystem = doc.TryGetProperty("system", out var sys) ? sys.GetString() : "";
                if (!string.IsNullOrEmpty(system) && gameSystem != system) continue;

                games.Add(new
                {
                    id = g.Key.Replace("pretzel_game:", ""),
                    title = doc.TryGetProperty("title", out var t) ? t.GetString() : "",
                    system = gameSystem,
                    system_name = Systems.TryGetValue(gameSystem ?? "", out var si) ? ((dynamic)si).name : gameSystem,
                    core = Systems.TryGetValue(gameSystem ?? "", out var sc) ? ((dynamic)sc).core : gameSystem,
                    file_name = doc.TryGetProperty("file_name", out var fn) ? fn.GetString() : "",
                    file_size = doc.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0,
                    cover_url = doc.TryGetProperty("cover_url", out var cu) ? cu.GetString() : null,
                    added_at = doc.TryGetProperty("added_at", out var aa) ? aa.GetString() : "",
                    last_played = doc.TryGetProperty("last_played", out var lp) ? lp.GetString() : null,
                    play_count = doc.TryGetProperty("play_count", out var pc) ? pc.GetInt32() : 0,
                    favorite = doc.TryGetProperty("favorite", out var fav) && fav.GetBoolean(),
                });
            }
            catch { }
        }

        return Ok(new { games = games.OrderByDescending(g => ((dynamic)g).last_played ?? "").ToList(), total = games.Count });
    }

    // ── Add Game ────────────────────────────────────────────────────
    [HttpPost("games")]
    public async Task<IActionResult> AddGame([FromBody] JsonElement body)
    {
        var title = body.TryGetProperty("title", out var t) ? t.GetString()?.Trim() ?? "" : "";
        var system = body.TryGetProperty("system", out var sys) ? sys.GetString() ?? "" : "";
        var fileName = body.TryGetProperty("file_name", out var fn) ? fn.GetString() ?? "" : "";
        var filePath = body.TryGetProperty("file_path", out var fp) ? fp.GetString() ?? "" : "";
        var fileSize = body.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0;
        var coverUrl = body.TryGetProperty("cover_url", out var cu) ? cu.GetString() : null;

        if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(system))
            return BadRequest(new { success = false, message = "Title and system are required" });
        if (!Systems.ContainsKey(system))
            return BadRequest(new { success = false, message = $"Unknown system: {system}" });

        var id = Guid.NewGuid().ToString("N")[..12];
        var gameData = JsonSerializer.Serialize(new
        {
            title, system, file_name = fileName, file_path = filePath,
            file_size = fileSize, cover_url = coverUrl,
            added_at = DateTime.UtcNow.ToString("o"),
            added_by = this.UserId(),
            play_count = 0, favorite = false,
        });

        _db.Settings.Add(new AppSetting { Key = $"pretzel_game:{id}", UserId = "", Value = gameData });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, id, message = $"'{title}' added to library" });
    }

    // ── Delete Game ─────────────────────────────────────────────────
    [HttpDelete("games/{id}")]
    public async Task<IActionResult> DeleteGame(string id)
    {
        var key = $"pretzel_game:{id}";
        var game = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (game == null) return NotFound(new { success = false, message = "Game not found" });
        _db.Settings.Remove(game);
        await _db.SaveChangesAsync();
        return Ok(new { success = true, message = "Game removed" });
    }

    // ── Record Play Session ─────────────────────────────────────────
    [HttpPost("games/{id}/play")]
    public async Task<IActionResult> RecordPlay(string id)
    {
        var key = $"pretzel_game:{id}";
        var game = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (game?.Value == null) return NotFound();

        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(game.Value) ?? new();
        var count = data.TryGetValue("play_count", out var pc) && pc is JsonElement je ? je.GetInt32() : 0;
        data["play_count"] = count + 1;
        data["last_played"] = DateTime.UtcNow.ToString("o");
        game.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, play_count = count + 1 });
    }

    // ── Toggle Favorite ─────────────────────────────────────────────
    [HttpPost("games/{id}/favorite")]
    public async Task<IActionResult> ToggleFavorite(string id)
    {
        var key = $"pretzel_game:{id}";
        var game = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (game?.Value == null) return NotFound();

        var data = JsonSerializer.Deserialize<Dictionary<string, object>>(game.Value) ?? new();
        var fav = data.TryGetValue("favorite", out var f) && f is JsonElement je && je.GetBoolean();
        data["favorite"] = !fav;
        game.Value = JsonSerializer.Serialize(data);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, favorite = !fav });
    }

    // ── Save States ─────────────────────────────────────────────────
    [HttpGet("games/{id}/saves")]
    public async Task<IActionResult> GetSaves(string id)
    {
        var saves = await _db.Settings
            .Where(s => s.Key.StartsWith($"pretzel_save:{id}:"))
            .ToListAsync();

        var result = saves.Select(s =>
        {
            try
            {
                var doc = JsonDocument.Parse(s.Value ?? "{}").RootElement;
                return new
                {
                    id = s.Key.Split(':').Last(),
                    slot = doc.TryGetProperty("slot", out var sl) ? sl.GetInt32() : 0,
                    label = doc.TryGetProperty("label", out var l) ? l.GetString() : "",
                    created_at = doc.TryGetProperty("created_at", out var ca) ? ca.GetString() : "",
                };
            }
            catch { return null; }
        }).Where(x => x != null);

        return Ok(result);
    }

    [HttpPost("games/{id}/saves")]
    public async Task<IActionResult> CreateSave(string id, [FromBody] JsonElement body)
    {
        var slot = body.TryGetProperty("slot", out var sl) ? sl.GetInt32() : 0;
        var label = body.TryGetProperty("label", out var l) ? l.GetString() ?? $"Save Slot {slot}" : $"Save Slot {slot}";
        var stateData = body.TryGetProperty("state_data", out var sd) ? sd.GetString() : null;

        var saveId = Guid.NewGuid().ToString("N")[..8];
        var data = JsonSerializer.Serialize(new { slot, label, state_data = stateData, created_at = DateTime.UtcNow.ToString("o") });
        _db.Settings.Add(new AppSetting { Key = $"pretzel_save:{id}:{saveId}", UserId = "", Value = data });
        await _db.SaveChangesAsync();

        return Ok(new { success = true, id = saveId, message = "Save state created" });
    }

    // ── Stats ───────────────────────────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var games = await _db.Settings.Where(s => s.Key.StartsWith("pretzel_game:")).ToListAsync();
        var systemCounts = new Dictionary<string, int>();
        int totalPlays = 0;
        foreach (var g in games)
        {
            try
            {
                var doc = JsonDocument.Parse(g.Value ?? "{}").RootElement;
                var sys = doc.TryGetProperty("system", out var s) ? s.GetString() ?? "" : "";
                systemCounts[sys] = systemCounts.GetValueOrDefault(sys) + 1;
                totalPlays += doc.TryGetProperty("play_count", out var pc) ? pc.GetInt32() : 0;
            }
            catch { }
        }
        return Ok(new { total_games = games.Count, total_plays = totalPlays, systems = systemCounts, save_states = await _db.Settings.CountAsync(s => s.Key.StartsWith("pretzel_save:")) });
    }

    // ── Scan Directory for ROMs ─────────────────────────────────────
    [HttpPost("scan")]
    public async Task<IActionResult> ScanDirectory([FromBody] JsonElement body)
    {
        var path = body.TryGetProperty("path", out var p) ? p.GetString() : null;
        if (string.IsNullOrEmpty(path) || !Directory.Exists(path))
            return BadRequest(new { success = false, message = "Invalid directory path" });

        var allExtensions = Systems.Values
            .SelectMany(v => ((dynamic)v).extensions as string[] ?? Array.Empty<string>())
            .Distinct().ToHashSet();

        var found = new List<object>();
        foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
        {
            var ext = Path.GetExtension(file).ToLowerInvariant();
            if (!allExtensions.Contains(ext)) continue;

            // Detect system from extension
            string? detectedSystem = null;
            foreach (var (sysId, sysInfo) in Systems)
            {
                var exts = ((dynamic)sysInfo).extensions as string[];
                if (exts != null && exts.Contains(ext)) { detectedSystem = sysId; break; }
            }

            found.Add(new
            {
                file_name = Path.GetFileName(file),
                file_path = file,
                file_size = new FileInfo(file).Length,
                detected_system = detectedSystem,
                title = Path.GetFileNameWithoutExtension(file).Replace("_", " ").Replace("-", " "),
            });
        }

        return Ok(new { success = true, files = found, total = found.Count });
    }

    // ── Bulk Add from Scan ──────────────────────────────────────────
    [HttpPost("scan/import")]
    public async Task<IActionResult> ImportScanned([FromBody] JsonElement body)
    {
        if (!body.TryGetProperty("files", out var filesArr) || filesArr.ValueKind != JsonValueKind.Array)
            return BadRequest(new { success = false, message = "files array required" });

        int added = 0;
        foreach (var file in filesArr.EnumerateArray())
        {
            var title = file.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            var system = file.TryGetProperty("system", out var s) ? s.GetString() ?? "" : "";
            var filePath = file.TryGetProperty("file_path", out var fp) ? fp.GetString() ?? "" : "";
            var fileName = file.TryGetProperty("file_name", out var fn) ? fn.GetString() ?? "" : "";
            var fileSize = file.TryGetProperty("file_size", out var fs) ? fs.GetInt64() : 0;

            if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(system) || !Systems.ContainsKey(system)) continue;

            var id = Guid.NewGuid().ToString("N")[..12];
            var gameData = JsonSerializer.Serialize(new
            {
                title, system, file_name = fileName, file_path = filePath,
                file_size = fileSize, added_at = DateTime.UtcNow.ToString("o"),
                added_by = this.UserId(), play_count = 0, favorite = false,
            });
            _db.Settings.Add(new AppSetting { Key = $"pretzel_game:{id}", UserId = "", Value = gameData });
            added++;
        }
        await _db.SaveChangesAsync();

        return Ok(new { success = true, added, message = $"{added} games imported" });
    }
}

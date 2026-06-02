using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.PixelFormats;
using Image = SixLabors.ImageSharp.Image;
using WatchNexus.Core.Data;

using static WatchNexus.Core.Log;

namespace WatchNexus.Core.Controllers;

/// <summary>
/// GameBot gadget — C# port of Pillow-based image processing for movie/poster games.
/// Handles: poster blurring, progressive reveal, quiz generation.
/// Uses SixLabors.ImageSharp (replaces Pillow).
/// </summary>
// ── Waffle (Movie Quiz) ─────────────────────────────────────
[Route("api/gadgets/gamebot")]
[ApiController]
[Authorize]
public class GameBotController : ControllerBase
{
    private readonly AppDbContext _db;
    private static readonly string CacheDir = Path.Combine(AppContext.BaseDirectory, "cache", "gamebot");

    public GameBotController(AppDbContext db) => _db = db;

    // ── Poster Blur Game ──────────────────────────────────
    [HttpPost("blur-poster")]
    public async Task<IActionResult> BlurPoster([FromBody] JsonElement body)
    {
        var imageUrl = body.TryGetProperty("image_url", out var iu) ? iu.GetString() : null;
        var sigma = body.TryGetProperty("blur_sigma", out var bs) ? bs.GetSingle() : 25f;

        if (string.IsNullOrEmpty(imageUrl)) return BadRequest(new { detail = "image_url required" });

        Directory.CreateDirectory(CacheDir);
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(imageUrl)))[..16].ToLower();
        var outputPath = Path.Combine(CacheDir, $"blur_{hash}_{(int)sigma}.jpg");

        if (System.IO.File.Exists(outputPath))
            return PhysicalFile(outputPath, "image/jpeg");

        try
        {
            var http = this.Http();
            var imageData = await http.GetByteArrayAsync(imageUrl);

            using var image = Image.Load<Rgba32>(imageData);
            image.Mutate(x => x.GaussianBlur(sigma));
            await image.SaveAsJpegAsync(outputPath);

            return PhysicalFile(outputPath, "image/jpeg");
        }
        catch (Exception ex) { Log.Error(ex, "[GameBotController] operation failed"); return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("progressive-reveal")]
    public async Task<IActionResult> ProgressiveReveal([FromBody] JsonElement body)
    {
        var imageUrl = body.TryGetProperty("image_url", out var iu) ? iu.GetString() : null;
        var steps = body.TryGetProperty("steps", out var st) ? st.GetInt32() : 5;

        if (string.IsNullOrEmpty(imageUrl)) return BadRequest(new { detail = "image_url required" });

        Directory.CreateDirectory(CacheDir);
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(imageUrl)))[..16].ToLower();

        var urls = new List<string>();
        try
        {
            var http = this.Http();
            var imageData = await http.GetByteArrayAsync(imageUrl);

            for (int i = 0; i < steps; i++)
            {
                var sigma = (steps - i) * 8f;
                var outputPath = Path.Combine(CacheDir, $"reveal_{hash}_step{i}.jpg");

                if (!System.IO.File.Exists(outputPath))
                {
                    using var image = Image.Load<Rgba32>(imageData);
                    if (sigma > 0.5f) image.Mutate(x => x.GaussianBlur(sigma));
                    await image.SaveAsJpegAsync(outputPath);
                }
                urls.Add($"/api/gadgets/gamebot/cache/{hash}_step{i}");
            }
            // Final unblurred
            var finalPath = Path.Combine(CacheDir, $"reveal_{hash}_final.jpg");
            if (!System.IO.File.Exists(finalPath))
            {
                using var image = Image.Load<Rgba32>(imageData);
                await image.SaveAsJpegAsync(finalPath);
            }
            urls.Add($"/api/gadgets/gamebot/cache/{hash}_final");

            return Ok(new { steps = urls, total = urls.Count });
        }
        catch (Exception ex) { Log.Error(ex, "[GameBotController] Final unblurred"); return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpGet("cache/{filename}")]
    [AllowAnonymous]
    public IActionResult ServeCache(string filename)
    {
        var path = Path.Combine(CacheDir, $"reveal_{filename}.jpg");
        if (!System.IO.File.Exists(path))
        {
            path = Path.Combine(CacheDir, $"blur_{filename}.jpg");
            if (!System.IO.File.Exists(path)) return NotFound();
        }
        return PhysicalFile(path, "image/jpeg");
    }

    // ── Quiz Generation ──────────────────────────────────
    [HttpPost("generate-quiz")]
    public async Task<IActionResult> GenerateQuiz([FromBody] JsonElement body)
    {
        var category = body.TryGetProperty("category", out var cat) ? cat.GetString() ?? "movie" : "movie";
        var count = body.TryGetProperty("count", out var c) ? c.GetInt32() : 5;

        // Get movies from TMDB for quiz material
        var userId = this.UserId();
        var tmdbKey = await _db.Settings.FirstOrDefaultAsync(s => s.UserId == userId && s.Key == "crumbs_tmdb");
        string? apiKey = null;
        if (tmdbKey?.Value != null)
        {
            var doc = JsonDocument.Parse(tmdbKey.Value).RootElement;
            apiKey = doc.TryGetProperty("api_key", out var ak) ? ak.GetString() : null;
        }

        var questions = new List<object>();
        if (!string.IsNullOrEmpty(apiKey))
        {
            try
            {
                var http = this.Http();
                var resp = await http.GetStringAsync(
                    $"https://api.themoviedb.org/3/movie/popular?api_key={apiKey}&page={Random.Shared.Next(1, 5)}");
                var doc = JsonDocument.Parse(resp);
                if (doc.RootElement.TryGetProperty("results", out var results))
                {
                    var movies = results.EnumerateArray().ToList();
                    var selected = movies.OrderBy(_ => Random.Shared.Next()).Take(count);

                    foreach (var movie in selected)
                    {
                        var title = movie.TryGetProperty("title", out var t) ? t.GetString() : "Unknown";
                        var poster = movie.TryGetProperty("poster_path", out var pp) ? pp.GetString() : null;
                        var posterUrl = poster != null ? $"https://image.tmdb.org/t/p/w500{poster}" : null;

                        // Generate wrong answers from other movies
                        var wrongAnswers = movies
                            .Where(m => m.TryGetProperty("title", out var mt) && mt.GetString() != title)
                            .OrderBy(_ => Random.Shared.Next())
                            .Take(3)
                            .Select(m => m.TryGetProperty("title", out var mt) ? mt.GetString() : "Unknown")
                            .ToList();

                        questions.Add(new
                        {
                            type = "poster_guess",
                            image_url = posterUrl,
                            blur_url = posterUrl != null ? $"/api/gadgets/gamebot/blur-poster" : null,
                            correct_answer = title,
                            options = wrongAnswers.Append(title!).OrderBy(_ => Random.Shared.Next()).ToList(),
                            year = movie.TryGetProperty("release_date", out var rd) ? rd.GetString()?[..4] : null,
                        });
                    }
                }
            }
            catch { Log.Error("[GameBotController] operation failed"); }
        }

        if (questions.Count == 0)
        {
            return Ok(new
            {
                questions = Array.Empty<object>(),
                message = "Configure a TMDB API key in API Management to generate movie quizzes"
            });
        }

        return Ok(new { questions, category });
    }

    // ── Image Utilities ──────────────────────────────────
    [HttpPost("resize")]
    public async Task<IActionResult> ResizeImage([FromBody] JsonElement body)
    {
        var imageUrl = body.TryGetProperty("image_url", out var iu) ? iu.GetString() : null;
        var width = body.TryGetProperty("width", out var w) ? w.GetInt32() : 300;
        var height = body.TryGetProperty("height", out var h) ? h.GetInt32() : 0;

        if (string.IsNullOrEmpty(imageUrl)) return BadRequest(new { detail = "image_url required" });

        try
        {
            var http = this.Http();
            var imageData = await http.GetByteArrayAsync(imageUrl);

            using var image = Image.Load<Rgba32>(imageData);
            if (height <= 0) height = (int)(image.Height * ((float)width / image.Width));
            image.Mutate(x => x.Resize(width, height));

            using var ms = new MemoryStream();
            await image.SaveAsJpegAsync(ms);
            return File(ms.ToArray(), "image/jpeg");
        }
        catch (Exception ex) { Log.Error(ex, "[GameBotController] operation failed"); return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("grayscale")]
    public async Task<IActionResult> Grayscale([FromBody] JsonElement body)
    {
        var imageUrl = body.TryGetProperty("image_url", out var iu) ? iu.GetString() : null;
        if (string.IsNullOrEmpty(imageUrl)) return BadRequest(new { detail = "image_url required" });

        try
        {
            var http = this.Http();
            var imageData = await http.GetByteArrayAsync(imageUrl);

            using var image = Image.Load<Rgba32>(imageData);
            image.Mutate(x => x.Grayscale());

            using var ms = new MemoryStream();
            await image.SaveAsJpegAsync(ms);
            return File(ms.ToArray(), "image/jpeg");
        }
        catch (Exception ex) { Log.Error(ex, "[GameBotController] operation failed"); return StatusCode(500, new { detail = ex.Message }); }
    }

    [HttpPost("pixelate")]
    public async Task<IActionResult> Pixelate([FromBody] JsonElement body)
    {
        var imageUrl = body.TryGetProperty("image_url", out var iu) ? iu.GetString() : null;
        var size = body.TryGetProperty("pixel_size", out var ps) ? ps.GetInt32() : 10;
        if (string.IsNullOrEmpty(imageUrl)) return BadRequest(new { detail = "image_url required" });

        try
        {
            var http = this.Http();
            var imageData = await http.GetByteArrayAsync(imageUrl);

            using var image = Image.Load<Rgba32>(imageData);
            image.Mutate(x => x.Pixelate(size));

            using var ms = new MemoryStream();
            await image.SaveAsJpegAsync(ms);
            return File(ms.ToArray(), "image/jpeg");
        }
        catch (Exception ex) { Log.Error(ex, "[GameBotController] operation failed"); return StatusCode(500, new { detail = ex.Message }); }
    }
}

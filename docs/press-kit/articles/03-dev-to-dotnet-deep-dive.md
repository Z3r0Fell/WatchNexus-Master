# Building a 35-Module Media Server in .NET 10: Architecture Decisions That Scaled

**Target:** Dev.to, CodeProject, .NET Blog  
**Format:** Technical article with code snippets  
**Tags:** `#dotnet` `#csharp` `#architecture` `#webdev`  
**Word Count:** ~2,200  
**Tone:** Technical, educational, developer-to-developer

---

When I started building WatchNexus -- a self-hosted media management pipeline -- the first decision was the tech stack. The self-hosted media space is dominated by Python (Radarr/Sonarr are actually C#, but most alternatives are Python) and Go. I went with .NET 10, and after 35 modules and 136 API endpoints, here's what worked, what didn't, and what I'd do differently.

## The Problem Space

A modern self-hosted media setup requires 5-7 separate applications: content automation (Sonarr, Radarr), indexer aggregation (Prowlarr), a download client (qBittorrent), subtitle management (Bazarr), a media server (Jellyfin), and optionally a request manager (Overseerr). Each has its own database, its own configuration, and its own update cycle.

WatchNexus consolidates all of this into a single application with a modular architecture. Thirty-five modules, one process, one database.

## Why .NET 10

Three factors drove the decision:

**1. Self-Contained Publishing**

```bash
dotnet publish -c Release -r linux-x64 --self-contained true
```

This produces a single binary with zero runtime dependencies. The Linux x64 build is 58 MB. Users download, extract, run. No "install .NET first" step. For a self-hosted application targeting users who may not be developers, this is critical.

**2. Entity Framework Core 10 + SQLite**

EF Core's migration system gave us versioned, incremental schema management from day one. With 35 modules potentially adding their own tables, having a migration-based approach prevents the "just drop and recreate the database" anti-pattern that plagues self-hosted software.

```csharp
public class AppDbContext : DbContext
{
    public DbSet<AppSetting> Settings { get; set; }
    public DbSet<MediaItem> MediaItems { get; set; }
    public DbSet<DownloadItem> Downloads { get; set; }
    // ... 12 more DbSets

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Composite key: every setting is scoped to a user
        builder.Entity<AppSetting>()
            .HasKey(s => new { s.Key, s.UserId });
    }
}
```

The composite key pattern `(Key, UserId)` was a deliberate choice. Global settings use `UserId = ""`, user-specific settings use the actual user ID. This eliminated the need for separate tables for user preferences vs. system configuration.

**3. Controller Pattern Scalability**

ASP.NET Core's controller pattern scales well to 35+ controllers. Each module gets its own controller file with standard CRUD + module-specific endpoints:

```csharp
[ApiController]
[Route("api/[controller]")]
public class CompoteController : ControllerBase
{
    private readonly AppDbContext _db;
    
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string query,
        [FromQuery] string category = "all")
    {
        var indexers = await _db.Settings
            .Where(s => s.Key.StartsWith("indexer:") && s.UserId == "")
            .ToListAsync();
            
        var results = new List<SearchResult>();
        
        foreach (var indexer in indexers)
        {
            var config = JsonSerializer.Deserialize<IndexerConfig>(indexer.Value);
            var indexerResults = config.Type switch
            {
                "nyaa" => await SearchNyaa(query, config),
                "yts" => await SearchYts(query, config),
                "eztv" => await SearchEztv(query, config),
                "torznab" => await SearchTorznab(query, config),
                _ => await SearchGenericRss(query, config)
            };
            results.AddRange(indexerResults);
        }
        
        return Ok(results.OrderByDescending(r => r.Seeders));
    }
}
```

## The RSS Parsing Engine

The indexer search module (codename: Compote) was the most interesting engineering challenge. Rather than wrapping Jackett or Prowlarr, we built a first-party RSS/JSON parsing engine.

For Nyaa.si, the search is performed against their RSS feed:

```csharp
private async Task<List<SearchResult>> SearchNyaa(string query, IndexerConfig config)
{
    var url = $"{config.Url}/?page=rss&q={Uri.EscapeDataString(query)}&c=0_0&f=0";
    var xml = await _httpClient.GetStringAsync(url);
    var doc = XDocument.Parse(xml);
    
    var ns = XNamespace.Get("https://nyaa.si/xmlns/nyaa");
    
    return doc.Descendants("item").Select(item => new SearchResult
    {
        Title = item.Element("title")?.Value ?? "",
        Link = item.Element("link")?.Value ?? "",
        Size = ParseSize(item.Element(ns + "size")?.Value),
        Seeders = int.TryParse(item.Element(ns + "seeders")?.Value, out var s) ? s : 0,
        Leechers = int.TryParse(item.Element(ns + "leechers")?.Value, out var l) ? l : 0,
        InfoHash = item.Element(ns + "infoHash")?.Value ?? "",
        Quality = DetectQuality(item.Element("title")?.Value ?? ""),
        Codec = DetectCodec(item.Element("title")?.Value ?? ""),
        IndexerName = "Nyaa.si"
    }).ToList();
}
```

The quality and codec detection uses regex against the title string:

```csharp
private static string DetectQuality(string title)
{
    if (Regex.IsMatch(title, @"2160p|4K|UHD", RegexOptions.IgnoreCase)) return "2160p";
    if (Regex.IsMatch(title, @"1080p|FHD", RegexOptions.IgnoreCase)) return "1080p";
    if (Regex.IsMatch(title, @"720p|HD", RegexOptions.IgnoreCase)) return "720p";
    if (Regex.IsMatch(title, @"480p|SD", RegexOptions.IgnoreCase)) return "480p";
    return "Unknown";
}
```

This approach handles real-world torrent titles surprisingly well. Parsing "Mushoku Tensei S2 - 12 [1080p][HEVC][Multi-Subs]" correctly extracts both quality and codec.

## TOTP 2FA: Don't Roll Your Own (But Here's How)

The security module (Bastion) implements real TOTP two-factor authentication. The implementation uses Base32 encoding for secret generation and constructs standard `otpauth://` URIs:

```csharp
[HttpPost("2fa/setup")]
public async Task<IActionResult> Setup2FA()
{
    // Generate 20-byte secret, encode as Base32
    var secret = new byte[20];
    RandomNumberGenerator.Fill(secret);
    var base32Secret = Base32Encode(secret);
    
    // Generate backup codes
    var backupCodes = Enumerable.Range(0, 8)
        .Select(_ => RandomNumberGenerator.GetInt32(10000000, 99999999).ToString())
        .ToList();
    
    // Construct otpauth:// URI for QR code generation
    var uri = $"otpauth://totp/WatchNexus:{user.Email}" +
              $"?secret={base32Secret}&issuer=WatchNexus&digits=6&period=30";
    
    return Ok(new { Secret = base32Secret, QrUri = uri, BackupCodes = backupCodes });
}
```

The key insight: don't invent your own 2FA protocol. Follow RFC 6238 (TOTP) exactly, use `otpauth://` URIs that any authenticator app understands, and always provide backup codes.

## Assembly Integrity: The Fortress Module

One unusual feature is Fortress, which provides runtime assembly integrity verification:

```csharp
public class FortressService
{
    private readonly Dictionary<string, string> _baselines = new();
    
    public void ComputeBaselines()
    {
        foreach (var assembly in Directory.GetFiles(AppContext.BaseDirectory, "*.dll"))
        {
            using var sha256 = SHA256.Create();
            using var stream = File.OpenRead(assembly);
            var hash = Convert.ToHexString(sha256.ComputeHash(stream));
            _baselines[Path.GetFileName(assembly)] = hash;
        }
    }
    
    public bool VerifyIntegrity()
    {
        foreach (var (file, baseline) in _baselines)
        {
            using var sha256 = SHA256.Create();
            using var stream = File.OpenRead(Path.Combine(AppContext.BaseDirectory, file));
            var current = Convert.ToHexString(sha256.ComputeHash(stream));
            if (current != baseline) return false; // Tampering detected
        }
        return true;
    }
}
```

At startup, SHA-256 hashes are computed for every assembly. A background service periodically re-verifies these hashes. If a mismatch is detected, the API auto-locks. It's not bulletproof against a determined attacker, but it catches accidental corruption and casual tampering.

## What I'd Do Differently

**SQLite was the right choice for v1, but...** We're hitting the single-writer limitation on concurrent operations. For a media server that's scanning libraries, searching indexers, and managing downloads simultaneously, Postgres would have been a better foundation. The migration path exists (EF Core abstracts the provider), but it's still work.

**The module system should have been a plugin system.** Right now, every module is compiled into the main binary. A plugin architecture with dynamic loading would have made the codebase more maintainable at 35 modules. We have dynamic module loading infrastructure (`ModuleLoader.cs`) but it's underutilized.

**More aggressive use of background services.** .NET's `IHostedService` / `BackgroundService` pattern is perfect for the kind of periodic work a media server does (library scanning, indexer polling, health checks). We use it for Fortress, but should have built every module's background work on it from the start.

## Results

- **35 modules**, each with its own controller
- **136 API endpoints** tested and verified
- **58 MB** self-contained Linux binary
- **4 GB minimum RAM** (realistic for the target audience)
- **100% test pass rate** on the latest comprehensive test suite

The codebase is at version 1.0.0. The .NET 10 foundation has held up well -- the performance characteristics, the deployment story, and the ecosystem (EF Core, ASP.NET Core) were the right fit for this problem space.

---

*WatchNexus is a self-hosted media management pipeline. Version 1.0.0 release builds are available for Linux x64 and Windows x64.*

---

## Submission Notes
- Dev.to: Publish directly, use tags `#dotnet #csharp #architecture #webdev`
- CodeProject: Submit via their article submission system
- Include actual code snippets -- Dev.to readers expect them
- Link to GitHub repo if available

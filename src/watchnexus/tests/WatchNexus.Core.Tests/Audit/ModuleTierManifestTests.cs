using System.Text.Json;
using WatchNexus.Core.Controllers;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

/// <summary>
/// FortressFilter gates /api/{segment} by the tier of whichever module.json claims that
/// segment (api_route_prefix or an exact api_routes entry). The integration test host does
/// not load manifests, so a wrong manifest silently locked core Standard APIs
/// (/api/settings, /api/media, /api/logs) behind Pro in real installs. Guard against that here.
/// </summary>
public class ModuleTierManifestTests
{
    // Core API segments every tier (including an unlicensed Standard install) must reach.
    private static readonly string[] CoreSegments =
    {
        "settings", "media", "logs", "libraries", "marmalade", "user", "users", "auth",
        "system", "cellar", "watchlist", "watch-progress", "downloads", "quality-profiles", "zest",
    };

    private static string ModulesDir()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "watchnexus", "modules");
            if (Directory.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("src/watchnexus/modules not found above test bin");
    }

    private static IEnumerable<(string File, string Tier, string Segment)> ClaimedSegments()
    {
        foreach (var file in Directory.GetFiles(ModulesDir(), "module.json", SearchOption.AllDirectories))
        {
            if (file.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}") ||
                file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")) continue;
            using var doc = JsonDocument.Parse(File.ReadAllText(file));
            var root = doc.RootElement;
            var tier = root.TryGetProperty("tier", out var t) ? t.GetString() ?? "standard" : "standard";
            if (root.TryGetProperty("api_route_prefix", out var p) && p.GetString() is { Length: > 0 } prefix)
                yield return (file, tier, prefix.Trim('/').ToLowerInvariant());
            if (root.TryGetProperty("api_routes", out var routes) && routes.ValueKind == JsonValueKind.Array)
            {
                foreach (var r in routes.EnumerateArray())
                {
                    // Fortress looks up exactly "api/{segment}", so only two-segment routes gate a whole prefix.
                    var parts = (r.GetString() ?? "").Trim('/').ToLowerInvariant().Split('/');
                    if (parts.Length == 2 && parts[0] == "api") yield return (file, tier, parts[1]);
                }
            }
        }
    }

    [Fact]
    public void NoPaidManifest_ClaimsACoreOrStandardApiSegment()
    {
        var standard = new HashSet<string>(CellarController.TierModules["standard"].Concat(CoreSegments));
        var offenders = ClaimedSegments()
            .Where(c => c.Tier != "standard" && standard.Contains(c.Segment))
            .Select(c => $"{Path.GetFileName(Path.GetDirectoryName(c.File))}: /api/{c.Segment} -> {c.Tier}")
            .ToList();
        Assert.True(offenders.Count == 0, "Paid module manifests gate Standard APIs: " + string.Join("; ", offenders));
    }
}

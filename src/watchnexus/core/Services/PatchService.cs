using System.Security.Cryptography;
using System.Text.Json;

namespace WatchNexus.Core.Services;

// ══════════════════════════════════════════════════════════════════════
// PATCH SERVICE — Real hot-patching from the private patch repo.
//
//   • Frontend/config files ("target": "web" / "data") are applied LIVE —
//     the running server keeps serving; browsers pick changes up on the
//     next page load. No restart, no interruption.
//   • Binary files ("target": "app" — .dll/.exe/.so) are STAGED into
//     <baseDir>/pending-update/ and swapped in at the next boot by
//     ApplyPendingUpdates(). Restart only when the fix is to the binary.
//
// Every file must carry a sha256 in the manifest; anything that fails
// verification aborts the whole patch. Originals are backed up to
// <baseDir>/patch-backups/<patch_id>/ before being overwritten.
// ══════════════════════════════════════════════════════════════════════

public record PatchFileEntry(string Path, string Target, string? Url, string? Sha256);

public record PatchManifest(
    string PatchId, string Description, string Severity, bool Silent,
    List<PatchFileEntry> Files);

public record PatchApplyResult(
    bool Success, string PatchId, List<string> AppliedLive, List<string> StagedForRestart,
    bool RestartRequired, string? Error);

public class PatchService
{
    public const string PendingDirName = "pending-update";
    public const string BackupDirName = "patch-backups";

    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;

    // Set from Program.cs once the SPA root is resolved.
    public static string? WebRoot { get; set; }

    public PatchService(IHttpClientFactory httpFactory, IConfiguration config)
    {
        _httpFactory = httpFactory;
        _config = config;
    }

    private string RepoUrl => (_config["PATCH_REPO_URL"] ?? "").TrimEnd('/');
    private string RepoToken => _config["PATCH_REPO_TOKEN"] ?? "";

    public bool IsConfigured => !string.IsNullOrEmpty(RepoUrl);

    private HttpClient CreateClient()
    {
        var http = _httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(30);
        http.DefaultRequestHeaders.Add("User-Agent", "WatchNexus-Updater");
        if (!string.IsNullOrEmpty(RepoToken))
            http.DefaultRequestHeaders.Add("Authorization", $"token {RepoToken}");
        return http;
    }

    // ── Manifest ─────────────────────────────────────────────────────
    public async Task<PatchManifest?> FetchManifestAsync(string version)
    {
        if (!IsConfigured) return null;
        using var http = CreateClient();
        var resp = await http.GetAsync($"{RepoUrl}/contents/Patches/{version}.json");
        if (!resp.IsSuccessStatusCode) return null;
        var ghFile = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;
        if (!ghFile.TryGetProperty("content", out var content)) return null;
        var decoded = System.Text.Encoding.UTF8.GetString(
            Convert.FromBase64String(content.GetString()?.Replace("\n", "") ?? ""));
        return ParseManifest(decoded);
    }

    public static PatchManifest? ParseManifest(string json)
    {
        try
        {
            var d = JsonDocument.Parse(json).RootElement;
            var files = new List<PatchFileEntry>();
            if (d.TryGetProperty("files", out var fs) && fs.ValueKind == JsonValueKind.Array)
            {
                foreach (var f in fs.EnumerateArray())
                {
                    files.Add(new PatchFileEntry(
                        f.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "",
                        f.TryGetProperty("target", out var t) ? t.GetString() ?? "web" : "web",
                        f.TryGetProperty("url", out var u) ? u.GetString() : null,
                        f.TryGetProperty("sha256", out var s) ? s.GetString() : null));
                }
            }
            return new PatchManifest(
                d.TryGetProperty("patch_id", out var pid) ? pid.GetString() ?? "" : "",
                d.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : "",
                d.TryGetProperty("severity", out var sev) ? sev.GetString() ?? "low" : "low",
                d.TryGetProperty("silent", out var sil) && sil.GetBoolean(),
                files);
        }
        catch { return null; }
    }

    // ── Apply ────────────────────────────────────────────────────────
    public async Task<PatchApplyResult> ApplyAsync(PatchManifest manifest)
    {
        var appliedLive = new List<string>();
        var staged = new List<string>();

        if (string.IsNullOrEmpty(manifest.PatchId) || manifest.Files.Count == 0)
            return new PatchApplyResult(false, manifest.PatchId, appliedLive, staged, false, "Manifest has no patch_id or no files");

        // Phase 1: download + verify EVERYTHING before touching disk.
        var payloads = new List<(PatchFileEntry entry, byte[] data, string destFull, bool isBinary)>();
        foreach (var f in manifest.Files)
        {
            if (string.IsNullOrEmpty(f.Sha256))
                return Fail($"File '{f.Path}' has no sha256 — refusing unverifiable patch");

            var (root, isBinary) = ResolveTargetRoot(f);
            if (root == null)
                return Fail($"File '{f.Path}': target '{f.Target}' unavailable (web root not resolved?)");

            var destFull = SafeResolve(root, f.Path);
            if (destFull == null)
                return Fail($"File '{f.Path}' escapes its target root — rejected");

            byte[]? data = await DownloadFileAsync(manifest.PatchId, f);
            if (data == null)
                return Fail($"File '{f.Path}': download failed");
            if (!VerifySha256(data, f.Sha256))
                return Fail($"File '{f.Path}': sha256 mismatch — rejected");

            payloads.Add((f, data, destFull, isBinary));
        }

        // Phase 2: backup + write.
        var backupDir = Path.Combine(AppContext.BaseDirectory, BackupDirName, manifest.PatchId);
        foreach (var (entry, data, destFull, isBinary) in payloads)
        {
            if (isBinary)
            {
                // Stage — swapped in at next boot by ApplyPendingUpdates().
                var stagePath = Path.Combine(AppContext.BaseDirectory, PendingDirName, entry.Path);
                Directory.CreateDirectory(Path.GetDirectoryName(stagePath)!);
                await File.WriteAllBytesAsync(stagePath, data);
                staged.Add(entry.Path);
            }
            else
            {
                if (File.Exists(destFull))
                {
                    var bak = Path.Combine(backupDir, entry.Target, entry.Path);
                    Directory.CreateDirectory(Path.GetDirectoryName(bak)!);
                    File.Copy(destFull, bak, overwrite: true);
                }
                Directory.CreateDirectory(Path.GetDirectoryName(destFull)!);
                // Atomic-ish: write temp then move into place so the running
                // server never serves a half-written file.
                var tmp = destFull + ".patch-tmp";
                await File.WriteAllBytesAsync(tmp, data);
                File.Move(tmp, destFull, overwrite: true);
                appliedLive.Add(entry.Path);
            }
        }

        return new PatchApplyResult(true, manifest.PatchId, appliedLive, staged, staged.Count > 0, null);

        PatchApplyResult Fail(string msg) =>
            new(false, manifest.PatchId, appliedLive, staged, false, msg);
    }

    private (string? root, bool isBinary) ResolveTargetRoot(PatchFileEntry f)
    {
        var ext = Path.GetExtension(f.Path).ToLowerInvariant();
        var binaryExt = ext is ".dll" or ".exe" or ".so" or ".dylib";
        return f.Target.ToLowerInvariant() switch
        {
            "web" => (WebRoot, false),
            "app" => (AppContext.BaseDirectory, true),          // binaries → staged
            "data" => (AppContext.BaseDirectory, binaryExt),    // config/assets next to binary
            _ => (null, false),
        };
    }

    private async Task<byte[]?> DownloadFileAsync(string patchId, PatchFileEntry f)
    {
        try
        {
            using var http = CreateClient();
            if (!string.IsNullOrEmpty(f.Url))
                return await http.GetByteArrayAsync(f.Url);

            // Default layout: Patches/files/<patch_id>/<path> via GitHub contents API
            var resp = await http.GetAsync($"{RepoUrl}/contents/Patches/files/{patchId}/{f.Path}");
            if (!resp.IsSuccessStatusCode) return null;
            var ghFile = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;
            if (!ghFile.TryGetProperty("content", out var content)) return null;
            return Convert.FromBase64String(content.GetString()?.Replace("\n", "") ?? "");
        }
        catch { return null; }
    }

    // ── Pure helpers (unit-tested) ───────────────────────────────────
    public static string? SafeResolve(string root, string relPath)
    {
        if (string.IsNullOrWhiteSpace(relPath) || Path.IsPathRooted(relPath)) return null;
        if (relPath.Contains("..")) return null;
        var rootFull = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var full = Path.GetFullPath(Path.Combine(rootFull, relPath));
        return full.StartsWith(rootFull + Path.DirectorySeparatorChar, StringComparison.Ordinal) ? full : null;
    }

    public static bool VerifySha256(byte[] data, string? expectedHex)
    {
        if (string.IsNullOrWhiteSpace(expectedHex)) return false;
        var actual = Convert.ToHexString(SHA256.HashData(data));
        return string.Equals(actual, expectedHex.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    // ── Boot hook: swap staged binaries into place before the host starts ──
    public static int ApplyPendingUpdates(Action<string>? log = null)
    {
        var pendingDir = Path.Combine(AppContext.BaseDirectory, PendingDirName);
        if (!Directory.Exists(pendingDir)) return 0;

        var applied = 0;
        foreach (var staged in Directory.GetFiles(pendingDir, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(pendingDir, staged);
            var dest = SafeResolve(AppContext.BaseDirectory, rel);
            if (dest == null) { log?.Invoke($"[Updater] Skipping unsafe staged path: {rel}"); continue; }
            try
            {
                if (File.Exists(dest))
                {
                    var bak = Path.Combine(AppContext.BaseDirectory, BackupDirName, "pre-boot", rel);
                    Directory.CreateDirectory(Path.GetDirectoryName(bak)!);
                    File.Copy(dest, bak, overwrite: true);
                }
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                File.Move(staged, dest, overwrite: true);
                applied++;
                log?.Invoke($"[Updater] Applied staged update: {rel}");
            }
            catch (Exception ex)
            {
                log?.Invoke($"[Updater] FAILED to apply staged update {rel}: {ex.Message}");
            }
        }
        try { Directory.Delete(pendingDir, recursive: true); } catch { }
        return applied;
    }
}

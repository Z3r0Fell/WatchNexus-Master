using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WatchNexus.Core.Controllers;

// ── Pantry (Filesystem) ─────────────────────────────────────
[Route("api/filesystem")]
[ApiController]
[Authorize]
public class FilesystemController : ControllerBase
{
    private static readonly HashSet<string> MediaExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".webm",
        ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma",
        ".ts", ".m2ts", ".vob", ".iso", ".srt", ".sub", ".ass"
    };

    [HttpGet("browse")]
    public IActionResult Browse([FromQuery] string path = "")
    {
        var osType = GetOsType();
        var pathSep = osType == "windows" ? "\\" : "/";
        var homeDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (string.IsNullOrEmpty(homeDir)) homeDir = Environment.GetEnvironmentVariable("HOME") ?? "/";

        // Normalize path
        if (string.IsNullOrWhiteSpace(path))
            path = homeDir;

        if (osType == "windows")
            path = path.Replace("/", "\\");

        // Resolve the path
        string currentPath;
        try
        {
            currentPath = Path.GetFullPath(path);
        }
        catch
        {
            return BadRequest(new { detail = $"Invalid path: {path}" });
        }

        if (!Directory.Exists(currentPath))
            return BadRequest(new { detail = $"Path does not exist: {currentPath}" });

        var items = new List<object>();
        var drives = BuildDriveList(osType, homeDir);
        string? parentPath = null;
        var isRoot = false;
        var mediaCount = 0;

        // Parent path
        var parentDir = Directory.GetParent(currentPath);
        if (parentDir != null)
            parentPath = parentDir.FullName;
        else
            isRoot = true;

        // List directory contents
        try
        {
            var entries = new DirectoryInfo(currentPath).GetFileSystemInfos();

            // Sort: directories first, then name case-insensitive
            var sorted = entries
                .Where(e => !e.Name.StartsWith('.'))
                .Where(e => !IsHidden(e, osType))
                .OrderBy(e => e is FileInfo)
                .ThenBy(e => e.Name, StringComparer.OrdinalIgnoreCase);

            foreach (var entry in sorted)
            {
                try
                {
                    if (entry is DirectoryInfo dir)
                    {
                        var childCount = 0;
                        var permDenied = false;
                        try
                        {
                            var count = 0;
                            foreach (var _ in dir.EnumerateFileSystemInfos())
                            {
                                count++;
                                if (count >= 999) break;
                            }
                            childCount = count;
                        }
                        catch (UnauthorizedAccessException) { permDenied = true; }
                        catch (Exception) { childCount = 0; }

                        items.Add(new
                        {
                            name = dir.Name,
                            path = dir.FullName,
                            type = "directory",
                            is_parent = false,
                            item_count = childCount,
                            permission_denied = permDenied
                        });
                    }
                    else if (entry is FileInfo file)
                    {
                        if (MediaExtensions.Contains(file.Extension))
                            mediaCount++;
                    }
                }
                catch { /* skip entries we can't access */ }
            }
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(403, new { detail = $"Permission denied: {currentPath}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = $"Error reading directory: {ex.Message}" });
        }

        return Ok(new
        {
            current_path = currentPath,
            items,
            drives,
            parent_path = parentPath,
            is_root = isRoot,
            os_type = osType,
            path_separator = pathSep,
            home_directory = homeDir,
            media_files_in_current = mediaCount
        });
    }

    private static string GetOsType()
    {
        if (OperatingSystem.IsWindows()) return "windows";
        if (OperatingSystem.IsMacOS()) return "darwin";
        return "linux";
    }

    private static bool IsHidden(FileSystemInfo entry, string osType)
    {
        if (osType == "windows")
            return entry.Attributes.HasFlag(FileAttributes.Hidden);
        return false; // dot-prefix already filtered
    }

    private static List<object> BuildDriveList(string osType, string homeDir)
    {
        var drives = new List<object>();

        if (osType == "linux")
        {
            drives.Add(new { name = "Root", path = "/" });
            drives.Add(new { name = "Home", path = homeDir });
            foreach (var (n, p) in new[] { ("Desktop", "Desktop"), ("Documents", "Documents"), ("Downloads", "Downloads"), ("Videos", "Videos") })
            {
                var full = Path.Combine(homeDir, p);
                if (Directory.Exists(full)) drives.Add(new { name = n, path = full });
            }
            foreach (var (n, p) in new[] { ("Media", "/media"), ("Mounts", "/mnt"), ("Tmp", "/tmp"), ("Srv", "/srv") })
            {
                if (Directory.Exists(p)) drives.Add(new { name = n, path = p });
            }
            // Docker container: media folders are typically bind-mounted here.
            // Surfaces them as a top-level "Container Media" drive so users can
            // pick the correct in-container path instead of a host path that
            // doesn't exist inside the container.
            var mediaRoots = new List<string>();
            var envRoots = Environment.GetEnvironmentVariable("MEDIA_ROOT")
                           ?? Environment.GetEnvironmentVariable("MEDIA_ROOTS");
            if (!string.IsNullOrWhiteSpace(envRoots))
            {
                foreach (var r in envRoots.Split(','))
                {
                    var t = r.Trim();
                    if (!string.IsNullOrEmpty(t)) mediaRoots.Add(t);
                }
            }
            else
            {
                // Default compose mounts: /data/media (+ optional extras).
                mediaRoots.Add("/data/media");
                mediaRoots.Add("/data/rips");
                mediaRoots.Add("/data/transcoded");
                mediaRoots.Add("/data/offline");
            }
            var mediaDriveAdded = false;
            foreach (var root in mediaRoots)
            {
                if (Directory.Exists(root))
                {
                    drives.Add(new { name = mediaDriveAdded ? System.IO.Path.GetFileName(root.TrimEnd('/')) : "Container Media", path = root });
                    mediaDriveAdded = true;
                }
            }
        }
        else if (osType == "darwin")
        {
            drives.Add(new { name = "Root", path = "/" });
            drives.Add(new { name = "Home", path = homeDir });
            foreach (var (n, p) in new[] { ("Desktop", "Desktop"), ("Documents", "Documents"), ("Downloads", "Downloads"), ("Movies", "Movies"), ("Music", "Music") })
            {
                var full = Path.Combine(homeDir, p);
                if (Directory.Exists(full)) drives.Add(new { name = n, path = full });
            }
            if (Directory.Exists("/Volumes"))
            {
                drives.Add(new { name = "Volumes", path = "/Volumes" });
                try
                {
                    foreach (var vol in new DirectoryInfo("/Volumes").GetDirectories())
                    {
                        if (vol.Name != "Macintosh HD")
                            drives.Add(new { name = vol.Name, path = vol.FullName });
                    }
                }
                catch { }
            }
        }
        else // Windows
        {
            foreach (var d in DriveInfo.GetDrives().Where(d => d.IsReady))
            {
                drives.Add(new { name = d.Name.TrimEnd('\\'), path = d.RootDirectory.FullName });
            }
            foreach (var (n, p) in new[] { ("Desktop", "Desktop"), ("Documents", "Documents"), ("Downloads", "Downloads"), ("Videos", "Videos") })
            {
                var full = Path.Combine(homeDir, p);
                try { if (Directory.Exists(full)) drives.Add(new { name = n, path = full }); } catch { }
            }
        }

        return drives;
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FilesystemController : ControllerBase
{
    private readonly IFileBrowserService _fileBrowser;
    private readonly ILogger<FilesystemController> _logger;

    public FilesystemController(IFileBrowserService fileBrowser, ILogger<FilesystemController> logger)
    {
        _fileBrowser = fileBrowser;
        _logger = logger;
    }

    [HttpGet("browse")]
    [Authorize]
    public async Task<IActionResult> Browse([FromQuery] string? path, CancellationToken ct)
    {
        try
        {
            var result = await _fileBrowser.BrowseAsync(path ?? "/", ct);
            return Ok(new
            {
                current_path = result.CurrentPath,
                parent_path = result.ParentPath,
                is_root = result.IsRoot,
                os_type = result.OsType,
                items = result.Items.Select(i => new
                {
                    name = i.Name,
                    path = i.Path,
                    type = i.IsDirectory ? "directory" : "file",
                    size = i.Size,
                    item_count = i.ItemCount,
                    permission_denied = i.PermissionDenied,
                    is_symlink = i.IsSymlink
                }),
                drives = result.Drives.Select(d => new
                {
                    name = d.Name,
                    path = d.Path,
                    total_size = d.TotalSize,
                    free_space = d.FreeSpace
                })
            });
        }
        catch (DirectoryNotFoundException)
        {
            return NotFound(new { detail = "Directory not found" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { detail = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error browsing path: {Path}", path);
            return StatusCode(500, new { detail = "An error occurred" });
        }
    }

    [HttpGet("drives")]
    [Authorize]
    public async Task<IActionResult> GetDrives(CancellationToken ct)
    {
        var drives = await _fileBrowser.GetDrivesAsync(ct);
        return Ok(drives.Select(d => new
        {
            name = d.Name,
            path = d.Path,
            total_size = d.TotalSize,
            free_space = d.FreeSpace
        }));
    }

    [HttpGet("exists")]
    [Authorize]
    public IActionResult PathExists([FromQuery] string path)
    {
        return Ok(new { exists = _fileBrowser.PathExists(path) });
    }
}

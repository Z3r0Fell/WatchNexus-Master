using System.Runtime.InteropServices;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.Infrastructure.Services;

/// <summary>
/// File browser service - cross-platform file system navigation
/// </summary>
public class FileBrowserService : IFileBrowserService
{
    public async Task<BrowseResult> BrowseAsync(string path, CancellationToken ct = default)
    {
        var osType = GetOsType();
        
        // Normalize and validate path
        if (string.IsNullOrWhiteSpace(path))
            path = GetDefaultPath();
        
        path = Path.GetFullPath(path);
        
        if (!Directory.Exists(path))
            throw new DirectoryNotFoundException($"Directory not found: {path}");

        var isRoot = IsRootPath(path);
        var parentPath = isRoot ? null : Path.GetDirectoryName(path);
        
        var items = new List<BrowseItem>();
        
        try
        {
            // Get directories
            foreach (var dir in Directory.EnumerateDirectories(path))
            {
                try
                {
                    var dirInfo = new DirectoryInfo(dir);
                    var itemCount = 0;
                    var permissionDenied = false;
                    
                    try
                    {
                        itemCount = Directory.EnumerateFileSystemEntries(dir).Take(1000).Count();
                    }
                    catch (UnauthorizedAccessException)
                    {
                        permissionDenied = true;
                    }
                    
                    items.Add(new BrowseItem(
                        Name: dirInfo.Name,
                        Path: dir,
                        IsDirectory: true,
                        Size: 0,
                        ItemCount: itemCount,
                        PermissionDenied: permissionDenied,
                        IsSymlink: dirInfo.Attributes.HasFlag(FileAttributes.ReparsePoint)
                    ));
                }
                catch (UnauthorizedAccessException)
                {
                    items.Add(new BrowseItem(
                        Name: Path.GetFileName(dir),
                        Path: dir,
                        IsDirectory: true,
                        Size: 0,
                        ItemCount: 0,
                        PermissionDenied: true,
                        IsSymlink: false
                    ));
                }
            }
            
            // Get files
            foreach (var file in Directory.EnumerateFiles(path))
            {
                try
                {
                    var fileInfo = new FileInfo(file);
                    items.Add(new BrowseItem(
                        Name: fileInfo.Name,
                        Path: file,
                        IsDirectory: false,
                        Size: fileInfo.Length,
                        ItemCount: 0,
                        PermissionDenied: false,
                        IsSymlink: fileInfo.Attributes.HasFlag(FileAttributes.ReparsePoint)
                    ));
                }
                catch (UnauthorizedAccessException)
                {
                    items.Add(new BrowseItem(
                        Name: Path.GetFileName(file),
                        Path: file,
                        IsDirectory: false,
                        Size: 0,
                        ItemCount: 0,
                        PermissionDenied: true,
                        IsSymlink: false
                    ));
                }
            }
        }
        catch (UnauthorizedAccessException)
        {
            throw new UnauthorizedAccessException($"Access denied to directory: {path}");
        }
        
        // Sort: directories first, then by name
        items = items
            .OrderByDescending(i => i.IsDirectory)
            .ThenBy(i => i.Name)
            .ToList();
        
        var drives = await GetDrivesAsync(ct);
        
        return new BrowseResult(
            CurrentPath: path,
            ParentPath: parentPath,
            IsRoot: isRoot,
            OsType: osType,
            Items: items,
            Drives: drives
        );
    }

    public Task<IEnumerable<Domain.Interfaces.DriveInfo>> GetDrivesAsync(CancellationToken ct = default)
    {
        var drives = new List<Domain.Interfaces.DriveInfo>();
        
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            foreach (var drive in System.IO.DriveInfo.GetDrives())
            {
                if (drive.IsReady)
                {
                    drives.Add(new Domain.Interfaces.DriveInfo(
                        Name: drive.Name.TrimEnd('\\'),
                        Path: drive.RootDirectory.FullName,
                        TotalSize: drive.TotalSize,
                        FreeSpace: drive.AvailableFreeSpace
                    ));
                }
            }
        }
        else
        {
            // Linux/macOS common directories
            var commonPaths = new[]
            {
                ("/", "Root"),
                (Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Home"),
                ("/media", "Media"),
                ("/mnt", "Mount"),
                ("/srv", "Server"),
                ("/data", "Data")
            };
            
            foreach (var (path, name) in commonPaths)
            {
                if (Directory.Exists(path))
                {
                    try
                    {
                        var driveInfo = new System.IO.DriveInfo(path);
                        drives.Add(new Domain.Interfaces.DriveInfo(
                            Name: name,
                            Path: path,
                            TotalSize: driveInfo.TotalSize,
                            FreeSpace: driveInfo.AvailableFreeSpace
                        ));
                    }
                    catch
                    {
                        drives.Add(new Domain.Interfaces.DriveInfo(
                            Name: name,
                            Path: path,
                            TotalSize: 0,
                            FreeSpace: 0
                        ));
                    }
                }
            }
        }
        
        return Task.FromResult<IEnumerable<Domain.Interfaces.DriveInfo>>(drives);
    }

    public bool PathExists(string path) => 
        Directory.Exists(path) || File.Exists(path);

    public bool IsDirectory(string path) => 
        Directory.Exists(path);

    private static string GetOsType()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return "Windows";
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            return "macOS";
        return "Linux";
    }

    private static string GetDefaultPath()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return "/";
    }

    private static bool IsRootPath(string path)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return Path.GetPathRoot(path) == path;
        return path == "/";
    }
}

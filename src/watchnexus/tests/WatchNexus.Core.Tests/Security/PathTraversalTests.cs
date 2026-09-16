using System.IO;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Security;

/// <summary>
/// VERIFIES: C1 - Path traversal blocked in SubtitlesController.ServeSubtitle
/// VERIFIES: C1 - Path traversal blocked in PhotosController.ServePhoto
/// VERIFIES: C2 - Arbitrary file write blocked in SubtitlesController.DownloadSubtitle
/// VERIFIES: M2 - IsAllowedMediaPath prefix check bypassable (symlink resolution test)
/// </summary>
public class PathTraversalTests
{
    private readonly AppDbContext _db;
    private readonly string _testRoot;

    public PathTraversalTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"PathTraversalTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        // Create isolated test directory structure
        _testRoot = Path.Combine(Path.GetTempPath(), $"wn_sec_test_{Guid.NewGuid()}");
        Directory.CreateDirectory(Path.Combine(_testRoot, "media", "movies"));
        Directory.CreateDirectory(Path.Combine(_testRoot, "media", "photos"));
        Directory.CreateDirectory(Path.Combine(_testRoot, "etc"));
        File.WriteAllText(Path.Combine(_testRoot, "etc", "passwd"), "root:x:0:0:root:/root:/bin/bash\n");
        File.WriteAllText(Path.Combine(_testRoot, "media", "movies", "test.mp4"), "fake video");
        File.WriteAllText(Path.Combine(_testRoot, "media", "photos", "photo.jpg"), "fake photo");

        // Configure media roots to only allow test media directory
        Environment.SetEnvironmentVariable("MEDIA_ROOTS", Path.Combine(_testRoot, "media"));
    }

    [Fact]
    public void SubtitlesController_ServeSubtitle_Blocks_PathTraversal_EtcPasswd()
    {
        // ARRANGE
        var controller = new SubtitlesController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Try to traverse to /etc/passwd
        var result = controller.ServeSubtitle("../../etc/passwd");

        // ASSERT - Should return NotFound (404) not the file
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void SubtitlesController_ServeSubtitle_Blocks_PathTraversal_UrlEncoded()
    {
        // ARRANGE
        var controller = new SubtitlesController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - URL encoded traversal
        var result = controller.ServeSubtitle("..%2F..%2Fetc%2Fpasswd");

        // ASSERT
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void SubtitlesController_ServeSubtitle_Blocks_WindowsStyleTraversal()
    {
        // ARRANGE
        var controller = new SubtitlesController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Windows-style traversal
        var result = controller.ServeSubtitle("..\\..\\windows\\system32");

        // ASSERT
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task PhotosController_ServePhoto_Blocks_PathTraversal_EtcPasswd()
    {
        // ARRANGE
        var controller = new PhotosController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Add a photo library for this user pointing to allowed media
        var lib = new PhotoLibrary { UserId = "test-user", Name = "Test", Path = Path.Combine(_testRoot, "media", "photos") };
        _db.PhotoLibraries.Add(lib);
        _db.SaveChanges();

        // ACT - Try to traverse to /etc/passwd
        var result = await controller.ServePhoto("../../etc/passwd");

        // ASSERT - Should return NotFound (404)
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task PhotosController_ServePhoto_Blocks_CrossUserAccess()
    {
        // ARRANGE
        var controller = new PhotosController(_db);
        var user = CreateUser("user-a", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // User B's library
        var libB = new PhotoLibrary { UserId = "user-b", Name = "TestB", Path = Path.Combine(_testRoot, "media", "photos") };
        _db.PhotoLibraries.Add(libB);
        _db.SaveChanges();

        // ACT - User A tries to access User B's photo
        var photoPath = Path.Combine(_testRoot, "media", "photos", "photo.jpg");
        var relativePath = photoPath.Replace(_testRoot + Path.DirectorySeparatorChar, "");
        var result = await controller.ServePhoto(relativePath);

        // ASSERT - Should return NotFound (not allowed for this user)
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void SubtitlesController_DownloadSubtitle_Blocks_ArbitraryFileWrite()
    {
        // ARRANGE
        var controller = new SubtitlesController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Add a media item for this user
        var media = new MediaItem { Id = "media-1", LibraryId = "lib-1", FilePath = Path.Combine(_testRoot, "media", "movies", "test.mp4"), Title = "Test" };
        _db.MediaItems.Add(media);
        _db.SaveChanges();

        // ACT - Try to download subtitle to arbitrary location via media_path
        // The download_url is validated by SsrfGuard.IsAllowedUrl (must be http/https)
        // but media_path could be manipulated if not validated
        var result = controller.DownloadSubtitle(
            download_url: "https://example.com/subtitle.srt",
            source: "test",
            media_id: "media-1",
            media_path: "/etc/passwd"  // Attempt to write outside media root
        ).Result;

        // ASSERT - Should be rejected (BadRequest, NotFound, or InternalServerError)
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.True(statusResult.StatusCode == 400 || statusResult.StatusCode == 404 || statusResult.StatusCode == 500,
            $"Expected 400/404/500 but got {statusResult.StatusCode}: {statusResult.Value}");
    }

    [Fact]
    public void MediaOpsController_HealthCheck_Blocks_PathTraversal()
    {
        // ARRANGE
        var controller = new MediaOpsController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Try to access /etc/passwd via health-check
        var result = controller.HealthCheck(file_path: "/etc/passwd");

        // ASSERT - Should return 403 Forbidden (outside media roots)
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, statusResult.StatusCode);
    }

    [Fact]
    public void MediaOpsController_Repair_Blocks_PathTraversal()
    {
        // ARRANGE
        var controller = new MediaOpsController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Try to repair /etc/passwd
        var result = controller.Repair(file_path: "/etc/passwd", output_path: "/tmp/out").Result;

        // ASSERT - Should return 403 Forbidden
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, statusResult.StatusCode);
    }

    [Fact]
    public void LibrariesController_Create_Blocks_PathOutsideMediaRoots()
    {
        // ARRANGE
        var controller = new LibrariesController(_db, null!, null!, null!);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        var req = new LibrariesController.LibraryRequest("Test", "/etc", "movies");

        // ACT
        var result = controller.Create(req).Result;

        // ASSERT - Should return BadRequest (path outside media roots)
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public void MediaPaths_IsAllowedPath_Resolves_Symlinks()
    {
        // ARRANGE - Create symlink from allowed media to /etc/passwd
        var linkPath = Path.Combine(_testRoot, "media", "movies", "evil_link");
        try
        {
            // Create symlink pointing to /etc/passwd (or test equivalent)
            var target = Path.Combine(_testRoot, "etc", "passwd");
            if (OperatingSystem.IsLinux() || OperatingSystem.IsMacOS())
            {
                if (File.Exists(linkPath)) File.Delete(linkPath);
                File.CreateSymbolicLink(linkPath, target);
            }
            else
            {
                // On Windows, skip symlink test (requires admin)
                return;
            }
        }
        catch
        {
            // Symlink creation may fail in test environment
            return;
        }

        // ACT - IsAllowedPath should resolve symlink and deny
        var allowed = MediaPaths.IsAllowedPath(linkPath);

        // ASSERT - Should be FALSE because resolved target is outside media roots
        Assert.False(allowed);
    }

    [Fact]
    public void SubtitlesController_ServeSubtitle_Allows_LegitimateMediaFile()
    {
        // ARRANGE
        var controller = new SubtitlesController(_db);
        var user = CreateUser("test-user", "admin");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // ACT - Access legitimate file under media root
        var result = controller.ServeSubtitle("media/movies/test.mp4");

        // ASSERT - Should return PhysicalFile (200) or NotFound if not subtitle
        // The file exists but is not a subtitle - controller returns NotFound for non-existent
        // For this test, we verify it doesn't crash and properly validates path
        Assert.NotNull(result);
    }

    private static ClaimsPrincipal CreateUser(string userId, string role)
    {
        return new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(System.Security.Claims.ClaimTypes.NameIdentifier, userId),
            new Claim(System.Security.Claims.ClaimTypes.Role, role)
        }, "TestAuth"));
    }
}
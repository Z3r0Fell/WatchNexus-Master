using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Tests;

public class LibrariesControllerTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IConfiguration> _configMock;
    private readonly Mock<IHttpClientFactory> _httpFactoryMock;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly LibrariesController _controller;

    public LibrariesControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"LibrariesTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _configMock = new Mock<IConfiguration>();
        _configMock.Setup(c => c["TMDB_API_KEY"]).Returns((string?)null);

        _httpFactoryMock = new Mock<IHttpClientFactory>();

        var services = new ServiceCollection();
        services.AddSingleton(_db);
        services.AddSingleton(_httpFactoryMock.Object);
        var provider = services.BuildServiceProvider();
        _scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();

        _controller = new LibrariesController(_db, _configMock.Object, _httpFactoryMock.Object, _scopeFactory);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task GetAll_ReturnsEmptyList_WhenNoLibraries()
    {
        var result = await _controller.GetAll();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Empty(value);
    }

    [Fact]
    public async Task GetAll_ReturnsLibraries_WhenExist()
    {
        _db.Libraries.Add(new Library
        {
            Id = "lib-1",
            Name = "Movies",
            Path = "/data/media/Movies",
            MediaType = "movies",
            ItemCount = 100,
            TotalSize = 50000000000,
            ScanStatus = "completed",
            LastScannedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var result = await _controller.GetAll();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Single(value);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.GetById("nonexistent");

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task GetById_ReturnsLibrary_WhenExists()
    {
        var lib = new Library
        {
            Id = "lib-1",
            Name = "Movies",
            Path = "/data/media/Movies",
            MediaType = "movies",
            ItemCount = 100
        };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();

        var result = await _controller.GetById("lib-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("lib-1", props.First(p => p.Name == "Id").GetValue(value));
        Assert.Equal("Movies", props.First(p => p.Name == "Name").GetValue(value));
    }

    [Fact]
    public async Task Create_RejectsMissingNameOrPath()
    {
        var req = new LibrariesController.LibraryRequest("", "/data/media/Movies", "movies");
        var result = await _controller.Create(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Create_RejectsPathOutsideMediaRoots()
    {
        var req = new LibrariesController.LibraryRequest("Movies", "/etc", "movies");
        var result = await _controller.Create(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var value = badRequest.Value;
        var props = value!.GetType().GetProperties();
        Assert.Contains("outside", props.First(p => p.Name == "detail").GetValue(value)!.ToString()!);
    }

    [Fact]
    public async Task Create_RejectsNonExistentPath()
    {
        var req = new LibrariesController.LibraryRequest("Movies", "/nonexistent/path", "movies");
        var result = await _controller.Create(req);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var value = badRequest.Value;
        var props = value!.GetType().GetProperties();
        Assert.Contains("not found", props.First(p => p.Name == "detail").GetValue(value)!.ToString()!);
    }

    [Fact]
    public async Task Create_AcceptsValidPath_AndCreatesLibrary()
    {
        var testDir = Path.Combine(Path.GetTempPath(), $"wn-test-lib-{Guid.NewGuid()}");
        Directory.CreateDirectory(testDir);
        
        try
        {
            var req = new LibrariesController.LibraryRequest("Test Library", testDir, "movies");
            var result = await _controller.Create(req);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var value = okResult.Value;
            var props = value!.GetType().GetProperties();
            Assert.Equal("Test Library", props.First(p => p.Name == "Name").GetValue(value));
            Assert.Equal(testDir, props.First(p => p.Name == "Path").GetValue(value));
            Assert.Equal("movies", props.First(p => p.Name == "media_type").GetValue(value));
            
            var saved = await _db.Libraries.FirstOrDefaultAsync(l => l.Path == testDir);
            Assert.NotNull(saved);
        }
        finally
        {
            Directory.Delete(testDir, true);
        }
    }

    [Fact]
    public async Task Update_UpdatesLibraryProperties()
    {
        var lib = new Library
        {
            Id = "lib-1",
            Name = "Old Name",
            Path = "/data/media/Movies",
            MediaType = "movies"
        };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();

        var req = new LibrariesController.LibraryRequest("New Name", "/data/media/Movies", "movies");
        var result = await _controller.Update("lib-1", req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("New Name", props.First(p => p.Name == "Name").GetValue(value));
    }

    [Fact]
    public async Task Delete_RemovesLibraryAndMediaItems()
    {
        var lib = new Library { Id = "lib-1", Name = "Movies", Path = "/data/media/Movies", MediaType = "movies" };
        _db.Libraries.Add(lib);
        _db.MediaItems.Add(new MediaItem { Id = "item-1", LibraryId = "lib-1", Title = "Test", FilePath = "/data/media/Movies/test.mkv", FileSize = 1000 });
        await _db.SaveChangesAsync();

        var result = await _controller.Delete("lib-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("deleted", props.First(p => p.Name == "status").GetValue(value));

        var remainingLib = await _db.Libraries.FindAsync("lib-1");
        var remainingItems = await _db.MediaItems.Where(m => m.LibraryId == "lib-1").ToListAsync();
        Assert.Null(remainingLib);
        Assert.Empty(remainingItems);
    }

    [Fact]
    public async Task Scan_ReturnsExistingJob_WhenAlreadyScanning()
    {
        var lib = new Library { Id = "lib-1", Name = "Movies", Path = "/data/media/Movies", MediaType = "movies" };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();

        var job1 = await _controller.Scan("lib-1");
        var job2 = await _controller.Scan("lib-1");

        var ok1 = Assert.IsType<OkObjectResult>(job1);
        var ok2 = Assert.IsType<OkObjectResult>(job2);
        Assert.Same(ok1.Value, ok2.Value);
    }

    [Fact]
    public async Task CancelScan_CancelsActiveJob()
    {
        var lib = new Library { Id = "lib-1", Name = "Movies", Path = "/data/media/Movies", MediaType = "movies" };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();

        await _controller.Scan("lib-1");
        var result = await _controller.CancelScan("lib-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("cancelled", props.First(p => p.Name == "status").GetValue(value));
    }

    [Fact]
    public async Task ScanStatus_ReturnsIdle_WhenNoJob()
    {
        var result = await _controller.ScanStatus("nonexistent");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("idle", props.First(p => p.Name == "status").GetValue(value));
        Assert.Equal(0, props.First(p => p.Name == "progress").GetValue(value));
    }

    [Fact]
    public async Task GetMedia_ReturnsPaginatedResults()
    {
        var lib = new Library { Id = "lib-1", Name = "Movies", Path = "/data/media/Movies", MediaType = "movies" };
        _db.Libraries.Add(lib);
        
        for (int i = 0; i < 10; i++)
        {
            _db.MediaItems.Add(new MediaItem
            {
                Id = $"item-{i}",
                LibraryId = "lib-1",
                Title = $"Movie {i}",
                FilePath = $"/data/media/Movies/movie{i}.mkv",
                FileSize = 1000000000,
                MediaType = "movie"
            });
        }
        await _db.SaveChangesAsync();

        var result = await _controller.GetMedia("lib-1", limit: 5, offset: 2);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Equal(5, value.Count());
    }

    [Fact]
    public void ParseTitle_ExtractsNameAndYear()
    {
        var parseMethod = typeof(LibrariesController).GetMethod("ParseTitle", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        var result1 = parseMethod!.Invoke(null, new object[] { "Movie.Name.2023.1080p" });
        Assert.Equal(("Movie Name", 2023), result1);

        var result2 = parseMethod.Invoke(null, new object[] { "Another Movie (2022)" });
        Assert.Equal(("Another Movie", 2022), result2);

        var result3 = parseMethod.Invoke(null, new object[] { "No Year Here" });
        Assert.Equal(("No Year Here", null), result3);
    }

    [Fact]
    public void ParseTitle_RemovesQualityTags()
    {
        var parseMethod = typeof(LibrariesController).GetMethod("ParseTitle", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        var result = parseMethod!.Invoke(null, new object[] { "Movie.Name.2023.1080p.BluRay.x264" });
        Assert.Equal(("Movie Name", 2023), result);
    }
}
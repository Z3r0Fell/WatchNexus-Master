using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using System.Text.Json;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Tests;

public class IptvControllerTests
{
    private readonly AppDbContext _db;
    private readonly IptvController _controller;

    public IptvControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"IptvTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new IptvController(_db);

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
    public async Task Sources_ReturnsEmpty_WhenNoSources()
    {
        var result = await _controller.Sources();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Empty(value);
    }

    [Fact]
    public async Task AddSource_RejectsInvalidUrl()
    {
        var result = await _controller.AddSource("Test", "not-a-url", null);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task AddSource_CreatesSource()
    {
        // Use a test URL that SsrfGuard allows
        var result = await _controller.AddSource("Test Source", "https://httpbin.org/get", "https://httpbin.org/xml");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("added", props.First(p => p.Name == "status").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "Id").GetValue(value));
    }

    [Fact]
    public async Task UpdateSource_UpdatesProperties()
    {
        var source = new IptvSource { Id = "src-1", Name = "Old", Url = "https://example.com", EpgUrl = "https://example.com/epg" };
        _db.IptvSources.Add(source);
        await _db.SaveChangesAsync();

        var body = JsonSerializer.Serialize(new { name = "New Name", epg_url = "https://new.com/epg" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.UpdateSource("src-1", jsonElement);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updated = await _db.IptvSources.FindAsync("src-1");
        Assert.Equal("New Name", updated!.Name);
        Assert.Equal("https://new.com/epg", updated.EpgUrl);
    }

    [Fact]
    public async Task UpdateSource_RejectsInvalidUrl()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        await _db.SaveChangesAsync();

        var body = JsonSerializer.Serialize(new { url = "not-a-url" });
        var jsonElement = JsonDocument.Parse(body).RootElement;

        var result = await _controller.UpdateSource("src-1", jsonElement);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task RefreshSource_RefreshesChannels()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://httpbin.org/get" };
        _db.IptvSources.Add(source);
        _db.IptvChannels.Add(new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Old Channel", StreamUrl = "https://example.com/stream" });
        await _db.SaveChangesAsync();

        var result = await _controller.RefreshSource("src-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("refreshed", props.First(p => p.Name == "status").GetValue(value));
    }

    [Fact]
    public async Task DeleteSource_RemovesSourceAndChannels()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        _db.IptvChannels.Add(new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Channel", StreamUrl = "https://example.com/stream" });
        await _db.SaveChangesAsync();

        var result = await _controller.DeleteSource("src-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var remainingSource = await _db.IptvSources.FindAsync("src-1");
        var remainingChannels = await _db.IptvChannels.Where(c => c.SourceId == "src-1").ToListAsync();
        Assert.Null(remainingSource);
        Assert.Empty(remainingChannels);
    }

    [Fact]
    public async Task Channels_ReturnsFilteredResults()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        _db.IptvChannels.AddRange(
            new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Channel 1", GroupTitle = "News", StreamUrl = "https://example.com/1", SortOrder = 1 },
            new IptvChannel { Id = "ch-2", SourceId = "src-1", Name = "Channel 2", GroupTitle = "Sports", StreamUrl = "https://example.com/2", SortOrder = 2 },
            new IptvChannel { Id = "ch-3", SourceId = "src-1", Name = "Channel 3", GroupTitle = "News", StreamUrl = "https://example.com/3", SortOrder = 3 }
        );
        await _db.SaveChangesAsync();

        var result = await _controller.Channels(source_id: "src-1", group: "News");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        Assert.Equal(2, value.Count());
    }

    [Fact]
    public async Task ToggleFavorite_AddsFavorite()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        var channel = new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Channel", StreamUrl = "https://example.com/stream" };
        _db.IptvChannels.Add(channel);
        await _db.SaveChangesAsync();

        var result = await _controller.ToggleFavorite("ch-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.True((bool)props.First(p => p.Name == "is_favorite").GetValue(value)!);

        var favSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "iptv_favorite:ch-1" && s.UserId == "test-user");
        Assert.NotNull(favSetting);
    }

    [Fact]
    public async Task ToggleFavorite_RemovesFavorite()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        var channel = new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Channel", StreamUrl = "https://example.com/stream" };
        _db.IptvChannels.Add(channel);
        _db.Settings.Add(new AppSetting { Key = "iptv_favorite:ch-1", UserId = "test-user", Value = "1" });
        await _db.SaveChangesAsync();

        var result = await _controller.ToggleFavorite("ch-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.False((bool)props.First(p => p.Name == "is_favorite").GetValue(value)!);

        var favSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "iptv_favorite:ch-1" && s.UserId == "test-user");
        Assert.Null(favSetting);
    }

    [Fact]
    public async Task Channel_ReturnsNotFound_WhenMissing()
    {
        var result = await _controller.Channel("nonexistent");

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Channel_ReturnsChannel_WhenExists()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        var channel = new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Test Channel", StreamUrl = "https://example.com/stream", LogoUrl = "https://example.com/logo.png" };
        _db.IptvChannels.Add(channel);
        await _db.SaveChangesAsync();

        var result = await _controller.Channel("ch-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("ch-1", props.First(p => p.Name == "Id").GetValue(value));
        Assert.Equal("Test Channel", props.First(p => p.Name == "Name").GetValue(value));
    }

    [Fact]
    public async Task Groups_ReturnsGroupedChannels()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        _db.IptvChannels.AddRange(
            new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Ch1", GroupTitle = "News", StreamUrl = "https://example.com/1" },
            new IptvChannel { Id = "ch-2", SourceId = "src-1", Name = "Ch2", GroupTitle = "News", StreamUrl = "https://example.com/2" },
            new IptvChannel { Id = "ch-3", SourceId = "src-1", Name = "Ch3", GroupTitle = "Sports", StreamUrl = "https://example.com/3" }
        );
        await _db.SaveChangesAsync();

        var result = await _controller.Groups("src-1");

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = Assert.IsAssignableFrom<IEnumerable<object>>(okResult.Value);
        var groups = value.ToList();
        Assert.Equal(2, groups.Count);
        
        var newsGroup = groups.First(g => g.GetType().GetProperty("name")!.GetValue(g)!.ToString() == "News");
        Assert.Equal(2, newsGroup.GetType().GetProperty("count")!.GetValue(newsGroup));
    }

    [Fact]
    public async Task Stats_ReturnsStatistics()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        _db.IptvChannels.AddRange(
            new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Ch1", GroupTitle = "News", StreamUrl = "https://example.com/1" },
            new IptvChannel { Id = "ch-2", SourceId = "src-1", Name = "Ch2", GroupTitle = "Sports", StreamUrl = "https://example.com/2" }
        );
        _db.Settings.Add(new AppSetting { Key = "iptv_favorite:ch-1", UserId = "test-user", Value = "1" });
        await _db.SaveChangesAsync();

        var result = await _controller.Stats();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal(1, props.First(p => p.Name == "sources").GetValue(value));
        Assert.Equal(2, props.First(p => p.Name == "channels").GetValue(value));
        Assert.Equal(2, props.First(p => p.Name == "groups").GetValue(value));
        Assert.Equal(1, props.First(p => p.Name == "favorites_count").GetValue(value));
    }

    [Fact]
    public async Task Export_ReturnsM3UContent()
    {
        var source = new IptvSource { Id = "src-1", Name = "Test", Url = "https://example.com" };
        _db.IptvSources.Add(source);
        _db.IptvChannels.Add(new IptvChannel { Id = "ch-1", SourceId = "src-1", Name = "Test Channel", StreamUrl = "https://example.com/stream", GroupTitle = "News", TvgId = "test.id", TvgName = "Test", LogoUrl = "https://example.com/logo.png" });
        await _db.SaveChangesAsync();

        var result = await _controller.Export(null, false);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        var content = props.First(p => p.Name == "content").GetValue(value)!.ToString()!;
        Assert.StartsWith("#EXTM3U", content);
        Assert.Contains("#EXTINF:-1 tvg-id=\"test.id\" tvg-name=\"Test\" tvg-logo=\"https://example.com/logo.png\" group-title=\"News\",Test Channel", content);
        Assert.Contains("https://example.com/stream", content);
    }

    [Fact]
    public void ParseM3U_ParsesValidM3U()
    {
        var m3uContent = """
            #EXTM3U
            #EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" tvg-logo="logo.png" group-title="News",Channel 1
            http://example.com/stream1
            #EXTINF:-1 tvg-id="ch2" group-title="Sports",Channel 2
            http://example.com/stream2
            """;

        var parseMethod = typeof(IptvController).GetMethod("ParseM3U", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var channels = (List<IptvChannel>)parseMethod!.Invoke(null, new object[] { m3uContent, "src-1" })!;

        Assert.Equal(2, channels.Count);
        Assert.Equal("Channel 1", channels[0].Name);
        Assert.Equal("News", channels[0].GroupTitle);
        Assert.Equal("ch1", channels[0].TvgId);
        Assert.Equal("Channel 2", channels[1].Name);
        Assert.Equal("Sports", channels[1].GroupTitle);
    }

    [Fact]
    public void ExtractAttribute_ExtractsAttributes()
    {
        var extractMethod = typeof(IptvController).GetMethod("ExtractAttribute", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        var line = "#EXTINF:-1 tvg-id=\"test\" tvg-name=\"Test\" group-title=\"News\",Channel";
        
        Assert.Equal("test", extractMethod!.Invoke(null, new object[] { line, "tvg-id" }));
        Assert.Equal("Test", extractMethod.Invoke(null, new object[] { line, "tvg-name" }));
        Assert.Equal("News", extractMethod.Invoke(null, new object[] { line, "group-title" }));
        Assert.Null(extractMethod.Invoke(null, new object[] { line, "nonexistent" }));
    }
}
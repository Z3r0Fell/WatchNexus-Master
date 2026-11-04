namespace WatchNexus.Core.Tests;

public class DrizzleQueueTests
{
    [Fact]
    public void ClearQueue_ReturnsOk()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"Drizzle_{Guid.NewGuid()}").Options);
        var ctl = new DrizzleController(db);
        Assert.IsType<OkObjectResult>(ctl.ClearQueue());
    }

    [Fact]
    public void ClearQueue_IsRoutedAsHttpDeleteOnQueue()
    {
        var method = typeof(DrizzleController).GetMethod(nameof(DrizzleController.ClearQueue))!;
        var attr = method.GetCustomAttributes(typeof(HttpDeleteAttribute), false)
            .Cast<HttpDeleteAttribute>().Single();
        Assert.Equal("queue", attr.Template);
    }
}

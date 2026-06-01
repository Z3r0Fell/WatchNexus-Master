using Microsoft.AspNetCore.Http;
using WatchNexus.Core.Middleware;

namespace WatchNexus.Tests;

public class RateLimiterMiddlewareTests
{
    [Fact]
    public async Task NonAuthPath_PassesThrough()
    {
        var wasCalled = false;
        var middleware = new RateLimiterMiddleware(_ => { wasCalled = true; return Task.CompletedTask; });
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/health";

        await middleware.InvokeAsync(ctx);

        Assert.True(wasCalled);
        Assert.NotEqual(429, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task AuthPath_UnderLimit_PassesThrough()
    {
        var wasCalled = false;
        var middleware = new RateLimiterMiddleware(_ => { wasCalled = true; return Task.CompletedTask; }, maxRequests: 5);
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/auth/login";
        ctx.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("192.168.1.1");

        for (int i = 0; i < 5; i++)
        {
            wasCalled = false;
            var c = new DefaultHttpContext();
            c.Request.Path = "/api/auth/login";
            c.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("192.168.1.1");
            await middleware.InvokeAsync(c);
            Assert.True(wasCalled, $"Request {i + 1} should pass");
        }
    }

    [Fact]
    public async Task AuthPath_OverLimit_Returns429()
    {
        var middleware = new RateLimiterMiddleware(_ => Task.CompletedTask, maxRequests: 3);
        var ip = System.Net.IPAddress.Parse("10.0.0.1");

        for (int i = 0; i < 3; i++)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = "/api/auth/login";
            ctx.Connection.RemoteIpAddress = ip;
            await middleware.InvokeAsync(ctx);
            Assert.NotEqual(429, ctx.Response.StatusCode);
        }

        var limited = new DefaultHttpContext();
        limited.Request.Path = "/api/auth/login";
        limited.Connection.RemoteIpAddress = ip;
        await middleware.InvokeAsync(limited);
        Assert.Equal(429, limited.Response.StatusCode);
    }

    [Fact]
    public async Task DifferentIps_HaveSeparateCounters()
    {
        var middleware = new RateLimiterMiddleware(_ => Task.CompletedTask, maxRequests: 2);

        var ip1 = System.Net.IPAddress.Parse("10.0.0.1");
        var ip2 = System.Net.IPAddress.Parse("10.0.0.2");

        for (int i = 0; i < 3; i++)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = "/api/auth/login";
            ctx.Connection.RemoteIpAddress = ip1;
            await middleware.InvokeAsync(ctx);
        }

        var ctx2 = new DefaultHttpContext();
        ctx2.Request.Path = "/api/auth/login";
        ctx2.Connection.RemoteIpAddress = ip2;
        await middleware.InvokeAsync(ctx2);

        Assert.NotEqual(429, ctx2.Response.StatusCode);
    }
}

public class CsrfMiddlewareTests
{
    [Fact]
    public async Task NonApiPath_SkipsCheck()
    {
        var wasCalled = false;
        var middleware = new CsrfMiddleware(_ => { wasCalled = true; return Task.CompletedTask; });
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/index.html";
        ctx.Request.Method = "POST";
        ctx.Request.Headers["Origin"] = "http://evil.com";

        await middleware.InvokeAsync(ctx);

        Assert.True(wasCalled);
    }

    [Fact]
    public async Task LoginPath_SkipsCsrf()
    {
        var wasCalled = false;
        var middleware = new CsrfMiddleware(_ => { wasCalled = true; return Task.CompletedTask; });
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/auth/login";
        ctx.Request.Method = "POST";
        ctx.Request.Headers["Origin"] = "http://evil.com";

        await middleware.InvokeAsync(ctx);

        Assert.True(wasCalled);
    }

    [Fact]
    public async Task StateChangingMethod_WithBadOrigin_Returns403()
    {
        var middleware = new CsrfMiddleware(_ => Task.CompletedTask);
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/settings";
        ctx.Request.Method = "POST";
        ctx.Request.Headers["Origin"] = "http://evil-attacker.com";

        await middleware.InvokeAsync(ctx);

        Assert.Equal(403, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task StateChangingMethod_WithGoodOrigin_Passes()
    {
        var wasCalled = false;
        var middleware = new CsrfMiddleware(_ => { wasCalled = true; return Task.CompletedTask; });
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/settings";
        ctx.Request.Method = "POST";
        ctx.Request.Headers["Origin"] = "http://localhost:8001";

        await middleware.InvokeAsync(ctx);

        Assert.True(wasCalled);
    }

    [Fact]
    public async Task GetRequest_SkipsCsrf()
    {
        var wasCalled = false;
        var middleware = new CsrfMiddleware(_ => { wasCalled = true; return Task.CompletedTask; });
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/settings";
        ctx.Request.Method = "GET";
        ctx.Request.Headers["Origin"] = "http://evil.com";

        await middleware.InvokeAsync(ctx);

        Assert.True(wasCalled);
    }

    [Fact]
    public async Task EmptyOriginAndReferer_AllowsRequest()
    {
        var wasCalled = false;
        var middleware = new CsrfMiddleware(_ => { wasCalled = true; return Task.CompletedTask; });
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/settings";
        ctx.Request.Method = "POST";

        await middleware.InvokeAsync(ctx);

        Assert.True(wasCalled);
    }
}

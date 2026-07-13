using Microsoft.AspNetCore.Http;
using WatchNexus.Core.Auth;

namespace WatchNexus.Core.Tests;

public class CsrfTokensTests
{
    [Fact]
    public void Generate_produces_unique_urlsafe_tokens()
    {
        var a = CsrfTokens.Generate();
        var b = CsrfTokens.Generate();
        Assert.NotEqual(a, b);
        Assert.True(a.Length >= 40);
        Assert.DoesNotContain('+', a);
        Assert.DoesNotContain('/', a);
        Assert.DoesNotContain('=', a);
    }
}

public class CsrfProtectionMiddlewareTests
{
    private static async Task<(HttpContext ctx, bool nextCalled)> Run(
        string method, string path, string? cookieHeader = null, string? csrfHeader = null, string? authHeader = null)
    {
        var nextCalled = false;
        var mw = new CsrfProtectionMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        ctx.Request.Method = method;
        ctx.Request.Path = path;
        if (cookieHeader != null) ctx.Request.Headers.Cookie = cookieHeader;
        if (csrfHeader != null) ctx.Request.Headers[CsrfTokens.HeaderName] = csrfHeader;
        if (authHeader != null) ctx.Request.Headers.Authorization = authHeader;
        await mw.InvokeAsync(ctx);
        return (ctx, nextCalled);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("HEAD")]
    [InlineData("OPTIONS")]
    public async Task Safe_methods_are_exempt(string method)
    {
        var (_, nextCalled) = await Run(method, "/api/settings", cookieHeader: "wn_token=x");
        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Non_api_paths_are_exempt()
    {
        var (_, nextCalled) = await Run("POST", "/static/whatever");
        Assert.True(nextCalled);
    }

    [Theory]
    [InlineData("/api/auth/login")]
    [InlineData("/api/auth/setup")]
    public async Task Session_establishing_endpoints_are_exempt(string path)
    {
        var (_, nextCalled) = await Run("POST", path);
        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Pure_bearer_clients_without_auth_cookie_are_exempt()
    {
        var (_, nextCalled) = await Run("POST", "/api/settings", authHeader: "Bearer some.jwt.token");
        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Cookie_session_without_csrf_token_is_rejected()
    {
        var (ctx, nextCalled) = await Run("POST", "/api/settings", cookieHeader: "wn_token=x");
        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task Mismatched_csrf_header_is_rejected()
    {
        var (ctx, nextCalled) = await Run("PUT", "/api/settings",
            cookieHeader: "wn_token=x; XSRF-TOKEN=aaaa", csrfHeader: "bbbb");
        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task Matching_double_submit_tokens_pass()
    {
        var token = CsrfTokens.Generate();
        var (_, nextCalled) = await Run("DELETE", "/api/settings/foo",
            cookieHeader: $"wn_token=x; XSRF-TOKEN={token}", csrfHeader: token);
        Assert.True(nextCalled);
    }

    [Fact]
    public async Task Bearer_header_with_auth_cookie_still_requires_csrf()
    {
        // A browser session (cookie present) can't bypass CSRF by adding a Bearer header.
        var (ctx, nextCalled) = await Run("POST", "/api/settings",
            cookieHeader: "wn_token=x", authHeader: "Bearer some.jwt.token");
        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, ctx.Response.StatusCode);
    }
}

using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for the rolling file logger + LogsController (/api/logs/*),
/// the endpoints behind the Zest Log Viewer page.
/// </summary>
public class LogsControllerIntegrationTests : IntegrationTestBase, IDisposable
{
    // Field initializers run BEFORE the base constructor builds the test host,
    // so Program.cs sees WATCHNEXUS_LOG_DIR and enables the file logger there.
    private readonly string _logDir = PrepareLogDir();

    private static string PrepareLogDir()
    {
        var root = Path.Combine(Path.GetTempPath(), "wn-logs-test-" + Guid.NewGuid().ToString("N"));
        var dir = Path.Combine(root, "logs");
        Directory.CreateDirectory(dir);
        Environment.SetEnvironmentVariable("WATCHNEXUS_LOG_DIR", dir);
        return dir;
    }

    public LogsControllerIntegrationTests() : base()
    {
        // Host is built; don't leak the override into other test classes.
        Environment.SetEnvironmentVariable("WATCHNEXUS_LOG_DIR", null);
    }

    void IDisposable.Dispose()
    {
        base.Dispose();
        try { Directory.Delete(Path.GetDirectoryName(_logDir)!, recursive: true); } catch { }
    }

    private ILogger Logger(string category = "LogsTest") =>
        Services.GetRequiredService<ILoggerFactory>().CreateLogger(category);

    private static List<JsonElement> Lines(JsonElement json) =>
        json.GetProperty("lines").EnumerateArray().ToList();

    private Task<HttpResponseMessage> PostClient(string json) =>
        Client.PostAsync("/api/logs/client", new StringContent(json, Encoding.UTF8, "application/json"));

    [Fact]
    public async Task Latest_ReturnsWrittenEntries_WithParsedLevels()
    {
        AuthenticateAsUser();
        var marker = Guid.NewGuid().ToString("N");
        Logger().LogInformation("hello {Marker}", marker);
        Logger().LogError(new InvalidOperationException("kaboom-" + marker), "failed {Marker}", marker);

        var response = await Client.GetAsync("/api/logs/latest?lines=200");
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);

        Assert.StartsWith("watchnexus-", json.GetProperty("file").GetString());
        Assert.True(json.GetProperty("total").GetInt32() >= 3);
        var lines = Lines(json);

        var info = lines.Single(l => l.GetProperty("text").GetString()!.Contains("hello " + marker));
        Assert.Equal("INFO", info.GetProperty("level").GetString());
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[INFO\] LogsTest: hello ", info.GetProperty("text").GetString());
        Assert.True(info.GetProperty("line_number").GetInt32() > 0);

        var err = lines.Single(l => l.GetProperty("text").GetString()!.Contains("failed " + marker));
        Assert.Equal("ERROR", err.GetProperty("level").GetString());

        // Exception text is on following (indented) lines and inherits ERROR.
        var exLine = lines.Single(l => l.GetProperty("text").GetString()!.Contains("kaboom-" + marker));
        Assert.StartsWith("  ", exLine.GetProperty("text").GetString());
        Assert.Equal("ERROR", exLine.GetProperty("level").GetString());
    }

    [Fact]
    public async Task Latest_LevelFilter_ReturnsOnlyMatchingLevel()
    {
        AuthenticateAsUser();
        Logger().LogInformation("info line");
        Logger().LogWarning("warn line");
        Logger().LogError("error line");

        var json = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?lines=500&level=WARNING"));
        var lines = Lines(json);

        Assert.NotEmpty(lines);
        Assert.All(lines, l => Assert.Equal("WARNING", l.GetProperty("level").GetString()));
        Assert.Contains(lines, l => l.GetProperty("text").GetString()!.Contains("warn line"));

        // Case-insensitive filter + ALL means unfiltered.
        var errJson = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?level=error"));
        Assert.All(Lines(errJson), l => Assert.Equal("ERROR", l.GetProperty("level").GetString()));
        var allJson = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?level=ALL&lines=500"));
        Assert.Contains(Lines(allJson), l => l.GetProperty("level").GetString() == "INFO");
    }

    [Fact]
    public async Task Latest_ClampsLineCount()
    {
        AuthenticateAsUser();
        for (var i = 0; i < 5; i++) Logger().LogInformation("clamp {I}", i);

        var one = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?lines=0"));
        Assert.Single(Lines(one));

        var huge = await Client.GetAsync("/api/logs/latest?lines=100000000");
        Assert.Equal(HttpStatusCode.OK, huge.StatusCode);
    }

    [Fact]
    public async Task GetFiles_ListsLogFiles_WithNameAndSize()
    {
        AuthenticateAsUser();
        Logger().LogInformation("make sure a file exists");

        var json = await DeserializeResponseElement(await Client.GetAsync("/api/logs"));
        Assert.Equal(JsonValueKind.Array, json.ValueKind);
        var file = json.EnumerateArray().First(f => f.GetProperty("name").GetString()!.StartsWith("watchnexus-"));
        Assert.True(file.GetProperty("size").GetInt64() > 0);
        Assert.True(file.TryGetProperty("modified", out _));
    }

    [Fact]
    public async Task GetFile_ReturnsPagedLines()
    {
        AuthenticateAsUser();
        Logger().LogInformation("paged");
        var files = await DeserializeResponseElement(await Client.GetAsync("/api/logs"));
        var name = files.EnumerateArray().First().GetProperty("name").GetString();

        var json = await DeserializeResponseElement(await Client.GetAsync($"/api/logs/file/{name}?offset=0&limit=1"));
        Assert.Equal(name, json.GetProperty("file").GetString());
        Assert.Single(Lines(json));
    }

    [Theory]
    [InlineData("..%2F..%2Fappsettings.json")]
    [InlineData("..%2Fsecret.log")]
    [InlineData("..%5Csecret.log")]
    [InlineData("a..b.log")]
    [InlineData("not-a-real-file.log")]
    public async Task GetFile_RejectsTraversalAndUnknownFiles(string filename)
    {
        AuthenticateAsAdmin();
        // A real file one level above the log dir — must never be reachable.
        await File.WriteAllTextAsync(Path.Combine(Path.GetDirectoryName(_logDir)!, "secret.log"), "TOP SECRET");

        var get = await Client.GetAsync($"/api/logs/file/{filename}");
        Assert.True(get.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound,
            $"GET {filename} returned {get.StatusCode}");
        Assert.DoesNotContain("TOP SECRET", await get.Content.ReadAsStringAsync());

        var del = await Client.DeleteAsync($"/api/logs/file/{filename}");
        Assert.True(del.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound,
            $"DELETE {filename} returned {del.StatusCode}");
        Assert.True(File.Exists(Path.Combine(Path.GetDirectoryName(_logDir)!, "secret.log")));
    }

    [Fact]
    public async Task MaintenanceEndpoints_ListViewAndDownload()
    {
        AuthenticateAsUser();
        var marker = Guid.NewGuid().ToString("N");
        Logger().LogWarning("maint {Marker}", marker);

        var list = await DeserializeResponseElement(await Client.GetAsync("/api/logs/list"));
        var first = list.GetProperty("logs").EnumerateArray().First();
        Assert.False(string.IsNullOrEmpty(first.GetProperty("filename").GetString()));
        Assert.True(first.TryGetProperty("size_kb", out _));

        // Legacy default filename falls back to the active log; lines are plain strings.
        var view = await DeserializeResponseElement(await Client.GetAsync("/api/logs/view?filename=watchnexus.log&lines=50"));
        var lines = view.GetProperty("lines").EnumerateArray().Select(l => l.GetString()!).ToList();
        Assert.Contains(lines, l => l.Contains("maint " + marker) && l.Contains("[WARNING]"));

        Assert.Equal(HttpStatusCode.BadRequest,
            (await Client.GetAsync("/api/logs/view?filename=..%2F..%2Fappsettings.json")).StatusCode);

        var name = view.GetProperty("file").GetString();
        var dl = await Client.GetAsync($"/api/logs/download/{name}");
        Assert.Equal(HttpStatusCode.OK, dl.StatusCode);
        Assert.Contains("maint " + marker, await dl.Content.ReadAsStringAsync());
        Assert.True((await Client.GetAsync("/api/logs/download/..%2Fsecret.log")).StatusCode
            is HttpStatusCode.BadRequest or HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ClearOld_AdminOnly_KeepsActiveFile()
    {
        Logger().LogInformation("active");
        var old = Path.Combine(_logDir, "watchnexus-20000101.log");
        await File.WriteAllTextAsync(old, "old\n");

        AuthenticateAsUser();
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.PostAsync("/api/logs/clear", null)).StatusCode);

        AuthenticateAsAdmin();
        Assert.Equal(HttpStatusCode.OK, (await Client.PostAsync("/api/logs/clear", null)).StatusCode);
        Assert.False(File.Exists(old));
        Assert.NotEmpty(Directory.GetFiles(_logDir, "watchnexus-*.log"));
    }

    [Fact]
    public async Task DeleteFile_RequiresAdmin_AndDeletesExistingFile()
    {
        var path = Path.Combine(_logDir, "old-test.log");
        await File.WriteAllTextAsync(path, "2026-01-01T00:00:00.000Z [INFO] X: old\n");

        AuthenticateAsUser();
        var forbidden = await Client.DeleteAsync("/api/logs/file/old-test.log");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.True(File.Exists(path));

        AuthenticateAsAdmin();
        var ok = await Client.DeleteAsync("/api/logs/file/old-test.log");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.False(File.Exists(path));
    }

    [Fact]
    public async Task Endpoints_RequireAuthentication()
    {
        ClearAuthentication();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client.GetAsync("/api/logs/latest")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await PostClient("{\"message\":\"x\"}")).StatusCode);
    }

    [Fact]
    public async Task ClientReport_IsLoggedUnderFrontendCategory()
    {
        AuthenticateAsUser("crash-user");
        var marker = Guid.NewGuid().ToString("N");
        var body = JsonSerializer.Serialize(new
        {
            level = "error",
            message = "TypeError: x is undefined " + marker,
            stack = "TypeError: x\n    at Foo (app.js:1:1)",
            componentStack = "\n    in LogViewerPage\n    in App",
            correlationId = "corr-" + marker,
            url = "http://localhost/logs",
            userAgent = "TestAgent/1.0",
        });

        var response = await PostClient(body);
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        var json = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?lines=500&level=ERROR"));
        var lines = Lines(json);
        var head = lines.Single(l => l.GetProperty("text").GetString()!.Contains(marker) &&
                                     l.GetProperty("text").GetString()!.Contains("[ERROR] Frontend:"));
        var text = head.GetProperty("text").GetString()!;
        Assert.Contains("corr-" + marker, text);
        Assert.Contains("user=crash-user", text);
        Assert.Contains("url=http://localhost/logs", text);
        Assert.Contains(lines, l => l.GetProperty("text").GetString()!.Contains("at Foo (app.js:1:1)"));
        Assert.Contains(lines, l => l.GetProperty("text").GetString()!.Contains("in LogViewerPage"));
    }

    [Fact]
    public async Task ClientReport_WarnLevel_TruncatesFields_AndBlocksLineForging()
    {
        AuthenticateAsUser();
        var marker = Guid.NewGuid().ToString("N");
        var forged = "\n2026-01-01T00:00:00.000Z [FATAL] Security: forged-" + marker;
        var body = JsonSerializer.Serialize(new
        {
            level = "warn",
            message = "warn-" + marker + forged,
            url = "http://x/" + forged,
            stack = new string('A', 50_000),
        });

        Assert.Equal(HttpStatusCode.Accepted, (await PostClient(body)).StatusCode);

        var json = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?lines=5000"));
        var lines = Lines(json);
        var head = lines.Single(l => l.GetProperty("text").GetString()!.Contains("warn-" + marker));
        Assert.Equal("WARNING", head.GetProperty("level").GetString());

        // The forged text must not appear as its own FATAL entry.
        Assert.DoesNotContain(lines, l => l.GetProperty("text").GetString()!.Contains("forged-" + marker)
                                          && l.GetProperty("level").GetString() == "FATAL");

        // 50k stack is capped at 8KB (+ marker).
        var stackLine = lines.Single(l => l.GetProperty("text").GetString()!.Contains("AAAA"));
        Assert.True(stackLine.GetProperty("text").GetString()!.Length < 9 * 1024);
        Assert.Contains("[truncated]", stackLine.GetProperty("text").GetString());
    }

    [Fact]
    public async Task ClientReport_ToleratesMalformedBody()
    {
        AuthenticateAsUser();
        var response = await PostClient("{not json");
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        var json = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?lines=50&level=ERROR"));
        Assert.Contains(Lines(json), l => l.GetProperty("text").GetString()!.Contains("unparseable client report"));
    }

    [Fact]
    public async Task ZestClear_TruncatesActiveLogFile()
    {
        AuthenticateAsUser();
        Logger().LogInformation("before clear");
        // Admin-only: a normal user is refused.
        var denied = await Client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/zest/logs/clear") { Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json") });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        AuthenticateAsAdmin();

        var res = await Client.PostAsync("/api/zest/logs/clear", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        Logger().LogInformation("after clear");
        var json = await DeserializeResponseElement(await Client.GetAsync("/api/logs/latest?lines=500"));
        var texts = Lines(json).Select(l => l.GetProperty("text").GetString()!).ToList();
        Assert.DoesNotContain(texts, t => t.Contains("before clear"));
        Assert.Contains(texts, t => t.Contains("after clear"));
    }
}

public class FileLogSinkTests
{
    [Theory]
    [InlineData("2026-11-01T12:00:00.000Z [INFO] Cat: msg", null, "INFO")]
    [InlineData("2026-11-01T12:00:00.000Z [WARNING] Cat: msg", null, "WARNING")]
    [InlineData("2026-11-01T12:00:00.000Z [FATAL] Cat: msg", null, "FATAL")]
    [InlineData("[12:00:00.000] [FATAL] Unhandled exception", null, "FATAL")]
    [InlineData("[12:00:00.000] [WatchNexus] Data dir: /app/data", null, "INFO")]
    [InlineData("     at Foo.Bar()", "ERROR", "ERROR")]
    [InlineData("  [INFO] forged but indented", "ERROR", "ERROR")]
    public void ParseLevel_NormalisesAndInheritsForContinuations(string line, string? prev, string expected)
    {
        Assert.Equal(expected, FileLogSink.ParseLevel(line, prev));
    }

    [Fact]
    public void FormatEntry_IndentsMultilineMessageAndException()
    {
        var text = FileLogSink.FormatEntry(new DateTime(2026, 11, 1, 12, 0, 0, DateTimeKind.Utc),
            LogLevel.Error, "Cat", "line1\nline2", new Exception("boom"));
        var lines = text.TrimEnd('\n').Split('\n');
        Assert.Equal("2026-11-01T12:00:00.000Z [ERROR] Cat: line1", lines[0]);
        Assert.All(lines.Skip(1), l => Assert.StartsWith("  ", l));
        Assert.Contains(lines, l => l.Contains("System.Exception: boom"));
    }
}

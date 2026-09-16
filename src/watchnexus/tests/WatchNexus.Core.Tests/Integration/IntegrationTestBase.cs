using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Core.Services;
using WatchNexus.Shared;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Base class for integration tests using WebApplicationFactory.
/// </summary>
public abstract class IntegrationTestBase : IAsyncLifetime, IDisposable
{
    protected readonly WebApplicationFactory<Program> Factory;
    protected readonly HttpClient Client;
    protected readonly AppDbContext DbContext;
    protected readonly Mock<IHttpClientFactory> HttpClientFactoryMock;
    protected readonly List<Mock<HttpMessageHandler>> HandlerMocks;
    private readonly IServiceScope _scope;

    public IServiceProvider Services => Factory.Services;

    protected IntegrationTestBase()
    {
        // Ensure Program.cs's top-level `isTesting` check sees the test
        // environment. WebApplicationFactory sets the environment via the
        // host-builder config, but the entry point reads the process env
        // var directly — without this it runs the full production boot
        // (SQLite migrate, patch service, fortress) inside the test host.
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");

        HttpClientFactoryMock = new Mock<IHttpClientFactory>();
        HandlerMocks = new List<Mock<HttpMessageHandler>>();
        
        HttpClientFactoryMock.Setup(f => f.CreateClient(It.IsAny<string>()))
            .Returns(() =>
            {
                var handler = HandlerMocks.Count > 0 ? HandlerMocks[^1].Object : new HttpClientHandler();
                return new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
            });

        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                
                builder.ConfigureServices(services =>
                {
                    // Replace the real HttpClientFactory with our mock
                    var httpFactoryDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IHttpClientFactory));
                    if (httpFactoryDescriptor != null)
                        services.Remove(httpFactoryDescriptor);
                    
                    services.AddSingleton<IHttpClientFactory>(HttpClientFactoryMock.Object);

                    // Register the test auth scheme so TestAuthHandler can satisfy [Authorize]
                    services.AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = "Test";
                        options.DefaultChallengeScheme = "Test";
                    }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", null);
                    
                    // Use in-memory database
                    var dbContextDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
                    if (dbContextDescriptor != null)
                        services.Remove(dbContextDescriptor);
                    
                    var dbName = $"IntegrationTest_{Guid.NewGuid()}";
                    services.AddDbContext<AppDbContext>(options =>
                    {
                        options.UseInMemoryDatabase(dbName);
                        options.EnableSensitiveDataLogging();
                    });
                    
                    // Disable automatic key generation for tests
                    var dpDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IDataProtectionBuilder));
                    // DataProtection is added by Program.cs, we just ensure it works
                });
            });

        Client = Factory.CreateClient();
        Client.BaseAddress = new Uri("http://localhost");

        _scope = Factory.Services.CreateScope();
        DbContext = _scope.ServiceProvider.GetRequiredService<AppDbContext>();
        
        // Ensure database is created
        DbContext.Database.EnsureCreated();
        
        // Initialize SecretProtector with the test data protection provider
        var dataProtectionProvider = Factory.Services.GetRequiredService<IDataProtectionProvider>();
        SecretProtector.Initialize(dataProtectionProvider.CreateProtector("WatchNexus.Secrets.v1"));

        // Populate ModuleRegistry with test modules
        PopulateTestModuleRegistry();
    }

    private static void PopulateTestModuleRegistry()
    {
        // Register test modules that match the FortressFilter's expected module names
        var testModules = new[]
        {
            new ModuleManifest { Codename = "compote", Tier = "pro", ApiRoutePrefix = "compote" },
            new ModuleManifest { Codename = "fondue", Tier = "pro", ApiRoutePrefix = "fondue" },
            new ModuleManifest { Codename = "saffron", Tier = "pro", ApiRoutePrefix = "saffron" },
            new ModuleManifest { Codename = "sourdough", Tier = "pro", ApiRoutePrefix = "sourdough" },
            new ModuleManifest { Codename = "bastion", Tier = "pro", ApiRoutePrefix = "bastion" },
            new ModuleManifest { Codename = "truffle", Tier = "pro", ApiRoutePrefix = "truffle" },
            new ModuleManifest { Codename = "tunnel", Tier = "pro", ApiRoutePrefix = "tunnel" },
            new ModuleManifest { Codename = "sprout", Tier = "pro", ApiRoutePrefix = "sprout" },
            new ModuleManifest { Codename = "drizzle", Tier = "pro", ApiRoutePrefix = "drizzle" },
            new ModuleManifest { Codename = "meringue", Tier = "pro", ApiRoutePrefix = "meringue" },
            new ModuleManifest { Codename = "nutmeg", Tier = "pro", ApiRoutePrefix = "nutmeg" },
            new ModuleManifest { Codename = "biscotti", Tier = "pro", ApiRoutePrefix = "biscotti" },
            new ModuleManifest { Codename = "treacle", Tier = "pro", ApiRoutePrefix = "treacle" },
            new ModuleManifest { Codename = "sage", Tier = "pro", ApiRoutePrefix = "sage" },
            new ModuleManifest { Codename = "terrine", Tier = "pro", ApiRoutePrefix = "terrine" },
            new ModuleManifest { Codename = "iptv", Tier = "pro", ApiRoutePrefix = "iptv" },
            new ModuleManifest { Codename = "streaming-logins", Tier = "pro", ApiRoutePrefix = "streaming-logins" },
            new ModuleManifest { Codename = "streaming-services", Tier = "pro", ApiRoutePrefix = "streaming-services" },
            new ModuleManifest { Codename = "security", Tier = "ultra", ApiRoutePrefix = "security" },
            new ModuleManifest { Codename = "rind", Tier = "ultra", ApiRoutePrefix = "rind" },
            new ModuleManifest { Codename = "pepper", Tier = "ultra", ApiRoutePrefix = "pepper" },
            new ModuleManifest { Codename = "crucible", Tier = "ultra", ApiRoutePrefix = "crucible" },
            new ModuleManifest { Codename = "strudel", Tier = "ultra", ApiRoutePrefix = "strudel" },
            new ModuleManifest { Codename = "crumbs", Tier = "ultra", ApiRoutePrefix = "crumbs" },
            new ModuleManifest { Codename = "taffy", Tier = "ultra", ApiRoutePrefix = "taffy" },
            new ModuleManifest { Codename = "cinnamon", Tier = "ultra", ApiRoutePrefix = "cinnamon" },
            new ModuleManifest { Codename = "waffle", Tier = "ultra", ApiRoutePrefix = "waffle" },
            new ModuleManifest { Codename = "custard", Tier = "ultra", ApiRoutePrefix = "custard" },
            new ModuleManifest { Codename = "yeast", Tier = "ultra", ApiRoutePrefix = "yeast" },
            new ModuleManifest { Codename = "brine", Tier = "ultra", ApiRoutePrefix = "brine" },
            new ModuleManifest { Codename = "ladle", Tier = "ultra", ApiRoutePrefix = "ladle" },
            new ModuleManifest { Codename = "vpn", Tier = "ultra", ApiRoutePrefix = "vpn" },
            new ModuleManifest { Codename = "qbittorrent", Tier = "ultra", ApiRoutePrefix = "qbittorrent" },
            new ModuleManifest { Codename = "subtitles", Tier = "ultra", ApiRoutePrefix = "subtitles" },
            new ModuleManifest { Codename = "pretzel", Tier = "ultra", ApiRoutePrefix = "pretzel" },
            new ModuleManifest { Codename = "parfait", Tier = "ultra", ApiRoutePrefix = "parfait" },
            new ModuleManifest { Codename = "menu", Tier = "ultra", ApiRoutePrefix = "menu" },
            new ModuleManifest { Codename = "popsicle", Tier = "ultra", ApiRoutePrefix = "popsicle" },
            new ModuleManifest { Codename = "preserves", Tier = "ultra", ApiRoutePrefix = "preserves" },
            new ModuleManifest { Codename = "marshmallow", Tier = "ultra", ApiRoutePrefix = "marshmallow" },
            new ModuleManifest { Codename = "chowder", Tier = "ultra", ApiRoutePrefix = "chowder" },
            new ModuleManifest { Codename = "watch-party", Tier = "ultra", ApiRoutePrefix = "watch-party" },
            new ModuleManifest { Codename = "marzipan", Tier = "ultra", ApiRoutePrefix = "marzipan" },
            // Standard tier modules
            new ModuleManifest { Codename = "marmalade", Tier = "standard", ApiRoutePrefix = "marmalade" },
            new ModuleManifest { Codename = "tmdb", Tier = "standard", ApiRoutePrefix = "tmdb" },
            new ModuleManifest { Codename = "libraries", Tier = "standard", ApiRoutePrefix = "libraries" },
            new ModuleManifest { Codename = "watchlist", Tier = "standard", ApiRoutePrefix = "watchlist" },
            new ModuleManifest { Codename = "watch-progress", Tier = "standard", ApiRoutePrefix = "watch-progress" },
            new ModuleManifest { Codename = "playlists", Tier = "standard", ApiRoutePrefix = "playlists" },
            new ModuleManifest { Codename = "filesystem", Tier = "standard", ApiRoutePrefix = "filesystem" },
            new ModuleManifest { Codename = "quality-profiles", Tier = "standard", ApiRoutePrefix = "quality-profiles" },
            new ModuleManifest { Codename = "indexers", Tier = "standard", ApiRoutePrefix = "indexers" },
            new ModuleManifest { Codename = "media-ops", Tier = "standard", ApiRoutePrefix = "media-ops" },
            new ModuleManifest { Codename = "downloads", Tier = "standard", ApiRoutePrefix = "downloads" },
            new ModuleManifest { Codename = "next-up", Tier = "standard", ApiRoutePrefix = "next-up" },
            new ModuleManifest { Codename = "milk", Tier = "standard", ApiRoutePrefix = "milk" },
            new ModuleManifest { Codename = "gelatin", Tier = "standard", ApiRoutePrefix = "gelatin" },
            new ModuleManifest { Codename = "churro", Tier = "standard", ApiRoutePrefix = "churro" },
            new ModuleManifest { Codename = "roux", Tier = "standard", ApiRoutePrefix = "roux" },
            new ModuleManifest { Codename = "glaze", Tier = "standard", ApiRoutePrefix = "glaze" },
            new ModuleManifest { Codename = "sorbet", Tier = "standard", ApiRoutePrefix = "sorbet" },
            new ModuleManifest { Codename = "brioche", Tier = "standard", ApiRoutePrefix = "brioche" },
            new ModuleManifest { Codename = "nectar", Tier = "standard", ApiRoutePrefix = "nectar" },
            new ModuleManifest { Codename = "ganache", Tier = "standard", ApiRoutePrefix = "ganache" },
            new ModuleManifest { Codename = "bisque", Tier = "standard", ApiRoutePrefix = "bisque" },
            // Gadget routes
            new ModuleManifest { Codename = "synapse-admin", Tier = "ultra", ApiRoutePrefix = "gadgets/synapse-admin" },
            new ModuleManifest { Codename = "gamebot", Tier = "ultra", ApiRoutePrefix = "gadgets/gamebot" },
            new ModuleManifest { Codename = "media-bridge", Tier = "ultra", ApiRoutePrefix = "gadgets/media-bridge" },
            new ModuleManifest { Codename = "bot", Tier = "ultra", ApiRoutePrefix = "gadgets/bot" },
            new ModuleManifest { Codename = "matrix", Tier = "ultra", ApiRoutePrefix = "gadgets/matrix" },
        };

        foreach (var module in testModules)
        {
            ModuleRegistry.Register(module);
        }
    }

    public async Task InitializeAsync()
    {
        await Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        Client?.Dispose();
        _scope?.Dispose();
        await Factory.DisposeAsync();
    }

    public void Dispose()
    {
        DisposeAsync().GetAwaiter().GetResult();
    }

    /// <summary>
    /// Authenticate as a standard user
    /// </summary>
    protected void AuthenticateAsUser(string userId = "test-user", string role = "user")
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Role, role)
        };

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        // Serialize a flat claim payload only — serializing the whole
        // ClaimsPrincipal cycles through Subject/Actor claims infinitely.
        var payload = JsonSerializer.Serialize(new
        {
            claims = claims.Select(c => new { c.Type, c.Value, c.ValueType })
        });
        Client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Test", Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(payload)));

        TestAuthHandler.SetTestUser(principal);
    }

    /// <summary>
    /// Authenticate as admin
    /// </summary>
    protected void AuthenticateAsAdmin(string userId = "admin-user")
    {
        AuthenticateAsUser(userId, "admin");
    }

    /// <summary>
    /// Clear authentication
    /// </summary>
    protected void ClearAuthentication()
    {
        Client.DefaultRequestHeaders.Authorization = null;
        TestAuthHandler.SetTestUser(null);
    }

    /// <summary>
    /// Setup a mocked HTTP response for external service calls
    /// </summary>
    protected Mock<HttpMessageHandler> SetupHttpMock(HttpResponseMessage response)
    {
        var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(response)
            .Verifiable();
        
        HandlerMocks.Add(handlerMock);
        return handlerMock;
    }

    /// <summary>
    /// Setup a mocked HTTP response with JSON content
    /// </summary>
    protected Mock<HttpMessageHandler> SetupHttpMockJson(object jsonContent, HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        var json = JsonSerializer.Serialize(jsonContent);
        var response = new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
        };
        return SetupHttpMock(response);
    }

    /// <summary>
    /// Seed a license in the database for tier testing
    /// </summary>
    protected async Task SeedLicenseAsync(string tier, string? serial = null)
    {
        serial ??= tier switch
        {
            "pro" => "WNX-PRO-AAAA-BBBB-CCCC",
            "ultra" => "WNX-ULT-AAAA-BBBB-CCCC",
            _ => "WNX-STD-AAAA-BBBB-CCCC"
        };

        var hash = CellarController.ComputeHash(serial);
        var licenseJson = JsonSerializer.Serialize(new
        {
            tier,
            serial,
            hash,
            activated_at = DateTime.UtcNow.ToString("o"),
            activation_id = $"act-{Guid.NewGuid():N}[..8]"
        });

        var existing = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "cellar_license" && s.UserId == "");
        if (existing != null) existing.Value = licenseJson;
        else DbContext.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseJson });
        
        await DbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Seed TMDB API key
    /// </summary>
    protected async Task SeedTmdbKeyAsync(string apiKey = "test-tmdb-key")
    {
        var existing = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.UserId == "");
        if (existing != null) existing.Value = apiKey;
        else DbContext.Settings.Add(new AppSetting { Key = "tmdb_api_key", Value = apiKey, UserId = "" });
        await DbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Seed qBittorrent settings
    /// </summary>
    protected async Task SeedQbitSettingsAsync(string host = "localhost", int port = 8080, string username = "admin", string password = "password")
    {
        var json = JsonSerializer.Serialize(new { host, port, username, password, enabled = true });
        var existing = await DbContext.Settings.FirstOrDefaultAsync(s => s.Key == "qbittorrent_settings" && s.UserId == "");
        if (existing != null) existing.Value = json;
        else DbContext.Settings.Add(new AppSetting { Key = "qbittorrent_settings", Value = json, UserId = "" });
        await DbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Create a test library
    /// </summary>
    protected async Task<Library> CreateTestLibraryAsync(string name = "Test Library", string path = "/data/media/movies", string mediaType = "movies")
    {
        var library = new Library
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Path = path,
            MediaType = mediaType,
            ItemCount = 0,
            TotalSize = 0,
            ScanStatus = "idle",
            CreatedAt = DateTime.UtcNow
        };
        DbContext.Libraries.Add(library);
        await DbContext.SaveChangesAsync();
        return library;
    }

    /// <summary>
    /// Create test media items
    /// </summary>
    protected async Task<List<MediaItem>> CreateTestMediaItemsAsync(string libraryId, int count = 5)
    {
        var items = new List<MediaItem>();
        for (int i = 0; i < count; i++)
        {
            var item = new MediaItem
            {
                Id = Guid.NewGuid().ToString(),
                LibraryId = libraryId,
                Title = $"Test Movie {i + 1}",
                FilePath = $"/data/media/movies/Test Movie {i + 1}.mkv",
                FileSize = 1024L * 1024 * 1024 * (i + 1),
                MediaType = "movie",
                TmdbId = 10000 + i,
                Year = 2020 + i,
                Rating = 7.5 + (i * 0.1),
                CreatedAt = DateTime.UtcNow
            };
            items.Add(item);
            DbContext.MediaItems.Add(item);
        }
        await DbContext.SaveChangesAsync();
        return items;
    }

    /// <summary>
    /// Assert response has expected status code and content type
    /// </summary>
    protected static void AssertJsonResponse(HttpResponseMessage response, HttpStatusCode expectedStatus = HttpStatusCode.OK)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    /// <summary>
    /// Deserialize response content to T
    /// </summary>
    protected static async Task<T> DeserializeResponse<T>(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(content, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        })!;
    }

    /// <summary>
    /// Deserialize response to JsonElement for flexible assertions
    /// </summary>
    protected static async Task<JsonElement> DeserializeResponseElement(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(content).RootElement;
    }
}

/// <summary>
/// Test authentication handler that reads the test user from a static property
/// </summary>
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private static ClaimsPrincipal? _testUser;

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        Microsoft.Extensions.Logging.ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    internal static void SetTestUser(ClaimsPrincipal? user)
    {
        _testUser = user;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var user = _testUser;
        if (user == null)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var ticket = new AuthenticationTicket(user, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
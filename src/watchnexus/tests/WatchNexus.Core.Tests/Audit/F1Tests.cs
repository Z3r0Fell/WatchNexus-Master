using System.Net;

namespace WatchNexus.Core.Tests.Audit;

/// <summary>
/// Audit slice F1: the TMDB discover proxy must forward the filters the
/// Anime (with_original_language) and Discover (vote_count.gte) pages send.
/// </summary>
public class F1Tests
{
    private sealed class CapturingHandler : HttpMessageHandler
    {
        public Uri? LastUri { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            LastUri = request.RequestUri;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"results\":[]}")
            });
        }
    }

    private static (TmdbProxyController controller, CapturingHandler handler) Create()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"F1_{Guid.NewGuid()}").Options);
        db.Settings.Add(new AppSetting { Key = "tmdb_api_key", UserId = "", Value = "{\"api_key\":\"k\"}" });
        db.SaveChanges();

        var handler = new CapturingHandler();
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(() => new HttpClient(handler, false));
        var config = new ConfigurationBuilder().Build();
        return (new TmdbProxyController(factory.Object, db, config), handler);
    }

    [Fact]
    public async Task Discover_ForwardsOriginalLanguageAndVoteFloor()
    {
        var (controller, handler) = Create();

        await controller.Discover("tv", 1, "16", "popularity.desc", "ja", 100);

        var query = handler.LastUri!.Query;
        Assert.Contains("with_original_language=ja", query);
        Assert.Contains("vote_count.gte=100", query);
        Assert.Contains("with_genres=16", query);
    }

    [Fact]
    public async Task Discover_OmitsOptionalFiltersWhenAbsent()
    {
        var (controller, handler) = Create();

        await controller.Discover("movie");

        var query = handler.LastUri!.Query;
        Assert.DoesNotContain("with_original_language", query);
        Assert.DoesNotContain("vote_count.gte", query);
    }
}

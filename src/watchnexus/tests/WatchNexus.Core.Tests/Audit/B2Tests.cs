using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Tests.Integration;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

/// <summary>Regression tests for audit slice B2 (Core/Content/Crucible/Crumbs/DownloadEngine controllers).</summary>
public class B2Tests : IntegrationTestBase
{
    private static StringContent Json(object o) =>
        new(JsonSerializer.Serialize(o), Encoding.UTF8, "application/json");

    private async Task SeedUserAsync(string id, string username, string email, string role = "user")
    {
        DbContext.Users.Add(new WatchNexus.Shared.AppUser
        {
            Id = id, Username = username, Email = email, Role = role,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Str0ng!Passw0rd#"),
        });
        await DbContext.SaveChangesAsync();
    }

    [Fact]
    public async Task Profiles_Anonymous_DoesNotExposeEmail()
    {
        await SeedUserAsync("u1", "alice", "alice@example.com");
        ClearAuthentication();
        var resp = await Client.GetAsync("/api/users/profiles");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("alice", body);
        Assert.DoesNotContain("alice@example.com", body);
    }

    [Fact]
    public async Task CreateUser_DuplicateUsername_Conflict()
    {
        await SeedUserAsync("u1", "alice", "alice@example.com");
        AuthenticateAsAdmin();
        var resp = await Client.PostAsync("/api/users", Json(new { email = "other@example.com", username = "alice", password = "Str0ng!Passw0rd#" }));
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    [Fact]
    public async Task CreateUser_InvalidRole_BadRequest()
    {
        AuthenticateAsAdmin();
        var resp = await Client.PostAsync("/api/users", Json(new { email = "new@example.com", username = "newbie", password = "Str0ng!Passw0rd#", role = "root" }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Theory]
    [InlineData("/api/bastion/config")]
    [InlineData("/api/bastion/audit")]
    [InlineData("/api/tunnel/peers")]
    [InlineData("/api/tunnel/config")]
    public async Task ServerConfig_NonAdmin_Forbidden(string url)
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        var resp = await Client.GetAsync(url);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task BastionConfig_Admin_Ok()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsAdmin();
        var resp = await Client.GetAsync("/api/bastion/config");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    private async Task<string> SeedMovieAsync(string ownerId)
    {
        var lib = await CreateTestLibraryAsync(name: "Lib " + ownerId, userId: ownerId);
        var item = new WatchNexus.Core.Data.MediaItem { LibraryId = lib.Id, Title = "Owned " + ownerId, MediaType = "movies", FilePath = "" };
        DbContext.MediaItems.Add(item);
        await DbContext.SaveChangesAsync();
        return item.Id;
    }

    [Fact]
    public async Task FondueMovies_ScopedToCallersLibraries()
    {
        await SeedLicenseAsync("ultra");
        await SeedMovieAsync("other-user");
        var mineId = await SeedMovieAsync("test-user");
        AuthenticateAsUser();
        var json = await DeserializeResponseElement(await Client.GetAsync("/api/fondue/movies"));
        Assert.Equal(1, json.GetProperty("total").GetInt32());
        var movies = json.GetProperty("movies");
        Assert.Equal(1, movies.GetArrayLength());
        Assert.Equal(mineId, movies[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task FondueDeleteMovie_OtherUsersItem_NotFound_OwnItem_Ok()
    {
        await SeedLicenseAsync("ultra");
        var theirs = await SeedMovieAsync("other-user");
        var mine = await SeedMovieAsync("test-user");
        AuthenticateAsUser();
        Assert.Equal(HttpStatusCode.NotFound, (await Client.DeleteAsync($"/api/fondue/movies/{theirs}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Client.DeleteAsync($"/api/fondue/movies/{mine}")).StatusCode);
        DbContext.ChangeTracker.Clear();
        Assert.True(await DbContext.MediaItems.AnyAsync(m => m.Id == theirs));
        Assert.False(await DbContext.MediaItems.AnyAsync(m => m.Id == mine));
    }

    [Fact]
    public async Task FondueConfigPut_NonAdmin_Forbidden()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        var resp = await Client.PutAsync("/api/fondue/config", Json(new { auto_search = false }));
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task RevokeSession_UnknownId_NotFound()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        var resp = await Client.DeleteAsync("/api/bastion/sessions/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task RevokeAllSessions_BumpsTokenVersion_AndReissuesToken()
    {
        await SeedLicenseAsync("ultra");
        await SeedUserAsync("test-user", "tester", "tester@example.com");
        AuthenticateAsUser();
        var before = await WatchNexus.Core.Auth.TokenVersionStore.GetAsync(DbContext, "test-user");
        var resp = await Client.PostAsync("/api/bastion/sessions/revoke-all", null);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await DeserializeResponseElement(resp);
        Assert.False(string.IsNullOrEmpty(json.GetProperty("access_token").GetString()));
        DbContext.ChangeTracker.Clear();
        var after = await WatchNexus.Core.Auth.TokenVersionStore.GetAsync(DbContext, "test-user");
        Assert.Equal(before + 1, after);
    }

    [Fact]
    public async Task ChurroClients_NotConfigured_ReturnsEmpty_AndTestIs404()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        var resp = await Client.GetAsync("/api/churro/clients");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await DeserializeResponseElement(resp);
        Assert.Equal(0, json.GetArrayLength());

        var test = await Client.PostAsync("/api/churro/clients/qbittorrent/test", null);
        Assert.Equal(HttpStatusCode.NotFound, test.StatusCode);
    }

    [Fact]
    public async Task WatchProgress_MissingTmdbId_BadRequest()
    {
        AuthenticateAsUser();
        var resp = await Client.PostAsync("/api/watch-progress", Json(new { media_type = "movie", progress = 10 }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task WatchProgress_NonStringMediaType_DoesNot500()
    {
        AuthenticateAsUser();
        var resp = await Client.PostAsync("/api/watch-progress", Json(new { tmdb_id = 5, media_type = 7, progress = 10 }));
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task NextUp_InProgressItemsNotDroppedByPreFilterTake()
    {
        AuthenticateAsUser();
        // 4 finished items whose keys sort ahead, then 1 in-progress item.
        for (var i = 0; i < 4; i++)
            await Client.PostAsync("/api/watch-progress", Json(new { tmdb_id = 900 + i, media_type = "movie", progress = 100 }));
        await Client.PostAsync("/api/watch-progress", Json(new { tmdb_id = 100, media_type = "movie", progress = 50 }));
        var resp = await Client.GetAsync("/api/next-up?limit=1");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await DeserializeResponseElement(resp);
        Assert.Equal(1, json.GetArrayLength());
    }

    [Fact]
    public async Task CrumbsSave_NumericField_DoesNot500()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        var resp = await Client.PutAsync("/api/crumbs/qbittorrent", Json(new { enabled = true, fields = new { host = "localhost", port = 8080 } }));
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var fields = await DeserializeResponseElement(await Client.GetAsync("/api/crumbs/qbittorrent/fields"));
        Assert.Equal("8080", fields.GetProperty("fields").GetProperty("port").GetString());
    }
}

using System.Net;
using System.Text;
using System.Text.Json;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Core.Tests.Integration;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

public class B3Tests : IntegrationTestBase
{
    private static StringContent Json(object o) => new(JsonSerializer.Serialize(o), Encoding.UTF8, "application/json");

    [Fact]
    public async Task Iptv_SourceMutations_AreAdminOnly_AndUrlsHiddenFromUsers()
    {
        await SeedLicenseAsync("pro");
        var src = new IptvSource { Name = "S", Url = "https://user:pass@example.com/x.m3u" };
        DbContext.IptvSources.Add(src);
        await DbContext.SaveChangesAsync();

        AuthenticateAsUser();
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.DeleteAsync($"/api/iptv/sources/{src.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.PostAsync($"/api/iptv/sources/{src.Id}/refresh", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.PutAsync($"/api/iptv/sources/{src.Id}", Json(new { name = "x" }))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client.PostAsync("/api/iptv/sources?name=a&url=https://example.com/a.m3u", null)).StatusCode);

        var list = await DeserializeResponseElement(await Client.GetAsync("/api/iptv/sources"));
        Assert.Equal(JsonValueKind.Null, list[0].GetProperty("url").ValueKind);

        AuthenticateAsAdmin();
        var adminList = await DeserializeResponseElement(await Client.GetAsync("/api/iptv/sources"));
        Assert.Equal(src.Url, adminList[0].GetProperty("url").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Client.DeleteAsync($"/api/iptv/sources/{src.Id}")).StatusCode);
    }

    [Fact]
    public async Task Drizzle_RemoveItem_RejectsOtherUsersPlaylist()
    {
        await SeedLicenseAsync("pro");
        var pl = new Playlist { UserId = "owner", Name = "P" };
        DbContext.Playlists.Add(pl);
        var item = new PlaylistItem { PlaylistId = pl.Id, Title = "T" };
        DbContext.PlaylistItems.Add(item);
        await DbContext.SaveChangesAsync();

        AuthenticateAsUser("attacker");
        var resp = await Client.DeleteAsync($"/api/drizzle/playlists/{pl.Id}/items/{item.Id}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        DbContext.ChangeTracker.Clear();
        Assert.NotNull(await DbContext.PlaylistItems.FindAsync(item.Id));
    }

    [Fact]
    public async Task Drizzle_UiContract_CreateViaQuery_ListWrapped_NumericTmdbId()
    {
        await SeedLicenseAsync("pro");
        AuthenticateAsUser();
        var created = await Client.PostAsync("/api/drizzle/playlists?name=Mine", null);
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var id = (await DeserializeResponseElement(created)).GetProperty("id").GetString();

        var add = await Client.PostAsync($"/api/drizzle/playlists/{id}/items", Json(new { tmdb_id = 603, title = "The Matrix", poster_path = "/p.jpg" }));
        Assert.Equal(HttpStatusCode.OK, add.StatusCode);

        var list = await DeserializeResponseElement(await Client.GetAsync("/api/drizzle/playlists"));
        var first = list.GetProperty("playlists")[0];
        Assert.Equal("Mine", first.GetProperty("name").GetString());
        Assert.Equal(1, first.GetProperty("item_count").GetInt32());
    }

    [Fact]
    public async Task Gadgets_Import_Returns501_AndEnableDisableRoundTrips()
    {
        AuthenticateAsUser();
        var imp = await Client.PostAsync("/api/gadgets/import-url?url=https://x/y.zip", null);
        Assert.Equal(HttpStatusCode.NotImplemented, imp.StatusCode);
        Assert.Equal("not_supported", (await DeserializeResponseElement(imp)).GetProperty("code").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Client.PostAsync("/api/gadgets/plugins/weather/disable", Json(new { }))).StatusCode);
        var plugins = await DeserializeResponseElement(await Client.GetAsync("/api/gadgets/plugins"));
        var weather = plugins.EnumerateArray().First(p => p.GetProperty("id").GetString() == "weather");
        Assert.Equal("inactive", weather.GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Client.PostAsync("/api/gadgets/plugins/weather/enable", Json(new { }))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.PostAsync("/api/gadgets/plugins/nope/enable", Json(new { }))).StatusCode);
    }

    [Fact]
    public async Task Milk_SetTheme_AcceptsQueryWithoutBody()
    {
        AuthenticateAsUser();
        var resp = await Client.PostAsync("/api/milk/set-theme?theme_type=ocean", null);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal("ocean", (await DeserializeResponseElement(resp)).GetProperty("active_theme").GetString());
    }

    [Fact]
    public async Task Ladle_SaveConfig_RejectsNonObject()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        var resp = await Client.PutAsync("/api/gadgets/ladle/config", Json(new[] { 1, 2 }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Theory]
    [InlineData("Movie.1080p.BluRay", "Movie", null)]
    [InlineData("The.Matrix.1999.1080p", "The Matrix", 1999)]
    [InlineData("2001 A Space Odyssey (1968)", "2001 A Space Odyssey", 1968)]
    public void Libraries_ParseTitle_YearDetection(string file, string name, int? year)
    {
        var (n, y) = LibrariesController.ParseTitle(file);
        Assert.Equal(name, n);
        Assert.Equal(year, y);
    }
}

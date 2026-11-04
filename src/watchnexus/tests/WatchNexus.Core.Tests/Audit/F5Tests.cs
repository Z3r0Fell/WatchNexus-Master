using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Tests.Integration;
using Xunit;

namespace WatchNexus.Core.Tests.Audit;

/// <summary>Audit slice F5 regression tests (watch party WS, Milk theme contract).</summary>
public class F5Tests : IntegrationTestBase
{
    [Fact]
    public async Task WatchPartyWebSocket_ConnectsAndRelaysToSender()
    {
        await SeedLicenseAsync("ultra");
        AuthenticateAsUser();
        var ws = Factory.Server.CreateWebSocketClient();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var socket = await ws.ConnectAsync(new Uri(Factory.Server.BaseAddress, "api/watch-party/f5party/ws"), cts.Token);
        Assert.Equal(WebSocketState.Open, socket.State);

        var payload = Encoding.UTF8.GetBytes("{\"type\":\"chat\",\"text\":\"hi\",\"client_id\":\"abc\"}");
        await socket.SendAsync(payload, WebSocketMessageType.Text, true, cts.Token);
        var buf = new byte[1024];
        var r = await socket.ReceiveAsync(buf, cts.Token);
        Assert.Contains("\"client_id\":\"abc\"", Encoding.UTF8.GetString(buf, 0, r.Count));
        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", cts.Token);
    }

    [Fact]
    public async Task MilkCustomTheme_PersistsColors_AndKeepsCustomCss()
    {
        AuthenticateAsUser("f5-user");
        DbContext.Settings.Add(new WatchNexus.Shared.AppSetting { Key = "custom_css", Value = "body{}", UserId = "f5-user" });
        await DbContext.SaveChangesAsync();

        var resp = await Client.PostAsJsonAsync("/api/milk/custom-theme",
            new { name = "Ocean", colors = new { primary = "#0EA5E9", background = "#0C1222" } });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var forge = await Client.GetFromJsonAsync<JsonElement>("/api/milk/theme-forge");
        Assert.Equal("#0EA5E9", forge.GetProperty("current_theme").GetProperty("colors").GetProperty("primary").GetString());

        DbContext.ChangeTracker.Clear();
        var css = await DbContext.Settings.FirstAsync(s => s.UserId == "f5-user" && s.Key == "custom_css");
        Assert.Equal("body{}", css.Value);
    }
}

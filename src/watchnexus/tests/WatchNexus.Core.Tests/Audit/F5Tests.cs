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
}

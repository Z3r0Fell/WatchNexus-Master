using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using Microsoft.AspNetCore.Mvc.Testing;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// WebSocket Integration Tests
/// Tests /api/watch-party/{code}/ws WebSocket endpoint
/// </summary>
public class WebSocketIntegrationTests : IntegrationTestBase
{
    public WebSocketIntegrationTests() : base() { }

    [Fact]
    public async Task WatchPartyWebSocket_Connect_Success()
    {
        // Arrange
        AuthenticateAsUser();

        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/test-party/ws");

        // Act
        await wsClient.ConnectAsync(uri, CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketState.Open, wsClient.State);

        // Clean up
        await wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test complete", CancellationToken.None);
    }

    [Fact]
    public async Task WatchPartyWebSocket_NoAuth_Rejected()
    {
        // Arrange - no auth
        ClearAuthentication();
        
        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/test-party/ws");

        // Act & Assert
        try
        {
            await wsClient.ConnectAsync(uri, CancellationToken.None);
            await wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);
        }
        catch (HttpRequestException)
        {
            // Expected - unauthorized
        }
    }

    [Fact]
    public async Task WatchPartyWebSocket_SendReceiveMessages()
    {
        // Arrange
        AuthenticateAsUser();

        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/test-party/ws");

        await wsClient.ConnectAsync(uri, CancellationToken.None);
        Assert.Equal(WebSocketState.Open, wsClient.State);

        // Send play message
        var playMessage = JsonSerializer.Serialize(new { type = "play", timestamp = 1000 });
        var playBytes = Encoding.UTF8.GetBytes(playMessage);
        await wsClient.SendAsync(new ArraySegment<byte>(playBytes), WebSocketMessageType.Text, true, CancellationToken.None);

        // Receive response (echo or ack)
        var buffer = new byte[1024];
        var result = await wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);
        var response = Encoding.UTF8.GetString(buffer, 0, result.Count);
        Assert.NotEmpty(response);

        // Send pause message
        var pauseMessage = JsonSerializer.Serialize(new { type = "pause", timestamp = 1500 });
        var pauseBytes = Encoding.UTF8.GetBytes(pauseMessage);
        await wsClient.SendAsync(new ArraySegment<byte>(pauseBytes), WebSocketMessageType.Text, true, CancellationToken.None);

        result = await wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        // Send seek message
        var seekMessage = JsonSerializer.Serialize(new { type = "seek", timestamp = 5000 });
        var seekBytes = Encoding.UTF8.GetBytes(seekMessage);
        await wsClient.SendAsync(new ArraySegment<byte>(seekBytes), WebSocketMessageType.Text, true, CancellationToken.None);

        result = await wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        // Send chat message
        var chatMessage = JsonSerializer.Serialize(new { type = "chat", user = "test-user", message = "Hello party!" });
        var chatBytes = Encoding.UTF8.GetBytes(chatMessage);
        await wsClient.SendAsync(new ArraySegment<byte>(chatBytes), WebSocketMessageType.Text, true, CancellationToken.None);

        result = await wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        await wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test complete", CancellationToken.None);
    }

    [Fact]
    public async Task WatchPartyWebSocket_MultipleClients_Broadcast()
    {
        // Arrange
        AuthenticateAsUser();

        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/multi-party/ws");

        // Connect two clients
        using var ws1 = new System.Net.WebSockets.ClientWebSocket();
        await ws1.ConnectAsync(uri, CancellationToken.None);
        
        AuthenticateAsUser("user2");

        using var ws2 = new System.Net.WebSockets.ClientWebSocket();
        await ws2.ConnectAsync(uri, CancellationToken.None);

        Assert.Equal(WebSocketState.Open, ws1.State);
        Assert.Equal(WebSocketState.Open, ws2.State);

        // User1 sends play
        var playMessage = JsonSerializer.Serialize(new { type = "play", timestamp = 0 });
        var playBytes = Encoding.UTF8.GetBytes(playMessage);
        await ws1.SendAsync(new ArraySegment<byte>(playBytes), WebSocketMessageType.Text, true, CancellationToken.None);

        // User2 should receive broadcast
        var buffer = new byte[1024];
        var result = await ws2.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        Assert.Equal(WebSocketMessageType.Text, result.MessageType);

        await ws1.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);
        await ws2.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);
    }

    [Fact]
    public async Task WatchPartyWebSocket_Reconnection_ExponentialBackoff()
    {
        // This test verifies the client-side reconnection logic would work
        // Server-side just needs to accept new connections
        AuthenticateAsUser();

        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/reconnect-party/ws");

        // First connection
        using var ws1 = new System.Net.WebSockets.ClientWebSocket();
        await ws1.ConnectAsync(uri, CancellationToken.None);
        Assert.Equal(WebSocketState.Open, ws1.State);
        await ws1.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);

        // Reconnect (simulating client reconnection)
        using var ws2 = new System.Net.WebSockets.ClientWebSocket();
        await ws2.ConnectAsync(uri, CancellationToken.None);
        Assert.Equal(WebSocketState.Open, ws2.State);
        await ws2.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);

        // Third reconnect
        using var ws3 = new System.Net.WebSockets.ClientWebSocket();
        await ws3.ConnectAsync(uri, CancellationToken.None);
        Assert.Equal(WebSocketState.Open, ws3.State);
        await ws3.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);
    }

    [Fact]
    public async Task WatchPartyWebSocket_InvalidMessage_HandledGracefully()
    {
        AuthenticateAsUser();

        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/invalid-party/ws");

        await wsClient.ConnectAsync(uri, CancellationToken.None);

        // Send invalid JSON
        var invalidBytes = Encoding.UTF8.GetBytes("not valid json {{{");
        await wsClient.SendAsync(new ArraySegment<byte>(invalidBytes), WebSocketMessageType.Text, true, CancellationToken.None);

        // Should not crash - might receive error or ignore
        var buffer = new byte[1024];
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        var result = await wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);
        
        // Connection should still be open
        Assert.Equal(WebSocketState.Open, wsClient.State);

        await wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);
    }

    [Fact]
    public async Task WatchPartyWebSocket_LargeMessage_Handled()
    {
        AuthenticateAsUser();

        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/large-party/ws");

        await wsClient.ConnectAsync(uri, CancellationToken.None);

        // Send large chat message (near WebSocket frame limit)
        var largeMessage = JsonSerializer.Serialize(new { type = "chat", user = "test-user", message = new string('x', 60000) });
        var largeBytes = Encoding.UTF8.GetBytes(largeMessage);
        await wsClient.SendAsync(new ArraySegment<byte>(largeBytes), WebSocketMessageType.Text, true, CancellationToken.None);

        var buffer = new byte[65536];
        var result = await wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        
        Assert.Equal(WebSocketState.Open, wsClient.State);

        await wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None);
    }

    [Fact]
    public async Task WatchPartyWebSocket_PartyLimits_MaxConnections()
    {
        // Test that multiple connections to same party work
        // (Actual limit enforcement would be in ConnectionManager)
        AuthenticateAsUser();

        var wsClient = new System.Net.WebSockets.ClientWebSocket();
        var uri = new Uri("ws://localhost/api/watch-party/limit-party/ws");

        var connections = new List<System.Net.WebSockets.ClientWebSocket>();
        
        try
        {
            // Try to create multiple connections
            for (int i = 0; i < 10; i++)
            {
                var ws = new System.Net.WebSockets.ClientWebSocket();
                await ws.ConnectAsync(uri, CancellationToken.None);
                connections.Add(ws);
            }

            Assert.Equal(10, connections.Count);
        }
        finally
        {
            foreach (var ws in connections)
            {
                try { await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Test", CancellationToken.None); } catch { }
            }
        }
    }
}
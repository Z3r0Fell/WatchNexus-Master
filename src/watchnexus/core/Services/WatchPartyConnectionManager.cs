using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;

namespace WatchNexus.Core.Services;

/// <summary>
/// Simple WebSocket connection manager for WatchParty live sync.
/// </summary>
public class WatchPartyConnectionManager
{
    private readonly ConcurrentDictionary<string, List<WebSocket>> _connections = new();

    public async Task HandleConnection(HttpContext context, string partyCode)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        var socket = await context.WebSockets.AcceptWebSocketAsync();
        var connections = _connections.GetOrAdd(partyCode, _ => new List<WebSocket>());

        lock (connections)
        {
            connections.Add(socket);
        }

        try
        {
            await ReceiveLoop(socket, partyCode);
        }
        finally
        {
            lock (connections)
            {
                connections.Remove(socket);
                if (connections.Count == 0)
                    _connections.TryRemove(partyCode, out _);
            }
            await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Connection closed", CancellationToken.None);
        }
    }

    public async Task BroadcastToParty(string partyCode, string message)
    {
        if (!_connections.TryGetValue(partyCode, out var connections))
            return;

        List<WebSocket>? toRemove = null;
        foreach (var socket in connections)
        {
            if (socket.State == WebSocketState.Open)
            {
                try
                {
                    var bytes = Encoding.UTF8.GetBytes(message);
                    await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                }
                catch
                {
                    toRemove ??= new List<WebSocket>();
                    toRemove.Add(socket);
                }
            }
            else
            {
                toRemove ??= new List<WebSocket>();
                toRemove.Add(socket);
            }
        }

        if (toRemove != null)
        {
            lock (connections)
            {
                foreach (var s in toRemove)
                    connections.Remove(s);
            }
        }
    }

    private async Task ReceiveLoop(WebSocket socket, string partyCode)
    {
        var buffer = new byte[4096];
        while (socket.State == WebSocketState.Open)
        {
            try
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
                {
                    var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    await BroadcastToParty(partyCode, message);
                }
            }
            catch
            {
                break;
            }
        }
    }
}

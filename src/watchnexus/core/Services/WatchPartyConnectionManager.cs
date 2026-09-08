using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;

namespace WatchNexus.Core.Services;

/// <summary>
/// Simple WebSocket connection manager for WatchParty live sync.
/// Enforces per-connection message size and rate limits to prevent amplified DoS.
/// </summary>
public class WatchPartyConnectionManager
{
    private const int MaxMessageSize = 65536;      // 64 KB max per frame
    private const int MaxMessagesPerSecond = 20;   // rate limit per connection
    private const int MaxConnectionsPerParty = 50; // cap per party

    private readonly ConcurrentDictionary<string, List<WebSocket>> _connections = new();
    private readonly ConcurrentDictionary<WebSocket, RateLimiter> _rateLimiters = new();

    public async Task HandleConnection(HTTPContext context, string partyCode)
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
            if (connections.Count >= MaxConnectionsPerParty)
            {
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                _ = socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Party full", CancellationToken.None);
                return;
            }
            connections.Add(socket);
        }

        _rateLimiters.TryAdd(socket, new RateLimiter(MaxMessagesPerSecond));

        try
        {
            await ReceiveLoop(socket, partyCode);
        }
        finally
        {
            _rateLimiters.TryRemove(socket, out _);
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
        var buffer = new byte[MaxMessageSize];
        while (socket.State == WebSocketState.Open)
        {
            try
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
                {
                    if (result.Count > MaxMessageSize)
                        continue; // drop oversized frame

                    var limiter = _rateLimiters.GetValueOrDefault(socket);
                    if (limiter != null && !limiter.Allow())
                        continue; // rate limited

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

    /// <summary>Simple token-bucket rate limiter for per-connection WS frames.</summary>
    private sealed class RateLimiter
    {
        private readonly int _maxPerSecond;
        private readonly Queue<DateTime> _timestamps = new();
        private readonly object _lock = new();

        public RateLimiter(int maxPerSecond)
        {
            _maxPerSecond = maxPerSecond;
        }

        public bool Allow()
        {
            var now = DateTime.UtcNow;
            lock (_lock)
            {
                while (_timestamps.Count > 0 && (now - _timestamps.Peek()).TotalSeconds >= 1.0)
                    _timestamps.Dequeue();

                if (_timestamps.Count >= _maxPerSecond)
                    return false;

                _timestamps.Enqueue(now);
                return true;
            }
        }
    }
}
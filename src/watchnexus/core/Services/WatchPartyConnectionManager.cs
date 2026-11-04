using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using Microsoft.AspNetCore.Http;

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
    // WebSocket allows only one outstanding SendAsync per socket; broadcasts from
    // several senders must be serialized per receiving socket.
    private readonly ConcurrentDictionary<WebSocket, SemaphoreSlim> _sendLocks = new();

    public async Task HandleConnection(HttpContext context, string partyCode)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        var socket = await context.WebSockets.AcceptWebSocketAsync();
        var connections = _connections.GetOrAdd(partyCode, _ => new List<WebSocket>());

        bool full;
        lock (connections)
        {
            full = connections.Count >= MaxConnectionsPerParty;
            if (!full) connections.Add(socket);
        }
        if (full)
        {
            // The 101 response has already been sent, so the status code can no
            // longer change (setting it threw) — just close the socket.
            await SafeCloseAsync(socket, WebSocketCloseStatus.PolicyViolation, "Party full");
            return;
        }

        _rateLimiters.TryAdd(socket, new RateLimiter(MaxMessagesPerSecond));
        _sendLocks.TryAdd(socket, new SemaphoreSlim(1, 1));

        try
        {
            await ReceiveLoop(socket, partyCode);
        }
        finally
        {
            _rateLimiters.TryRemove(socket, out _);
            _sendLocks.TryRemove(socket, out _);
            lock (connections)
            {
                connections.Remove(socket);
                if (connections.Count == 0)
                    _connections.TryRemove(new KeyValuePair<string, List<WebSocket>>(partyCode, connections));
            }
            await SafeCloseAsync(socket, WebSocketCloseStatus.NormalClosure, "Connection closed");
        }
    }

    private static async Task SafeCloseAsync(WebSocket socket, WebSocketCloseStatus status, string reason)
    {
        try
        {
            if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
                await socket.CloseAsync(status, reason, CancellationToken.None);
        }
        catch { /* peer already gone */ }
    }

    public async Task BroadcastToParty(string partyCode, string message)
    {
        if (!_connections.TryGetValue(partyCode, out var connections))
            return;

        // Snapshot under the lock: joins/leaves mutate the list concurrently
        // (enumerating it directly threw "Collection was modified").
        WebSocket[] snapshot;
        lock (connections) snapshot = connections.ToArray();

        var bytes = Encoding.UTF8.GetBytes(message);
        List<WebSocket>? toRemove = null;
        foreach (var socket in snapshot)
        {
            if (socket.State == WebSocketState.Open)
            {
                try
                {
                    if (_sendLocks.TryGetValue(socket, out var sendLock))
                    {
                        await sendLock.WaitAsync();
                        try { await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None); }
                        finally { sendLock.Release(); }
                    }
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

                if (!result.EndOfMessage)
                {
                    // Message larger than MaxMessageSize: drain the remainder and
                    // drop it (previously each 64 KB chunk was broadcast as its own
                    // message, so the size cap was never enforced).
                    while (!result.EndOfMessage && socket.State == WebSocketState.Open)
                        result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    continue;
                }

                if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
                {
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

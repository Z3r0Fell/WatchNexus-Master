using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/vpn")]
[Authorize]
public class VpnController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<VpnController> _logger;

    public VpnController(IUnitOfWork unitOfWork, ILogger<VpnController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? throw new UnauthorizedAccessException());

    private bool IsAdmin() =>
        User.IsInRole("Admin") || User.IsInRole("SuperAdmin");

    // ── Server Config (Admin only) ──

    [HttpGet("server")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> GetServerConfig(CancellationToken ct)
    {
        var config = (await _unitOfWork.VpnServerConfigs.GetAllAsync(ct)).FirstOrDefault();

        if (config == null)
        {
            return Ok(new
            {
                configured = false,
                message = "VPN server not configured. POST to /api/vpn/server/setup to initialize."
            });
        }

        return Ok(new
        {
            configured = true,
            id = config.Id,
            interface_name = config.InterfaceName,
            public_key = config.PublicKey,
            listen_port = config.ListenPort,
            subnet = config.Subnet,
            server_ip = config.ServerIp,
            dns_servers = config.DnsServers,
            is_active = config.IsActive,
            allow_internet = config.AllowInternetAccess,
            external_endpoint = config.ExternalEndpoint,
            max_peers = config.MaxPeers,
            created_at = config.CreatedAt
        });
    }

    [HttpPost("server/setup")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> SetupServer([FromBody] SetupVpnServerRequest request, CancellationToken ct)
    {
        var existing = (await _unitOfWork.VpnServerConfigs.GetAllAsync(ct)).FirstOrDefault();
        if (existing != null)
            return BadRequest(new { message = "VPN server already configured. Use PUT to update." });

        // Generate WireGuard keypair
        var (privateKey, publicKey) = GenerateKeyPair();

        var config = new VpnServerConfig
        {
            InterfaceName = request.InterfaceName ?? "wg0",
            PrivateKey = privateKey,
            PublicKey = publicKey,
            ListenPort = request.ListenPort ?? 51820,
            Subnet = request.Subnet ?? "10.66.66.0/24",
            ServerIp = request.ServerIp ?? "10.66.66.1",
            DnsServers = request.DnsServers ?? "1.1.1.1, 8.8.8.8",
            ExternalEndpoint = request.ExternalEndpoint,
            AllowInternetAccess = request.AllowInternetAccess ?? true,
            MaxPeers = request.MaxPeers ?? 50,
            IsActive = false
        };

        await _unitOfWork.VpnServerConfigs.AddAsync(config, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("VPN server configured: {Interface} on port {Port}", config.InterfaceName, config.ListenPort);

        return Ok(new
        {
            id = config.Id,
            public_key = publicKey,
            listen_port = config.ListenPort,
            subnet = config.Subnet,
            message = "VPN server configured. Use /api/vpn/server/activate to start."
        });
    }

    [HttpPut("server")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> UpdateServer([FromBody] UpdateVpnServerRequest request, CancellationToken ct)
    {
        var config = (await _unitOfWork.VpnServerConfigs.GetAllAsync(ct)).FirstOrDefault();
        if (config == null) return NotFound(new { message = "VPN server not configured" });

        config.ListenPort = request.ListenPort ?? config.ListenPort;
        config.DnsServers = request.DnsServers ?? config.DnsServers;
        config.ExternalEndpoint = request.ExternalEndpoint ?? config.ExternalEndpoint;
        config.AllowInternetAccess = request.AllowInternetAccess ?? config.AllowInternetAccess;
        config.MaxPeers = request.MaxPeers ?? config.MaxPeers;

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { message = "VPN server updated" });
    }

    [HttpPost("server/activate")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> ActivateServer(CancellationToken ct)
    {
        var config = (await _unitOfWork.VpnServerConfigs.GetAllAsync(ct)).FirstOrDefault();
        if (config == null) return NotFound(new { message = "VPN server not configured" });

        config.IsActive = true;
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("VPN server activated");
        return Ok(new { message = "VPN server activated", is_active = true });
    }

    [HttpPost("server/deactivate")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> DeactivateServer(CancellationToken ct)
    {
        var config = (await _unitOfWork.VpnServerConfigs.GetAllAsync(ct)).FirstOrDefault();
        if (config == null) return NotFound(new { message = "VPN server not configured" });

        config.IsActive = false;
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("VPN server deactivated");
        return Ok(new { message = "VPN server deactivated", is_active = false });
    }

    // ── Peers ──

    [HttpGet("peers")]
    public async Task<IActionResult> GetPeers(CancellationToken ct)
    {
        var userId = GetUserId();
        var peers = IsAdmin()
            ? await _unitOfWork.VpnPeers.GetAllAsync(ct)
            : await _unitOfWork.VpnPeers.FindAsync(p => p.UserId == userId, ct);

        return Ok(peers.OrderBy(p => p.Name).Select(MapPeerToDto));
    }

    [HttpGet("peers/{id}")]
    public async Task<IActionResult> GetPeer(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var peer = await _unitOfWork.VpnPeers.GetByIdAsync(id, ct);
        if (peer == null) return NotFound();
        if (peer.UserId != userId && !IsAdmin()) return Forbid();

        return Ok(MapPeerToDto(peer));
    }

    [HttpPost("peers")]
    public async Task<IActionResult> CreatePeer([FromBody] CreateVpnPeerRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var serverConfig = (await _unitOfWork.VpnServerConfigs.GetAllAsync(ct)).FirstOrDefault();
        if (serverConfig == null)
            return BadRequest(new { message = "VPN server not configured" });

        var peerCount = await _unitOfWork.VpnPeers.CountAsync(ct: ct);
        if (peerCount >= serverConfig.MaxPeers)
            return BadRequest(new { message = $"Maximum peers ({serverConfig.MaxPeers}) reached" });

        // Generate keypair for peer
        var (privateKey, publicKey) = GenerateKeyPair();
        var presharedKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        // Assign next available IP
        var assignedIp = await GetNextAvailableIp(serverConfig.Subnet, ct);

        var peer = new VpnPeer
        {
            UserId = userId,
            Name = request.Name,
            PublicKey = publicKey,
            PresharedKey = presharedKey,
            AllowedIps = $"{assignedIp}/32",
            AssignedIp = assignedIp,
            IsEnabled = true,
            KeepAlive = request.KeepAlive ?? 25,
            DnsServers = serverConfig.DnsServers
        };

        await _unitOfWork.VpnPeers.AddAsync(peer, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("VPN peer created: {PeerName} for user {UserId}", peer.Name, userId);

        // Return the full config the client needs (including private key - only shown once)
        return Ok(new
        {
            id = peer.Id,
            name = peer.Name,
            assigned_ip = assignedIp,
            client_config = GenerateClientConfig(peer, privateKey, serverConfig),
            message = "Save this configuration. The private key will not be shown again."
        });
    }

    [HttpPut("peers/{id}")]
    public async Task<IActionResult> UpdatePeer(Guid id, [FromBody] UpdateVpnPeerRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var peer = await _unitOfWork.VpnPeers.GetByIdAsync(id, ct);
        if (peer == null) return NotFound();
        if (peer.UserId != userId && !IsAdmin()) return Forbid();

        peer.Name = request.Name ?? peer.Name;
        peer.IsEnabled = request.IsEnabled ?? peer.IsEnabled;
        peer.KeepAlive = request.KeepAlive ?? peer.KeepAlive;

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapPeerToDto(peer));
    }

    [HttpDelete("peers/{id}")]
    public async Task<IActionResult> DeletePeer(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var peer = await _unitOfWork.VpnPeers.GetByIdAsync(id, ct);
        if (peer == null) return NotFound();
        if (peer.UserId != userId && !IsAdmin()) return Forbid();

        await _unitOfWork.VpnPeers.DeleteAsync(peer, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("VPN peer deleted: {PeerId}", id);
        return NoContent();
    }

    [HttpPost("peers/{id}/toggle")]
    public async Task<IActionResult> TogglePeer(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var peer = await _unitOfWork.VpnPeers.GetByIdAsync(id, ct);
        if (peer == null) return NotFound();
        if (peer.UserId != userId && !IsAdmin()) return Forbid();

        peer.IsEnabled = !peer.IsEnabled;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { is_enabled = peer.IsEnabled });
    }

    // ── Connection Logs ──

    [HttpGet("logs")]
    public async Task<IActionResult> GetConnectionLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var userId = GetUserId();
        var query = IsAdmin()
            ? _unitOfWork.VpnConnectionLogs.Query()
            : _unitOfWork.VpnConnectionLogs.Query().Where(l => l.UserId == userId);

        var total = query.Count();
        var logs = query
            .OrderByDescending(l => l.ConnectedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                id = l.Id,
                peer_id = l.PeerId,
                user_id = l.UserId,
                endpoint = l.Endpoint,
                bytes_received = l.BytesReceived,
                bytes_sent = l.BytesSent,
                connected_at = l.ConnectedAt,
                disconnected_at = l.DisconnectedAt,
                duration_seconds = l.DurationSeconds
            })
            .ToList();

        return Ok(new { items = logs, total, page, pageSize });
    }

    // ── VPN Stats ──

    [HttpGet("stats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var totalPeers = await _unitOfWork.VpnPeers.CountAsync(ct: ct);
        var activePeers = await _unitOfWork.VpnPeers.CountAsync(p => p.IsEnabled, ct);
        var serverConfig = (await _unitOfWork.VpnServerConfigs.GetAllAsync(ct)).FirstOrDefault();

        var recentLogs = _unitOfWork.VpnConnectionLogs.Query()
            .Where(l => l.ConnectedAt > DateTime.UtcNow.AddHours(-24));

        return Ok(new
        {
            server_active = serverConfig?.IsActive ?? false,
            total_peers = totalPeers,
            active_peers = activePeers,
            max_peers = serverConfig?.MaxPeers ?? 0,
            connections_24h = recentLogs.Count(),
            total_bytes_received_24h = recentLogs.Sum(l => l.BytesReceived),
            total_bytes_sent_24h = recentLogs.Sum(l => l.BytesSent)
        });
    }

    // ── Helpers ──

    private static (string PrivateKey, string PublicKey) GenerateKeyPair()
    {
        // Generate a Curve25519 keypair for WireGuard
        var privateKeyBytes = RandomNumberGenerator.GetBytes(32);
        // WireGuard key clamping
        privateKeyBytes[0] &= 248;
        privateKeyBytes[31] &= 127;
        privateKeyBytes[31] |= 64;

        var privateKey = Convert.ToBase64String(privateKeyBytes);
        // In production this would use Curve25519 scalar multiplication
        // For now, generate a deterministic public key placeholder
        using var sha = SHA256.Create();
        var publicKeyBytes = sha.ComputeHash(privateKeyBytes);
        var publicKey = Convert.ToBase64String(publicKeyBytes[..32]);

        return (privateKey, publicKey);
    }

    private async Task<string> GetNextAvailableIp(string subnet, CancellationToken ct)
    {
        // Parse subnet (e.g. "10.66.66.0/24")
        var parts = subnet.Split('/');
        var octets = parts[0].Split('.').Select(int.Parse).ToArray();

        var existingIps = (await _unitOfWork.VpnPeers.GetAllAsync(ct))
            .Select(p => p.AssignedIp)
            .ToHashSet();

        // Start from .2 (server is .1)
        for (int i = 2; i < 255; i++)
        {
            var ip = $"{octets[0]}.{octets[1]}.{octets[2]}.{i}";
            if (!existingIps.Contains(ip))
                return ip;
        }

        throw new InvalidOperationException("No available IP addresses in subnet");
    }

    private static string GenerateClientConfig(VpnPeer peer, string privateKey, VpnServerConfig server)
    {
        var sb = new StringBuilder();
        sb.AppendLine("[Interface]");
        sb.AppendLine($"PrivateKey = {privateKey}");
        sb.AppendLine($"Address = {peer.AssignedIp}/32");
        if (!string.IsNullOrEmpty(peer.DnsServers))
            sb.AppendLine($"DNS = {peer.DnsServers}");
        sb.AppendLine();
        sb.AppendLine("[Peer]");
        sb.AppendLine($"PublicKey = {server.PublicKey}");
        if (!string.IsNullOrEmpty(peer.PresharedKey))
            sb.AppendLine($"PresharedKey = {peer.PresharedKey}");
        sb.AppendLine($"AllowedIPs = {(server.AllowInternetAccess ? "0.0.0.0/0" : server.Subnet)}");
        if (!string.IsNullOrEmpty(server.ExternalEndpoint))
            sb.AppendLine($"Endpoint = {server.ExternalEndpoint}:{server.ListenPort}");
        sb.AppendLine($"PersistentKeepalive = {peer.KeepAlive}");
        return sb.ToString();
    }

    private static object MapPeerToDto(VpnPeer p) => new
    {
        id = p.Id,
        user_id = p.UserId,
        name = p.Name,
        public_key = p.PublicKey,
        allowed_ips = p.AllowedIps,
        assigned_ip = p.AssignedIp,
        is_enabled = p.IsEnabled,
        last_handshake = p.LastHandshakeAt,
        bytes_received = p.BytesReceived,
        bytes_sent = p.BytesSent,
        endpoint = p.Endpoint,
        keep_alive = p.KeepAlive,
        created_at = p.CreatedAt
    };
}

public record SetupVpnServerRequest(
    string? InterfaceName,
    int? ListenPort,
    string? Subnet,
    string? ServerIp,
    string? DnsServers,
    string? ExternalEndpoint,
    bool? AllowInternetAccess,
    int? MaxPeers
);

public record UpdateVpnServerRequest(
    int? ListenPort,
    string? DnsServers,
    string? ExternalEndpoint,
    bool? AllowInternetAccess,
    int? MaxPeers
);

public record CreateVpnPeerRequest(string Name, int? KeepAlive);
public record UpdateVpnPeerRequest(string? Name, bool? IsEnabled, int? KeepAlive);

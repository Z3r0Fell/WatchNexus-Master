namespace WatchNexus.Domain.Entities;

/// <summary>
/// VPN peer configuration for WireGuard-based tunnel
/// </summary>
public class VpnPeer : BaseEntity
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string? PresharedKey { get; set; }
    public string AllowedIps { get; set; } = string.Empty; // CIDR notation
    public string AssignedIp { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastHandshakeAt { get; set; }
    public long BytesReceived { get; set; }
    public long BytesSent { get; set; }
    public string? Endpoint { get; set; }
    public int KeepAlive { get; set; } = 25;
    public string? DnsServers { get; set; }

    public virtual User User { get; set; } = null!;
}

/// <summary>
/// VPN server configuration
/// </summary>
public class VpnServerConfig : BaseEntity
{
    public string InterfaceName { get; set; } = "wg0";
    public string PrivateKey { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string ListenAddress { get; set; } = "0.0.0.0";
    public int ListenPort { get; set; } = 51820;
    public string Subnet { get; set; } = "10.66.66.0/24";
    public string ServerIp { get; set; } = "10.66.66.1";
    public string? DnsServers { get; set; } = "1.1.1.1, 8.8.8.8";
    public string? PostUp { get; set; }
    public string? PostDown { get; set; }
    public bool IsActive { get; set; } = false;
    public bool AllowInternetAccess { get; set; } = true;
    public string? ExternalEndpoint { get; set; }
    public int MaxPeers { get; set; } = 50;
}

/// <summary>
/// VPN connection log
/// </summary>
public class VpnConnectionLog : BaseEntity
{
    public Guid PeerId { get; set; }
    public Guid UserId { get; set; }
    public string? Endpoint { get; set; }
    public long BytesReceived { get; set; }
    public long BytesSent { get; set; }
    public DateTime ConnectedAt { get; set; }
    public DateTime? DisconnectedAt { get; set; }
    public int DurationSeconds { get; set; }

    public virtual VpnPeer Peer { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}

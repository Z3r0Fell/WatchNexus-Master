using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Security;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Controllers;

[ApiController]
[Route("api/vpn")]
[Authorize]
public class VpnController : ControllerBase
{
    private readonly AppDbContext _db;
    public VpnController(AppDbContext db) { _db = db; }

    public record ServerSetup(int ListenPort = 51820, string Address = "10.0.0.1/24",
        string Dns = "1.1.1.1", string Endpoint = "", int Mtu = 1420);
    public record PeerCreate(string Name,
        [property: System.Text.Json.Serialization.JsonPropertyName("allowed_ips")] string AllowedIps = "10.0.0.0/24");

    // Peer list/detail shape read by VpnPage.js. Never includes key material.
    private static object PeerView(VpnPeer p) => new
    {
        id = p.Id, name = p.Name, public_key = p.PublicKey,
        address = p.Address, assigned_ip = p.Address, allowed_ips = p.AllowedIps,
        is_active = p.IsActive, is_enabled = p.IsActive,
        bytes_received = p.TransferRx, bytes_sent = p.TransferTx,
        keep_alive = 25, created_at = p.CreatedAt,
    };

    private static string ClientConfig(VpnPeer p, VpnServerConfig s) =>
        $"[Interface]\nPrivateKey = {p.PrivateKey}\nAddress = {p.Address}\nDNS = {s.Dns}\n\n" +
        $"[Peer]\nPublicKey = {s.PublicKey}\nPresharedKey = {p.PresharedKey}\nAllowedIPs = 0.0.0.0/0\n" +
        $"Endpoint = {s.Endpoint}:{s.ListenPort}\nPersistentKeepalive = 25\n";

    private static string Str(System.Text.Json.JsonElement b, string def, params string[] names)
    {
        foreach (var n in names)
            foreach (var p in b.EnumerateObject())
                if (string.Equals(p.Name, n, StringComparison.OrdinalIgnoreCase))
                    return p.Value.ValueKind == System.Text.Json.JsonValueKind.String ? p.Value.GetString() ?? def : p.Value.ToString();
        return def;
    }

    private static int Int(System.Text.Json.JsonElement b, int def, params string[] names) =>
        int.TryParse(Str(b, "", names), out var v) ? v : def;

    private async Task<VpnServerConfig> GetOrCreateServer()
    {
        var config = await _db.VpnServerConfigs.FindAsync("default");
        if (config != null) return config;
        var (privKey, pubKey) = GenerateWgKeyPair();
        config = new VpnServerConfig
        {
            PublicKey = pubKey,
            PrivateKey = privKey,
        };
        _db.VpnServerConfigs.Add(config);
        await _db.SaveChangesAsync();
        return config;
    }

    private static (string PrivateKey, string PublicKey) GenerateWgKeyPair()
    {
        var privateKey = new byte[32];
        RandomNumberGenerator.Fill(privateKey);
        var privParams = new X25519PrivateKeyParameters(privateKey, 0);
        var publicKey = privParams.GeneratePublicKey().GetEncoded();
        return (Convert.ToBase64String(privateKey), Convert.ToBase64String(publicKey));
    }

    [HttpGet("server")]
    public async Task<IActionResult> GetServer()
    {
        var s = await GetOrCreateServer();
        return Ok(new
        {
            s.ListenPort, s.Address, s.Dns, s.Endpoint, s.Mtu,
            public_key = s.PublicKey, is_active = s.IsActive, is_configured = s.IsConfigured,
            @interface = "wg0",
            // snake_case keys read by VpnPage.js
            listen_port = s.ListenPort, subnet = s.Address, dns_servers = s.Dns
        });
    }

    // Accepts both the record's names (listenPort/endpoint/address/dns/mtu) and
    // the snake_case form VpnPage.js sends (listen_port/external_endpoint/subnet/dns_servers).
    [HttpPost("server/setup")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Setup([FromBody] System.Text.Json.JsonElement body)
    {
        if (body.ValueKind != System.Text.Json.JsonValueKind.Object)
            return BadRequest(new { message = "JSON object required" });
        var s = await GetOrCreateServer();
        var port = Int(body, 51820, "listen_port", "listenPort");
        if (port < 1 || port > 65535) return BadRequest(new { message = "listen_port must be 1-65535" });
        s.ListenPort = port;
        s.Address = Str(body, "10.0.0.1/24", "address", "subnet");
        s.Dns = Str(body, "1.1.1.1", "dns", "dns_servers");
        s.Endpoint = Str(body, "", "endpoint", "external_endpoint");
        s.Mtu = Int(body, 1420, "mtu");
        s.IsConfigured = true;
        await _db.SaveChangesAsync();
        return Ok(new { s.ListenPort, s.Address, s.Dns, s.Endpoint, s.Mtu, public_key = s.PublicKey, is_active = s.IsActive, is_configured = true });
    }

    [HttpPut("server")]
    [Authorize(Roles = "admin")]
    public Task<IActionResult> UpdateServer([FromBody] System.Text.Json.JsonElement body) => Setup(body);

    [HttpPost("server/activate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Activate() { var s = await GetOrCreateServer(); s.IsActive = true; await _db.SaveChangesAsync(); return Ok(new { is_active = true }); }

    [HttpPost("server/deactivate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Deactivate() { var s = await GetOrCreateServer(); s.IsActive = false; await _db.SaveChangesAsync(); return Ok(new { is_active = false }); }

    [HttpGet("peers")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetPeers() =>
        Ok((await _db.VpnPeers.OrderBy(p => p.CreatedAt).ToListAsync()).Select(PeerView));

    [HttpGet("peers/{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetPeer(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        return p == null ? NotFound() : Ok(PeerView(p));
    }

    [HttpPost("peers")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreatePeer([FromBody] PeerCreate req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "name is required" });
        var server = await GetOrCreateServer();
        // Lowest free host in the server's /24 (count+2 reused addresses after
        // deletes and overflowed past .254).
        var octets = (server.Address ?? "10.0.0.1/24").Split('/')[0].Split('.');
        var prefix = octets.Length == 4 ? $"{octets[0]}.{octets[1]}.{octets[2]}" : "10.0.0";
        var used = (await _db.VpnPeers.Select(p => p.Address).ToListAsync()).ToHashSet();
        var host = Enumerable.Range(2, 253).FirstOrDefault(h => !used.Contains($"{prefix}.{h}/32"));
        if (host == 0) return Conflict(new { message = "No free addresses left in the VPN subnet" });
        var (privKey, pubKey) = GenerateWgKeyPair();
        var psk = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var peer = new VpnPeer
        {
            Name = req.Name,
            AllowedIps = req.AllowedIps,
            Address = $"{prefix}.{host}/32",
            PublicKey = pubKey,
            PrivateKey = privKey,
            PresharedKey = psk,
        };
        _db.VpnPeers.Add(peer);
        await _db.SaveChangesAsync();
        // Shown once to the admin so the client config can be downloaded.
        return Ok(new
        {
            id = peer.Id, name = peer.Name, public_key = peer.PublicKey,
            private_key = peer.PrivateKey, preshared_key = peer.PresharedKey,
            allowed_ips = peer.AllowedIps, address = peer.Address, assigned_ip = peer.Address,
            is_active = peer.IsActive, is_enabled = peer.IsActive, keep_alive = 25,
            created_at = peer.CreatedAt, client_config = ClientConfig(peer, server),
        });
    }

    [HttpPut("peers/{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdatePeer(string id, [FromBody] PeerCreate req)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        p.Name = req.Name; p.AllowedIps = req.AllowedIps;
        await _db.SaveChangesAsync();
        return Ok(PeerView(p));
    }

    [HttpDelete("peers/{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeletePeer(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        _db.VpnPeers.Remove(p);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("peers/{id}/toggle")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> TogglePeer(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        p.IsActive = !p.IsActive;
        await _db.SaveChangesAsync();
        return Ok(PeerView(p));
    }

    [HttpGet("peers/{id}/qr-data")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> PeerQr(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        var s = await GetOrCreateServer();
        // Complete client config (the old one had no PrivateKey/PresharedKey, so
        // the WireGuard app could not import a working tunnel from it).
        var config = ClientConfig(p, s);
        return Ok(new { qr_data = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(config)), peer_id = id });
    }

    [HttpGet("server/wg-status")]
    public async Task<IActionResult> WgStatus()
    {
        var s = await GetOrCreateServer();
        return Ok(new { @interface = "wg0", is_running = s.IsActive, s.ListenPort, public_key = s.PublicKey,
            peers_connected = await _db.VpnPeers.CountAsync(p => p.IsActive), total_peers = await _db.VpnPeers.CountAsync() });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var s = await GetOrCreateServer();
        return Ok(new
        {
            server_active = s.IsActive, server_configured = s.IsConfigured,
            total_peers = await _db.VpnPeers.CountAsync(),
            active_peers = await _db.VpnPeers.CountAsync(p => p.IsActive),
            total_rx = await _db.VpnPeers.SumAsync(p => p.TransferRx),
            total_tx = await _db.VpnPeers.SumAsync(p => p.TransferTx),
        });
    }
}

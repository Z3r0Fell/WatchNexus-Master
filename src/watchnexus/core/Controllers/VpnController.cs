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
    public record PeerCreate(string Name, string AllowedIps = "10.0.0.0/24");

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
            @interface = "wg0"
        });
    }

    [HttpPost("server/setup")]
    public async Task<IActionResult> Setup([FromBody] ServerSetup req)
    {
        var s = await GetOrCreateServer();
        s.ListenPort = req.ListenPort; s.Address = req.Address; s.Dns = req.Dns;
        s.Endpoint = req.Endpoint; s.Mtu = req.Mtu; s.IsConfigured = true;
        await _db.SaveChangesAsync();
        return Ok(new { s.ListenPort, s.Address, s.Dns, s.Endpoint, s.Mtu, public_key = s.PublicKey, is_active = s.IsActive, is_configured = true });
    }

    [HttpPut("server")]
    public Task<IActionResult> UpdateServer([FromBody] ServerSetup req) => Setup(req);

    [HttpPost("server/activate")]
    public async Task<IActionResult> Activate() { var s = await GetOrCreateServer(); s.IsActive = true; await _db.SaveChangesAsync(); return Ok(new { is_active = true }); }

    [HttpPost("server/deactivate")]
    public async Task<IActionResult> Deactivate() { var s = await GetOrCreateServer(); s.IsActive = false; await _db.SaveChangesAsync(); return Ok(new { is_active = false }); }

    [HttpGet("peers")]
    public async Task<IActionResult> GetPeers() => Ok(await _db.VpnPeers.ToListAsync());

    [HttpGet("peers/{id}")]
    public async Task<IActionResult> GetPeer(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        return p == null ? NotFound() : Ok(p);
    }

    [HttpPost("peers")]
    public async Task<IActionResult> CreatePeer([FromBody] PeerCreate req)
    {
        var count = await _db.VpnPeers.CountAsync();
        var (privKey, pubKey) = GenerateWgKeyPair();
        var psk = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var peer = new VpnPeer
        {
            Name = req.Name,
            AllowedIps = req.AllowedIps,
            Address = $"10.0.0.{count + 2}/32",
            PublicKey = pubKey,
            PrivateKey = privKey,
            PresharedKey = psk,
        };
        _db.VpnPeers.Add(peer);
        await _db.SaveChangesAsync();
        return Ok(peer);
    }

    [HttpPut("peers/{id}")]
    public async Task<IActionResult> UpdatePeer(string id, [FromBody] PeerCreate req)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        p.Name = req.Name; p.AllowedIps = req.AllowedIps;
        await _db.SaveChangesAsync();
        return Ok(p);
    }

    [HttpDelete("peers/{id}")]
    public async Task<IActionResult> DeletePeer(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        _db.VpnPeers.Remove(p);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted" });
    }

    [HttpPost("peers/{id}/toggle")]
    public async Task<IActionResult> TogglePeer(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        p.IsActive = !p.IsActive;
        await _db.SaveChangesAsync();
        return Ok(p);
    }

    [HttpGet("peers/{id}/qr-data")]
    public async Task<IActionResult> PeerQr(string id)
    {
        var p = await _db.VpnPeers.FindAsync(id);
        if (p == null) return NotFound();
        var s = await GetOrCreateServer();
        var config = $"[Interface]\nAddress = {p.Address}\nDNS = {s.Dns}\n\n[Peer]\nPublicKey = {s.PublicKey}\nAllowedIPs = 0.0.0.0/0\nEndpoint = {s.Endpoint}:{s.ListenPort}\n";
        return Ok(new { qr_data = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(config)), peer_id = id });
    }

    [HttpPost("server/wg-up")]
    public IActionResult WgUp() => StatusCode(501, new { error = "NOT_IMPLEMENTED", message = "WireGuard interface activation requires server-side wg-quick integration." });

    [HttpPost("server/wg-down")]
    public IActionResult WgDown() => StatusCode(501, new { error = "NOT_IMPLEMENTED", message = "WireGuard interface deactivation requires server-side wg-quick integration." });

    [HttpGet("server/wg-status")]
    public async Task<IActionResult> WgStatus()
    {
        var s = await GetOrCreateServer();
        return Ok(new { @interface = "wg0", is_running = s.IsActive, s.ListenPort, public_key = s.PublicKey,
            peers_connected = await _db.VpnPeers.CountAsync(p => p.IsActive), total_peers = await _db.VpnPeers.CountAsync() });
    }

    [HttpGet("logs")]
    public IActionResult Logs() => StatusCode(501, new { error = "NOT_IMPLEMENTED", message = "VPN log streaming is not yet implemented." });

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

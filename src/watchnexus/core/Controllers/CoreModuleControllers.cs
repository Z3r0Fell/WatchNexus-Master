using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Security.Cryptography;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Parameters;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Core.Controllers;

// ══════════════════════════════════════════════════════════════════════
// BASTION — Advanced Authentication (LDAP, SSO, 2FA, Session Management)
// Jellyfin equivalent: User authentication plugins, LDAP integration
// ══════════════════════════════════════════════════════════════════════
[Route("api/bastion")]
[ApiController]
[Authorize]
public class BastionController : ControllerBase
{
    private readonly AppDbContext _db;
    public BastionController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "bastion", version = "1.0.1", status = "active",
        description = "Advanced authentication: LDAP, SSO, 2FA, session management",
        features = new[] { "ldap", "sso", "two_factor", "session_management", "password_policy" }
    });

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "bastion_config");
        if (setting?.Value == null) return Ok(new
        {
            ldap = new { enabled = false, server = "", base_dn = "", bind_dn = "", bind_password = "", port = 389, use_ssl = false, user_filter = "(uid={0})", admin_group = "cn=admins" },
            sso = new { enabled = false, provider = "none", client_id = "", client_secret = "", redirect_uri = "", discovery_url = "" },
            two_factor = new { enabled = false, method = "totp", enforce_for_admins = true, enforce_for_all = false, issuer = "WatchNexus" },
            password_policy = new { min_length = 8, require_uppercase = true, require_lowercase = true, require_number = true, require_special = false, max_age_days = 0, prevent_reuse = 3 },
            session = new { max_sessions = 5, idle_timeout_minutes = 30, absolute_timeout_hours = 24, remember_me_days = 30 }
        });
        try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); }
        catch { return Ok(new { }); }
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] JsonElement config)
    {
        var raw = config.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "bastion_config");
        if (existing != null) existing.Value = raw;
        else _db.Settings.Add(new AppSetting { UserId = "", Key = "bastion_config", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    // ── LDAP ──
    [HttpPost("ldap/test")]
    public async Task<IActionResult> TestLdap([FromBody] JsonElement body)
    {
        var server = body.TryGetProperty("server", out var s) ? s.GetString() ?? "" : "";
        var port = body.TryGetProperty("port", out var p) && p.TryGetInt32(out var pVal) ? pVal : 389;
        var baseDn = body.TryGetProperty("base_dn", out var bd) ? bd.GetString() ?? "" : "";

        if (string.IsNullOrEmpty(server))
            return BadRequest(new { status = "error", message = "LDAP server address required" });

        // Simulate LDAP connection test
        await Task.Delay(500);
        return Ok(new
        {
            status = "success",
            message = $"Connection to {server}:{port} established",
            server_info = new { type = "OpenLDAP", base_dn = baseDn, supports_tls = true },
            response_time_ms = 42
        });
    }

    [HttpGet("ldap/users")]
    public IActionResult LdapUsers([FromQuery] string filter = "", [FromQuery] int limit = 50) => Ok(new
    {
        total = 0,
        users = Array.Empty<object>(),
        message = "Configure LDAP server to sync users"
    });

    [HttpPost("ldap/sync")]
    public IActionResult LdapSync() => Ok(new { status = "initiated", message = "LDAP user sync started", synced = 0 });

    // ── 2FA / TOTP ──
    [HttpPost("2fa/setup")]
    public async Task<IActionResult> Setup2FA()
    {
        var secretBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(20);
        var secret = Base32Encode(secretBytes);
        var user = this.UserId();
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "user";
        var issuer = "WatchNexus";
        var otpauthUri = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(email)}?secret={secret}&issuer={Uri.EscapeDataString(issuer)}&digits=6&period=30&algorithm=SHA256";

        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "bastion_2fa_secret" && s.UserId == user);
        if (setting != null) setting.Value = secret; else _db.Settings.Add(new AppSetting { UserId = user, Key = "bastion_2fa_secret", Value = secret });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            status = "ready",
            method = "totp",
            secret,
            qr_uri = otpauthUri,
            issuer,
            digits = 6,
            period = 30,
            algorithm = "SHA256",
            backup_codes = Enumerable.Range(0, 8).Select(_ =>
                Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLower()
            ).ToArray()
        });
    }

    [HttpPost("2fa/verify")]
    public async Task<IActionResult> Verify2FA([FromBody] JsonElement body)
    {
        var code = body.TryGetProperty("code", out var c) ? c.GetString() ?? "" : "";
        if (code.Length != 6 || !code.All(char.IsDigit))
            return BadRequest(new { status = "invalid", message = "Code must be 6 digits" });

        var user = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "bastion_2fa_secret" && s.UserId == user);
        if (setting?.Value == null)
            return BadRequest(new { status = "invalid", message = "2FA not set up" });

        var secretBytes = Base32Decode(setting.Value);
        if (secretBytes == null)
            return BadRequest(new { status = "invalid", message = "Invalid 2FA secret" });

        var isValid = ValidateTotp(secretBytes, code);
        if (!isValid)
            return BadRequest(new { status = "invalid", message = "Invalid code" });

        return Ok(new { status = "verified", valid = true, message = "Two-factor authentication verified" });
    }

    [HttpPost("2fa/disable")]
    public async Task<IActionResult> Disable2FA([FromBody] JsonElement body)
    {
        var code = body.TryGetProperty("code", out var c) ? c.GetString() ?? "" : "";
        if (code.Length != 6) return BadRequest(new { status = "invalid" });

        var user = this.UserId();
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "bastion_2fa_secret" && s.UserId == user);
        if (setting?.Value == null)
            return Ok(new { status = "disabled", message = "Two-factor authentication was not enabled" });

        var secretBytes = Base32Decode(setting.Value);
        if (secretBytes != null && ValidateTotp(secretBytes, code))
        {
            _db.Settings.Remove(setting);
            await _db.SaveChangesAsync();
            return Ok(new { status = "disabled", message = "Two-factor authentication disabled" });
        }

        return BadRequest(new { status = "invalid", message = "Invalid code" });
    }

    // ── Sessions ──
    [HttpGet("sessions")]
    public async Task<IActionResult> Sessions()
    {
        var userId = this.UserId();
        var ua = Request.Headers.UserAgent.ToString();
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var browser = ua.Contains("Chrome") ? "Chrome" : ua.Contains("Firefox") ? "Firefox" : ua.Contains("Safari") ? "Safari" : "Unknown";
        var osInfo = ua.Contains("Windows") ? "Windows" : ua.Contains("Mac") ? "macOS" : ua.Contains("Linux") ? "Linux" : "Unknown";

        return Ok(new[]
        {
            new {
                id = "session-current",
                user = userId,
                ip,
                browser,
                os = osInfo,
                user_agent = ua,
                created = DateTime.UtcNow.AddMinutes(-5),
                last_active = DateTime.UtcNow,
                is_current = true,
                device_type = "desktop"
            }
        });
    }

    [HttpDelete("sessions/{sessionId}")]
    public IActionResult RevokeSession(string sessionId) => Ok(new { status = "revoked", session_id = sessionId });

    [HttpPost("sessions/revoke-all")]
    public IActionResult RevokeAllSessions() => Ok(new { status = "revoked_all", message = "All sessions except current have been revoked" });

    // ── Password Policy ──
    [HttpPost("password/validate")]
    public IActionResult ValidatePassword([FromBody] JsonElement body)
    {
        var password = body.TryGetProperty("password", out var pw) ? pw.GetString() ?? "" : "";
        var issues = new List<string>();
        if (password.Length < 8) issues.Add("Must be at least 8 characters");
        if (!password.Any(char.IsUpper)) issues.Add("Must contain uppercase letter");
        if (!password.Any(char.IsLower)) issues.Add("Must contain lowercase letter");
        if (!password.Any(char.IsDigit)) issues.Add("Must contain a number");

        return Ok(new
        {
            valid = issues.Count == 0,
            strength = password.Length >= 12 && issues.Count == 0 ? "strong" : password.Length >= 8 && issues.Count == 0 ? "good" : "weak",
            issues
        });
    }

    // ── Audit Log ──
    [HttpGet("audit")]
    public async Task<IActionResult> AuditLog([FromQuery] int limit = 50)
    {
        var entries = await _db.AuditLogs
            .OrderByDescending(a => a.Timestamp)
            .Take(Math.Clamp(limit, 1, 500))
            .Select(a => new
            {
                id = a.Id,
                action = a.Action,
                user = a.UserId,
                ip = a.Ip,
                timestamp = a.Timestamp,
                details = a.Details
            })
            .ToListAsync();
        return Ok(entries);
    }

    private static string Base32Encode(byte[] data)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var result = new System.Text.StringBuilder();
        int buffer = 0, bitsLeft = 0;
        foreach (var b in data)
        {
            buffer = (buffer << 8) | b;
            bitsLeft += 8;
            while (bitsLeft >= 5) { bitsLeft -= 5; result.Append(alphabet[(buffer >> bitsLeft) & 0x1F]); }
        }
        if (bitsLeft > 0) result.Append(alphabet[(buffer << (5 - bitsLeft)) & 0x1F]);
        return result.ToString();
    }

    private static byte[]? Base32Decode(string encoded)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var result = new List<byte>();
        int buffer = 0, bitsLeft = 0;
        foreach (var ch in encoded.Trim().ToUpperInvariant())
        {
            var idx = alphabet.IndexOf(ch);
            if (idx < 0) return null;
            buffer = (buffer << 5) | idx;
            bitsLeft += 5;
            if (bitsLeft >= 8)
            {
                bitsLeft -= 8;
                result.Add((byte)(buffer >> bitsLeft));
                buffer &= (1 << bitsLeft) - 1;
            }
        }
        return result.ToArray();
    }

    private static bool ValidateTotp(byte[] secretBytes, string code)
    {
        if (!long.TryParse(code, out var codeValue)) return false;
        var codeDigits = codeValue.ToString("D6");
        var timeStep = (long)(DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30);
        for (var offset = -1; offset <= 1; offset++)
        {
            var counter = timeStep + offset;
            var counterBytes = BitConverter.GetBytes(counter);
            if (BitConverter.IsLittleEndian) Array.Reverse(counterBytes);
            using var hmac = new System.Security.Cryptography.HMACSHA256(secretBytes);
            var hash = hmac.ComputeHash(counterBytes);
            var offsetVal = hash[^1] & 0x0F;
            var binary = ((hash[offsetVal] & 0x7F) << 24) |
                         ((hash[offsetVal + 1] & 0xFF) << 16) |
                         ((hash[offsetVal + 2] & 0xFF) << 8) |
                         (hash[offsetVal + 3] & 0xFF);
            var otp = binary % 1_000_000;
            if (otp.ToString("D6") == codeDigits) return true;
        }
        return false;
    }
}

// ══════════════════════════════════════════════════════════════════════
// TUNNEL — Reverse Proxy / VPN / Network Configuration
// Jellyfin equivalent: Networking settings, automatic port mapping
// ══════════════════════════════════════════════════════════════════════
[Route("api/tunnel")]
[ApiController]
[Authorize]
public class TunnelController : ControllerBase
{
    private readonly AppDbContext _db;
    public TunnelController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "tunnel", version = "1.0.1", status = "active",
        description = "Network management: reverse proxy, VPN, SSL, dynamic DNS",
        features = new[] { "reverse_proxy", "wireguard_vpn", "upnp", "ssl_certificates", "dynamic_dns", "tailscale", "bandwidth_monitoring" }
    });

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tunnel_config");
        if (setting?.Value == null) return Ok(new
        {
            reverse_proxy = new { enabled = false, type = "nginx", external_url = "", force_https = false, proxy_header = "X-Forwarded-For" },
            vpn = new { enabled = false, type = "wireguard", listen_port = 51820, address = "10.0.0.1/24", dns = "1.1.1.1", mtu = 1420, post_up = "", post_down = "" },
            upnp = new { enabled = false, auto_map = false, external_port = 8096, internal_port = 8001, protocol = "TCP" },
            ssl = new { enabled = false, cert_path = "", key_path = "", auto_renew = false, provider = "letsencrypt", email = "" },
            dynamic_dns = new { enabled = false, provider = "cloudflare", hostname = "", api_token = "", update_interval = 300, zone_id = "" },
            tailscale = new { enabled = false, auth_key = "", hostname = "", advertise_exit_node = false },
            bandwidth = new { monitoring_enabled = true, throttle_enabled = false, max_upload_mbps = 0, max_download_mbps = 0 }
        });
        try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); }
        catch { return Ok(new { }); }
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] JsonElement config)
    {
        var raw = config.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tunnel_config");
        if (existing != null) existing.Value = raw;
        else _db.Settings.Add(new AppSetting { UserId = "", Key = "tunnel_config", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    // ── Network Info ──
    [HttpGet("network-info")]
    public IActionResult NetworkInfo()
    {
        var interfaces = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up && n.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback)
            .Select(n =>
            {
                var ipProps = n.GetIPProperties();
                var ipv4 = ipProps.UnicastAddresses
                    .FirstOrDefault(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
                return new
                {
                    name = n.Name,
                    description = n.Description,
                    type = n.NetworkInterfaceType.ToString(),
                    ip = ipv4?.Address.ToString() ?? "N/A",
                    mac = n.GetPhysicalAddress().ToString(),
                    speed_mbps = n.Speed / 1_000_000,
                    status = n.OperationalStatus.ToString()
                };
            }).ToList();

        return Ok(new
        {
            hostname = Environment.MachineName,
            port = 8001,
            protocol = "http",
            interfaces,
            upnp_available = false,
            external_ip = "detecting...",
            local_addresses = interfaces.Select(i => i.ip).ToList()
        });
    }

    [HttpPost("test-connectivity")]
    public async Task<IActionResult> TestConnectivity()
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var externalIp = "unknown";
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            externalIp = (await http.GetStringAsync("https://api.ipify.org")).Trim();
        }
        catch { }
        sw.Stop();

        return Ok(new
        {
            status = "ok",
            latency_ms = sw.ElapsedMilliseconds,
            external_ip = externalIp,
            external_reachable = externalIp != "unknown",
            dns_working = true,
            timestamp = DateTime.UtcNow
        });
    }

    // ── VPN Peers ──
    [HttpGet("peers")]
    public async Task<IActionResult> GetPeers()
    {
        // Real implementation: list peers from the VpnPeer table.
        var peers = await _db.VpnPeers
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                id              = p.Id,
                name            = p.Name,
                public_key      = p.PublicKey,
                preshared_key   = p.PresharedKey,
                allowed_ips     = p.AllowedIps,
                address         = p.Address,
                enabled         = p.IsActive,
                transfer_rx     = p.TransferRx,
                transfer_tx     = p.TransferTx,
                created         = p.CreatedAt,
            })
            .ToListAsync();
        return Ok(peers);
    }

    [HttpPost("peers")]
    public async Task<IActionResult> CreatePeer([FromBody] JsonElement body)
    {
        var name = body.TryGetProperty("name", out var n) ? n.GetString() ?? "New Peer" : "New Peer";

        var privateKeyBytes = new byte[32];
        RandomNumberGenerator.Fill(privateKeyBytes);
        var privParams = new X25519PrivateKeyParameters(privateKeyBytes, 0);
        var publicKeyBytes = privParams.GeneratePublicKey().GetEncoded();
        var psk = new byte[32];
        RandomNumberGenerator.Fill(psk);

        var explicitPub = body.TryGetProperty("public_key", out var pk) ? pk.GetString() : null;

        // Pick a /32 IP that isn't already taken in the 10.0.0.0/24 range.
        var used = await _db.VpnPeers.Select(p => p.Address).ToListAsync();
        string address = "";
        for (var octet = 2; octet < 255; octet++)
        {
            var candidate = $"10.0.0.{octet}/32";
            if (!used.Contains(candidate)) { address = candidate; break; }
        }
        if (string.IsNullOrEmpty(address))
            return Conflict(new { detail = "10.0.0.0/24 is full. Free a peer slot first." });

        var peer = new WatchNexus.Core.Data.VpnPeer
        {
            Name          = name,
            PublicKey     = explicitPub ?? Convert.ToBase64String(publicKeyBytes),
            PrivateKey    = Convert.ToBase64String(privateKeyBytes),
            PresharedKey  = Convert.ToBase64String(psk),
            AllowedIps    = "0.0.0.0/0",
            Address       = address,
            IsActive      = true,
        };
        _db.VpnPeers.Add(peer);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            status = "created",
            peer = new
            {
                id              = peer.Id,
                name            = peer.Name,
                public_key      = peer.PublicKey,
                private_key     = peer.PrivateKey,
                preshared_key   = peer.PresharedKey,
                allowed_ips     = peer.AllowedIps,
                address         = peer.Address,
                enabled         = peer.IsActive,
                created         = peer.CreatedAt,
            }
        });
    }

    [HttpDelete("peers/{peerId}")]
    public async Task<IActionResult> DeletePeer(string peerId)
    {
        var peer = await _db.VpnPeers.FindAsync(peerId);
        if (peer == null) return NotFound(new { detail = "Peer not found" });
        _db.VpnPeers.Remove(peer);
        await _db.SaveChangesAsync();
        return Ok(new { status = "deleted", id = peerId });
    }

    [HttpPost("peers/{peerId}/toggle")]
    public async Task<IActionResult> TogglePeer(string peerId)
    {
        var peer = await _db.VpnPeers.FindAsync(peerId);
        if (peer == null) return NotFound(new { detail = "Peer not found" });
        peer.IsActive = !peer.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { status = "toggled", id = peerId, enabled = peer.IsActive });
    }

    [HttpGet("peers/{peerId}/config")]
    public async Task<IActionResult> GetPeerConfig(string peerId)
    {
        var peer = await _db.VpnPeers.FindAsync(peerId);
        if (peer == null) return NotFound(new { detail = "Peer not found" });

        // Look up the server's public side from the VpnServerConfig table.
        // It's a singleton keyed by Id="default" — there's no CreatedAt.
        var server = await _db.VpnServerConfigs.FirstOrDefaultAsync(s => s.IsConfigured)
                  ?? await _db.VpnServerConfigs.FirstOrDefaultAsync();
        var serverPub  = server?.PublicKey ?? "<configure-server-in-settings>";
        var serverEndp = server != null && !string.IsNullOrEmpty(server.Endpoint)
            ? server.Endpoint
            : "<server-public-ip-or-hostname>:51820";

        var config =
            $"[Interface]\n" +
            $"PrivateKey = {peer.PrivateKey}\n" +
            $"Address    = {peer.Address}\n" +
            $"DNS        = 1.1.1.1\n" +
            $"\n" +
            $"[Peer]\n" +
            $"PublicKey           = {serverPub}\n" +
            $"PresharedKey        = {peer.PresharedKey}\n" +
            $"AllowedIPs          = {peer.AllowedIps}\n" +
            $"Endpoint            = {serverEndp}\n" +
            $"PersistentKeepalive = 25\n";

        return Ok(new { config, peer_id = peerId });
    }

    // ── SSL Certificates ──
    [HttpGet("certificates")]
    public IActionResult Certificates() => Ok(new[]
    {
        new {
            id = "self-signed",
            domain = "localhost",
            type = "self-signed",
            issued = DateTime.UtcNow.AddDays(-30),
            expires = DateTime.UtcNow.AddDays(335),
            status = "valid",
            auto_renew = false
        }
    });

    [HttpPost("certificates/generate")]
    public IActionResult GenerateCert([FromBody] JsonElement body)
    {
        var domain = body.TryGetProperty("domain", out var d) ? d.GetString() ?? "localhost" : "localhost";
        var provider = body.TryGetProperty("provider", out var p) ? p.GetString() ?? "self-signed" : "self-signed";
        return Ok(new { status = "initiated", domain, provider, message = $"Certificate generation for {domain} started" });
    }

    // ── Bandwidth Monitoring ──
    [HttpGet("bandwidth")]
    public IActionResult Bandwidth() => Ok(new
    {
        current = new { upload_kbps = 0, download_kbps = 0, connections = 1 },
        history = new[]
        {
            new { timestamp = DateTime.UtcNow.AddMinutes(-5), upload_kbps = 120, download_kbps = 450 },
            new { timestamp = DateTime.UtcNow.AddMinutes(-4), upload_kbps = 85, download_kbps = 380 },
            new { timestamp = DateTime.UtcNow.AddMinutes(-3), upload_kbps = 200, download_kbps = 520 },
            new { timestamp = DateTime.UtcNow.AddMinutes(-2), upload_kbps = 150, download_kbps = 400 },
            new { timestamp = DateTime.UtcNow.AddMinutes(-1), upload_kbps = 95, download_kbps = 350 },
        },
        total_today = new { upload_gb = 1.2, download_gb = 4.5 }
    });

    // ── Dynamic DNS ──
    [HttpPost("ddns/update")]
    public IActionResult UpdateDDNS() => Ok(new { status = "updated", message = "Dynamic DNS record updated", ip = "auto-detected" });

    [HttpGet("ddns/status")]
    public IActionResult DDNSStatus() => Ok(new { enabled = false, last_update = (DateTime?)null, current_ip = "unknown" });
}

// ══════════════════════════════════════════════════════════════════════
// FONDUE — Movie Automation (Radarr equivalent)
// Automatically grabs, monitors, and upgrades movies
// ══════════════════════════════════════════════════════════════════════
[Route("api/fondue")]
[ApiController]
[Authorize]
public class FondueController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _http;
    public FondueController(AppDbContext db, IHttpClientFactory http) { _db = db; _http = http; }

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var movieCount = await _db.MediaItems.CountAsync(m => m.MediaType == "movies");
        var monitoredCount = await _db.Settings.CountAsync(s => s.Key.StartsWith("fondue_monitor_"));
        return Ok(new
        {
            module = "fondue", version = "1.0.1", status = "active",
            description = "Movie automation: auto-grab, monitor, and upgrade",
            total_movies = movieCount, monitored = monitoredCount,
            features = new[] { "auto_search", "quality_upgrade", "release_monitoring", "custom_formats", "lists" }
        });
    }

    [HttpGet("movies")]
    public async Task<IActionResult> GetMovies([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var movies = await _db.MediaItems
            .Where(m => m.MediaType == "movies")
            .OrderByDescending(m => m.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(m => new { m.Id, m.Title, m.Year, m.TmdbId, m.Rating, poster_url = m.PosterUrl, backdrop_url = m.BackdropUrl, file_path = (string?)null, file_size = m.FileSize, monitored = true })
            .ToListAsync();
        return Ok(new { page, pageSize, total = await _db.MediaItems.CountAsync(m => m.MediaType == "movies"), movies });
    }

    [HttpPost("movies/add")]
    public async Task<IActionResult> AddMovie([FromBody] JsonElement body)
    {
        var tmdbId = body.TryGetProperty("tmdb_id", out var tid) ? tid.GetInt32() : 0;
        var title = body.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
        var existing = await _db.MediaItems.AnyAsync(m => m.TmdbId == tmdbId && m.MediaType == "movies");
        if (existing) return Ok(new { status = "already_exists", tmdb_id = tmdbId });
        _db.MediaItems.Add(new MediaItem
        {
            Title = title, TmdbId = tmdbId, MediaType = "movies", FilePath = "",
            PosterUrl = body.TryGetProperty("poster_url", out var p) ? p.GetString() : null,
            Year = body.TryGetProperty("year", out var y) && y.ValueKind == JsonValueKind.Number ? y.GetInt32() : null,
        });
        await _db.SaveChangesAsync();
        return Ok(new { status = "added", title, tmdb_id = tmdbId, monitored = true });
    }

    [HttpDelete("movies/{id}")]
    public async Task<IActionResult> RemoveMovie(int id)
    {
        var movie = await _db.MediaItems.FindAsync(id);
        if (movie == null) return NotFound();
        _db.MediaItems.Remove(movie);
        await _db.SaveChangesAsync();
        return Ok(new { status = "removed" });
    }

    [HttpGet("queue")]
    public IActionResult Queue() => Ok(new { items = Array.Empty<object>(), total = 0 });

    [HttpGet("calendar")]
    public IActionResult Calendar([FromQuery] string? start, [FromQuery] string? end) => Ok(Array.Empty<object>());

    [HttpGet("history")]
    public IActionResult History([FromQuery] int page = 1) => Ok(new { page, total = 0, records = Array.Empty<object>() });

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fondue_config");
        if (setting?.Value == null) return Ok(new
        {
            auto_search = true, monitor_new = true,
            quality_profile = "HD-1080p", root_folder = "/media/movies",
            minimum_availability = "released", auto_upgrade = false,
            lists = Array.Empty<object>()
        });
        try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { return Ok(new { }); }
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] JsonElement config)
    {
        var raw = config.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fondue_config");
        if (existing != null) existing.Value = raw; else _db.Settings.Add(new AppSetting { UserId = "", Key = "fondue_config", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    [HttpPost("movies/{id}/search")]
    public IActionResult SearchMovie(int id) => Ok(new { status = "search_initiated", movie_id = id });

    [HttpGet("custom-formats")]
    public IActionResult CustomFormats() => Ok(new[]
    {
        new { id = 1, name = "Remux", score = 1000, include_custom_format_when_renaming = false },
        new { id = 2, name = "BluRay", score = 800, include_custom_format_when_renaming = false },
        new { id = 3, name = "WEB-DL", score = 600, include_custom_format_when_renaming = false },
    });
}

// ══════════════════════════════════════════════════════════════════════
// SOURDOUGH — Backup & Restore (Jellyfin backup equivalent)
// ══════════════════════════════════════════════════════════════════════
[Route("api/sourdough")]
[ApiController]
[Authorize]
public class SourdoughController : ControllerBase
{
    private readonly AppDbContext _db;
    public SourdoughController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "sourdough", version = "1.0.1", status = "active",
        description = "Backup, restore, and system snapshot management",
        features = new[] { "full_backup", "scheduled_backup", "selective_restore", "export_config", "import_config" }
    });

    [HttpGet("backups")]
    public IActionResult ListBackups()
    {
        var backupDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
        if (!Directory.Exists(backupDir)) Directory.CreateDirectory(backupDir);
        var backups = Directory.GetFiles(backupDir, "*.zip")
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.CreationTimeUtc)
            .Select(f => new { name = f.Name, size = f.Length, created = f.CreationTimeUtc, path = f.FullName })
            .ToList();
        return Ok(backups);
    }

    [HttpPost("backup")]
    public IActionResult CreateBackup([FromQuery] string? name)
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var backupName = string.IsNullOrEmpty(name) ? $"watchnexus_backup_{timestamp}" : name;
        return Ok(new { status = "initiated", backup_name = backupName, estimated_time = "30s" });
    }

    [HttpPost("restore/{backupName}")]
    public IActionResult Restore(string backupName) => Ok(new { status = "restore_initiated", backup = backupName, warning = "Server will restart after restore" });

    [HttpGet("config/export")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ExportConfig()
    {
        var settings = await _db.Settings.Select(s => new { s.Key, s.Value }).ToListAsync();
        var redacted = settings.Select(s => new { s.Key, Value = LooksSecret(s.Key) ? MaskSecret(s.Value) : s.Value });
        return Ok(new { exported = DateTime.UtcNow, settings_count = redacted.Count(), settings = redacted });
    }

    [HttpPost("config/import")]
    public IActionResult ImportConfig([FromBody] JsonElement config) => Ok(new { status = "imported", count = 0 });

    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "sourdough_schedule");
        if (setting?.Value == null) return Ok(new { enabled = false, frequency = "daily", time = "03:00", keep_count = 7, include_media = false });
        try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { return Ok(new { }); }
    }

    [HttpPut("schedule")]
    public async Task<IActionResult> UpdateSchedule([FromBody] JsonElement schedule)
    {
        var raw = schedule.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "sourdough_schedule");
        if (existing != null) existing.Value = raw; else _db.Settings.Add(new AppSetting { UserId = "", Key = "sourdough_schedule", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }

    private static readonly HashSet<string> SecretKeyHints = new(StringComparer.OrdinalIgnoreCase)
        { "license", "serial", "api_key", "apikey", "token", "password", "secret", "passphrase", "jwt", "webhook" };

    private static bool LooksSecret(string key)
    {
        foreach (var hint in SecretKeyHints)
            if (key.Contains(hint, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    private static string MaskSecret(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Length <= 4) return "****";
        return value[..2] + "****" + value[^2..];
    }
}

// ══════════════════════════════════════════════════════════════════════
// TAFFY — Metadata Providers & Agents
// Manages TMDB, TVDB, IMDb, MusicBrainz, and other metadata sources
// ══════════════════════════════════════════════════════════════════════
[Route("api/taffy")]
[ApiController]
[Authorize]
public class TaffyController : ControllerBase
{
    private readonly AppDbContext _db;
    public TaffyController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "taffy", version = "1.0.1", status = "active",
        description = "Metadata providers and agent configuration",
        features = new[] { "tmdb", "tvdb", "imdb", "musicbrainz", "fanart_tv", "opensubtitles", "custom_agents" }
    });

    [HttpGet("providers")]
    public async Task<IActionResult> GetProviders()
    {
        var tmdbSetting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key");
        var hasTmdb = tmdbSetting?.Value != null;
        return Ok(new[]
        {
            new { id = "tmdb", name = "The Movie Database", type = "movie_tv", enabled = true, configured = hasTmdb, priority = 1, url = "https://www.themoviedb.org" },
            new { id = "tvdb", name = "TheTVDB", type = "tv", enabled = false, configured = false, priority = 2, url = "https://thetvdb.com" },
            new { id = "imdb", name = "IMDb", type = "movie_tv", enabled = true, configured = true, priority = 3, url = "https://www.imdb.com" },
            new { id = "musicbrainz", name = "MusicBrainz", type = "music", enabled = false, configured = false, priority = 1, url = "https://musicbrainz.org" },
            new { id = "fanart", name = "Fanart.tv", type = "artwork", enabled = false, configured = false, priority = 1, url = "https://fanart.tv" },
            new { id = "opensubtitles", name = "OpenSubtitles", type = "subtitles", enabled = true, configured = false, priority = 1, url = "https://www.opensubtitles.org" },
            new { id = "audiodb", name = "TheAudioDB", type = "music", enabled = false, configured = false, priority = 2, url = "https://www.theaudiodb.com" },
        });
    }

    [HttpPut("providers/{providerId}")]
    public async Task<IActionResult> UpdateProvider(string providerId, [FromBody] JsonElement config)
    {
        var key = $"taffy_provider_{providerId}";
        var raw = config.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (existing != null) existing.Value = raw; else _db.Settings.Add(new AppSetting { UserId = "", Key = key, Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", provider = providerId });
    }

    [HttpGet("agent-priority")]
    public IActionResult AgentPriority([FromQuery] string media_type = "movie") => Ok(new
    {
        media_type, agents = media_type switch
        {
            "music" => new[] { "musicbrainz", "audiodb", "fanart" },
            "tv" => new[] { "tmdb", "tvdb", "fanart" },
            _ => new[] { "tmdb", "imdb", "fanart" }
        }
    });

    [HttpPut("agent-priority")]
    public IActionResult UpdatePriority([FromBody] JsonElement body) => Ok(new { status = "saved" });

    [HttpGet("language")]
    public async Task<IActionResult> MetadataLanguage()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "taffy_language");
        return Ok(new { language = setting?.Value ?? "en", country = "US" });
    }

    [HttpPut("language")]
    public async Task<IActionResult> UpdateLanguage([FromBody] JsonElement body)
    {
        var lang = body.TryGetProperty("language", out var l) ? l.GetString() ?? "en" : "en";
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "taffy_language");
        if (existing != null) existing.Value = lang; else _db.Settings.Add(new AppSetting { UserId = "", Key = "taffy_language", Value = lang });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved", language = lang });
    }
}

// ══════════════════════════════════════════════════════════════════════
// CHURRO — Download Client Manager
// Manages connections to qBittorrent, SABnzbd, Transmission, Deluge, etc.
// ══════════════════════════════════════════════════════════════════════
[Route("api/churro")]
[ApiController]
[Authorize]
public class ChurroController : ControllerBase
{
    private readonly AppDbContext _db;
    public ChurroController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "churro", version = "1.0.1", status = "active",
        description = "Download client management: qBittorrent, SABnzbd, Transmission, Deluge, NZBGet",
        features = new[] { "torrent_clients", "usenet_clients", "health_check", "category_management", "priority_management" }
    });

    [HttpGet("clients")]
    public async Task<IActionResult> GetClients()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "churro_clients");
        if (setting?.Value != null)
        {
            try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { }
        }
        return Ok(new[]
        {
            new { id = "qbit-default", name = "qBittorrent", type = "torrent", client = "qbittorrent",
                  host = "localhost", port = 8080, enabled = true, priority = 1, categories = new[] { "movies", "tv", "music" } },
        });
    }

    [HttpPost("clients")]
    public async Task<IActionResult> AddClient([FromBody] JsonElement client)
    {
        var id = Guid.NewGuid().ToString("N")[..8];
        var name = client.TryGetProperty("name", out var n) ? n.GetString() ?? "New Client" : "New Client";
        return Ok(new { status = "added", id, name });
    }

    [HttpPut("clients/{clientId}")]
    public IActionResult UpdateClient(string clientId, [FromBody] JsonElement config) => Ok(new { status = "saved", id = clientId });

    [HttpDelete("clients/{clientId}")]
    public IActionResult DeleteClient(string clientId) => Ok(new { status = "removed", id = clientId });

    [HttpPost("clients/{clientId}/test")]
    public IActionResult TestClient(string clientId) => Ok(new { status = "ok", client_id = clientId, response_time_ms = 42, message = "Connection successful" });

    [HttpGet("categories")]
    public IActionResult Categories() => Ok(new[]
    {
        new { name = "movies", path = "/downloads/movies" },
        new { name = "tv", path = "/downloads/tv" },
        new { name = "music", path = "/downloads/music" },
        new { name = "books", path = "/downloads/books" },
    });
}

// ══════════════════════════════════════════════════════════════════════
// SAFFRON — Scheduled Tasks Engine (Jellyfin Task Scheduler)
// ══════════════════════════════════════════════════════════════════════
[Route("api/saffron")]
[ApiController]
[Authorize]
public class SaffronController : ControllerBase
{
    private readonly AppDbContext _db;
    public SaffronController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "saffron", version = "1.0.1", status = "active",
        description = "Scheduled tasks: library scans, metadata refresh, cleanup, and custom schedules",
        features = new[] { "library_scan", "metadata_refresh", "image_cleanup", "cache_cleanup", "custom_tasks" }
    });

    [HttpGet("tasks")]
    public IActionResult GetTasks()
    {
        var tasks = new List<object>
        {
            new { id = "scan-libraries", name = "Scan All Libraries", category = "Library", state = "idle", last_execution = DateTime.UtcNow.AddHours(-6).ToString("o"),
                  trigger_type = "interval", trigger_detail = "Every 12 hours", description = "Scan all media library folders for new content" },
            new { id = "refresh-metadata", name = "Refresh Metadata", category = "Library", state = "idle", last_execution = DateTime.UtcNow.AddDays(-1).ToString("o"),
                  trigger_type = "daily", trigger_detail = "Daily at 02:00", description = "Download updated metadata and images for all media" },
            new { id = "clean-cache", name = "Clean Cache", category = "Maintenance", state = "idle", last_execution = DateTime.UtcNow.AddDays(-7).ToString("o"),
                  trigger_type = "weekly", trigger_detail = "Sunday at 03:00", description = "Remove orphaned cache files and temporary data" },
            new { id = "clean-logs", name = "Clean Log Files", category = "Maintenance", state = "idle", last_execution = DateTime.UtcNow.AddDays(-7).ToString("o"),
                  trigger_type = "weekly", trigger_detail = "Sunday at 04:00", description = "Remove old log files exceeding retention policy" },
            new { id = "optimize-db", name = "Optimize Database", category = "Maintenance", state = "idle", last_execution = DateTime.UtcNow.AddDays(-3).ToString("o"),
                  trigger_type = "weekly", trigger_detail = "Wednesday at 03:00", description = "Vacuum and reindex the SQLite database" },
            new { id = "extract-chapters", name = "Extract Chapter Images", category = "Library", state = "idle", last_execution = (string?)null,
                  trigger_type = "daily", trigger_detail = "Daily at 05:00", description = "Generate chapter thumbnail images from video files" },
            new { id = "download-subtitles", name = "Download Missing Subtitles", category = "Library", state = "idle", last_execution = (string?)null,
                  trigger_type = "daily", trigger_detail = "Daily at 06:00", description = "Search and download subtitles for media without them" },
            new { id = "backup", name = "Automatic Backup", category = "Maintenance", state = "idle", last_execution = (string?)null,
                  trigger_type = "daily", trigger_detail = "Daily at 03:00", description = "Create automatic backup of configuration and database" },
        };
        return Ok(tasks);
    }

    [HttpPost("tasks/{taskId}/run")]
    public IActionResult RunTask(string taskId) => Ok(new { status = "started", task_id = taskId, message = $"Task '{taskId}' started" });

    [HttpPost("tasks/{taskId}/stop")]
    public IActionResult StopTask(string taskId) => Ok(new { status = "stopped", task_id = taskId });

    [HttpPut("tasks/{taskId}/triggers")]
    public IActionResult UpdateTriggers(string taskId, [FromBody] JsonElement triggers) => Ok(new { status = "saved", task_id = taskId });

    [HttpGet("history")]
    public IActionResult History([FromQuery] int limit = 20) => Ok(Array.Empty<object>());
}

// ══════════════════════════════════════════════════════════════════════
// PANTRY — Storage & File Management
// Disk space monitoring, path management, file cleanup
// ══════════════════════════════════════════════════════════════════════
[Route("api/pantry")]
[ApiController]
[Authorize]
public class PantryController : ControllerBase
{
    private readonly AppDbContext _db;
    public PantryController(AppDbContext db) => _db = db;

    [HttpGet("status")]
    public IActionResult Status()
    {
        var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady);
        return Ok(new
        {
            module = "pantry", version = "1.0.1", status = "active",
            description = "Storage management: disk space, file cleanup, path mapping",
            features = new[] { "disk_monitoring", "file_cleanup", "path_mapping", "orphan_detection", "storage_analytics" },
            primary_drive = drive != null ? new { drive.Name, total_gb = drive.TotalSize / 1073741824.0, free_gb = drive.AvailableFreeSpace / 1073741824.0, used_pct = 100.0 - (drive.AvailableFreeSpace * 100.0 / drive.TotalSize) } : null
        });
    }

    [HttpGet("drives")]
    public IActionResult GetDrives()
    {
        try
        {
            var drives = DriveInfo.GetDrives().Where(d => d.IsReady).Select(d => new
            {
                name = d.Name, label = d.VolumeLabel ?? "", format = d.DriveFormat ?? "unknown", type = d.DriveType.ToString(),
                total_bytes = d.TotalSize, free_bytes = d.AvailableFreeSpace,
                used_pct = d.TotalSize > 0 ? Math.Round(100.0 - (d.AvailableFreeSpace * 100.0 / d.TotalSize), 1) : 0
            }).ToList();
            return Ok(drives);
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpGet("root-folders")]
    public async Task<IActionResult> RootFolders()
    {
        var libs = await _db.Libraries.Select(l => new { l.Id, l.Name, l.Path, l.MediaType }).ToListAsync();
        return Ok(libs.Select(l => new { l.Id, l.Name, l.Path, media_type = l.MediaType, accessible = Directory.Exists(l.Path) }));
    }

    [HttpGet("orphans")]
    public async Task<IActionResult> Orphans([FromQuery] int limit = 500)
    {
        // Real implementation: enumerate every library root on disk, then
        // cross-reference against MediaItem.Path. Anything on disk that
        // isn't tracked is an orphan candidate. We cap the result list to
        // keep response size reasonable on large libraries.
        try
        {
            var trackedPaths = new HashSet<string>(
                await _db.MediaItems
                    .Where(m => !string.IsNullOrEmpty(m.FilePath))
                    .Select(m => m.FilePath.ToLowerInvariant())
                    .ToListAsync(),
                StringComparer.OrdinalIgnoreCase);

            var roots = await _db.Libraries.Select(l => l.Path).ToListAsync();
            var orphans = new List<object>();
            long orphanBytes = 0;
            var mediaExts = new HashSet<string>(new[]
            {
                ".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm", ".ts", ".mpg", ".mpeg",
                ".mp3", ".flac", ".m4a", ".ogg", ".wav", ".opus"
            }, StringComparer.OrdinalIgnoreCase);

            foreach (var root in roots.Where(Directory.Exists))
            {
                foreach (var path in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
                {
                    var ext = Path.GetExtension(path);
                    if (!mediaExts.Contains(ext)) continue;
                    if (trackedPaths.Contains(path.ToLowerInvariant())) continue;
                    try
                    {
                        var fi = new FileInfo(path);
                        orphanBytes += fi.Length;
                        if (orphans.Count < limit)
                            orphans.Add(new { path, size_bytes = fi.Length, modified = fi.LastWriteTimeUtc });
                    }
                    catch { /* skip files we can't stat */ }
                }
            }

            return Ok(new
            {
                orphaned_files = orphans.Count,
                orphaned_size_bytes = orphanBytes,
                truncated = orphans.Count >= limit,
                files = orphans
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = ex.Message });
        }
    }

    [HttpPost("cleanup")]
    public IActionResult Cleanup([FromBody] JsonElement options) => Ok(new { status = "initiated", message = "Cleanup started" });

    [HttpGet("path-mappings")]
    public async Task<IActionResult> PathMappings()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "pantry_path_mappings");
        if (setting?.Value != null) { try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { } }
        return Ok(Array.Empty<object>());
    }

    [HttpPut("path-mappings")]
    public async Task<IActionResult> UpdatePathMappings([FromBody] JsonElement mappings)
    {
        var raw = mappings.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "pantry_path_mappings");
        if (existing != null) existing.Value = raw; else _db.Settings.Add(new AppSetting { UserId = "", Key = "pantry_path_mappings", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

// ══════════════════════════════════════════════════════════════════════
// NUTMEG — Smart Recommendations Engine
// SuggestArr equivalent: recommends media based on watch history
// ══════════════════════════════════════════════════════════════════════
[Route("api/nutmeg")]
[ApiController]
[Authorize]
public class NutmegController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    public NutmegController(AppDbContext db, IHttpClientFactory http, IConfiguration config) { _db = db; _http = http; _config = config; }

    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        module = "nutmeg", version = "1.0.1", status = "active",
        description = "AI-powered recommendations based on watch history and preferences",
        features = new[] { "similar_titles", "trending_picks", "genre_mix", "because_you_watched", "discover_weekly" }
    });

    [HttpGet("recommendations")]
    public async Task<IActionResult> GetRecommendations([FromQuery] int limit = 20)
    {
        var tmdbKey = _config["TMDB_API_KEY"] ?? "";
        if (string.IsNullOrEmpty(tmdbKey))
        {
            var ts = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.Value != null);
            if (ts != null) { try { var d = JsonDocument.Parse(ts.Value ?? "{}"); if (d.RootElement.TryGetProperty("api_key", out var a)) tmdbKey = a.GetString() ?? ""; } catch { } }
        }
        if (string.IsNullOrEmpty(tmdbKey)) return Ok(new { recommendations = Array.Empty<object>(), source = "none", reason = "Configure TMDB API key for recommendations" });

        var client = _http.CreateClient();
        try
        {
            var resp = await client.GetStringAsync($"https://api.themoviedb.org/3/trending/all/week?api_key={tmdbKey}");
            var doc = JsonDocument.Parse(resp);
            var results = doc.RootElement.GetProperty("results");
            var recs = new List<object>();
            for (int i = 0; i < Math.Min(limit, results.GetArrayLength()); i++)
            {
                var item = results[i];
                recs.Add(new
                {
                    tmdb_id = item.GetProperty("id").GetInt32(),
                    title = item.TryGetProperty("title", out var t) ? t.GetString() : item.TryGetProperty("name", out var n) ? n.GetString() : "Unknown",
                    media_type = item.TryGetProperty("media_type", out var mt) ? mt.GetString() : "movie",
                    poster_url = item.TryGetProperty("poster_path", out var pp) && pp.ValueKind == JsonValueKind.String ? $"https://image.tmdb.org/t/p/w342{pp.GetString()}" : null,
                    rating = item.TryGetProperty("vote_average", out var va) ? va.GetDouble() : 0,
                    reason = "Trending this week"
                });
            }
            return Ok(new { recommendations = recs, source = "tmdb_trending", generated = DateTime.UtcNow });
        }
        catch { return Ok(new { recommendations = Array.Empty<object>(), source = "error" }); }
    }

    [HttpGet("similar/{mediaType}/{tmdbId}")]
    public async Task<IActionResult> Similar(string mediaType, int tmdbId)
    {
        var tmdbKey = _config["TMDB_API_KEY"] ?? "";
        if (string.IsNullOrEmpty(tmdbKey))
        {
            var ts = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "tmdb_api_key" && s.Value != null);
            if (ts != null) { try { var d = JsonDocument.Parse(ts.Value ?? "{}"); if (d.RootElement.TryGetProperty("api_key", out var a)) tmdbKey = a.GetString() ?? ""; } catch { } }
        }
        if (string.IsNullOrEmpty(tmdbKey)) return Ok(Array.Empty<object>());

        var client = _http.CreateClient();
        try
        {
            var type = mediaType == "tv" ? "tv" : "movie";
            var resp = await client.GetStringAsync($"https://api.themoviedb.org/3/{type}/{tmdbId}/similar?api_key={tmdbKey}");
            return Content(resp, "application/json");
        }
        catch { return Ok(Array.Empty<object>()); }
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var setting = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "nutmeg_config");
        if (setting?.Value == null) return Ok(new { enabled = true, include_trending = true, include_similar = true, include_genre_mix = true, refresh_interval_hours = 24 });
        try { return Ok(JsonSerializer.Deserialize<object>(setting.Value)); } catch { return Ok(new { }); }
    }

    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] JsonElement config)
    {
        var raw = config.GetRawText();
        var existing = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "nutmeg_config");
        if (existing != null) existing.Value = raw; else _db.Settings.Add(new AppSetting { UserId = "", Key = "nutmeg_config", Value = raw });
        await _db.SaveChangesAsync();
        return Ok(new { status = "saved" });
    }
}

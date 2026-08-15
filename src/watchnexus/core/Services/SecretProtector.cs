using Microsoft.AspNetCore.DataProtection;

namespace WatchNexus.Core.Services;

// ── Encryption at rest (S-20 / S-21) ──────────────────────────────────
// Transparent encryption for sensitive credential/secret values stored in
// SQLite (integration API keys, qBittorrent passwords, WireGuard private
// keys, etc.). Backed by ASP.NET Core Data Protection (AES-256-CBC + HMAC)
// with keys persisted to the data dir so they survive restarts.
//
// Backward compatible: legacy plaintext rows (written before this shipped)
// have no "enc:v1:" prefix and decrypt to themselves. Newly written values
// are always encrypted. Wired into EF Core via a ValueConverter so every
// existing controller keeps working unchanged.
public static class SecretProtector
{
    private const string Prefix = "enc:v1:";
    private static IDataProtector? _protector;

    public static void Initialize(IDataProtector protector) => _protector = protector;

    // Encrypt on the way into the database.
    public static string ProtectValue(string? plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return plaintext ?? "";
        if (_protector is null) return plaintext;            // not wired (design-time / migrations)
        if (plaintext.StartsWith(Prefix)) return plaintext;  // already encrypted
        return Prefix + _protector.Protect(plaintext);
    }

    // Decrypt on the way out of the database.
    public static string UnprotectValue(string? stored)
    {
        if (string.IsNullOrEmpty(stored)) return stored ?? "";
        if (_protector is null) return stored;
        if (!stored.StartsWith(Prefix)) return stored;       // legacy plaintext
        try { return _protector.Unprotect(stored.Substring(Prefix.Length)); }
        catch { return string.Empty; }                        // corrupt / foreign payload — fail closed
    }
}

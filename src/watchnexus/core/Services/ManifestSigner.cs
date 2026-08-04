using System.Text;
using System.Text.Json;
using Org.BouncyCastle.Crypto.Generators;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using Org.BouncyCastle.Security;

namespace WatchNexus.Core.Services;

// ══════════════════════════════════════════════════════════════════════
// MANIFEST SIGNER — Ed25519 signature for patch manifests.
//
//   The signature covers the canonical JSON of the manifest (all fields
//   except "signature"), using deterministic serialization (sorted keys,
//   no whitespace). An attacker who modifies any field invalidates the
//   signature.
//
//   Key management:
//     Generate: ManifestSigner.GenerateKeyPair() -> (publicKey, privateKey)
//     Sign:     ManifestSigner.Sign(manifestJson, privateKey) -> base64
//     Verify:   ManifestSigner.Verify(manifestJson, signature, publicKey) -> bool
//
//   Server-side: PatchService reads PATCH_SIGNING_PUBLIC_KEY from config.
//   If empty, signature verification is skipped with a warning (backwards
//   compat during rollout).
// ══════════════════════════════════════════════════════════════════════

public static class ManifestSigner
{
    // BouncyCastle Ed25519: public key = 32 bytes, private key seed = 32 bytes, signature = 64 bytes
    public const int PublicKeySize = 32;
    public const int PrivateKeySeedSize = 32;
    public const int SignatureSize = 64;

    public static (string publicKeyBase64, string privateKeyBase64) GenerateKeyPair()
    {
        var generator = new Ed25519KeyPairGenerator();
        generator.Init(new Ed25519KeyGenerationParameters(new SecureRandom()));
        var keyPair = generator.GenerateKeyPair();

        var privateKey = ((Ed25519PrivateKeyParameters)keyPair.Private).GetEncoded();
        var publicKey = ((Ed25519PublicKeyParameters)keyPair.Public).GetEncoded();
        return (Convert.ToBase64String(publicKey), Convert.ToBase64String(privateKey));
    }

    public static string Sign(string manifestJson, string privateKeyBase64)
    {
        var canonical = StripSignature(manifestJson);
        var data = Encoding.UTF8.GetBytes(canonical);
        var privateKeyBytes = Convert.FromBase64String(privateKeyBase64);

        var privateKey = new Ed25519PrivateKeyParameters(privateKeyBytes);
        var signer = new Ed25519Signer();
        signer.Init(true, privateKey);
        signer.BlockUpdate(data, 0, data.Length);
        var signature = signer.GenerateSignature();
        return Convert.ToBase64String(signature);
    }

    public static bool Verify(string manifestJson, string signatureBase64, string publicKeyBase64)
    {
        try
        {
            var canonical = StripSignature(manifestJson);
            var data = Encoding.UTF8.GetBytes(canonical);
            var signatureBytes = Convert.FromBase64String(signatureBase64);
            var publicKeyBytes = Convert.FromBase64String(publicKeyBase64);

            var publicKey = new Ed25519PublicKeyParameters(publicKeyBytes);
            var verifier = new Ed25519Signer();
            verifier.Init(false, publicKey);
            verifier.BlockUpdate(data, 0, data.Length);
            return verifier.VerifySignature(signatureBytes);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Extract the manifest JSON without the "signature" field.
    /// This is the canonical form that gets signed/verified.
    /// </summary>
    public static string StripSignature(string manifestJson)
    {
        using var doc = JsonDocument.Parse(manifestJson);
        var root = doc.RootElement;
        var dict = new SortedDictionary<string, JsonElement>(StringComparer.Ordinal);

        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name == "signature") continue;
            dict[prop.Name] = prop.Value;
        }

        return SerializeSorted(dict);
    }

    /// <summary>
    /// Canonical JSON: sorted keys at every level, no whitespace, deterministic.
    /// </summary>
    public static string Canonicalize(string manifestJson)
    {
        using var doc = JsonDocument.Parse(manifestJson);
        return SerializeElement(doc.RootElement);
    }

    internal static string SerializeElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => SerializeObject(element),
            JsonValueKind.Array => SerializeArray(element),
            JsonValueKind.String => JsonSerializer.Serialize(element.GetString()),
            JsonValueKind.Number => element.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => "null",
            _ => element.GetRawText(),
        };
    }

    private static string SerializeObject(JsonElement obj)
    {
        var sb = new StringBuilder();
        sb.Append('{');
        var props = new List<JsonProperty>();
        foreach (var prop in obj.EnumerateObject())
            props.Add(prop);
        props.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.Ordinal));

        var first = true;
        foreach (var prop in props)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append(JsonSerializer.Serialize(prop.Name));
            sb.Append(':');
            sb.Append(SerializeElement(prop.Value));
        }
        sb.Append('}');
        return sb.ToString();
    }

    private static string SerializeArray(JsonElement arr)
    {
        var sb = new StringBuilder();
        sb.Append('[');
        var first = true;
        foreach (var item in arr.EnumerateArray())
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append(SerializeElement(item));
        }
        sb.Append(']');
        return sb.ToString();
    }

    private static string SerializeSorted(SortedDictionary<string, JsonElement> dict)
    {
        var sb = new StringBuilder();
        sb.Append('{');
        var first = true;
        foreach (var kvp in dict)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append(JsonSerializer.Serialize(kvp.Key));
            sb.Append(':');
            sb.Append(SerializeElement(kvp.Value));
        }
        sb.Append('}');
        return sb.ToString();
    }
}

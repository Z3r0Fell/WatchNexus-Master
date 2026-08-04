using System.Text;
using System.Text.Json;
using Org.BouncyCastle.Crypto.Generators;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Security;
using WatchNexus.Core.Services;

// ══════════════════════════════════════════════════════════════════════
// WatchNexus Manifest Signer — Offline Ed25519 signing tool
//
// Usage:
//   dotnet run --project tools/sign-manifest -- generate-keypair
//   dotnet run --project tools/sign-manifest -- sign --manifest <file> --key <private-key-file>
//   dotnet run --project tools/sign-manifest -- verify --manifest <file> --key <public-key-file>
// ══════════════════════════════════════════════════════════════════════

if (args.Length == 0)
{
    PrintUsage();
    return 1;
}

return args[0].ToLowerInvariant() switch
{
    "generate-keypair" or "gen" => GenerateKeyPair(args),
    "sign" => SignManifest(args),
    "verify" => VerifyManifest(args),
    _ => PrintUsage()
};

int PrintUsage()
{
    Console.WriteLine("""
    WatchNexus Manifest Signer — Ed25519

    Commands:
      generate-keypair   Generate a new Ed25519 keypair
                         --out <file>        Write private key (default: private.key)
                         --out-public <file>  Write public key (default: public.key)

      sign               Sign a manifest file
                         --manifest <file>   Path to manifest JSON
                         --key <file>        Path to private key file (PEM or raw base64)
                         --output <file>     Output signed manifest (default: overwrites input)

      verify             Verify a manifest signature
                         --manifest <file>   Path to signed manifest JSON
                         --key <file>        Path to public key file (PEM or raw base64)
    """);
    return 1;
}

int GenerateKeyPair(string[] args)
{
    var privateKeyPath = GetArg(args, "--out") ?? "private.key";
    var publicKeyPath = GetArg(args, "--out-public") ?? "public.key";

    var generator = new Ed25519KeyPairGenerator();
    generator.Init(new Ed25519KeyGenerationParameters(new SecureRandom()));
    var keyPair = generator.GenerateKeyPair();

    var privateKeyBytes = ((Ed25519PrivateKeyParameters)keyPair.Private).GetEncoded();
    var publicKeyBytes = ((Ed25519PublicKeyParameters)keyPair.Public).GetEncoded();

    // Write private key as PEM
    var privPem = $"-----BEGIN PRIVATE KEY-----\n{IndentBase64(Convert.ToBase64String(privateKeyBytes))}\n-----END PRIVATE KEY-----\n";
    File.WriteAllText(privateKeyPath, privPem);

    // Write public key as PEM
    var pubPem = $"-----BEGIN PUBLIC KEY-----\n{IndentBase64(Convert.ToBase64String(publicKeyBytes))}\n-----END PUBLIC KEY-----\n";
    File.WriteAllText(publicKeyPath, pubPem);

    Console.WriteLine($"Keypair generated:");
    Console.WriteLine($"  Private key: {privateKeyPath}");
    Console.WriteLine($"  Public key:  {publicKeyPath}");
    Console.WriteLine();
    Console.WriteLine($"  Public key (base64, for server config PATCH_SIGNING_PUBLIC_KEY):");
    Console.WriteLine($"  {Convert.ToBase64String(publicKeyBytes)}");

    return 0;
}

int SignManifest(string[] args)
{
    var manifestPath = GetArg(args, "--manifest");
    var keyPath = GetArg(args, "--key");
    var outputPath = GetArg(args, "--output") ?? manifestPath;

    if (manifestPath == null || keyPath == null)
    {
        Console.Error.WriteLine("Error: --manifest and --key are required");
        return 1;
    }

    if (!File.Exists(manifestPath))
    {
        Console.Error.WriteLine($"Error: manifest not found: {manifestPath}");
        return 1;
    }

    var privateKeyBase64 = ReadKey(keyPath);
    var manifestJson = File.ReadAllText(manifestPath);

    // Validate it's valid JSON
    try { JsonDocument.Parse(manifestJson); }
    catch (JsonException ex)
    {
        Console.Error.WriteLine($"Error: invalid JSON in manifest: {ex.Message}");
        return 1;
    }

    var signature = ManifestSigner.Sign(manifestJson, privateKeyBase64);

    // Embed signature in manifest (sorted, canonical)
    using var doc = JsonDocument.Parse(manifestJson);
    var root = doc.RootElement;
    var dict = new SortedDictionary<string, JsonElement>(StringComparer.Ordinal);
    foreach (var prop in root.EnumerateObject())
        dict[prop.Name] = prop.Value;
    dict["signature"] = JsonSerializer.SerializeToElement(signature);

    var signedJson = JsonSerializer.Serialize(dict, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(outputPath!, signedJson);

    Console.WriteLine($"Manifest signed:");
    Console.WriteLine($"  Input:     {manifestPath}");
    Console.WriteLine($"  Output:    {outputPath}");
    Console.WriteLine($"  Signature: {signature[..40]}...");

    return 0;
}

int VerifyManifest(string[] args)
{
    var manifestPath = GetArg(args, "--manifest");
    var keyPath = GetArg(args, "--key");

    if (manifestPath == null || keyPath == null)
    {
        Console.Error.WriteLine("Error: --manifest and --key are required");
        return 1;
    }

    if (!File.Exists(manifestPath))
    {
        Console.Error.WriteLine($"Error: manifest not found: {manifestPath}");
        return 1;
    }

    var publicKeyBase64 = ReadKey(keyPath);
    var manifestJson = File.ReadAllText(manifestPath);

    using var doc = JsonDocument.Parse(manifestJson);
    if (!doc.RootElement.TryGetProperty("signature", out var sigProp))
    {
        Console.Error.WriteLine("Error: manifest has no 'signature' field");
        return 1;
    }

    var signature = sigProp.GetString();
    if (string.IsNullOrEmpty(signature))
    {
        Console.Error.WriteLine("Error: signature is empty");
        return 1;
    }

    var valid = ManifestSigner.Verify(manifestJson, signature, publicKeyBase64);

    if (valid)
    {
        Console.WriteLine("Signature VALID");
        return 0;
    }
    else
    {
        Console.Error.WriteLine("Signature INVALID — manifest may have been tampered with");
        return 1;
    }
}

static string? GetArg(string[] args, string name)
{
    for (int i = 1; i < args.Length - 1; i++)
    {
        if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase))
            return args[i + 1];
    }
    return null;
}

static string ReadKey(string path)
{
    var content = File.ReadAllText(path).Trim();

    // Strip PEM headers/footers if present
    if (content.StartsWith("-----BEGIN"))
    {
        var lines = content.Split('\n')
            .Where(l => !l.StartsWith("-----") && !string.IsNullOrWhiteSpace(l))
            .Select(l => l.Trim());
        return string.Concat(lines);
    }

    return content;
}

static string IndentBase64(string base64)
{
    return string.Join('\n', Enumerable.Range(0, base64.Length / 64 + 1)
        .Select(i => base64.Substring(i * 64, Math.Min(64, base64.Length - i * 64)))
        .Where(s => s.Length > 0));
}

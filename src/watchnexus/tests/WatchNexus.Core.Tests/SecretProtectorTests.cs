using Microsoft.AspNetCore.DataProtection;
using WatchNexus.Core.Services;

namespace WatchNexus.Core.Tests;

public class SecretProtectorTests
{
    public SecretProtectorTests()
    {
        SecretProtector.Initialize(new EphemeralDataProtectionProvider().CreateProtector("WatchNexus.Secrets"));
    }

    [Fact]
    public void Protect_then_unprotect_roundtrips()
    {
        var stored = SecretProtector.ProtectValue("my-api-key");
        Assert.StartsWith("enc:v1:", stored);
        Assert.NotEqual("my-api-key", stored);
        Assert.Equal("my-api-key", SecretProtector.UnprotectValue(stored));
    }

    [Fact]
    public void Protect_is_idempotent_on_already_encrypted_values()
    {
        var once = SecretProtector.ProtectValue("secret");
        var twice = SecretProtector.ProtectValue(once);
        Assert.Equal(once, twice);
    }

    [Fact]
    public void Legacy_plaintext_rows_pass_through_unchanged()
    {
        Assert.Equal("legacy-plain-value", SecretProtector.UnprotectValue("legacy-plain-value"));
    }

    [Fact]
    public void Empty_and_null_values_are_safe()
    {
        Assert.Equal("", SecretProtector.ProtectValue(null));
        Assert.Equal("", SecretProtector.ProtectValue(""));
        Assert.Equal("", SecretProtector.UnprotectValue(null));
        Assert.Equal("", SecretProtector.UnprotectValue(""));
    }

    [Fact]
    public void Corrupt_payload_fails_open_to_stored_value()
    {
        var corrupt = "enc:v1:not-a-real-payload";
        Assert.Equal(corrupt, SecretProtector.UnprotectValue(corrupt));
    }
}

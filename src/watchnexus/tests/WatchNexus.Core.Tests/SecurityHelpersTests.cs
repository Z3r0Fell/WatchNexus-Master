using WatchNexus.Core.Auth;

namespace WatchNexus.Core.Tests;

public class PasswordPolicyTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("short1")]
    public void Rejects_missing_or_short_passwords(string? pw)
    {
        var (ok, error) = PasswordPolicy.Validate(pw);
        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Theory]
    [InlineData("onlyletters")]
    [InlineData("12345678")]
    public void Rejects_passwords_without_letter_and_digit_mix(string pw)
    {
        var (ok, _) = PasswordPolicy.Validate(pw);
        Assert.False(ok);
    }

    [Theory]
    [InlineData("password1")]
    [InlineData("Str0ngPassphrase")]
    public void Accepts_compliant_passwords(string pw)
    {
        var (ok, error) = PasswordPolicy.Validate(pw);
        Assert.True(ok);
        Assert.Null(error);
    }
}

public class EmailValidatorTests
{
    [Theory]
    [InlineData("owner@watchnexus.local")]
    [InlineData("a.b+c@example.com")]
    public void Accepts_valid_emails(string email) => Assert.True(EmailValidator.IsValid(email));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no-at-sign")]
    [InlineData("user@nodot")]
    [InlineData("user@@double.com")]
    public void Rejects_invalid_emails(string? email) => Assert.False(EmailValidator.IsValid(email));
}

public class SsrfGuardTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("metadata")]
    [InlineData("metadata.google.internal")]
    [InlineData("169.254.169.254")]
    [InlineData("fd00:ec2::254")]
    public void Blocks_cloud_metadata_targets(string? host) => Assert.True(SsrfGuard.IsBlocked(host));

    [Theory]
    [InlineData("localhost")]
    [InlineData("127.0.0.1")]
    [InlineData("192.168.1.50")]
    [InlineData("qbittorrent.lan")]
    public void Allows_legitimate_lan_download_clients(string host) => Assert.False(SsrfGuard.IsBlocked(host));
}

public class StreamTokenTests
{
    private const string Secret = "unit-test-secret-key-0123456789";

    [Fact]
    public void Roundtrip_validates()
    {
        var token = StreamToken.Issue("media-1", Secret, TimeSpan.FromMinutes(5));
        Assert.True(StreamToken.Validate("media-1", token, Secret));
    }

    [Fact]
    public void Rejects_wrong_media_id()
    {
        var token = StreamToken.Issue("media-1", Secret, TimeSpan.FromMinutes(5));
        Assert.False(StreamToken.Validate("media-2", token, Secret));
    }

    [Fact]
    public void Rejects_expired_token()
    {
        var token = StreamToken.Issue("media-1", Secret, TimeSpan.FromSeconds(-5));
        Assert.False(StreamToken.Validate("media-1", token, Secret));
    }

    [Fact]
    public void Rejects_wrong_secret_and_garbage()
    {
        var token = StreamToken.Issue("media-1", Secret, TimeSpan.FromMinutes(5));
        Assert.False(StreamToken.Validate("media-1", token, "another-secret"));
        Assert.False(StreamToken.Validate("media-1", "not.a.token", Secret));
        Assert.False(StreamToken.Validate("media-1", null, Secret));
        Assert.False(StreamToken.Validate("media-1", token, ""));
    }
}

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Shared;

namespace WatchNexus.Tests;

public class AuthServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "TestSecretKey_ThatIsAtLeast32CharactersLong!"
            })
            .Build();

        _service = new AuthService(_db, config);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Close();
    }

    [Fact]
    public void Register_CreatesNewUser_ReturnsUser()
    {
        var user = _service.Register("test@test.com", "testuser", "password123");

        Assert.NotNull(user);
        Assert.Equal("test@test.com", user.Email);
        Assert.Equal("testuser", user.Username);
        Assert.Equal("user", user.Role);
        Assert.NotNull(user.PasswordHash);
        Assert.NotEqual("password123", user.PasswordHash);
    }

    [Fact]
    public void Register_DuplicateEmail_ReturnsNull()
    {
        _service.Register("dup@test.com", "user1", "pass123");
        var result = _service.Register("dup@test.com", "user2", "pass456");

        Assert.Null(result);
    }

    [Fact]
    public void Login_ValidCredentials_ReturnsUserAndToken()
    {
        _service.Register("login@test.com", "loginuser", "correctpass");

        var (user, token) = _service.Login("login@test.com", "correctpass");

        Assert.NotNull(user);
        Assert.Equal("login@test.com", user.Email);
        Assert.NotNull(token);
        Assert.NotEmpty(token);
    }

    [Fact]
    public void Login_WrongPassword_ReturnsNull()
    {
        _service.Register("wrong@test.com", "wronguser", "realpass");

        var (user, token) = _service.Login("wrong@test.com", "wrongpass");

        Assert.Null(user);
        Assert.Null(token);
    }

    [Fact]
    public void Login_NonExistentEmail_ReturnsNull()
    {
        var (user, token) = _service.Login("nobody@test.com", "anypass");

        Assert.Null(user);
        Assert.Null(token);
    }

    [Fact]
    public void GenerateToken_ReturnsValidJwt()
    {
        var user = new AppUser
        {
            Id = "test-id-123",
            Email = "token@test.com",
            Username = "tokenuser",
            Role = "admin"
        };

        var token = _service.GenerateToken(user);

        Assert.NotNull(token);
        Assert.NotEmpty(token);
        Assert.Contains(".", token);
        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);
    }

    [Fact]
    public void Register_SetsDefaultRole_WhenNotSpecified()
    {
        var user = _service.Register("role@test.com", "roleuser", "pass123");

        Assert.NotNull(user);
        Assert.Equal("user", user.Role);
    }
}

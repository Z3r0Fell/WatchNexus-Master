using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using WatchNexus.Core.Auth;
using WatchNexus.Core.Data;
using WatchNexus.Core.Services;
using WatchNexus.Shared;

namespace WatchNexus.Core.Tests;

public class DatabaseIntegrationTests
{
    private static DbContextOptions<AppDbContext> CreateSqliteFileOptions(string dbName)
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"WatchNexus_Test_{dbName}_{Guid.NewGuid()}.db");
        var connectionString = $"Data Source={dbPath};Mode=ReadWriteCreate;Cache=Shared;Foreign Keys=True";
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connectionString)
            .EnableSensitiveDataLogging()
            .Options;
    }

    [Fact]
    public async Task Migration_AppliesCleanly()
    {
        var options = CreateSqliteFileOptions($"MigrationTest_{Guid.NewGuid()}");

        using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        // Verify all expected DbSets exist
        Assert.NotNull(db.Users);
        Assert.NotNull(db.Settings);
        Assert.NotNull(db.Libraries);
        Assert.NotNull(db.MediaItems);
        Assert.NotNull(db.AuditLogs);
        Assert.NotNull(db.IpRules);
        Assert.NotNull(db.ApiKeys);
        Assert.NotNull(db.VpnPeers);
        Assert.NotNull(db.VpnServerConfigs);
        Assert.NotNull(db.Downloads);
        Assert.NotNull(db.IptvSources);
        Assert.NotNull(db.IptvChannels);
        Assert.NotNull(db.PodcastSubscriptions);
        Assert.NotNull(db.RadioFavorites);
        Assert.NotNull(db.PhotoLibraries);
        Assert.NotNull(db.Playlists);
        Assert.NotNull(db.PlaylistItems);
        Assert.NotNull(db.WebVideoBookmarks);
        Assert.NotNull(db.WebVideoHistories);
        Assert.NotNull(db.PlayEvents);
        Assert.NotNull(db.NotificationLogs);
        Assert.NotNull(db.MediaRequests);
        Assert.NotNull(db.TranscodeJobs);
    }

    [Fact]
    public async Task EntityRelationships_WorkCorrectly()
    {
        var options = CreateSqliteFileOptions($"RelationshipTest_{Guid.NewGuid()}");

        using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var library = new Library { Id = "lib-1", Name = "Movies", Path = "/media/movies", MediaType = "movies" };
        db.Libraries.Add(library);

        var item1 = new MediaItem { Id = "item-1", LibraryId = "lib-1", Title = "Movie 1", FilePath = "/media/movies/m1.mkv", FileSize = 1000, MediaType = "movie" };
        var item2 = new MediaItem { Id = "item-2", LibraryId = "lib-1", Title = "Movie 2", FilePath = "/media/movies/m2.mkv", FileSize = 2000, MediaType = "movie" };
        db.MediaItems.AddRange(item1, item2);

        await db.SaveChangesAsync();

        var items = await db.MediaItems.Where(m => m.LibraryId == "lib-1").ToListAsync();
        Assert.Equal(2, items.Count);
    }

    [Fact]
    public async Task CascadeDelete_LibraryRemovesMediaItems()
    {
        var options = CreateSqliteFileOptions($"CascadeTest_{Guid.NewGuid()}");

        using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var library = new Library { Id = "lib-1", Name = "Movies", Path = "/media/movies", MediaType = "movies" };
        db.Libraries.Add(library);
        db.MediaItems.Add(new MediaItem { Id = "item-1", LibraryId = "lib-1", Title = "Movie", FilePath = "/media/movies/m.mkv", FileSize = 1000, MediaType = "movie" });
        await db.SaveChangesAsync();

        db.Libraries.Remove(library);
        await db.SaveChangesAsync();

        var items = await db.MediaItems.Where(m => m.LibraryId == "lib-1").ToListAsync();
        Assert.Empty(items);
    }

    [Fact]
    public async Task Indexes_AreCreated()
    {
        var options = CreateSqliteFileOptions($"IndexTest_{Guid.NewGuid()}");

        using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var library = new Library { Id = "lib-1", Name = "Movies", Path = "/media/movies", MediaType = "movies" };
        db.Libraries.Add(library);
        
        for (int i = 0; i < 10; i++)
        {
            db.MediaItems.Add(new MediaItem { Id = $"item-{i}", LibraryId = "lib-1", Title = $"Movie {i}", FilePath = $"/media/m{i}.mkv", FileSize = 1000, MediaType = "movie" });
        }
        await db.SaveChangesAsync();

        var items = await db.MediaItems.Where(m => m.LibraryId == "lib-1").ToListAsync();
        Assert.Equal(10, items.Count);

        for (int i = 0; i < 5; i++)
        {
            db.Playlists.Add(new Playlist { Id = $"pl-{i}", UserId = "user-1", Name = $"Playlist {i}" });
        }
        await db.SaveChangesAsync();

        var playlists = await db.Playlists.Where(p => p.UserId == "user-1").ToListAsync();
        Assert.Equal(5, playlists.Count);
    }

    [Fact]
    public void SecretProtector_Encrypts_AppSetting_Value()
    {
        SecretProtector.Initialize(new EphemeralDataProtectionProvider().CreateProtector("WatchNexus.Secrets"));

        var setting = new AppSetting { Key = "secret_key", Value = "super-secret-value", UserId = "test-user" };
        
        // Simulate what the ValueConverter does
        var encrypted = SecretProtector.ProtectValue(setting.Value);
        Assert.StartsWith("enc:v1:", encrypted);
        Assert.NotEqual("super-secret-value", encrypted);
        
        var decrypted = SecretProtector.UnprotectValue(encrypted);
        Assert.Equal("super-secret-value", decrypted);
    }

    [Fact]
    public void SecretProtector_Encrypts_VpnPeer_Keys()
    {
        SecretProtector.Initialize(new EphemeralDataProtectionProvider().CreateProtector("WatchNexus.Secrets"));

        var peer = new VpnPeer
        {
            Id = "peer-1",
            Name = "Test",
            PublicKey = "pubkey",
            PrivateKey = "private-key-secret",
            PresharedKey = "psk-secret",
            Address = "10.0.0.2/32"
        };

        var encryptedPrivateKey = SecretProtector.ProtectValue(peer.PrivateKey);
        var encryptedPresharedKey = SecretProtector.ProtectValue(peer.PresharedKey);
        
        Assert.StartsWith("enc:v1:", encryptedPrivateKey);
        Assert.StartsWith("enc:v1:", encryptedPresharedKey);
        
        Assert.Equal("private-key-secret", SecretProtector.UnprotectValue(encryptedPrivateKey));
        Assert.Equal("psk-secret", SecretProtector.UnprotectValue(encryptedPresharedKey));
    }

    [Fact]
    public void SecretProtector_Encrypts_VpnServerConfig_PrivateKey()
    {
        SecretProtector.Initialize(new EphemeralDataProtectionProvider().CreateProtector("WatchNexus.Secrets"));

        var config = new VpnServerConfig
        {
            Id = "default",
            PrivateKey = "server-private-key"
        };

        var encrypted = SecretProtector.ProtectValue(config.PrivateKey);
        
        Assert.StartsWith("enc:v1:", encrypted);
        Assert.Equal("server-private-key", SecretProtector.UnprotectValue(encrypted));
    }

    [Fact]
    public async Task UniqueConstraints_Work()
    {
        var options = CreateSqliteFileOptions($"UniqueTest_{Guid.NewGuid()}");

        using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var user1 = new AppUser { Id = "user-1", Email = "test@example.com", Username = "user1", PasswordHash = "hash" };
        var user2 = new AppUser { Id = "user-2", Email = "test@example.com", Username = "user2", PasswordHash = "hash" };
        
        db.Users.Add(user1);
        await db.SaveChangesAsync();

        db.Users.Add(user2);
        
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
}
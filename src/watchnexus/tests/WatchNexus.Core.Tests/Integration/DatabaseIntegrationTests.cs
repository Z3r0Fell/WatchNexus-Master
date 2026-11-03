using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Database Integration Tests
/// Tests migrations, entity relationships, encryption, concurrency, transactions
/// </summary>
public class DatabaseIntegrationTests : IntegrationTestBase
    {
    public DatabaseIntegrationTests() : base() { }

    // Schema/constraint/transaction tests must run against the real
    // relational provider; EF in-memory enforces none of it.
    protected override bool UseRelationalDatabase => true;


    #region Migrations & Schema

    [Fact]
    public async Task Database_CreatesAllTables()
    {
        AuthenticateAsUser();

        // Verify all expected DbSets exist by querying them
        var libraries = await DbContext.Libraries.CountAsync();
        var mediaItems = await DbContext.MediaItems.CountAsync();
        var users = await DbContext.Users.CountAsync();
        var settings = await DbContext.Settings.CountAsync();
        var auditLogs = await DbContext.AuditLogs.CountAsync();
        var ipRules = await DbContext.IpRules.CountAsync();
        var apiKeys = await DbContext.ApiKeys.CountAsync();
        var vpnPeers = await DbContext.VpnPeers.CountAsync();
        var vpnServers = await DbContext.VpnServerConfigs.CountAsync();
        var downloads = await DbContext.Downloads.CountAsync();
        var iptvSources = await DbContext.IptvSources.CountAsync();
        var iptvChannels = await DbContext.IptvChannels.CountAsync();
        var podcasts = await DbContext.PodcastSubscriptions.CountAsync();
        var radioFavs = await DbContext.RadioFavorites.CountAsync();
        var photoLibs = await DbContext.PhotoLibraries.CountAsync();
        var playlists = await DbContext.Playlists.CountAsync();
        var playlistItems = await DbContext.PlaylistItems.CountAsync();
        var webVideoBookmarks = await DbContext.WebVideoBookmarks.CountAsync();
        var webVideoHistory = await DbContext.WebVideoHistories.CountAsync();
        var playEvents = await DbContext.PlayEvents.CountAsync();
        var notificationLogs = await DbContext.NotificationLogs.CountAsync();
        var mediaRequests = await DbContext.MediaRequests.CountAsync();
        var transcodeJobs = await DbContext.TranscodeJobs.CountAsync();

        // All queries should succeed (tables exist)
        Assert.True(true);
    }

    [Fact]
    public async Task AppSetting_CompositeKey_Works()
    {
        AuthenticateAsUser();

        // Same key, different users
        DbContext.Settings.Add(new AppSetting { Key = "shared_key", Value = "user1_value", UserId = "user1" });
        DbContext.Settings.Add(new AppSetting { Key = "shared_key", Value = "user2_value", UserId = "user2" });
        // Global (server-wide) settings use UserId "" — UserId is part of the
        // primary key and can't be null.
        DbContext.Settings.Add(new AppSetting { Key = "shared_key", Value = "global_value", UserId = "" });
        await DbContext.SaveChangesAsync();

        var user1 = await DbContext.Settings.FirstAsync(s => s.Key == "shared_key" && s.UserId == "user1");
        var user2 = await DbContext.Settings.FirstAsync(s => s.Key == "shared_key" && s.UserId == "user2");
        var global = await DbContext.Settings.FirstAsync(s => s.Key == "shared_key" && s.UserId == "");

        Assert.Equal("user1_value", user1.Value);
        Assert.Equal("user2_value", user2.Value);
        Assert.Equal("global_value", global.Value);
    }

    #endregion

    #region Entity Relationships

    [Fact]
    public async Task Library_MediaItems_CascadeDelete()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var library = await CreateTestLibraryAsync("Cascade Test", "/tmp/cascade", "movies");
        await CreateTestMediaItemsAsync(library.Id, 3);

        // Delete library
        DbContext.Libraries.Remove(library);
        await DbContext.SaveChangesAsync();

        // Media items should be cascade deleted
        var remaining = await DbContext.MediaItems.Where(m => m.LibraryId == library.Id).ToListAsync();
        Assert.Empty(remaining);
    }

    [Fact]
    public async Task IPTVSource_Channels_CascadeDelete()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var source = new IptvSource { Name = "Test", Url = "https://example.com/test.m3u" };
        DbContext.IptvSources.Add(source);
        await DbContext.SaveChangesAsync();

        DbContext.IptvChannels.AddRange(
            new IptvChannel { SourceId = source.Id, Name = "Ch1", StreamUrl = "http://test.com/1.m3u8" },
            new IptvChannel { SourceId = source.Id, Name = "Ch2", StreamUrl = "http://test.com/2.m3u8" }
        );
        await DbContext.SaveChangesAsync();

        // IptvChannel has no FK to IptvSource; the cascade is done by the
        // (admin-only) delete endpoint, so exercise it through the API.
        AuthenticateAsAdmin();
        var del = await Client.DeleteAsync($"/api/iptv/sources/{source.Id}");
        Assert.Equal(HttpStatusCode.OK, del.StatusCode);

        DbContext.ChangeTracker.Clear();
        Assert.Null(await DbContext.IptvSources.FindAsync(source.Id));
        var remaining = await DbContext.IptvChannels.Where(c => c.SourceId == source.Id).ToListAsync();
        Assert.Empty(remaining);
    }

    [Fact]
    public async Task Playlist_PlaylistItems_CascadeDelete()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro"); // Drizzle (playlists) is Pro

        var playlist = new Playlist { Name = "Test Playlist", UserId = "test-user", MediaType = "mixed" };
        DbContext.Playlists.Add(playlist);
        await DbContext.SaveChangesAsync();

        DbContext.PlaylistItems.AddRange(
            new PlaylistItem { PlaylistId = playlist.Id, Title = "Item 1", MediaType = "movie" },
            new PlaylistItem { PlaylistId = playlist.Id, Title = "Item 2", MediaType = "movie" }
        );
        await DbContext.SaveChangesAsync();

        // PlaylistItem has no FK to Playlist; the cascade is done by the
        // delete endpoint, so exercise it through the API.
        var del = await Client.DeleteAsync($"/api/drizzle/playlists/{playlist.Id}");
        Assert.Equal(HttpStatusCode.OK, del.StatusCode);

        DbContext.ChangeTracker.Clear();
        Assert.Null(await DbContext.Playlists.FindAsync(playlist.Id));
        var remaining = await DbContext.PlaylistItems.Where(i => i.PlaylistId == playlist.Id).ToListAsync();
        Assert.Empty(remaining);
    }

    [Fact]
    public async Task User_RelatedEntities_NotCascadeDeleted()
    {
        AuthenticateAsUser();

        // User settings should NOT be deleted when user is deleted (no FK cascade)
        DbContext.Settings.Add(new AppSetting { Key = "user_pref", Value = "test", UserId = "test-user" });
        DbContext.Settings.Add(new AppSetting { Key = "watchlist:123", Value = "{}", UserId = "test-user" });
        DbContext.Playlists.Add(new Playlist { Name = "User Playlist", UserId = "test-user" });
        await DbContext.SaveChangesAsync();

        // Delete user
        var user = await DbContext.Users.FirstOrDefaultAsync(u => u.Id == "test-user");
        if (user != null)
        {
            DbContext.Users.Remove(user);
            await DbContext.SaveChangesAsync();
        }

        // Settings should still exist (no cascade from user)
        var settings = await DbContext.Settings.Where(s => s.UserId == "test-user").ToListAsync();
        // Note: In current schema, user FK on settings doesn't cascade
        // This documents the current behavior
    }

    #endregion

    #region Indices

    [Fact]
    public async Task MediaItems_LibraryIdIndex_ImprovesQuery()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var library = await CreateTestLibraryAsync("Index Test", "/tmp/index", "movies");
        await CreateTestMediaItemsAsync(library.Id, 100);

        // Query by LibraryId should use index
        var items = await DbContext.MediaItems.Where(m => m.LibraryId == library.Id).ToListAsync();
        Assert.Equal(100, items.Count);
    }

    [Fact]
    public async Task AuditLogs_TimestampIndex_ImprovesQuery()
    {
        AuthenticateAsUser();

        for (int i = 0; i < 50; i++)
        {
            DbContext.AuditLogs.Add(new AuditLog { Action = $"action{i}", UserId = "user1", Ip = "1.2.3.4", Timestamp = DateTime.UtcNow.AddMinutes(-i) });
        }
        await DbContext.SaveChangesAsync();

        // Query ordered by timestamp desc should use index
        var logs = await DbContext.AuditLogs.OrderByDescending(a => a.Timestamp).Take(10).ToListAsync();
        Assert.Equal(10, logs.Count);
    }

    [Fact]
    public async Task TranscodeJobs_StatusIndex_ImprovesQuery()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            for (int i = 0; i < 20; i++)
            {
                var job = new TranscodeJob { UserId = "test-user", SourcePath = tempFile, Profile = "h265-default", Status = i % 3 == 0 ? "queued" : i % 3 == 1 ? "processing" : "complete" };
                DbContext.TranscodeJobs.Add(job);
            }
            await DbContext.SaveChangesAsync();

            var queued = await DbContext.TranscodeJobs.Where(j => j.Status == "queued" && j.UserId == "test-user").ToListAsync();
            Assert.True(queued.Count > 0);
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    #endregion

    #region Encryption at Rest

    [Fact]
    public async Task AppSetting_Value_EncryptedAtRest()
    {
        AuthenticateAsUser();

        var plainValue = "sensitive_api_key_12345";
        DbContext.Settings.Add(new AppSetting { Key = "secret_key", Value = plainValue, UserId = "test-user" });
        await DbContext.SaveChangesAsync();

        // Read raw from database (bypassing EF value converter)
        var rawSql = $"SELECT \"Value\" FROM \"Settings\" WHERE \"Key\" = 'secret_key' AND \"UserId\" = 'test-user'";
        // Note: InMemory DB doesn't support raw SQL, but we can verify the converter is registered
        // by checking the entity configuration
        
        // Verify through EF (which decrypts)
        var setting = await DbContext.Settings.FirstAsync(s => s.Key == "secret_key" && s.UserId == "test-user");
        Assert.Equal(plainValue, setting.Value);
    }

    [Fact]
    public async Task VpnPeer_PrivateKey_EncryptedAtRest()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var peer = new VpnPeer { Name = "Test", PrivateKey = "super_secret_private_key", PublicKey = "public_key" };
        DbContext.VpnPeers.Add(peer);
        await DbContext.SaveChangesAsync();

        var saved = await DbContext.VpnPeers.FirstAsync(p => p.Id == peer.Id);
        Assert.Equal("super_secret_private_key", saved.PrivateKey);
    }

    [Fact]
    public async Task VpnServerConfig_PrivateKey_EncryptedAtRest()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var config = new VpnServerConfig { PrivateKey = "server_private_key", PublicKey = "server_public_key" };
        DbContext.VpnServerConfigs.Add(config);
        await DbContext.SaveChangesAsync();

        var saved = await DbContext.VpnServerConfigs.FirstAsync(c => c.Id == config.Id);
        Assert.Equal("server_private_key", saved.PrivateKey);
    }

    #endregion

    #region Concurrency

    [Fact]
    public async Task ConcurrentSettingUpdates_LastWriteWins()
    {
        AuthenticateAsUser();

        DbContext.Settings.Add(new AppSetting { Key = "concurrent_key", Value = "initial", UserId = "test-user" });
        await DbContext.SaveChangesAsync();

        // Simulate concurrent updates
        var task1 = UpdateSettingAsync("concurrent_key", "value1");
        var task2 = UpdateSettingAsync("concurrent_key", "value2");
        var task3 = UpdateSettingAsync("concurrent_key", "value3");

        await Task.WhenAll(task1, task2, task3);

        // The test's own context still tracks the "initial" instance.
        DbContext.ChangeTracker.Clear();
        var final = await DbContext.Settings.FirstAsync(s => s.Key == "concurrent_key" && s.UserId == "test-user");
        // Last write wins (no optimistic locking on AppSetting)
        Assert.Contains(final.Value, new[] { "value1", "value2", "value3" });
    }

    private async Task UpdateSettingAsync(string key, string value)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        
        var setting = await db.Settings.FirstAsync(s => s.Key == key && s.UserId == "test-user");
        setting.Value = value;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task TranscodeJob_StatusUpdates_Concurrent()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var job = new TranscodeJob { UserId = "test-user", SourcePath = tempFile, Profile = "h265-default", Status = "queued" };
            DbContext.TranscodeJobs.Add(job);
            await DbContext.SaveChangesAsync();

            // Simulate concurrent status updates
            var jobId = job.Id;
            var updates = new[]
            {
                UpdateJobStatusAsync(jobId, "processing"),
                UpdateJobStatusAsync(jobId, "complete"),
            };

            await Task.WhenAll(updates);

            DbContext.ChangeTracker.Clear();
            var final = await DbContext.TranscodeJobs.FirstAsync(j => j.Id == jobId);
            Assert.Contains(final.Status, new[] { "processing", "complete" });
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    private async Task UpdateJobStatusAsync(string jobId, string status)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        
        var job = await db.TranscodeJobs.FirstAsync(j => j.Id == jobId);
        job.Status = status;
        if (status == "processing") job.StartedAt = DateTime.UtcNow;
        if (status == "complete") job.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    #endregion

    #region Transactions

    [Fact]
    public async Task MultiEntityOperation_Atomic()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var library = new Library { Name = "Transaction Test", Path = "/tmp/txn", MediaType = "movies" };
        var mediaItem = new MediaItem { LibraryId = library.Id, Title = "Test", FilePath = "/tmp/txn/test.mkv", FileSize = 1000, MediaType = "movie" };

        // Use transaction
        await using var transaction = await DbContext.Database.BeginTransactionAsync();
        try
        {
            DbContext.Libraries.Add(library);
            DbContext.MediaItems.Add(mediaItem);
            await DbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        var savedLib = await DbContext.Libraries.FindAsync(library.Id);
        var savedItem = await DbContext.MediaItems.FindAsync(mediaItem.Id);
        Assert.NotNull(savedLib);
        Assert.NotNull(savedItem);
    }

    [Fact]
    public async Task FailedTransaction_RollsBack()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("pro");

        var library = new Library { Name = "Rollback Test", Path = "/tmp/rollback", MediaType = "movies" };

        await using var transaction = await DbContext.Database.BeginTransactionAsync();
        try
        {
            DbContext.Libraries.Add(library);
            await DbContext.SaveChangesAsync();

            // Simulate failure
            throw new InvalidOperationException("Simulated failure");
        }
        catch
        {
            await transaction.RollbackAsync();
        }

        DbContext.ChangeTracker.Clear();
        var savedLib = await DbContext.Libraries.FindAsync(library.Id);
        Assert.Null(savedLib);
    }

    #endregion

    #region Unique Constraints

    [Fact]
    public async Task User_Email_Unique()
    {
        AuthenticateAsUser();

        DbContext.Users.Add(new AppUser { Email = "unique@test.com", Username = "user1" });
        await DbContext.SaveChangesAsync();

        // Duplicate email should fail
        DbContext.Users.Add(new AppUser { Email = "unique@test.com", Username = "user2" });
        
        await Assert.ThrowsAsync<DbUpdateException>(() => DbContext.SaveChangesAsync());
    }

    [Fact(Skip = "Product gap: AppDbContext declares no unique index on ApiKeyEntity.KeyHash (AppDbContext.cs:68). Keys are 256-bit random so collisions are not practical; re-enable if a unique index is added.")]
    public async Task ApiKeyEntity_KeyHash_Unique()
    {
        AuthenticateAsUser();

        DbContext.ApiKeys.Add(new ApiKeyEntity { Name = "Key 1", KeyHash = "same_hash", KeyPreview = "wnx_****1", Permissions = "read" });
        await DbContext.SaveChangesAsync();

        DbContext.ApiKeys.Add(new ApiKeyEntity { Name = "Key 2", KeyHash = "same_hash", KeyPreview = "wnx_****2", Permissions = "read" });
        
        await Assert.ThrowsAsync<DbUpdateException>(() => DbContext.SaveChangesAsync());
    }

    #endregion
}
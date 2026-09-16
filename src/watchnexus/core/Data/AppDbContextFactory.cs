using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using WatchNexus.Core.Data;

namespace WatchNexus.Core;

/// <summary>
/// Design-time factory for EF Core migrations. Uses an in-memory SQLite
/// connection so `dotnet ef migrations add` works without booting the
/// full web server or touching a real data directory.
/// </summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        return new AppDbContext(options);
    }
}
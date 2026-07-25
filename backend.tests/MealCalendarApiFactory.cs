using MealCalendar.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace MealCalendar.Api.Tests;

public sealed class MealCalendarApiFactory : WebApplicationFactory<Program>
{
    private readonly string databasePath;
    private readonly int defaultTimeoutSeconds;

    public MealCalendarApiFactory()
        : this(30)
    {
    }

    internal MealCalendarApiFactory(int defaultTimeoutSeconds)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(defaultTimeoutSeconds);

        this.defaultTimeoutSeconds = defaultTimeoutSeconds;
        databasePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db");
    }

    public string DatabasePath => databasePath;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging => logging.ClearProviders());

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<MealCalendarDbContext>();
            services.RemoveAll<DbContextOptions<MealCalendarDbContext>>();
            services.AddDbContext<MealCalendarDbContext>(options => options.UseSqlite(
                $"Data Source={databasePath};Default Timeout={defaultTimeoutSeconds};Pooling=False"));
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();

        foreach (var path in new[] { databasePath, $"{databasePath}-shm", $"{databasePath}-wal" })
        {
            File.Delete(path);
        }
    }
}

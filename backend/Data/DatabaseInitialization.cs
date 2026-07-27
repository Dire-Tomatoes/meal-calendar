using Microsoft.EntityFrameworkCore;

namespace MealCalendar.Api.Data;

public static class DatabaseInitialization
{
    public static async Task InitializeDatabaseAsync(WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MealCalendarDbContext>();

        await context.Database.MigrateAsync();
    }
}

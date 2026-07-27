using System.Net.Http.Json;
using System.Text.Json;
using MealCalendar.Api.Data;
using MealCalendar.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MealCalendar.Api.Tests;

public sealed class MealsEndpointsTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task NewDatabaseStartsWithoutRecipes()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();

        var meals = await client.GetFromJsonAsync<List<MealResponse>>("/api/v1/meals", JsonOptions);

        Assert.NotNull(meals);
        Assert.Empty(meals);
    }

    [Fact]
    public async Task DeletingMealCascadesToScheduledDays()
    {
        await using var factory = new MealCalendarApiFactory();
        using var client = factory.CreateClient();
        using var healthResponse = await client.GetAsync("/api/health");
        healthResponse.EnsureSuccessStatusCode();

        await using (var createScope = factory.Services.CreateAsyncScope())
        {
            var context = createScope.ServiceProvider.GetRequiredService<MealCalendarDbContext>();
            context.Meals.Add(new Meal { Id = "cascade-meal", Name = "Cascade meal", Emoji = "🍽️" });
            context.ScheduleDays.Add(new ScheduleDay { Date = new DateOnly(2026, 7, 26), MealId = "cascade-meal" });
            await context.SaveChangesAsync();
        }

        await using (var deleteScope = factory.Services.CreateAsyncScope())
        {
            var context = deleteScope.ServiceProvider.GetRequiredService<MealCalendarDbContext>();
            var meal = await context.Meals.SingleAsync(entity => entity.Id == "cascade-meal");
            context.Meals.Remove(meal);
            await context.SaveChangesAsync();
        }

        await using var assertScope = factory.Services.CreateAsyncScope();
        var assertContext = assertScope.ServiceProvider.GetRequiredService<MealCalendarDbContext>();
        Assert.Empty(await assertContext.ScheduleDays.ToListAsync());
    }

    private sealed record MealResponse(string Id, string Name, string Emoji, string? ImageUrl);
}

using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace MealCalendar.Api.Tests;

public sealed class MealsEndpointsTests(MealCalendarApiFactory factory) : IClassFixture<MealCalendarApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task GetMealsReturnsStableSeededDefinitions()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v1/meals");

        response.EnsureSuccessStatusCode();
        var meals = await response.Content.ReadFromJsonAsync<List<MealResponse>>(JsonOptions);

        Assert.NotNull(meals);
        Assert.Contains(meals, meal => meal is { Id: "tacos", Name: "Tacos", Emoji: "🌮" });
        Assert.Contains(meals, meal => meal is { Id: "pizza", Name: "Pizza", Emoji: "🍕" });
        Assert.Contains(meals, meal => meal is { Id: "pasta", Name: "Pasta", Emoji: "🍝" });
        Assert.Contains(meals, meal => meal is { Id: "curry", Name: "Curry", Emoji: "🍛" });
        Assert.Equal(meals.Count, meals.Select(meal => meal.Id).Distinct(StringComparer.Ordinal).Count());
        Assert.All(meals, meal =>
        {
            Assert.False(string.IsNullOrWhiteSpace(meal.Name));
            Assert.False(string.IsNullOrWhiteSpace(meal.Emoji));
        });
    }

    private sealed record MealResponse(string Id, string Name, string Emoji, string? ImageUrl);
}

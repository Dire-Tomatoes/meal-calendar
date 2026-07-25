using MealCalendar.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MealCalendar.Api.Data;

public static class MealSeed
{
    private static readonly (string Id, string Name, string Emoji)[] Definitions =
    [
        ("tacos", "Tacos", "🌮"),
        ("pizza", "Pizza", "🍕"),
        ("pasta", "Pasta", "🍝"),
        ("burgers", "Burgers", "🍔"),
        ("curry", "Curry", "🍛"),
        ("stir-fry", "Stir Fry", "🥡"),
        ("soup", "Soup", "🍲"),
        ("leftovers", "Leftovers", "♻️")
    ];

    public static async Task SeedAsync(MealCalendarDbContext context, CancellationToken cancellationToken)
    {
        var definitionIds = Definitions.Select(definition => definition.Id).ToArray();
        var existingMeals = await context.Meals
            .Where(meal => definitionIds.Contains(meal.Id))
            .ToDictionaryAsync(meal => meal.Id, cancellationToken);

        foreach (var definition in Definitions)
        {
            if (existingMeals.TryGetValue(definition.Id, out var meal))
            {
                meal.Name = definition.Name;
                meal.Emoji = definition.Emoji;
                continue;
            }

            context.Meals.Add(new Meal
            {
                Id = definition.Id,
                Name = definition.Name,
                Emoji = definition.Emoji
            });
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}

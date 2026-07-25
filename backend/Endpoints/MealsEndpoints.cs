using MealCalendar.Api.Contracts;
using MealCalendar.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace MealCalendar.Api.Endpoints;

public static class MealsEndpoints
{
    public static IEndpointRouteBuilder MapMealsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/meals", async (MealCalendarDbContext context, CancellationToken cancellationToken) =>
        {
            var meals = await context.Meals
                .AsNoTracking()
                .OrderBy(meal => meal.Name)
                .ToListAsync(cancellationToken);

            var response = meals.Select(meal => new MealResponse(
                meal.Id,
                meal.Name,
                meal.Emoji,
                meal.ImagePath is null
                    ? null
                    : $"/images/meals/{Uri.EscapeDataString(meal.ImagePath)}"))
                .ToList();

            return Results.Ok(response);
        });

        return endpoints;
    }
}

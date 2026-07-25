using System.Globalization;
using MealCalendar.Api.Contracts;
using MealCalendar.Api.Data;
using MealCalendar.Api.Models;
using MealCalendar.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace MealCalendar.Api.Endpoints;

public static class ScheduleEndpoints
{
    public static IEndpointRouteBuilder MapScheduleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/schedule", GetScheduleAsync);
        endpoints.MapPut("/api/v1/schedule/{date}", AssignMealAsync);
        endpoints.MapDelete("/api/v1/schedule/{date}", DeleteMealAsync);

        return endpoints;
    }

    private static async Task<IResult> GetScheduleAsync(
        string? from,
        string? to,
        MealCalendarDbContext context,
        CancellationToken cancellationToken)
    {
        if (!IsoDate.TryParse(from, out var fromDate) || !IsoDate.TryParse(to, out var toDate))
        {
            return ApiProblem.Create(400, "Invalid date", "invalid_date", "Dates must use yyyy-MM-dd format.");
        }

        if (fromDate > toDate)
        {
            return ApiProblem.Create(400, "Invalid range", "invalid_range", "The from date must be on or before the to date.");
        }

        var rows = await context.ScheduleDays
            .AsNoTracking()
            .Where(row => row.Date >= fromDate && row.Date <= toDate)
            .OrderBy(row => row.Date)
            .ToListAsync(cancellationToken);

        return Results.Ok(new ScheduleResponse(rows.ToDictionary(
            row => row.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            row => row.MealId)));
    }

    private static async Task<IResult> AssignMealAsync(
        string date,
        AssignMealRequest? request,
        MealCalendarDbContext context,
        CancellationToken cancellationToken)
    {
        if (!IsoDate.TryParse(date, out var scheduleDate))
        {
            return ApiProblem.Create(400, "Invalid date", "invalid_date", "Dates must use yyyy-MM-dd format.");
        }

        if (string.IsNullOrWhiteSpace(request?.MealId))
        {
            return ApiProblem.Create(400, "Invalid meal", "invalid_meal_id", "A meal ID is required.");
        }

        if (!await context.Meals.AnyAsync(meal => meal.Id == request.MealId, cancellationToken))
        {
            return ApiProblem.Create(404, "Meal not found", "meal_not_found", "The requested meal does not exist.");
        }

        var existing = await context.ScheduleDays
            .SingleOrDefaultAsync(row => row.Date == scheduleDate, cancellationToken);

        if (existing is null)
        {
            context.ScheduleDays.Add(new ScheduleDay { Date = scheduleDate, MealId = request.MealId });
        }
        else
        {
            existing.MealId = request.MealId;
        }

        await context.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static async Task<IResult> DeleteMealAsync(
        string date,
        MealCalendarDbContext context,
        CancellationToken cancellationToken)
    {
        if (!IsoDate.TryParse(date, out var scheduleDate))
        {
            return ApiProblem.Create(400, "Invalid date", "invalid_date", "Dates must use yyyy-MM-dd format.");
        }

        var existing = await context.ScheduleDays
            .SingleOrDefaultAsync(row => row.Date == scheduleDate, cancellationToken);

        if (existing is not null)
        {
            context.ScheduleDays.Remove(existing);
            await context.SaveChangesAsync(cancellationToken);
        }

        return Results.NoContent();
    }
}

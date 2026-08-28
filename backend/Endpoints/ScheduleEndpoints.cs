using System.Globalization;
using MealCalendar.Api.Contracts;
using MealCalendar.Api.Data;
using MealCalendar.Api.Models;
using MealCalendar.Api.Utilities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MealCalendar.Api.Endpoints;

public static class ScheduleEndpoints
{
    public static IEndpointRouteBuilder MapScheduleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/schedule", GetScheduleAsync);
        endpoints.MapPut("/api/v1/schedule/{date}", AssignMealAsync);
        endpoints.MapDelete("/api/v1/schedule/{date}", DeleteMealAsync);
        endpoints.MapPost("/api/v1/schedule/move", MoveMealAsync);

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

        try
        {
            if (!await context.Meals.AnyAsync(meal => meal.Id == request.MealId, cancellationToken))
            {
                return ApiProblem.Create(
                    404,
                    "Meal not found",
                    "meal_not_found",
                    "The requested meal does not exist.");
            }

            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "ScheduleDays" ("Date", "MealId")
                VALUES ({scheduleDate}, {request.MealId})
                ON CONFLICT ("Date") DO UPDATE
                SET "MealId" = excluded."MealId";
                """, cancellationToken);

            return Results.NoContent();
        }
        catch (Exception exception) when (IsSqliteConflict(exception))
        {
            return CreateScheduleConflict();
        }
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

        try
        {
            await context.ScheduleDays
                .Where(row => row.Date == scheduleDate)
                .ExecuteDeleteAsync(cancellationToken);

            return Results.NoContent();
        }
        catch (Exception exception) when (IsSqliteConflict(exception))
        {
            return CreateScheduleConflict();
        }
    }

    private static async Task<IResult> MoveMealAsync(
        MoveMealRequest? request,
        MealCalendarDbContext context,
        CancellationToken cancellationToken)
    {
        if (!IsoDate.TryParse(request?.FromDate, out var fromDate) ||
            !IsoDate.TryParse(request?.ToDate, out var toDate))
        {
            return ApiProblem.Create(400, "Invalid date", "invalid_date", "Dates must use yyyy-MM-dd format.");
        }

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

            var source = await context.ScheduleDays
                .SingleOrDefaultAsync(row => row.Date == fromDate, cancellationToken);

            if (source is null)
            {
                return ApiProblem.Create(
                    404,
                    "Source not found",
                    "source_not_found",
                    "The source date has no scheduled meal.");
            }

            if (fromDate == toDate)
            {
                return Results.NoContent();
            }

            var destination = await context.ScheduleDays
                .SingleOrDefaultAsync(row => row.Date == toDate, cancellationToken);

            if (destination is null)
            {
                context.ScheduleDays.Add(new ScheduleDay { Date = toDate, MealId = source.MealId });
                context.ScheduleDays.Remove(source);
            }
            else
            {
                var displacedMealId = destination.MealId;
                destination.MealId = source.MealId;
                source.MealId = displacedMealId;
            }

            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Results.NoContent();
        }
        catch (Exception exception) when (IsSqliteConflict(exception))
        {
            return CreateScheduleConflict();
        }
    }

    private static IResult CreateScheduleConflict() =>
        ApiProblem.Create(
            409,
            "Schedule conflict",
            "schedule_conflict",
            "The schedule changed while this request was being saved. Refresh and try again.");

    private static bool IsSqliteConflict(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is SqliteException { SqliteErrorCode: 5 or 6 or 19 })
            {
                return true;
            }
        }

        return false;
    }
}

using MealCalendar.Api.Contracts;
using MealCalendar.Api.Data;
using MealCalendar.Api.Images;
using MealCalendar.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MealCalendar.Api.Endpoints;

public static class MealsEndpoints
{
    public static IEndpointRouteBuilder MapMealsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/meals", GetMealsAsync);
        endpoints.MapPost("/api/v1/meals", CreateMealAsync);
        endpoints.MapPut("/api/v1/meals/{id}", UpdateMealAsync);
        endpoints.MapDelete("/api/v1/meals/{id}", DeleteMealAsync);

        return endpoints;
    }

    private static async Task<IResult> GetMealsAsync(
        MealCalendarDbContext context,
        CancellationToken cancellationToken)
    {
        var meals = await context.Meals
            .AsNoTracking()
            .OrderBy(meal => meal.Name)
            .ToListAsync(cancellationToken);

        return Results.Ok(meals.Select(ToResponse).ToList());
    }

    private static async Task<IResult> CreateMealAsync(
        HttpRequest httpRequest,
        MealCalendarDbContext context,
        IMealImageStore imageStore,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        RecipeMutationRequest request;
        try
        {
            request = await RecipeMutationRequest.ReadAsync(httpRequest, cancellationToken);
        }
        catch (InvalidRecipeMutationRequestException exception)
        {
            return InvalidRecipe(exception.Message);
        }

        if (!TryValidate(request, out var name, out var emoji, out var validationProblem))
        {
            return validationProblem;
        }

        string? newFilename = null;
        try
        {
            if (request.Image is not null)
            {
                newFilename = await imageStore.SaveAsync(request.Image, cancellationToken);
            }
        }
        catch (MealImageValidationException exception)
        {
            return InvalidImage(exception.Message);
        }

        var meal = new Meal
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = name,
            Emoji = emoji,
            ImagePath = newFilename
        };

        context.Meals.Add(meal);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await DeleteAfterFailedDatabaseSaveAsync(imageStore, newFilename, loggerFactory.CreateLogger(typeof(MealsEndpoints).FullName!), cancellationToken);
            throw;
        }

        return Results.Created($"/api/v1/meals/{meal.Id}", ToResponse(meal));
    }

    private static async Task<IResult> UpdateMealAsync(
        string id,
        HttpRequest httpRequest,
        MealCalendarDbContext context,
        IMealImageStore imageStore,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        RecipeMutationRequest request;
        try
        {
            request = await RecipeMutationRequest.ReadAsync(httpRequest, cancellationToken);
        }
        catch (InvalidRecipeMutationRequestException exception)
        {
            return InvalidRecipe(exception.Message);
        }

        if (!TryValidate(request, out var name, out var emoji, out var validationProblem))
        {
            return validationProblem;
        }

        if (request.Image is not null && request.RemoveImage)
        {
            return InvalidRecipe("Choose either a replacement image or image removal, not both.");
        }

        var meal = await context.Meals.SingleOrDefaultAsync(entity => entity.Id == id, cancellationToken);
        if (meal is null)
        {
            return RecipeNotFound();
        }

        string? newFilename = null;
        try
        {
            if (request.Image is not null)
            {
                newFilename = await imageStore.SaveAsync(request.Image, cancellationToken);
            }
        }
        catch (MealImageValidationException exception)
        {
            return InvalidImage(exception.Message);
        }

        var previousFilename = meal.ImagePath;
        meal.Name = name;
        meal.Emoji = emoji;
        if (newFilename is not null)
        {
            meal.ImagePath = newFilename;
        }
        else if (request.RemoveImage)
        {
            meal.ImagePath = null;
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await DeleteAfterFailedDatabaseSaveAsync(
                imageStore,
                newFilename,
                loggerFactory.CreateLogger(typeof(MealsEndpoints).FullName!),
                cancellationToken);
            throw;
        }

        if (newFilename is not null || request.RemoveImage)
        {
            await DeleteAfterCommittedMutationAsync(
                imageStore,
                previousFilename,
                loggerFactory.CreateLogger(typeof(MealsEndpoints).FullName!),
                cancellationToken);
        }

        return Results.Ok(ToResponse(meal));
    }

    private static async Task<IResult> DeleteMealAsync(
        string id,
        MealCalendarDbContext context,
        IMealImageStore imageStore,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var meal = await context.Meals.SingleOrDefaultAsync(entity => entity.Id == id, cancellationToken);
        if (meal is null)
        {
            return RecipeNotFound();
        }

        var previousFilename = meal.ImagePath;
        context.Meals.Remove(meal);
        await context.SaveChangesAsync(cancellationToken);
        await DeleteAfterCommittedMutationAsync(
            imageStore,
            previousFilename,
            loggerFactory.CreateLogger(typeof(MealsEndpoints).FullName!),
            cancellationToken);

        return Results.NoContent();
    }

    private static bool TryValidate(
        RecipeMutationRequest request,
        out string name,
        out string emoji,
        out IResult validationProblem)
    {
        name = request.Name?.Trim() ?? string.Empty;
        emoji = request.Emoji?.Trim() ?? string.Empty;
        validationProblem = InvalidRecipe("A name of up to 120 characters and an emoji of up to 16 characters are required.");

        return name.Length is > 0 and <= 120 && emoji.Length is > 0 and <= 16;
    }

    private static MealResponse ToResponse(Meal meal) =>
        new(
            meal.Id,
            meal.Name,
            meal.Emoji,
            meal.ImagePath is null
                ? null
                : $"/images/meals/{Uri.EscapeDataString(meal.ImagePath)}");

    private static IResult InvalidRecipe(string detail) =>
        ApiProblem.Create(400, "Invalid recipe", "invalid_recipe", detail);

    private static IResult InvalidImage(string detail) =>
        ApiProblem.Create(400, "Invalid recipe image", "invalid_recipe_image", detail);

    private static IResult RecipeNotFound() =>
        ApiProblem.Create(404, "Recipe not found", "recipe_not_found", "The requested recipe does not exist.");

    private static async Task DeleteAfterFailedDatabaseSaveAsync(
        IMealImageStore imageStore,
        string? filename,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await imageStore.DeleteManagedAsync(filename, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Could not clean up uploaded recipe image {Filename} after database failure.", filename);
        }
    }

    private static async Task DeleteAfterCommittedMutationAsync(
        IMealImageStore imageStore,
        string? filename,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await imageStore.DeleteManagedAsync(filename, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Could not delete managed recipe image {Filename} after database commit.", filename);
        }
    }

}

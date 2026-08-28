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

        if (!TryValidate(request, out var values, out var validationProblem))
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
            Name = values.Name,
            Emoji = values.Emoji,
            ImagePath = newFilename,
            Notes = values.Notes,
            SourceUrl = values.SourceUrl,
            Tags = string.Join(',', values.Tags),
            IsFavorite = values.IsFavorite
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

        if (!TryValidate(request, out var values, out var validationProblem))
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
        meal.Name = values.Name;
        meal.Emoji = values.Emoji;
        meal.Notes = values.Notes;
        meal.SourceUrl = values.SourceUrl;
        meal.Tags = string.Join(',', values.Tags);
        meal.IsFavorite = values.IsFavorite;
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
        out ValidatedRecipe values,
        out IResult validationProblem)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        var emoji = request.Emoji?.Trim() ?? string.Empty;
        var notes = request.Notes?.Trim() ?? string.Empty;
        var sourceUrl = string.IsNullOrWhiteSpace(request.SourceUrl)
            ? null
            : request.SourceUrl.Trim();
        var tags = (request.Tags ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        values = new(name, emoji, notes, sourceUrl, tags, request.IsFavorite);
        validationProblem = InvalidRecipe("A name of up to 120 characters and emoji icons of up to 64 characters are required.");

        if (name.Length is 0 or > 120 || emoji.Length is 0 or > 64)
        {
            return false;
        }

        if (notes.Length > 2000 ||
            tags.Length > 10 ||
            tags.Any(tag => tag.Length > 30))
        {
            validationProblem = InvalidRecipe("Notes must be at most 2,000 characters and tags are limited to ten labels of 30 characters.");
            return false;
        }

        if (sourceUrl is not null &&
            (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri) ||
             uri.Scheme is not ("http" or "https") ||
             sourceUrl.Length > 500))
        {
            validationProblem = InvalidRecipe("The source URL must be an absolute HTTP or HTTPS URL of at most 500 characters.");
            return false;
        }

        return true;
    }

    private static MealResponse ToResponse(Meal meal) =>
        new(
            meal.Id,
            meal.Name,
            meal.Emoji,
            meal.ImagePath is null
                ? null
                : $"/images/meals/{Uri.EscapeDataString(meal.ImagePath)}",
            meal.Notes,
            meal.SourceUrl,
            meal.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            meal.IsFavorite);

    private sealed record ValidatedRecipe(
        string Name,
        string Emoji,
        string Notes,
        string? SourceUrl,
        IReadOnlyList<string> Tags,
        bool IsFavorite);

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

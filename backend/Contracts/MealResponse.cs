namespace MealCalendar.Api.Contracts;

public sealed record MealResponse(
    string Id,
    string Name,
    string Emoji,
    string? ImageUrl,
    string Notes,
    string? SourceUrl,
    IReadOnlyList<string> Tags,
    bool IsFavorite);

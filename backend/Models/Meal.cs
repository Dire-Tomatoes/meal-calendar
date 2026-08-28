namespace MealCalendar.Api.Models;

public sealed class Meal
{
    public required string Id { get; init; }
    public required string Name { get; set; }
    public required string Emoji { get; set; }
    public string? ImagePath { get; set; }
    public string Notes { get; set; } = "";
    public string? SourceUrl { get; set; }
    public string Tags { get; set; } = "";
    public bool IsFavorite { get; set; }
    public ICollection<ScheduleDay> ScheduleDays { get; } = [];
}
